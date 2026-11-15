// indicators.js
// Turns saved NASA POWER and MODIS NDVI data into simple field indicators.
// Every function here is "pure": data in, numbers out. No page code.
// Every threshold lives in THRESHOLDS below with a comment on where it came from.

const THRESHOLDS = {
  // 0 °C is the freezing point; a night at or below it is counted as a frost.
  // Starting point from the team plan (CLAUDE.md). PRISM uses 0 °C for freeze dates too.
  FROST_C: 0,
  // 32 °C is about 90 °F, a common "hot day" line for crops. Starting point from
  // the team plan; check crop-specific limits in the VCE Agronomy Handbook.
  HEAT_C: 32,
  // A day with under 1 mm of rain is a "dry day" (team plan starting point).
  DRY_DAY_MM: 1,
  // A day with over 50 mm (about 2 inches) of rain is an "extreme-rain day"
  // that can wash bare soil away (team plan starting point).
  EXTREME_RAIN_MM: 50,
  // NDVI under 0.3 is treated as "bare or nearly bare ground". Bare soil is
  // usually about 0.1-0.2 and green crops 0.6+ (NASA Earth Observatory,
  // "Measuring Vegetation"). 0.3 leaves room for thin stubble.
  BARE_NDVI: 0.3,
  // Root-zone wetness (GWETROOT) runs from 0 (dry) to 1 (soaked). A month counts as
  // "drier than normal" only if recent years are at least 0.02 (2 points out of 100)
  // below the long-term average. Smaller gaps are treated as noise, not a signal.
  // Team starting point; not from a published source.
  DRY_SOIL_ANOMALY: -0.02,
  // A 250 m MODIS pixel often mixes the field with tree lines and grass edges, which
  // keeps winter NDVI above 0.3 even when the crop is gone. So a month also counts as
  // "low cover" when its median NDVI is under half of the field's greenest month.
  LOW_SHARE_OF_PEAK: 0.5,
  // The growing season used for rainfall and dry spells: April to September.
  SEASON_START_MONTH: 4,
  SEASON_END_MONTH: 9,
  // Heat days are counted in summer: June to August.
  SUMMER_MONTHS: [6, 7, 8],
  // Back-test only (Proof page): a month counts as a "drought month" when at least one weekly
  // U.S. Drought Monitor map in it put this share of the county or more in moderate drought
  // (class D1) or worse. Team starting point; D1 is the first class the Monitor calls drought.
  DROUGHT_AREA_PCT: 50,
  // "Early" and "recent" windows used to describe change over time.
  EARLY_YEARS: [2005, 2009],
  RECENT_YEARS: [2021, 2025],
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------- helpers ----------

function mean(list) {
  const good = list.filter(v => v !== null && !Number.isNaN(v));
  if (good.length === 0) return null;
  return good.reduce((a, b) => a + b, 0) / good.length;
}

function stdev(list) {
  const m = mean(list);
  if (m === null) return null;
  const good = list.filter(v => v !== null);
  return Math.sqrt(mean(good.map(v => (v - m) ** 2)));
}

function median(list) {
  const good = list.filter(v => v !== null).sort((a, b) => a - b);
  if (good.length === 0) return null;
  const mid = Math.floor(good.length / 2);
  return good.length % 2 ? good[mid] : (good[mid - 1] + good[mid]) / 2;
}

function dayOfYear(date) {
  return Math.round((date - new Date(date.getFullYear(), 0, 1)) / 86400000) + 1;
}

function dayToDateLabel(day) {
  if (day === null) return 'n/a';
  const d = new Date(2021, 0, Math.round(day)); // 2021: not a leap year
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

// ---------- POWER: raw JSON -> list of days ----------

// Converts the POWER response into [{date, year, month, tmax, tmin, rain, rootWet, topWet}].
// Values equal to the fill value (-999, given in the response header) become null.
function parsePower(powerJson) {
  const p = powerJson.properties.parameter;
  const fill = powerJson.header.fill_value;
  const clean = v => (v === undefined || v === fill ? null : v);
  return Object.keys(p.T2M_MAX).sort().map(key => {
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(4, 6));
    const day = Number(key.slice(6, 8));
    return {
      date: new Date(year, month - 1, day),
      year, month,
      tmax: clean(p.T2M_MAX[key]),
      tmin: clean(p.T2M_MIN[key]),
      rain: clean(p.PRECTOTCORR[key]),
      rootWet: clean(p.GWETROOT[key]),
      topWet: clean(p.GWETTOP[key]),
    };
  });
}

// ---------- yearly indicators ----------

// Longest run of consecutive dry days in a list of days.
function longestDryRun(days) {
  let best = 0, run = 0;
  for (const d of days) {
    if (d.rain !== null && d.rain < THRESHOLDS.DRY_DAY_MM) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

// One row per year with every POWER indicator.
function yearlyIndicators(days) {
  const byYear = {};
  for (const d of days) (byYear[d.year] = byYear[d.year] || []).push(d);

  return Object.keys(byYear).map(Number).sort().map(year => {
    const list = byYear[year];
    const inSeason = list.filter(d => d.month >= THRESHOLDS.SEASON_START_MONTH &&
                                      d.month <= THRESHOLDS.SEASON_END_MONTH);
    // Frost: last frost before July 1, first frost after July 1.
    const frosts = list.filter(d => d.tmin !== null && d.tmin <= THRESHOLDS.FROST_C);
    const spring = frosts.filter(d => d.month < 7);
    const fall = frosts.filter(d => d.month >= 7);
    const lastSpring = spring.length ? dayOfYear(spring[spring.length - 1].date) : null;
    const firstFall = fall.length ? dayOfYear(fall[0].date) : null;
    const frostFree = lastSpring !== null && firstFall !== null ? firstFall - lastSpring - 1 : null;

    return {
      year,
      lastSpringFrost: lastSpring,
      firstFallFrost: firstFall,
      frostFreeDays: frostFree,
      heatDays: list.filter(d => THRESHOLDS.SUMMER_MONTHS.includes(d.month) &&
                                 d.tmax !== null && d.tmax > THRESHOLDS.HEAT_C).length,
      seasonRainMm: Math.round(inSeason.reduce((s, d) => s + (d.rain || 0), 0)),
      longestDrySpell: longestDryRun(inSeason),
      extremeRainDays: list.filter(d => d.rain !== null && d.rain > THRESHOLDS.EXTREME_RAIN_MM).length,
      missingDays: list.filter(d => d.tmax === null || d.tmin === null || d.rain === null).length,
    };
  });
}

// Average of a yearly field over a [firstYear, lastYear] window.
function windowMean(yearly, key, [first, last]) {
  return mean(yearly.filter(y => y.year >= first && y.year <= last).map(y => y[key]));
}

// Early vs recent change for one yearly field.
function change(yearly, key) {
  const early = windowMean(yearly, key, THRESHOLDS.EARLY_YEARS);
  const recent = windowMean(yearly, key, THRESHOLDS.RECENT_YEARS);
  return { early, recent, diff: early !== null && recent !== null ? recent - early : null };
}

// ---------- monthly profile ----------

// For each month (1-12): average heat days, extreme-rain days, rainfall, and
// the soil-wetness anomaly (recent years' root-zone wetness minus the 2005-2025 average).
function monthlyProfile(days) {
  const years = new Set(days.map(d => d.year)).size;
  const profile = [];
  for (let m = 1; m <= 12; m++) {
    const list = days.filter(d => d.month === m);
    const recent = list.filter(d => d.year >= THRESHOLDS.RECENT_YEARS[0]);
    const longTerm = mean(list.map(d => d.rootWet));
    const recentWet = mean(recent.map(d => d.rootWet));
    profile.push({
      month: m,
      name: MONTH_NAMES[m - 1],
      heatDaysPerYear: list.filter(d => d.tmax !== null && d.tmax > THRESHOLDS.HEAT_C).length / years,
      extremeRainPerYear: list.filter(d => d.rain !== null && d.rain > THRESHOLDS.EXTREME_RAIN_MM).length / years,
      frostNightsPerYear: list.filter(d => d.tmin !== null && d.tmin <= THRESHOLDS.FROST_C).length / years,
      rainMmPerYear: list.reduce((s, d) => s + (d.rain || 0), 0) / years,
      rootWetLongTerm: longTerm,
      rootWetRecent: recentWet,
      wetAnomaly: longTerm !== null && recentWet !== null ? recentWet - longTerm : null,
    });
  }
  return profile;
}

// ---------- NDVI: bare-field window ----------

// Converts the saved NDVI file into [{date, year, doy, ndvi}], dropping fill values.
function parseNdvi(ndviJson) {
  if (!ndviJson) return [];
  return Object.entries(ndviJson.values)
    .filter(([, raw]) => raw !== ndviJson.fill_value && raw !== null)
    .map(([iso, raw]) => {
      const date = new Date(iso + 'T00:00:00');
      return { date, year: date.getFullYear(), doy: dayOfYear(date), ndvi: raw * ndviJson.scale };
    });
}

// Median NDVI for each month, and which months usually have low or no plant cover:
// below BARE_NDVI, or below LOW_SHARE_OF_PEAK times the greenest month's median.
function ndviByMonth(points) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const vals = points.filter(p => p.date.getMonth() + 1 === m).map(p => p.ndvi);
    months.push({ month: m, name: MONTH_NAMES[m - 1], median: median(vals), count: vals.length });
  }
  const peak = Math.max(...months.map(m => m.median || 0));
  const line = Math.max(THRESHOLDS.BARE_NDVI, peak * THRESHOLDS.LOW_SHARE_OF_PEAK);
  for (const m of months) m.bare = m.median !== null && m.median < line;
  months.line = line; // the cut-off actually used, shown on the chart
  return months;
}

// Number of 16-day NDVI images per year that were below the low-cover line, as weeks.
// Uses the same line as ndviByMonth, so the yearly and monthly counts agree.
function bareWeeksByYear(points) {
  const line = ndviByMonth(points).line;
  const byYear = {};
  for (const p of points) {
    byYear[p.year] = byYear[p.year] || { year: p.year, bareImages: 0, images: 0, peak: 0 };
    byYear[p.year].images++;
    byYear[p.year].peak = Math.max(byYear[p.year].peak, p.ndvi);
    if (p.ndvi < line) byYear[p.year].bareImages++;
  }
  // Each MOD13Q1 image stands for a 16-day window, so one image is about 2.3 weeks.
  return Object.values(byYear).map(y => ({ ...y, bareWeeks: Math.round(y.bareImages * 16 / 7) }));
}

// ---------- everything for one field ----------

// The satellite-greenness part of a field's indicators. Kept separate so the page can
// add it later, when the slow satellite service answers, without redoing the weather math.
function ndviIndicators(ndviJson) {
  const points = parseNdvi(ndviJson);
  return {
    available: points.length > 0,
    points,
    byMonth: ndviByMonth(points),
    byYear: bareWeeksByYear(points),
  };
}

// ---------- back-test for the Proof page ----------

// For every month of every year: was root-zone soil drier than usual for that calendar month?
// "Usual" is the average of that month across all years. Uses the same DRY_SOIL_ANOMALY line
// as the rest of the tool. Returns [{ year, month, anomaly, dry }]; a month with no data is skipped.
function dryMonthsByYear(days) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const inMonth = days.filter(d => d.month === m);
    const usual = mean(inMonth.map(d => d.rootWet));
    for (const year of [...new Set(inMonth.map(d => d.year))].sort()) {
      const wet = mean(inMonth.filter(d => d.year === year).map(d => d.rootWet));
      if (wet === null || usual === null) continue;
      out.push({ year, month: m, anomaly: wet - usual, dry: wet - usual < THRESHOLDS.DRY_SOIL_ANOMALY });
    }
  }
  return out.sort((a, b) => a.year - b.year || a.month - b.month);
}

// Compares our dry-soil months with the U.S. Drought Monitor's record for the same county.
// weeks: [{ date: 'YYYY-MM-DD', d1: percent of county in moderate drought or worse }].
// Per year and in total: months both saw (hits), drought months we did not flag (missed),
// months we flagged with no drought on record (extra), and months with neither.
function droughtBacktest(dryMonths, weeks) {
  const droughtMonths = new Set(weeks.filter(w => w.d1 >= THRESHOLDS.DROUGHT_AREA_PCT).map(w => w.date.slice(0, 7)));
  const key = m => `${m.year}-${String(m.month).padStart(2, '0')}`;
  const count = list => ({
    months: list.length,
    hits: list.filter(m => m.dry && droughtMonths.has(key(m))).length,
    missed: list.filter(m => !m.dry && droughtMonths.has(key(m))).length,
    extra: list.filter(m => m.dry && !droughtMonths.has(key(m))).length,
    neither: list.filter(m => !m.dry && !droughtMonths.has(key(m))).length,
  });
  const years = [...new Set(dryMonths.map(m => m.year))];
  return {
    total: count(dryMonths),
    byYear: years.map(year => ({ year, ...count(dryMonths.filter(m => m.year === year)) })),
  };
}

function computeFieldIndicators(powerJson, ndviJson) {
  const days = parsePower(powerJson);
  const yearly = yearlyIndicators(days);
  return {
    firstYear: yearly[0].year,
    lastYear: yearly[yearly.length - 1].year,
    yearly,
    monthly: monthlyProfile(days),
    medianLastSpringFrost: median(yearly.map(y => y.lastSpringFrost)),
    medianFirstFallFrost: median(yearly.map(y => y.firstFallFrost)),
    frostFree: change(yearly, 'frostFreeDays'),
    heat: change(yearly, 'heatDays'),
    rain: { ...change(yearly, 'seasonRainMm'), spread: stdev(yearly.map(y => y.seasonRainMm)) },
    drySpell: change(yearly, 'longestDrySpell'),
    extremeRain: change(yearly, 'extremeRainDays'),
    missingDays: yearly.reduce((s, y) => s + y.missingDays, 0),
    ndvi: ndviIndicators(ndviJson),
  };
}

// Lets Node tests load this file; browsers ignore it.
if (typeof module !== 'undefined') {
  module.exports = { THRESHOLDS, MONTH_NAMES, mean, median, stdev, dayToDateLabel, parsePower,
    longestDryRun, yearlyIndicators, change, monthlyProfile, parseNdvi, ndviByMonth,
    bareWeeksByYear, ndviIndicators, dryMonthsByYear, droughtBacktest, computeFieldIndicators };
}
