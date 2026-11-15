// scoring.js
// Rule-based, explainable scoring of crop rotations. No machine learning, no AI.
// Every score comes back with the plain-language reasons behind it.
// Inputs: rotation + crop table + field indicators + soil + farmer sliders. Output: scores + reasons.

const LEVEL = { low: 1, shallow: 1, medium: 2, high: 3, deep: 3 };
const LEVEL_WORD = { 1: 'low', 2: 'medium', 3: 'high' };
// Soil textures in the farm form. Sandy ones hold the least water.
const SOIL_TEXTURES = ['Sand', 'Loamy sand', 'Sandy loam', 'Loam', 'Silt loam', 'Clay loam', 'Clay'];
const SANDY_TEXTURES = ['Sand', 'Loamy sand', 'Sandy loam'];

const PRIORITIES = {
  water: 'Save water',
  soil: 'Build soil health',
  income: 'Extra income',
  forage: 'Forage',
  erosion: 'Reduce erosion',
};

// Scoring rules, as named numbers so they are easy to find and explain.
const RULES = {
  // Soil health points (max 100)
  SOIL_WINTER_COVER: 40,   // full points if every winter has a living crop
  SOIL_NITROGEN: 25,       // full points if every year has a nitrogen-fixing crop
  SOIL_DEEP_ROOTS: 15,     // any deep-rooted crop in the rotation
  SOIL_PER_EXTRA_FAMILY: 10, // each extra plant family (grass, legume, brassica), up to 2
  // Water: extra points lost on a rain-fed field, per dry summer month, by a high-water crop
  WATER_DRY_MONTH_PENALTY: 10,
  // Water: extra points lost by high-water crops on sandy soil, which holds less water
  WATER_SANDY_PENALTY: 10,
  // Income: harvests per year that earn full points
  INCOME_FULL_HARVESTS: 1.5,
  FORAGE_HARVEST_VALUE: 0.5, // hay or grazing counts as half a cash harvest (needs livestock or a buyer)
  HEAT_PENALTY_PER_DAY: 0.5, // per recent hot day, per step of missing heat tolerance
  HEAT_PENALTY_MAX: 30,
  FROST_PENALTY: 10,       // per frost-sensitive crop whose window crosses the usual frost dates
  // Erosion: every month gets this small base weight, plus its extreme-rain days
  EROSION_BASE_WEIGHT: 0.05,
  // Soil warning signs: a month is a "heavy-rain month" if it averages more than this many
  // days a year over 50 mm. Same cut-off already used in scoreErosion and vulnerableMonths.
  HEAVY_RAIN_MONTH: 0.05,
  // Soil warning signs: slope (%) at which bare ground washes away more easily.
  // Same 7% line the soil card already uses in app.js.
  STEEP_SLOPE_PCT: 7,
};

// ---------- reading the CSV tables ----------

// Simple CSV reader. Our CSV files never put commas inside a value.
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const row = {};
    header.forEach((key, i) => { row[key] = (cells[i] || '').trim(); });
    return row;
  });
}

function parseCrops(rows) {
  const crops = {};
  for (const r of rows) {
    crops[r.id] = {
      ...r,
      start: Number(r.start_month),
      end: Number(r.end_month),
      water: LEVEL[r.water_need],
      heat: LEVEL[r.heat_tolerance],
      frost: LEVEL[r.frost_tolerance],
      roots: LEVEL[r.root_depth],
      fixesN: r.nitrogen_fixing === 'yes',
      forageValue: LEVEL[r.forage_value],
    };
  }
  return crops;
}

// "corn>cereal_rye;soybean>bare" -> years [{main: corn, winter: cereal_rye}, {main: soybean, winter: null}]
function parseRotations(rows, crops) {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    region: r.region || 'any', // east = humid rain-fed (Virginia), west = dry irrigated (Nevada)
    description: r.description,
    years: r.sequence.split(';').map(year => {
      const [main, winter] = year.split('>');
      return { main: crops[main] || null, winter: crops[winter] || null };
    }),
  }));
}

// ---------- calendar: which months have a living crop ----------

// Is month m inside a crop's window? Handles windows that wrap past December.
function inWindow(crop, m) {
  if (!crop) return false;
  return crop.start <= crop.end ? m >= crop.start && m <= crop.end
                                : m >= crop.start || m <= crop.end;
}

// For each month, the share of rotation years (0 to 1) when something is growing.
// A winter crop planted in year i covers the fall of year i and the spring of year i+1.
function coverageByMonth(rotation) {
  const years = rotation.years;
  const cover = [];
  for (let m = 1; m <= 12; m++) {
    let covered = 0;
    years.forEach((y, i) => {
      const prev = years[(i - 1 + years.length) % years.length];
      const main = y.main && (y.main.season === 'perennial' || y.main.start <= y.main.end)
        ? inWindow(y.main, m) : false;
      const winterNow = y.winter && m >= y.winter.start && inWindow(y.winter, m);
      const winterPrev = prev.winter && prev.winter.start > prev.winter.end &&
                         m <= prev.winter.end;
      if (main || winterNow || winterPrev) covered++;
    });
    cover.push(covered / years.length);
  }
  return cover;
}

function allCrops(rotation) {
  const list = [];
  for (const y of rotation.years) for (const c of [y.main, y.winter]) if (c) list.push(c);
  return list;
}

function uniqueCrops(rotation) {
  return [...new Map(allCrops(rotation).map(c => [c.id, c])).values()];
}

const round = x => Math.round(x);
const clamp = x => Math.max(0, Math.min(100, x));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayOfMid = m => [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][m - 1];

// ---------- the five sub-scores ----------

function scoreWater(rotation, field) {
  // Normally the main crops; a cycle with no main crop is judged on whatever it does grow.
  const mainCrops = rotation.years.map(y => y.main).filter(Boolean);
  const mains = mainCrops.length ? mainCrops : allCrops(rotation);
  if (!mains.length) return { score: 100, reasons: ['No crop in this cycle, so no crop water need.'] };
  const avgNeed = mains.reduce((s, c) => s + c.water, 0) / mains.length;
  let score = (3 - avgNeed) / 2 * 100;
  const reasons = [`Main crops have ${LEVEL_WORD[Math.round(avgNeed)]} average water need (crop table).`];
  const drySummer = field.ind.monthly.filter(m => [6, 7, 8].includes(m.month) &&
                                                  m.wetAnomaly !== null && m.wetAnomaly < THRESHOLDS.DRY_SOIL_ANOMALY);
  const highShare = mains.filter(c => c.water === 3).length / mains.length;
  if (!field.irrigated && drySummer.length && highShare > 0) {
    const penalty = highShare * RULES.WATER_DRY_MONTH_PENALTY * drySummer.length;
    score -= penalty;
    reasons.push(`Rain-fed field: root-zone soil was drier than normal in ${drySummer.map(m => m.name).join(', ')} ` +
                 `in recent years (NASA POWER), so thirsty crops lose ${round(penalty)} points.`);
  }
  if (!field.irrigated && SANDY_TEXTURES.includes(field.texture) && highShare > 0) {
    score -= highShare * RULES.WATER_SANDY_PENALTY;
    reasons.push(`${field.texture} soil holds less water, so thirsty crops lose ${round(highShare * RULES.WATER_SANDY_PENALTY)} more points.`);
  }
  return { score: clamp(score), reasons };
}

function scoreSoil(rotation, field) {
  const years = rotation.years;
  const winterCovered = years.filter(y => y.winter || (y.main && y.main.season === 'perennial')).length / years.length;
  const nYears = years.filter(y => (y.main && y.main.fixesN) || (y.winter && y.winter.fixesN)).length / years.length;
  const crops = uniqueCrops(rotation);
  const deep = crops.filter(c => c.roots === 3);
  const families = new Set(crops.map(c => c.family));
  const score = winterCovered * RULES.SOIL_WINTER_COVER + nYears * RULES.SOIL_NITROGEN +
    (deep.length ? RULES.SOIL_DEEP_ROOTS : 0) +
    Math.min(2, families.size - 1) * RULES.SOIL_PER_EXTRA_FAMILY;
  const reasons = [
    `Living roots in ${round(winterCovered * 100)}% of winters.`,
    `Nitrogen-fixing crop in ${round(nYears * 100)}% of years.`,
    deep.length ? `Deep roots from ${deep.map(c => c.name).join(', ')}.` : 'No deep-rooted crop.',
    `${families.size} plant famil${families.size === 1 ? 'y' : 'ies'} (${[...families].join(', ')}).`,
  ];
  if (field.soil && field.soil.om_r) {
    reasons.push(`Your topsoil has about ${field.soil.om_r}% organic matter (USDA soil survey); roots and residue add to it.`);
  }
  return { score: clamp(score), reasons };
}

function scoreErosion(rotation, field, cover) {
  const weights = field.ind.monthly.map(m => m.extremeRainPerYear + RULES.EROSION_BASE_WEIGHT);
  const total = weights.reduce((a, b) => a + b, 0);
  const protectedShare = cover.reduce((s, c, i) => s + c * weights[i], 0) / total;
  const reasons = [`Soil is covered in ${round(protectedShare * 100)}% of the time that matters, weighted by when heavy rain falls (NASA POWER).`];
  const exposed = field.ind.monthly.filter((m, i) => cover[i] < 1 && m.extremeRainPerYear > RULES.HEAVY_RAIN_MONTH)
                                   .map(m => m.name);
  if (exposed.length) reasons.push(`Bare in some years during heavy-rain months: ${exposed.join(', ')}.`);
  if (field.soil && Number(field.soil.slope_r) >= RULES.STEEP_SLOPE_PCT) {
    reasons.push(`Your soil sits on about ${field.soil.slope_r}% slope (USDA soil survey), so cover matters more.`);
  }
  return { score: clamp(protectedShare * 100), reasons };
}

// Frost-sensitive crops whose growing window crosses the field's usual frost dates.
function frostRisks(rotation, field) {
  const risks = [];
  const last = field.ind.medianLastSpringFrost, first = field.ind.medianFirstFallFrost;
  for (const c of uniqueCrops(rotation)) {
    if (c.frost !== 1 || c.start > c.end) continue;
    if (last !== null && dayOfMid(c.start) < last) {
      risks.push(`${c.name} planted mid-${MONTHS[c.start - 1]} is before the usual last spring frost (${dayToDateLabel(last)}).`);
    }
    if (first !== null && dayOfMid(c.end) > first) {
      risks.push(`${c.name} still growing mid-${MONTHS[c.end - 1]} is after the usual first fall frost (${dayToDateLabel(first)}).`);
    }
  }
  return risks;
}

function scoreIncome(rotation, field) {
  // Hay counts as a full harvest only if the farmer says they can sell it or feed it.
  const forageValue = field.sellsForage ? 1 : RULES.FORAGE_HARVEST_VALUE;
  let harvests = 0;
  for (const y of rotation.years) {
    // A perennial like alfalfa fills both slots of a year, so count it only once.
    const slots = y.winter === y.main ? [y.main] : [y.main, y.winter];
    for (const c of slots) {
      if (!c) continue;
      if (c.role === 'cash') harvests += 1;
      if (c.role === 'forage' && c === y.main) harvests += forageValue;
    }
  }
  const perYear = harvests / rotation.years.length;
  let score = perYear / RULES.INCOME_FULL_HARVESTS * 100;
  const reasons = [`About ${perYear.toFixed(1)} harvests a year (counted, not dollars; local prices not checked).`];
  if (allCrops(rotation).some(c => c.role === 'forage')) {
    reasons.push(field.sellsForage ? 'Hay counts as a full harvest because you said you can sell or feed it.'
                                   : 'Hay counts as half a harvest because you did not say you can sell or feed it.');
  }

  const hotDays = field.ind.heat.recent || 0;
  const summer = rotation.years.map(y => y.main).filter(c => c && c.season !== 'cool');
  const missingTolerance = summer.reduce((s, c) => s + (3 - c.heat), 0) / Math.max(1, summer.length);
  const heatPenalty = Math.min(RULES.HEAT_PENALTY_MAX, hotDays * missingTolerance * RULES.HEAT_PENALTY_PER_DAY);
  if (heatPenalty > 0) {
    score -= heatPenalty;
    reasons.push(`Recent summers average ${hotDays.toFixed(0)} days above 90 °F / 32 °C (NASA POWER); ` +
                 `heat-sensitive crops put yield at risk (−${round(heatPenalty)}).`);
  }
  const frost = frostRisks(rotation, field);
  if (frost.length) {
    score -= frost.length * RULES.FROST_PENALTY;
    reasons.push(`Frost timing risk for ${frost.length} crop window(s) (NASA POWER frost dates).`);
  }
  return { score: clamp(score), reasons, frost };
}

function scoreForage(rotation) {
  const values = rotation.years.map(y => Math.max(y.main ? y.main.forageValue : 0,
                                                  y.winter ? y.winter.forageValue : 0));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const best = uniqueCrops(rotation).filter(c => c.forageValue === 3).map(c => c.name);
  return {
    score: clamp(avg / 3 * 100),
    reasons: [best.length ? `High-value forage from ${best.join(', ')} (crop table).`
                          : 'No high-value forage crop; some grazing from small grains or covers.'],
  };
}

// ---------- the whole rotation ----------

function scoreRotation(rotation, field, weights) {
  const cover = coverageByMonth(rotation);
  const sub = {
    water: scoreWater(rotation, field),
    soil: scoreSoil(rotation, field),
    income: scoreIncome(rotation, field),
    forage: scoreForage(rotation),
    erosion: scoreErosion(rotation, field, cover),
  };
  let weightSum = 0, total = 0;
  for (const key of Object.keys(PRIORITIES)) {
    const w = weights[key] || 0;
    weightSum += w;
    total += w * sub[key].score;
  }
  if (weightSum === 0) { // all sliders at zero: treat every priority equally
    total = Object.values(sub).reduce((s, x) => s + x.score, 0) / 5;
  } else total /= weightSum;

  return {
    rotation,
    total: round(total),
    sub,
    cover,
    bareMonths: cover.map((c, i) => (c < 1 ? MONTHS[i] : null)).filter(Boolean),
    frostRisks: sub.income.frost,
  };
}

// Seasons when the crops in the ground look vulnerable: heat, dry soil, or bare during heavy rain.
function vulnerableMonths(result, field) {
  return field.ind.monthly.map((m, i) => {
    const flags = [];
    const growing = result.cover[i] > 0;
    if (growing && m.heatDaysPerYear >= 3) flags.push('heat');
    if (growing && m.wetAnomaly !== null && m.wetAnomaly < THRESHOLDS.DRY_SOIL_ANOMALY) flags.push('dry soil');
    if (result.cover[i] < 1 && m.extremeRainPerYear > RULES.HEAVY_RAIN_MONTH) flags.push('bare in heavy rain');
    if (result.cover[i] < 1 && field.ind.ndvi.available && field.ind.ndvi.byMonth[i].bare) flags.push('bare (satellite)');
    return { month: m.name, flags };
  });
}

// ---------- the five boxes ----------

function buildExplanation(result, current, field, weights) {
  const r = result.rotation;
  const isCurrent = r.id === current.rotation.id;
  const ranked = Object.keys(PRIORITIES)
    .filter(k => weights[k] > 0)
    .sort((a, b) => weights[b] * result.sub[b].score - weights[a] * result.sub[a].score);

  const why = isCurrent
    ? ['What you grow now, shown for comparison.']
    : [`Scores well on what you weighted most: ${ranked.slice(0, 2)
        .map(k => `${PRIORITIES[k].toLowerCase()} (${round(result.sub[k].score)})`).join(' and ')}.`,
       r.description];

  const evidence = [];
  for (const k of ranked.slice(0, 2)) evidence.push(...result.sub[k].reasons);
  if (field.ind.ndvi.available) {
    const bare = field.ind.ndvi.byMonth.filter(m => m.bare).map(m => m.name);
    evidence.push(bare.length
      ? `Satellite greenness (MODIS NDVI) shows low plant cover on this spot in ${bare.join(', ')}.`
      : 'Satellite greenness (MODIS NDVI) shows this spot is usually green all year.');
  }

  const benefits = [];
  const fewerBare = current.bareMonths.length - result.bareMonths.length;
  if (!isCurrent) {
    if (fewerBare > 0) benefits.push(`${fewerBare} fewer months with bare ground in some years than your current rotation.`);
    const curN = allCrops(current.rotation).some(c => c.fixesN);
    if (!curN && allCrops(r).some(c => c.fixesN)) benefits.push('Adds a nitrogen-fixing legume, which can cut fertilizer needs.');
    const curFam = new Set(allCrops(current.rotation).map(c => c.family));
    const newFam = [...new Set(allCrops(r).map(c => c.family))].filter(f => !curFam.has(f));
    if (newFam.length) benefits.push(`Adds a new plant family (${newFam.join(', ')}), which may interrupt pests and diseases that build up on your current crops.`);
    for (const k of Object.keys(PRIORITIES)) {
      const d = result.sub[k].score - current.sub[k].score;
      if (d >= 10) benefits.push(`${PRIORITIES[k]} score ${round(d)} points higher than now.`);
    }
  } else {
    benefits.push('No change in equipment, markets, or know-how.');
  }
  if (!benefits.length) benefits.push('Similar to your current rotation on most measures.');

  // Gaps about this field come first, then the limits that hold for every field.
  // The page shows the first three and tucks the rest behind "show all".
  const unknowns = [];
  const general = [
    'Crop trait ratings are our reading of extension sources and have not been checked by an agronomist yet.',
    'Yields under your soil and weather are not modeled.',
    'Local prices and markets were not checked, so income is counted in harvests, not dollars.',
    'NASA POWER weather is for a grid cell about 50 km wide, not your exact field.',
  ];
  if (field.ind.ndvi.available) {
    general.push('A MODIS pixel is 250 m wide and may include land next to your field.');
    // MOD13Q1 makes 23 images a year (one per 16 days). Say so if some were never saved.
    const pts = field.ind.ndvi.points;
    const expected = 23 * new Set(pts.map(p => p.year)).size;
    if (pts.length < expected) {
      unknowns.push(`Only ${pts.length} of about ${expected} satellite greenness images were saved; the rest failed to download.`);
    }
  }
  else unknowns.push('Satellite greenness (NDVI) is missing for this field, so bare-field timing comes only from the crop calendar.');
  if (field.irrigated && result.sub.income.reasons.some(t => t.includes('heat-sensitive'))) {
    unknowns.push('The heat penalty treats irrigated and rain-fed fields the same; watering may ease heat stress here.');
  }
  if (field.region === 'west' || field.picked) {
    unknowns.push('Planting months come from a Virginia calendar and may not fit this region.');
  }
  if (field.region === 'west') {
    unknowns.push(field.picked
      ? 'Western rotations were built from crops CropScape records near Fallon, Nevada, not from a guide for your area.'
      : 'Western rotations were built from crops CropScape records near this field, not from a local extension guide.');
  }
  if (field.picked) {
    unknowns.push('This field was picked on the map, so its region (East or dry West) comes only from which side of the 100th meridian it sits on.');
  }
  if (field.ind.missingDays) unknowns.push(`${field.ind.missingDays} days of weather data were missing and were skipped.`);
  unknowns.push(...general);

  const checkLocally = [...result.frostRisks];
  if (allCrops(r).some(c => c.role === 'cover')) checkLocally.push('When to end the cover crop before planting, and whether any herbicide you use limits cover crop choices.');
  if (allCrops(r).some(c => c.role === 'forage')) checkLocally.push('Whether you have hay equipment, livestock, or a buyer for forage.');
  const base = id => id.replace('_double', ''); // double-crop soybean is still soybean to a buyer
  const cashNew = uniqueCrops(r).filter(c => c.role === 'cash' &&
    !allCrops(current.rotation).some(x => base(x.id) === base(c.id)));
  if (cashNew.length) checkLocally.push(`Whether there is a nearby buyer for ${cashNew.map(c => c.name.toLowerCase()).join(', ')}.`);
  checkLocally.push('Talk these options through with your Cooperative Extension agent.');

  return { why, evidence, benefits, unknowns, checkLocally };
}

// ---------- soil warning signs ----------

// Four signs that a crop cycle wears soil down, checked for one rotation on one field.
// The first three follow USDA NRCS soil health advice ("maximize cover", "support living
// roots", "promote biodiversity") and the legume entries in VCE and SARE. The fourth
// (thirsty crops in drying months) is our own check on NASA POWER soil wetness.
// Returns { id, label, lit, number, reason, source } for each sign. lit = the warning is on.
function soilWarnings(result, field) {
  const r = result.rotation;
  const months = field.ind.monthly;
  const cover = result.cover;

  // 1. Erosion: bare ground in months when heavy rain falls.
  const exposed = months.filter((m, i) => cover[i] < 1 && m.extremeRainPerYear > RULES.HEAVY_RAIN_MONTH);
  const slope = field.soil ? Number(field.soil.slope_r) : null;
  const steep = slope !== null && slope >= RULES.STEEP_SLOPE_PCT;
  const erosion = {
    id: 'erosion', label: 'Soil washing away',
    lit: exposed.length > 0,
    number: `${exposed.length} heavy-rain month${exposed.length === 1 ? '' : 's'} with bare ground`,
    reason: exposed.length
      ? `Ground is bare in some years during ${exposed.map(m => m.name).join(', ')}, when days with over 2 in (50 mm) of rain happen` +
        (steep ? `, on a ${slope}% slope.` : '.')
      : 'Something is growing in every month when heavy rain usually falls.',
    source: steep ? 'NASA POWER rain + USDA soil survey slope + crop calendar' : 'NASA POWER rain + crop calendar',
  };

  // 2. Organic-matter loss: winters with no living roots feeding the soil.
  const years = r.years;
  const winterRoots = years.filter(y => y.winter || (y.main && y.main.season === 'perennial')).length / years.length;
  const organic = {
    id: 'organic', label: 'Soil losing organic matter',
    lit: winterRoots < 1,
    number: `Living roots in ${round(winterRoots * 100)}% of winters`,
    reason: winterRoots < 1
      ? `${result.bareMonths.length} month${result.bareMonths.length === 1 ? '' : 's'} a year can sit bare, so no roots or residue feed the soil then.`
      : 'A crop or cover crop holds the ground every winter, so roots keep feeding the soil.',
    source: 'Crop calendar' + (field.ind.ndvi.available ? ' + MODIS NDVI' : ''),
  };

  // 3. Nitrogen loss: no legume anywhere in the cycle.
  const legumes = uniqueCrops(r).filter(c => c.fixesN);
  const nitrogen = {
    id: 'nitrogen', label: 'Nitrogen running down',
    lit: legumes.length === 0,
    number: legumes.length ? `Legume: ${legumes.map(c => c.name).join(', ')}` : 'No legume in the cycle',
    reason: legumes.length
      ? 'A nitrogen-fixing legume puts some nitrogen back into the soil.'
      : 'No crop in this cycle fixes nitrogen, so all of it has to come from fertilizer.',
    source: 'Crop table (VCE, SARE)',
  };

  // 4. Drying soil: thirsty crops on a rain-fed field in months when NASA POWER shows drier root-zone soil.
  const dryMonths = months.filter(m => m.wetAnomaly !== null && m.wetAnomaly < THRESHOLDS.DRY_SOIL_ANOMALY);
  const thirsty = uniqueCrops(r).filter(c => c.water === 3 &&
    dryMonths.some(m => inWindow(c, m.month)));
  const drying = {
    id: 'drying', label: 'Thirsty crops in drying months',
    lit: !field.irrigated && thirsty.length > 0,
    number: dryMonths.length ? `${dryMonths.length} month${dryMonths.length === 1 ? '' : 's'} drier than usual` : 'No month drier than usual',
    reason: field.irrigated
      ? 'Irrigated field, so drier months matter less for this check.'
      : thirsty.length
        ? `${thirsty.map(c => c.name).join(', ')} need${thirsty.length === 1 ? 's' : ''} a lot of water and grow${thirsty.length === 1 ? 's' : ''} in ${dryMonths.filter(m => thirsty.some(c => inWindow(c, m.month))).map(m => m.name).join(', ')}, when root-zone soil was drier than usual in ${THRESHOLDS.RECENT_YEARS.join('–')}.`
        : 'No high-water crop grows in the months when soil was drier than usual.',
    source: 'NASA POWER soil wetness (GWETROOT) + crop table',
  };

  return [erosion, organic, nitrogen, drying];
}

// ---------- RUSLE: the soil erosion equation ----------

// The Revised Universal Soil Loss Equation (USDA Agriculture Handbook 703, Renard et al. 1997):
//   A (soil loss) = R (rain erosivity) × K (soil erodibility) × LS (slope) × C (cover) × P (practices)
// We do NOT compute A in tons per acre: R needs 30-minute storm intensity (NASA POWER is daily),
// slope length is unknown, and C needs crop-stage tables we have not sourced. Instead we show each
// factor with the real value we have, or say plainly that it is missing.
// status: 'measured' (real value), 'partial' (a stand-in, explained), 'unknown' (no data).
function erosionFactors(result, field) {
  const months = field.ind.monthly;
  const rainy = months.filter(m => m.extremeRainPerYear > RULES.HEAVY_RAIN_MONTH).map(m => m.name);
  const soil = field.soil || {};
  const k = soil.kwfact ? Number(soil.kwfact) : null;
  const slope = soil.slope_r ? Number(soil.slope_r) : null;
  const cover = round(result.sub.erosion.score);
  // The cover share comes from the crop calendar. If satellites saw low cover in heavy-rain
  // months, say so: real cover may be lower than the calendar suggests.
  const satBare = field.ind.ndvi.available
    ? field.ind.ndvi.byMonth.filter((m, i) => m.bare && months[i].extremeRainPerYear > RULES.HEAVY_RAIN_MONTH).map(m => m.name) : [];
  return [
    { id: 'R', name: 'Rain power', term: 'rainfall erosivity', status: 'partial',
      value: field.ind.extremeRain.recent !== null ? `${field.ind.extremeRain.recent.toFixed(1)} heavy-rain days a year` : 'n/a',
      note: `Days with over 2 in (50 mm) of rain, most often in ${rainy.join(', ') || 'no month'}. True R needs 30-minute storm intensity; NASA POWER is daily, so this is a stand-in.`,
      source: 'NASA POWER' },
    { id: 'K', name: 'Soil erodibility', term: 'K factor', status: k === null ? 'unknown' : 'measured',
      value: k === null ? 'Not in soil survey' : k.toFixed(2),
      note: k === null ? 'No soil survey value saved for this field.'
                       : `How easily this soil's particles wash away; higher means easier. From the USDA soil survey for ${soil.compname || 'this'} soil (${(soil.texdesc || '').toLowerCase()}).`,
      source: 'USDA soil survey (SSURGO Kw)' },
    { id: 'LS', name: 'Slope', term: 'length-slope factor', status: slope === null ? 'unknown' : 'partial',
      value: slope === null ? 'Unknown' : `${slope}% slope`,
      note: 'Steeper ground loses more soil. Slope length is not known, so LS itself is not computed.',
      source: 'USDA soil survey' },
    { id: 'C', name: 'Cover', term: 'cover-management factor', status: 'partial', changes: true,
      value: `${cover}% covered`,
      note: 'Share of the heavy-rain season when a crop or cover crop is growing, from the crop calendar. This is the factor your crop rotation changes.' +
        (satBare.length ? ` Satellites saw low plant cover in ${satBare.join(', ')}, so real cover may be lower.` : ''),
      source: 'Crop calendar + NASA POWER' + (field.ind.ndvi.available ? ' + MODIS NDVI' : '') },
    { id: 'P', name: 'Conservation practices', term: 'support practice factor', status: 'unknown',
      value: 'Ask the farmer',
      note: 'Contour farming, strips or terraces cut soil loss. Satellites cannot see these, so we leave them out.',
      source: 'Not in our data' },
  ];
}

// Score every rotation, keep the current one, and pick the two best alternatives.
function compareRotations(rotations, currentId, field, weights, constraints = {}) {
  // Only rotations meant for this field's region, and no hay crops if the farmer has no hay equipment.
  const inRegion = r => !field.region || r.region === 'any' || r.region === field.region;
  const allowed = r => inRegion(r) && !(constraints.noHay && allCrops(r).some(c => c.role === 'forage'));
  const current = scoreRotation(rotations.find(r => r.id === currentId), field, weights);
  // "I want to grow ...": when the farmer names a crop, both alternatives must include it.
  const wanted = r => !constraints.wantCrop || allCrops(r).some(c => c.id === constraints.wantCrop);
  const alternatives = rotations
    .filter(r => r.id !== currentId && allowed(r) && wanted(r))
    .map(r => scoreRotation(r, field, weights))
    .sort((a, b) => b.total - a.total)
    .slice(0, 2);
  const currentWarnings = soilWarnings(current, field);
  return [current, ...alternatives].map(res => {
    const warnings = res === current ? currentWarnings : soilWarnings(res, field);
    return {
      ...res,
      isCurrent: res === current,
      explain: buildExplanation(res, current, field, weights),
      vulnerable: vulnerableMonths(res, field),
      warnings,
      // Warning signs that are on for the current rotation but off for this one.
      fixes: warnings.filter((w, i) => !w.lit && currentWarnings[i].lit).map(w => w.id),
      // Warning signs that are off now but this rotation would turn on.
      adds: warnings.filter((w, i) => w.lit && !currentWarnings[i].lit).map(w => w.id),
    };
  });
}

// The three lines of the "Your answer" card, built only from results already worked out above:
// the biggest risk with what the farmer grows now, the option that fits their priorities best,
// and the first thing to check locally. results: what compareRotations returns.
function answerLines(results) {
  const [current, ...alts] = results;
  const lit = current.warnings.filter(w => w.lit);
  const risk = lit.length
    ? `${lit[0].label}. ${lit[0].reason}`
    : 'None of our four soil warning signs is on for what you grow now.';
  const top = alts.length ? alts.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  if (!top || top.total <= current.total) {
    return {
      risk,
      option: `What you grow now (${current.total}/100) fits your priorities as well as any option we checked.`,
      check: current.explain.checkLocally[0],
    };
  }
  const label = id => current.warnings.find(w => w.id === id).label.toLowerCase();
  const clears = lit.length && top.fixes.length
    ? ` Clears ${top.fixes.length} of ${lit.length} warning sign${lit.length === 1 ? '' : 's'}.` : '';
  const adds = top.adds.length ? ` Adds one: ${top.adds.map(label).join(', ')}.` : '';
  return {
    risk,
    option: `“${top.rotation.name}”: ${top.total}/100 fit, against ${current.total} now.${clears}${adds}`,
    check: top.explain.checkLocally[0],
  };
}

// ---------- the plan walkthrough (My farm > Open plan) ----------

// Which crop holds the ground in each month of each year of a cycle, or null for bare.
// Same rules as coverageByMonth, but kept year by year instead of averaged.
function planCalendar(rotation) {
  const years = rotation.years;
  return years.map((y, i) => {
    const prev = years[(i - 1 + years.length) % years.length];
    return MONTHS.map((_, k) => {
      const m = k + 1;
      if (y.main && (y.main.season === 'perennial' || y.main.start <= y.main.end) && inWindow(y.main, m)) return y.main;
      if (y.winter && m >= y.winter.start && inWindow(y.winter, m)) return y.winter;
      if (prev.winter && prev.winter.start > prev.winter.end && m <= prev.winter.end) return prev.winter;
      return null;
    });
  });
}

const ROLE_NOTE = {
  cash: 'A crop to harvest and sell.',
  cover: 'A cover crop: grown to protect and feed the soil, not to sell.',
  forage: 'A hay or forage crop.',
};

// The steps of the walkthrough for one option: what goes in the ground, in order, year by year,
// what that means for the soil on this field, the bare gaps, and a closing step.
// result and current come from compareRotations. Returns
// [{ year, kind: 'crop' | 'bare' | 'summary', title, cells: [{ year, month }], notes: [text] }].
// Only uses facts already in the crop table and the field's NASA and soil data. No yields, prices or dates.
function planSteps(result, current, field) {
  const r = result.rotation;
  const calendar = planCalendar(r);
  const monthly = field.ind.monthly;
  const names = cells => [...new Set(cells.map(c => c.month))].sort((a, b) => a - b).map(m => MONTHS[m - 1]).join(', ');
  const heavy = c => monthly[c.month - 1].extremeRainPerYear > RULES.HEAVY_RAIN_MONTH;
  const dry = c => monthly[c.month - 1].wetAnomaly !== null && monthly[c.month - 1].wetAnomaly < THRESHOLDS.DRY_SOIL_ANOMALY;
  const span = cells => (cells.length === 1 ? MONTHS[cells[0].month - 1]
    : `${MONTHS[cells[0].month - 1]} to ${MONTHS[cells[cells.length - 1].month - 1]}`);
  const steps = [];

  calendar.forEach((months, i) => {
    const year = i + 1;
    const yearSteps = [];
    // One step for each crop that starts its run in this year (a winter crop that carries
    // into the next year keeps its later months in the same step).
    const crops = [...new Set(months.filter(Boolean))];
    for (const crop of crops) {
      const first = months.indexOf(crop);
      // Skip the tail of last year's winter crop: it belongs to the step where it was planted.
      const carriedIn = first === 0 && crop.start > crop.end && calendar[(i - 1 + calendar.length) % calendar.length][11] === crop
                        && !(r.years[i].winter === crop && months.lastIndexOf(crop) >= crop.start - 1 && months[0] !== crop);
      const cells = [];
      months.forEach((c, k) => { if (c === crop && !(carriedIn && k + 1 <= crop.end)) cells.push({ year, month: k + 1 }); });
      if (r.years[i].winter === crop && crop.start > crop.end) {
        const next = (i + 1) % calendar.length;
        calendar[next].forEach((c, k) => { if (c === crop && k + 1 <= crop.end) cells.push({ year: next + 1, month: k + 1 }); });
      }
      if (!cells.length) continue;
      const notes = [ROLE_NOTE[crop.role]].filter(Boolean);
      if (crop.fixesN) notes.push('It is a legume, so it puts some nitrogen back into the soil.');
      const rainy = cells.filter(heavy);
      if (rainy.length) notes.push(`It covers the ground in ${names(rainy)}, when days with over 2 in (50 mm) of rain usually happen.`);
      const thirsty = cells.filter(dry);
      if (crop.water === 3 && !field.irrigated && thirsty.length) {
        notes.push(`It needs a lot of water, and root-zone soil was drier than usual in ${names(thirsty)} in ${THRESHOLDS.RECENT_YEARS.join('–')}.`);
      }
      notes.push(...result.frostRisks.filter(t => t.startsWith(crop.name)));
      yearSteps.push({ year, kind: 'crop', first: cells[0].month, title: `${crop.name}: ${span(cells)}`, cells, notes });
    }
    const bare = [];
    months.forEach((c, k) => { if (!c) bare.push({ year, month: k + 1 }); });
    if (bare.length) {
      const notes = [];
      const rainy = bare.filter(heavy);
      notes.push(rainy.length
        ? `Heavy rain usually falls in ${names(rainy)}, with nothing growing to hold the soil.`
        : 'No heavy-rain month falls in this gap.');
      if (field.ind.ndvi.available) {
        const seen = bare.filter(c => field.ind.ndvi.byMonth[c.month - 1].bare);
        if (seen.length) notes.push(`Satellites also saw little plant cover on this spot in ${names(seen)}.`);
      }
      notes.push('No living roots feed the soil in these months.');
      yearSteps.push({ year, kind: 'bare', first: bare[0].month, title: `Bare ground: ${names(bare)}`, cells: bare, notes });
    }
    yearSteps.sort((a, b) => a.first - b.first);
    steps.push(...yearSteps.map(({ first, ...step }) => step));
  });

  const lit = current.warnings.filter(w => w.lit).length;
  const label = id => current.warnings.find(w => w.id === id).label.toLowerCase();
  const signs = result.isCurrent
    ? `${lit} of ${current.warnings.length} soil warning signs are on.`
    : !lit ? 'No soil warning sign was on to begin with.'
      : `Under our rules it clears ${result.fixes.length} of the ${lit} warning sign${lit === 1 ? '' : 's'} on now` +
        (result.fixes.length ? ` (${result.fixes.map(label).join(', ')}).` : '.');
  const summary = [
    `Soil is covered for ${round(result.sub.erosion.score)}% of the heavy-rain season` +
      (result.isCurrent ? '.' : `, against ${round(current.sub.erosion.score)}% with what you grow now.`),
    signs,
  ];
  if (result.adds.length) summary.push(`It would turn on a new warning sign: ${result.adds.map(label).join(', ')}.`);
  summary.push(`It scores ${result.total}/100 for the priorities you set.`);
  summary.push(`Check locally first: ${result.explain.checkLocally[0]}`);
  steps.push({ year: null, kind: 'summary', title: 'What this plan adds up to', cells: [], notes: summary });
  return steps;
}

// ---------- matching the field's crop record to a crop cycle ----------

// USDA CropScape class names -> crop ids in data/crops.csv. A double-crop class counts as both crops.
// Names not listed here (pasture, forest, other hay ...) are ignored, never guessed.
const CDL_CROPS = {
  'Corn': ['corn'], 'Soybeans': ['soybean'], 'Winter Wheat': ['winter_wheat'],
  'Dbl Crop WinWht/Soybeans': ['winter_wheat', 'soybean_double'],
  'Dbl Crop Barley/Soybeans': ['barley', 'soybean_double'],
  'Dbl Crop WinWht/Corn': ['winter_wheat', 'corn'], 'Dbl Crop WinWht/Sorghum': ['winter_wheat', 'grain_sorghum'],
  'Sorghum': ['grain_sorghum'], 'Alfalfa': ['alfalfa'], 'Cotton': ['cotton'], 'Peanuts': ['peanut'],
  'Barley': ['barley'], 'Oats': ['oats_spring'], 'Sunflower': ['sunflower'], 'Sunflowers': ['sunflower'],
  'Canola': ['canola'], 'Tobacco': ['tobacco'], 'Potatoes': ['potato'], 'Triticale': ['triticale'],
  'Rye': ['cereal_rye'], 'Buckwheat': ['buckwheat'],
};

// Picks the listed crop cycle closest to what CropScape recorded on the field.
// Rule: crops in both lists divided by crops in either list; the highest share wins, the first listed wins a tie.
// Cover crops in a cycle are left out because CropScape does not record them.
// history: { "2016": "Corn", ... }. Returns { id, name, recorded: [crop ids] } or null when no recorded crop is in our table.
function matchRotation(history, rotations, region) {
  const recorded = new Set(Object.values(history || {}).flatMap(name => CDL_CROPS[name] || []));
  if (!recorded.size) return null;
  let best = null;
  for (const r of rotations) {
    if (region && r.region !== 'any' && r.region !== region) continue;
    const grown = new Set(allCrops(r).filter(c => c.role !== 'cover').map(c => c.id));
    const shared = [...grown].filter(id => recorded.has(id)).length;
    const share = shared / new Set([...grown, ...recorded]).size;
    if (shared && (!best || share > best.share)) best = { id: r.id, name: r.name, share };
  }
  return best && { id: best.id, name: best.name, recorded: [...recorded] };
}

// ---------- notes about where a crop is grown ----------

// A note shown on any Virginia field when a crop cycle includes the crop. The words come from the
// source; the tool does not decide whether the field's county is one of them.
const VIRGINIA_CROP_NOTES = {
  peanut: {
    text: 'Virginia peanuts are grown in eight counties in southeast Virginia. Check whether your county is one of them.',
    source: 'Virginia Peanut Growers Association',
    url: 'https://aboutpeanuts.com/virginia-peanuts/',
  },
};

// The notes that apply to one crop cycle (empty when none do).
function regionNotes(rotation) {
  return uniqueCrops(rotation).filter(c => VIRGINIA_CROP_NOTES[c.id]).map(c => VIRGINIA_CROP_NOTES[c.id]);
}

// ---------- "I want to grow ...": how one crop fits this field ----------

// Facts about one crop on this field, built only from the crop table and the field's NASA numbers.
// crops: the whole crop table (to look for a cover crop that fits the bare months).
// Returns { calendar: [..], water: [..], bare: [..], notGiven, source }. No rates, yields or prices: none are in our data.
function cropFit(crop, field, crops) {
  const one = { years: [{ main: crop, winter: null }] };
  const last = field.ind.medianLastSpringFrost, first = field.ind.medianFirstFallFrost;
  const calendar = [crop.season === 'perennial'
    ? 'In the ground all year (crop table).'
    : `In the ground ${MONTHS[crop.start - 1]} to ${MONTHS[crop.end - 1]} (crop table).`];
  if (last !== null && first !== null) {
    calendar.push(`Usual frost-free season here: ${dayToDateLabel(last)} to ${dayToDateLabel(first)}, ` +
                  `${first - last - 1} days (NASA POWER, median year).`);
  } else {
    calendar.push('No regular frost dates here in NASA POWER, so frost is not checked.');
  }
  const risks = frostRisks(one, field);
  calendar.push(...(risks.length ? risks
    : [crop.frost === 1 ? 'Fits inside it in a usual year.'
                        : `Frost tolerance: ${crop.frost_tolerance} (crop table), so no frost flag.`]));

  const water = [`Water need: ${crop.water_need} (crop table).`, ...scoreWater(one, field).reasons.slice(1)];
  if (field.irrigated) water.push('Irrigated field, so dry months are not counted against it.');
  else if (water.length === 1) water.push('No dry-summer or sandy-soil penalty on this field.');

  const bareMonths = MONTHS.map((_, i) => i + 1).filter(m => !inWindow(crop, m));
  const bare = [];
  if (!bareMonths.length) bare.push('Covers the soil every month.');
  else {
    bare.push(`Bare when grown alone: ${bareMonths.map(m => MONTHS[m - 1]).join(', ')}.`);
    const covers = Object.values(crops).filter(c => c.role === 'cover')
      .map(c => ({ c, n: bareMonths.filter(m => inWindow(c, m)).length }))
      .filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 2);
    bare.push(covers.length
      ? `Cover crops that grow then: ${covers.map(x => `${x.c.name.replace(/ \(.*\)$/, '')} (${x.n} of ${bareMonths.length} months)`).join(', ')}.`
      : 'No cover crop in our table grows then.');
  }
  return { calendar, water, bare, source: crop.source,
           notGiven: 'No seeding rates, fertilizer amounts, yields or prices: none are in our data with a source.' };
}

// In the browser dayToDateLabel comes from indicators.js; in Node we load it.
if (typeof module !== 'undefined') {
  ({ dayToDateLabel, THRESHOLDS } = require('./indicators.js'));
  module.exports = { LEVEL, PRIORITIES, RULES, SOIL_TEXTURES, parseCsv, parseCrops, parseRotations, inWindow,
    coverageByMonth, scoreRotation, compareRotations, frostRisks, vulnerableMonths, soilWarnings, erosionFactors, answerLines, planCalendar, planSteps,
    CDL_CROPS, matchRotation, regionNotes, cropFit };
}
