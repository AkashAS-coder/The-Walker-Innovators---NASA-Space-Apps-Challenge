// app.js
// Page code: loads the saved data files, draws the field report, and redraws the
// three option cards whenever the farmer changes an input. All the math lives in
// indicators.js and scoring.js; this file only reads inputs and writes HTML.

const state = {
  fields: [],
  crops: {},
  rotations: [],
  cache: {},     // field id -> { ind, soil } so we only crunch the numbers once
  field: null,
  charts: {},
  trendKey: 'heatDays',
};

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (x, digits = 0) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(digits));
const signed = (x, digits = 0) => (x === null ? 'n/a' : (x > 0 ? '+' : '') + Number(x).toFixed(digits));

async function getJson(path, optional = false) {
  const res = await fetch(path);
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`Could not load ${path} (${res.status})`);
  }
  return res.json();
}

async function getText(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.text();
}

// ---------- start-up ----------

async function init() {
  try {
    state.fields = await getJson('data/fields.json');
    state.crops = parseCrops(parseCsv(await getText('data/crops.csv')));
    state.rotations = parseRotations(parseCsv(await getText('data/rotations.csv')), state.crops);
  } catch (err) {
    showError(err);
    return;
  }
  buildInputs();
  buildMap();
  await selectField(state.fields[0].id);
  $('loading').hidden = true;
}

function showError(err) {
  $('loading').hidden = true;
  const box = $('load-error');
  box.hidden = false;
  box.textContent = `${err.message}. If you opened index.html straight from your computer, run ` +
    '"python3 -m http.server 8000" in the project folder and open http://localhost:8000 instead.';
}

// ---------- inputs ----------

function buildInputs() {
  $('field-select').innerHTML = state.fields
    .map(f => `<option value="${f.id}">${esc(f.name)} (${esc(f.place)})</option>`).join('');
  $('field-select').addEventListener('change', e => selectField(e.target.value));

  $('rotation-select').innerHTML = state.rotations
    .map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');

  $('texture-select').innerHTML = SOIL_TEXTURES.map(t => `<option>${t}</option>`).join('');

  for (const id of ['rotation-select', 'texture-select', 'irrigated', 'no-hay']) {
    $(id).addEventListener('change', render);
  }

  const defaults = { water: 3, soil: 4, income: 3, forage: 1, erosion: 3 };
  $('sliders').innerHTML = Object.entries(PRIORITIES).map(([key, label]) => `
    <div class="slider">
      <label for="w-${key}">${label} <output id="o-${key}">${defaults[key]}</output></label>
      <input type="range" id="w-${key}" min="0" max="5" step="1" value="${defaults[key]}">
    </div>`).join('');
  for (const key of Object.keys(PRIORITIES)) {
    $(`w-${key}`).addEventListener('input', e => {
      $(`o-${key}`).textContent = e.target.value;
      renderOptions();
    });
  }

  $('trend-toggle').innerHTML = [
    ['heatDays', 'Hot days (>32 °C)'], ['frostFreeDays', 'Frost-free days'],
    ['seasonRainMm', 'Apr–Sep rain (mm)'], ['longestDrySpell', 'Longest dry spell'],
  ].map(([k, label]) => `<button type="button" data-key="${k}">${label}</button>`).join('');
  $('trend-toggle').addEventListener('click', e => {
    if (!e.target.dataset.key) return;
    state.trendKey = e.target.dataset.key;
    drawTrendChart();
  });
}

function buildMap() {
  if (typeof L === 'undefined') { $('map').textContent = 'Map could not load (no internet?). Use the field list instead.'; return; }
  const map = L.map('map', { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap contributors',
  }).addTo(map);
  const markers = state.fields.map(f =>
    L.marker([f.lat, f.lon]).addTo(map)
      .bindTooltip(`${f.name}<br>${f.place}`)
      .on('click', () => { $('field-select').value = f.id; selectField(f.id); }));
  map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3));
  state.map = map;
}

// ---------- selecting a field ----------

async function selectField(id) {
  const field = state.fields.find(f => f.id === id);
  if (!state.cache[id]) {
    try {
      const [power, ndvi, soil, crops] = await Promise.all([
        getJson(`data/raw/power_${id}.json`),
        getJson(`data/raw/ndvi_${id}.json`, true), // optional files are shown as missing if absent
        getJson(`data/raw/soil_${id}.json`, true),
        getJson(`data/raw/cropscape_${id}.json`, true),
      ]);
      state.cache[id] = { ind: computeFieldIndicators(power, ndvi), soil, history: crops && crops.history };
    } catch (err) { showError(err); return; }
  }
  state.field = field;
  $('field-place').textContent = `${field.place} · latitude ${field.lat}, longitude ${field.lon}`;
  $('field-note').textContent = field.note;
  $('rotation-select').value = field.default_rotation;
  $('irrigated').checked = field.irrigated;
  const soil = state.cache[id].soil;
  // Match the survey texture to our list, longest name first ("Fine sandy loam" -> "Sandy loam").
  const surveyed = soil && soil.texdesc ? soil.texdesc.toLowerCase() : '';
  const texture = [...SOIL_TEXTURES].sort((a, b) => b.length - a.length)
    .find(t => surveyed.endsWith(t.toLowerCase())) || 'Loam';
  $('texture-select').value = texture;
  const history = state.cache[id].history;
  $('history').innerHTML = history
    ? Object.entries(history).map(([yr, crop]) =>
        `<div class="yr"><b>${yr}</b><span>${esc(crop || 'missing')}</span></div>`).join('')
    : '<p class="muted">No crop history saved for this field.</p>';
  $('texture-hint').textContent = soil ? `USDA soil survey says: ${soil.texdesc}. Change it if your field differs.`
                                       : 'No soil survey data saved for this field. Pick your soil texture.';
  render();
}

// The field object the scoring code needs, built from the current inputs.
function currentField() {
  const c = state.cache[state.field.id];
  return { id: state.field.id, ind: c.ind, soil: c.soil,
           irrigated: $('irrigated').checked, texture: $('texture-select').value };
}

function weights() {
  const w = {};
  for (const key of Object.keys(PRIORITIES)) w[key] = Number($(`w-${key}`).value);
  return w;
}

// ---------- drawing ----------

function render() {
  renderReport();
  renderOptions();
}

function card(label, value, meaning, alert = false) {
  return `<div class="card${alert ? ' alert' : ''}"><p class="label">${label}</p>
    <p class="value">${value}</p><p class="meaning">${meaning}</p></div>`;
}

function renderReport() {
  const ind = state.cache[state.field.id].ind;
  const soil = state.cache[state.field.id].soil;
  const early = `${THRESHOLDS.EARLY_YEARS[0]}–${THRESHOLDS.EARLY_YEARS[1]}`;
  const recent = `${THRESHOLDS.RECENT_YEARS[0]}–${THRESHOLDS.RECENT_YEARS[1]}`;
  $('report-intro').textContent = `Built from ${ind.lastYear - ind.firstYear + 1} years of daily NASA data ` +
    `(${ind.firstYear}–${ind.lastYear}). "Change" compares the average of ${recent} with ${early}.`;

  const drySummer = ind.monthly.filter(m => [6, 7, 8].includes(m.month) &&
                                           m.wetAnomaly !== null && m.wetAnomaly < THRESHOLDS.DRY_SOIL_ANOMALY);
  const summerAnom = (ind.monthly.slice(5, 8).reduce((s, m) => s + (m.wetAnomaly || 0), 0) / 3) * 100;

  $('weather-cards').innerHTML = [
    card('Frost-free season', `${fmt(ind.frostFree.recent)} days`,
      `${signed(ind.frostFree.diff)} day(s) compared with ${early}. More days can leave room for a cover crop or a second crop.`),
    card('Frost risk dates', `${dayToDateLabel(ind.medianLastSpringFrost)} → ${dayToDateLabel(ind.medianFirstFallFrost)}`,
      'Usual last spring frost and first fall frost (middle year of 21). Frost-sensitive crops should sit between them.', true),
    card('Hot summer days', `${fmt(ind.heat.recent)} / year`,
      `Days above 32 °C (90 °F) in June–August. ${signed(ind.heat.diff)} compared with ${early}.`, ind.heat.recent >= 20),
    card('Growing-season rain', `${fmt(ind.rain.recent)} mm`,
      `April–September total. It swings by about ±${fmt(ind.rain.spread)} mm from year to year. ${signed(ind.rain.diff)} mm compared with ${early}.`),
    card('Longest dry spell', `${fmt(ind.drySpell.recent)} days`,
      `Longest run of days with under 1 mm of rain in April–September. ${signed(ind.drySpell.diff, 1)} days compared with ${early}.`),
    card('Extreme-rain days', `${fmt(ind.extremeRain.recent, 1)} / year`,
      `Days with over 50 mm (2 in) of rain, which can wash bare soil away. ${signed(ind.extremeRain.diff, 1)} compared with ${early}.`),
    card('Summer soil-moisture anomaly', `${signed(summerAnom, 1)} points`,
      (drySummer.length ? `Root-zone soil was drier than usual in ${drySummer.map(m => m.name).join(', ')} in ${recent}.`
                        : `Root-zone soil was as wet as or wetter than usual in summer in ${recent}.`) +
      ' Wetness runs 0 (dry) to 100 (soaked); this is recent June–August minus the 21-year average.', drySummer.length > 0),
  ].join('');

  $('soil-card').innerHTML = soil ? [
    card('Soil type', esc(soil.compname), esc(soil.muname)),
    card('Slope', `${fmt(soil.slope_r)}%`, Number(soil.slope_r) >= 7 ? 'Sloped ground: bare soil here washes away more easily.' : 'Fairly flat ground.', Number(soil.slope_r) >= 7),
    card('Drainage', esc(soil.drainagecl || 'n/a'), `Hydrologic group ${esc(soil.hydgrp || 'n/a')} (A soaks in fast, D runs off).`),
    card('Topsoil', `${fmt(soil.om_r, 1)}% organic matter`, `Holds about ${fmt(soil.awc_r * 100, 0)} cm of water per meter of soil. ${esc(soil.texdesc)}.`),
  ].join('') : '<p class="muted">No soil survey data saved for this field.</p>';

  drawTrendChart();
  drawNdviChart();
}

function drawTrendChart() {
  const ind = state.cache[state.field.id].ind;
  const labels = { heatDays: 'Hot days (>32 °C)', frostFreeDays: 'Frost-free days',
                   seasonRainMm: 'Apr–Sep rain (mm)', longestDrySpell: 'Longest dry spell (days)' };
  document.querySelectorAll('#trend-toggle button')
    .forEach(b => b.classList.toggle('on', b.dataset.key === state.trendKey));
  if (typeof Chart === 'undefined') return;
  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart($('trend-chart'), {
    type: 'line',
    data: {
      labels: ind.yearly.map(y => y.year),
      datasets: [{ label: labels[state.trendKey], data: ind.yearly.map(y => y[state.trendKey]),
                   borderColor: '#2c5d8a', backgroundColor: '#2c5d8a', tension: 0.25 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } },
  });
}

function drawNdviChart() {
  const ndvi = state.cache[state.field.id].ind.ndvi;
  if (state.charts.ndvi) { state.charts.ndvi.destroy(); state.charts.ndvi = null; }
  if (!ndvi.available) {
    $('ndvi-note').textContent = 'Satellite greenness data is not saved for this field yet. Run src/fetch_ndvi.py.';
    return;
  }
  const years = new Set(ndvi.points.map(p => p.year));
  const bare = ndvi.byMonth.filter(m => m.bare).map(m => m.name);
  const line = ndvi.byMonth.line.toFixed(2);
  $('ndvi-note').textContent = `${ndvi.points.length} satellite images from ${Math.min(...years)}–${Math.max(...years)}. ` +
    (bare.length ? `Low plant cover (below ${line}) in ${bare.join(', ')}: a window where a cover crop could fit. ` +
                   `The line is ${THRESHOLDS.BARE_NDVI} or half of this field's greenest month, whichever is higher.`
                 : `No month falls below ${line}, so this spot stays fairly green all year.`);
  if (typeof Chart === 'undefined') return;
  state.charts.ndvi = new Chart($('ndvi-chart'), {
    type: 'bar',
    data: {
      labels: ndvi.byMonth.map(m => m.name),
      datasets: [
        { type: 'line', label: `Low-cover line (${line})`, data: ndvi.byMonth.map(() => ndvi.byMonth.line),
          borderColor: '#a4471d', borderDash: [6, 4], pointRadius: 0 },
        { label: 'Median NDVI', data: ndvi.byMonth.map(m => m.median),
          backgroundColor: ndvi.byMonth.map(m => (m.bare ? '#c9a27a' : '#5c9b62')) },
      ],
    },
    options: { scales: { y: { min: 0, max: 1 } } },
  });
}

function monthStrip(result, withFlags) {
  return result.cover.map((c, i) => {
    const cls = c === 1 ? 'covered' : c > 0 ? 'partial' : '';
    const flags = withFlags ? result.vulnerable[i].flags.map(f => `<span class="flag">⚠ ${f}</span>`).join('') : '';
    const title = `${result.vulnerable[i].month}: crop growing in ${Math.round(c * 100)}% of years` +
                  (result.vulnerable[i].flags.length ? `; ${result.vulnerable[i].flags.join(', ')}` : '');
    return `<div class="month ${cls}" title="${esc(title)}"><span class="m">${result.vulnerable[i].month}</span>${flags}</div>`;
  }).join('');
}

function sequenceText(rotation) {
  return rotation.years.map((y, i) =>
    `Year ${i + 1}: ${y.main ? y.main.name : 'bare'}${y.winter && y.winter !== y.main ? `, then ${y.winter.name} over winter` : ''}`)
    .join(' · ');
}

function list(items) {
  return `<ul>${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
}

function renderOptions() {
  const field = currentField();
  const results = compareRotations(state.rotations, $('rotation-select').value, field, weights(),
                                   { noHay: $('no-hay').checked });
  const best = Math.max(...results.slice(1).map(r => r.total));

  $('risk-strip').innerHTML = monthStrip(results[0], true);

  $('options').innerHTML = results.map(r => `
    <article class="option ${r.isCurrent ? 'current' : ''} ${!r.isCurrent && r.total === best ? 'best' : ''}">
      <span class="badge">${r.isCurrent ? 'What you grow now' : r.total === best ? 'Best fit for your priorities' : 'Alternative'}</span>
      <h3>${esc(r.rotation.name)}</h3>
      <p class="seq">${esc(sequenceText(r.rotation))}</p>
      <div class="fit"><span class="big">${r.total}</span><span class="muted">/ 100 fit score</span></div>
      <div class="bars">${Object.entries(PRIORITIES).map(([k, label]) => `
        <div class="bar"><span>${label}</span><span class="track"><span class="fill" style="width:${Math.round(r.sub[k].score)}%; display:block"></span></span><span>${Math.round(r.sub[k].score)}</span></div>`).join('')}
      </div>
      <div>
        <p class="small muted" style="margin:.2rem 0">Months with a crop growing (green) vs bare (tan) · bare months: ${r.bareMonths.length || 'none'}</p>
        <div class="month-strip">${monthStrip(r, false)}</div>
      </div>
      <div class="box why"><h4>Why suggested</h4>${list(r.explain.why)}</div>
      <div class="box evidence"><h4>Evidence</h4>${list(r.explain.evidence)}</div>
      <div class="box benefits"><h4>Benefits</h4>${list(r.explain.benefits)}</div>
      <div class="box unknowns"><h4>What we don't know</h4>${list(r.explain.unknowns)}</div>
      <div class="box check"><h4>Check locally</h4>${list(r.explain.checkLocally)}</div>
    </article>`).join('');
}

init();
