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

test('scores on saved Henry County data are between 0 and 100', () => {
  const power = JSON.parse(read('data/raw/power_henry_va.json'));
  const ndviFile = 'data/raw/ndvi_henry_va.json';
  const ndvi = fs.existsSync(path.join(root, ndviFile)) ? JSON.parse(read(ndviFile)) : null;
  const field = { id: 'henry_va', irrigated: false, soil: JSON.parse(read('data/raw/soil_henry_va.json')),
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
    assert.strictEqual(r.rotation.region, 'west');
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
