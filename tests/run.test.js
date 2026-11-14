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
  for (const line of read('data/rotations.csv').trim().split('\n').slice(1)) {
    for (const id of line.split(',')[2].split(/[;>]/)) {
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
