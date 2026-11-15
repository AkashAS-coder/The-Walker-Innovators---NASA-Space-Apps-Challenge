// Run with: node --test tests/
// Checks the indicator and scoring rules on small made-up inputs and on the saved NASA data.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ind = require('../js/indicators.js');
const sc = require('../js/scoring.js');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const crops = sc.parseCrops(sc.parseCsv(read('data/crops.csv')));
const rotations = sc.parseRotations(sc.parseCsv(read('data/rotations.csv')), crops);

test('longest dry run counts consecutive days under 1 mm', () => {
  const days = [5, 0, 0, 0.5, 2, 0, 0].map(rain => ({ rain }));
  assert.strictEqual(ind.longestDryRun(days), 3);
});

test('every crop in rotations.csv exists in crops.csv', () => {
  for (const row of sc.parseCsv(read('data/rotations.csv'))) {
    for (const id of row.sequence.split(/[;>]/)) {
      assert.ok(id === 'bare' || crops[id], `unknown crop ${id}`);
    }
  }
});

test('corn-soybean with no cover is bare in winter, cover crop version is not', () => {
  const bare = sc.coverageByMonth(rotations.find(r => r.id === 'corn_soy'));
  const covered = sc.coverageByMonth(rotations.find(r => r.id === 'corn_soy_cover'));
  assert.strictEqual(bare[0], 0);      // January
  assert.strictEqual(covered[0], 1);
});

test('scores on saved Franklin County data are between 0 and 100', () => {
  const power = JSON.parse(read('data/raw/power_franklin_va.json'));
  const ndviFile = 'data/raw/ndvi_franklin_va.json';
  const ndvi = fs.existsSync(path.join(root, ndviFile)) ? JSON.parse(read(ndviFile)) : null;
  const field = { id: 'franklin_va', irrigated: false, soil: JSON.parse(read('data/raw/soil_franklin_va.json')),
                  ind: ind.computeFieldIndicators(power, ndvi) };
  const weights = { water: 3, soil: 3, income: 3, forage: 1, erosion: 3 };
  const results = sc.compareRotations(rotations, 'corn_soy', field, weights);
  assert.strictEqual(results.length, 3);
  for (const r of results) {
    assert.ok(r.total >= 0 && r.total <= 100);
    for (const box of ['why', 'evidence', 'benefits', 'unknowns', 'checkLocally']) {
      assert.ok(r.explain[box].length > 0, `${r.rotation.id} missing ${box}`);
    }
  }
});

// A made-up field with flat weather, used to test single rules.
function fakeField(juneAnomaly) {
  const monthly = ind.MONTH_NAMES.map((name, i) => ({ month: i + 1, name, heatDaysPerYear: 0,
    extremeRainPerYear: 0, wetAnomaly: i + 1 === 6 ? juneAnomaly : 0 }));
  return { id: 'test', irrigated: false, texture: 'Loam', soil: null,
           ind: { monthly, heat: { recent: 0 }, medianLastSpringFrost: null, medianFirstFallFrost: null,
                  ndvi: { available: false } } };
}
const even = { water: 1, soil: 1, income: 1, forage: 1, erosion: 1 };

test('alfalfa hay counts toward income', () => {
  const r = sc.scoreRotation(rotations.find(x => x.id === 'alfalfa_grain'), fakeField(0), even);
  assert.ok(r.sub.income.score > 30, `income was ${r.sub.income.score}`);
});

test('a tiny soil-moisture dip is noise, a clear one costs thirsty crops points', () => {
  const corn = rotations.find(x => x.id === 'corn_soy');
  const flat = sc.scoreRotation(corn, fakeField(0), even).sub.water.score;
  const tiny = sc.scoreRotation(corn, fakeField(-0.009), even).sub.water.score;
  const clear = sc.scoreRotation(corn, fakeField(-0.035), even).sub.water.score;
  assert.strictEqual(tiny, flat);
  assert.ok(clear < flat);
});

test('Nevada field only gets western rotations, with no soybean', () => {
  const power = JSON.parse(read('data/raw/power_fallon_nv.json'));
  const field = { id: 'fallon_nv', region: 'west', irrigated: true, sellsForage: true, texture: 'Loam',
                  soil: JSON.parse(read('data/raw/soil_fallon_nv.json')), ind: ind.computeFieldIndicators(power, null) };
  const weights = { water: 3, soil: 3, income: 3, forage: 1, erosion: 3 };
  const results = sc.compareRotations(rotations, 'alfalfa_then_corn', field, weights);
  assert.strictEqual(results.length, 3);
  for (const r of results) {
    assert.ok(['west', 'any'].includes(r.rotation.region), `${r.rotation.id} is an eastern rotation`);
    assert.ok(!r.rotation.years.some(y => [y.main, y.winter].some(c => c && c.id.startsWith('soybean'))),
              `${r.rotation.id} includes soybean`);
  }
});

test('selling hay raises the income score of an alfalfa rotation', () => {
  const power = JSON.parse(read('data/raw/power_fallon_nv.json'));
  const base = { id: 'fallon_nv', region: 'west', irrigated: true, texture: 'Loam',
                 soil: null, ind: ind.computeFieldIndicators(power, null) };
  const rot = rotations.find(r => r.id === 'alfalfa_then_corn');
  const w = { income: 1 };
  const no = sc.scoreRotation(rot, { ...base, sellsForage: false }, w).sub.income.score;
  const yes = sc.scoreRotation(rot, { ...base, sellsForage: true }, w).sub.income.score;
  assert.ok(yes > no);
});

// A fake field where January gets heavy rain and June soil is clearly drier than usual.
function rainyJanField() {
  const field = fakeField(-0.035);
  field.ind.monthly[0].extremeRainPerYear = 0.2;
  return field;
}
const warningsFor = (id, field) => {
  const res = sc.scoreRotation(rotations.find(x => x.id === id), field, even);
  return Object.fromEntries(sc.soilWarnings(res, field).map(w => [w.id, w.lit]));
};

test('bare corn-soybean lights the erosion and organic-matter warnings', () => {
  const w = warningsFor('corn_soy', rainyJanField());
  assert.strictEqual(w.erosion, true);   // bare in rainy January
  assert.strictEqual(w.organic, true);   // no living roots over winter
  assert.strictEqual(w.drying, true);    // thirsty corn in a dry June, rain-fed
});

test('a cover crop turns off erosion and organic-matter warnings, irrigation turns off drying', () => {
  const field = rainyJanField();
  const w = warningsFor('corn_soy_cover', field);
  assert.strictEqual(w.erosion, false);
  assert.strictEqual(w.organic, false);
  assert.strictEqual(warningsFor('corn_soy', { ...field, irrigated: true }).drying, false);
});

test('a rotation with no legume lights the nitrogen warning', () => {
  assert.strictEqual(warningsFor('grain_no_hay', rainyJanField()).nitrogen, true);
  assert.strictEqual(warningsFor('corn_soy', rainyJanField()).nitrogen, false);
});

test('RUSLE factors use the real soil-survey K and say what is missing', () => {
  const field = rainyJanField();
  field.soil = { kwfact: '.24', slope_r: '5', compname: 'Clifford', texdesc: 'Fine sandy loam' };
  field.ind.extremeRain = { recent: 0.8 };
  const res = sc.scoreRotation(rotations.find(x => x.id === 'corn_soy'), field, even);
  const f = Object.fromEntries(sc.erosionFactors(res, field).map(x => [x.id, x]));
  assert.strictEqual(f.K.value, '0.24');
  assert.strictEqual(f.K.status, 'measured');
  assert.strictEqual(f.P.status, 'unknown');
  assert.ok(f.C.changes);
  // A cover crop raises the cover factor's covered share.
  const covered = sc.scoreRotation(rotations.find(x => x.id === 'corn_soy_cover'), field, even);
  assert.ok(covered.sub.erosion.score > res.sub.erosion.score);
});

test('a cycle with no main crop still gets a real water score, not NaN', () => {
  const coverOnly = { id: 'test_cover_only', name: 'Cover only', region: 'any', description: '',
                      years: [{ main: null, winter: crops.cereal_rye }] };
  const r = sc.scoreRotation(coverOnly, fakeField(0), even);
  assert.ok(Number.isFinite(r.sub.water.score), `water was ${r.sub.water.score}`);
  assert.ok(Number.isFinite(r.total), `total was ${r.total}`);
});

test('the answer card names the risk, the best-fit option and one local check', () => {
  const power = JSON.parse(read('data/raw/power_franklin_va.json'));
  const ndvi = JSON.parse(read('data/raw/ndvi_franklin_va.json'));
  const field = { id: 'franklin_va', region: 'east', irrigated: false, texture: 'Loam',
                  soil: JSON.parse(read('data/raw/soil_franklin_va.json')), ind: ind.computeFieldIndicators(power, ndvi) };
  const results = sc.compareRotations(rotations, 'corn_wheat_soy', field, { water: 3, soil: 4, income: 3, forage: 1, erosion: 4 });
  const [current, ...alts] = results;
  const a = sc.answerLines(results);
  // The risk line is the first warning sign that is on for what the farmer grows now.
  const firstLit = current.warnings.find(w => w.lit);
  assert.ok(a.risk.startsWith(firstLit.label));
  // The option line names the highest-scoring alternative and both scores.
  const top = alts.reduce((x, y) => (y.total > x.total ? y : x));
  assert.ok(a.option.includes(top.rotation.name) && a.option.includes(`${top.total}/100`) && a.option.includes(String(current.total)));
  assert.strictEqual(a.check, top.explain.checkLocally[0]);

  // With every slider at zero no option beats the current one, and the card says so instead of naming one.
  const flat = sc.compareRotations(rotations, 'corn_wheat_soy', field, { water: 0, soil: 0, income: 0, forage: 0, erosion: 0 });
  if (flat.slice(1).every(r => r.total <= flat[0].total)) {
    assert.ok(sc.answerLines(flat).option.startsWith('What you grow now'));
  }
});

test('gaps about this field are listed before the general limits', () => {
  const field = fakeField(0); // no satellite data
  const results = sc.compareRotations(rotations, 'corn_soy', field, even);
  assert.ok(results[0].explain.unknowns[0].includes('Satellite greenness (NDVI) is missing'));
});

test('dry months are found against the usual for that calendar month', () => {
  // Two years of June: one soaked (0.8), one dry (0.4). Usual is 0.6, so only the dry one is flagged.
  const days = [2020, 2021].flatMap(year => Array.from({ length: 30 }, () => ({ year, month: 6, rootWet: year === 2020 ? 0.8 : 0.4 })));
  const months = ind.dryMonthsByYear(days);
  assert.deepStrictEqual(months.map(m => [m.year, m.dry]), [[2020, false], [2021, true]]);
});

test('the back-test counts hits, misses and extra flags', () => {
  const dry = [
    { year: 2020, month: 6, dry: true },   // flagged, drought on record  -> hit
    { year: 2020, month: 7, dry: false },  // not flagged, drought        -> missed
    { year: 2020, month: 8, dry: true },   // flagged, no drought         -> extra
    { year: 2020, month: 9, dry: false },  // neither
  ];
  const weeks = [{ date: '2020-06-09', d1: 80 }, { date: '2020-07-14', d1: 50 },
                 { date: '2020-08-11', d1: 49 }, { date: '2020-09-08', d1: 0 }];
  const b = ind.droughtBacktest(dry, weeks);
  assert.deepStrictEqual(b.total, { months: 4, hits: 1, missed: 1, extra: 1, neither: 1 });
  assert.strictEqual(b.byYear[0].year, 2020);
});

test('the saved Franklin County back-test adds up to every month of 2005-2025', () => {
  const days = ind.parsePower(JSON.parse(read('data/raw/power_franklin_va.json')));
  const weeks = JSON.parse(read('data/raw/drought_franklin_va.json')).weeks;
  const t = ind.droughtBacktest(ind.dryMonthsByYear(days), weeks).total;
  assert.strictEqual(t.months, 252);
  assert.strictEqual(t.hits + t.missed + t.extra + t.neither, 252);
});

// The saved Franklin County field, scored with the page's starting sliders.
function franklinResults() {
  const field = { id: 'franklin_va', region: 'east', irrigated: false, texture: 'Loam',
                  soil: JSON.parse(read('data/raw/soil_franklin_va.json')),
                  ind: ind.computeFieldIndicators(JSON.parse(read('data/raw/power_franklin_va.json')), JSON.parse(read('data/raw/ndvi_franklin_va.json'))) };
  return { field, results: sc.compareRotations(rotations, 'corn_wheat_soy', field, { water: 3, soil: 4, income: 3, forage: 1, erosion: 4 }) };
}

test('the year-by-year plan calendar agrees with the averaged cover for every crop cycle', () => {
  for (const r of rotations) {
    const calendar = sc.planCalendar(r);
    sc.coverageByMonth(r).forEach((cover, k) => {
      const share = calendar.filter(year => year[k]).length / calendar.length;
      assert.ok(Math.abs(share - cover) < 1e-9, `${r.id} month ${k + 1}`);
    });
  }
});

test('plan steps walk through each crop, report bare gaps and end with a summary', () => {
  const { field, results } = franklinResults();
  const [current] = results;
  const steps = sc.planSteps(current, current, field);
  // Corn then wheat and double-crop soybean: a bare gap, corn, wheat, soybean, a bare gap, the summary.
  assert.deepStrictEqual(steps.map(s => s.kind), ['bare', 'crop', 'crop', 'crop', 'bare', 'summary']);
  assert.ok(steps[0].title.startsWith('Bare ground: Jan'));
  // Every month of every year is in exactly one step.
  const cells = steps.flatMap(s => s.cells.map(c => `${c.year}-${c.month}`));
  assert.strictEqual(cells.length, 24);
  assert.strictEqual(new Set(cells).size, 24);
  // Winter wheat is planted in year 1 and its step carries on into year 2.
  const wheat = steps.find(s => s.title.startsWith('Winter wheat'));
  assert.ok(wheat.cells.some(c => c.year === 1) && wheat.cells.some(c => c.year === 2));
});

test('a plan that covers every month has no bare step and its summary matches the comparison', () => {
  const { field, results } = franklinResults();
  const [current, ...alts] = results;
  const full = alts.find(r => r.bareMonths.length === 0);
  const steps = sc.planSteps(full, current, field);
  assert.ok(steps.every(s => s.kind !== 'bare'));
  const summary = steps[steps.length - 1].notes.join(' ');
  assert.ok(summary.includes(`clears ${full.fixes.length} of the`));
  assert.ok(summary.includes(`${full.total}/100`));
});

test('the crop record picks the closest listed crop cycle', () => {
  const history = JSON.parse(read('data/raw/cropscape_franklin_va.json')).history;
  const match = sc.matchRotation(history, rotations, 'east');
  // Recorded: corn, soybean, wheat + double-crop soybean, sunflower. Four of those five are in this cycle.
  assert.strictEqual(match.id, 'corn_soy_wheat');
  assert.deepStrictEqual([...match.recorded].sort(), ['corn', 'soybean', 'soybean_double', 'sunflower', 'winter_wheat']);
  // A western field is never matched to an eastern-only cycle.
  const west = sc.matchRotation({ 2024: 'Alfalfa', 2025: 'Corn' }, rotations, 'west');
  assert.ok(['west', 'any'].includes(rotations.find(r => r.id === west.id).region));
  // Land cover that is not in our crop table gives no match instead of a guess.
  assert.strictEqual(sc.matchRotation({ 2024: 'Deciduous Forest', 2025: null }, rotations, 'east'), null);
  assert.strictEqual(sc.matchRotation(null, rotations, 'east'), null);
});

test('every CropScape name we map points at a crop in crops.csv', () => {
  for (const ids of Object.values(sc.CDL_CROPS)) for (const id of ids) assert.ok(crops[id], `unknown crop ${id}`);
});

function franklinField() {
  return { id: 'franklin_va', region: 'east', irrigated: false, texture: 'Sandy loam',
           soil: JSON.parse(read('data/raw/soil_franklin_va.json')),
           ind: ind.computeFieldIndicators(JSON.parse(read('data/raw/power_franklin_va.json')),
                                           JSON.parse(read('data/raw/ndvi_franklin_va.json'))) };
}
const evenWeights = { water: 3, soil: 3, income: 3, forage: 3, erosion: 3 };

test('a wanted crop is in both alternatives and the current cycle is still shown', () => {
  const results = sc.compareRotations(rotations, 'corn_soy', franklinField(), evenWeights, { wantCrop: 'grain_sorghum' });
  assert.strictEqual(results[0].rotation.id, 'corn_soy');
  assert.ok(results.length >= 2);
  for (const r of results.slice(1)) {
    assert.ok(r.rotation.years.some(y => [y.main, y.winter].some(c => c && c.id === 'grain_sorghum')), r.rotation.id);
  }
  // With no wanted crop the answer is the same as before.
  const plain = sc.compareRotations(rotations, 'corn_soy', franklinField(), evenWeights, {});
  assert.deepStrictEqual(sc.compareRotations(rotations, 'corn_soy', franklinField(), evenWeights).map(r => r.rotation.id),
                         plain.map(r => r.rotation.id));
});

test('crop fit lists the bare months of a summer crop and a cover crop from the table for the gap', () => {
  const fit = sc.cropFit(crops.grain_sorghum, franklinField(), crops);
  assert.match(fit.bare[0], /Nov, Dec/);
  assert.match(fit.bare[0], /Jan, Feb, Mar, Apr/);
  assert.match(fit.bare[1], /Cereal rye/);
  assert.match(fit.water[0], /Water need: /);
  assert.strictEqual(fit.source, crops.grain_sorghum.source);
  assert.strictEqual(sc.cropFit(crops.alfalfa, franklinField(), crops).bare[0], 'Covers the soil every month.');
});

test('the peanut region note shows only on cycles with peanut', () => {
  assert.strictEqual(sc.regionNotes(rotations.find(r => r.id === 'peanut_cotton_corn')).length, 1);
  assert.strictEqual(sc.regionNotes(rotations.find(r => r.id === 'corn_soy')).length, 0);
});
