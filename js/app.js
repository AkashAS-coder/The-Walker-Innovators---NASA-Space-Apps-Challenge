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
  chat: [],      // the AI helper conversation so far: [{ role, content }]
};

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (x, digits = 0) => (x === null || x === undefined ? 'n/a' : Number(x).toFixed(digits));
const signed = (x, digits = 0) => (x === null ? 'n/a' : (x > 0 ? '+' : '') + Number(x).toFixed(digits));
// US units first, metric in brackets. 1 inch = 25.4 mm.
const inches = mm => (mm === null ? 'n/a' : (mm / 25.4).toFixed(1));
const rainText = mm => `${inches(mm)} in (${fmt(mm)} mm)`;

// Says whether an early-vs-recent change is bigger than the usual year-to-year swing
// (one standard deviation of the yearly values). Small changes may just be weather noise.
function swing(ind, key, diff, unit, toUnit = x => fmt(x, 1)) {
  const sd = stdev(ind.yearly.map(y => y[key]));
  if (diff === null || sd === null) return '';
  return Math.abs(diff) < sd
    ? ` That is within the normal year-to-year swing (±${toUnit(sd)} ${unit}), so it may not be a real trend.`
    : ` That is bigger than the normal year-to-year swing (±${toUnit(sd)} ${unit}).`;
}

// 'no-cache' asks the server if the file changed, so visitors never see an old crop list.
async function getJson(path, optional = false) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`Could not load ${path} (${res.status})`);
  }
  return res.json();
}

async function getText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
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
  state.myFields = listFields();
  buildInputs();
  buildMap();
  // Open the farmer's last field; with none yet, start on "Add field".
  if (state.myFields.length) await pickPoint(state.myFields[0].lat, state.myFields[0].lon);
  else startAdding();
  state.ready = true;
  $('loading').hidden = true;
  showPage();
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
  $('field-select').addEventListener('change', e => {
    const id = e.target.value;
    const mine = state.myFields.find(f => f.id === id);
    if (id === '__add') startAdding();
    else if (mine) { stopAdding(); pickPoint(mine.lat, mine.lon); }
    else { stopAdding(); selectField(id); }
  });

  $('rotation-select').innerHTML = state.rotations
    .map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');

  $('texture-select').innerHTML = SOIL_TEXTURES.map(t => `<option>${t}</option>`).join('');

  for (const id of ['rotation-select', 'texture-select', 'irrigated', 'no-hay', 'sells-forage']) {
    $(id).addEventListener('change', render);
  }

  // Soil health and erosion start a step higher because soil is this tool's focus.
  const defaults = { water: 3, soil: 4, income: 3, forage: 1, erosion: 4 };
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
    ['heatDays', 'Hot days (>90 °F)'], ['frostFreeDays', 'Frost-free days'],
    ['seasonRainMm', 'Apr–Sep rain (in)'], ['longestDrySpell', 'Longest dry spell'],
  ].map(([k, label]) => `<button type="button" data-key="${k}">${label}</button>`).join('');
  $('trend-toggle').addEventListener('click', e => {
    if (!e.target.dataset.key) return;
    state.trendKey = e.target.dataset.key;
    drawTrendChart();
  });
}

function buildMap() {
  if (typeof L === 'undefined') { $('map').textContent = 'Map could not load (no internet?). Use the field list instead.'; return; }
  // Scroll to zoom and drag to move, so a farmer can find their own fields.
  const map = L.map('map', { scrollWheelZoom: true });
  // Satellite photos (USGS, public domain, US only) make your own fields easy to spot.
  // USGS has photos up to zoom 16; Leaflet enlarges them for closer zooms.
  const satellite = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 18, maxNativeZoom: 16, attribution: 'Imagery: USGS The National Map',
  }).addTo(map);
  const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© OpenStreetMap contributors',
  });
  L.control.layers({ Satellite: satellite, 'Street map': streets }).addTo(map);
  const markers = state.fields.map(f =>
    L.marker([f.lat, f.lon])
      .bindTooltip(`Demo field: ${f.name}<br>${f.place}`)
      .on('click', () => { $('field-select').value = f.id; selectField(f.id); }));
  state.demoLayer = L.featureGroup(markers); // shown only in demo mode
  state.mapBounds = state.demoLayer.getBounds().pad(0.3);
  map.fitBounds([[US.south, US.west], [US.north, US.east]]);
  map.on('click', e => pickPoint(e.latlng.lat, e.latlng.lng));
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
  showField(field);
  fillFieldSelect();
}

// What CropScape recorded on the field on screen, year by year.
function showHistory() {
  const c = state.cache[state.field.id];
  $('history').innerHTML = c.history
    ? Object.entries(c.history).map(([yr, crop]) =>
        `<div class="yr"><b>${yr}</b><span>${esc(crop || 'missing')}</span></div>`).join('')
    : state.field.picked && !c.historyState ? '<p class="muted">Loading crop history…</p>'
    : '<p class="muted">Crop history could not be loaded for this spot (it loads on the live site only).</p>';
}

// Fills the field page from a field that is already loaded in state.cache
// (a demo field or a spot the farmer picked), then redraws everything.
function showField(field) {
  const id = field.id;
  state.field = field;
  $('field-place').textContent = `${field.place} · latitude ${field.lat}, longitude ${field.lon}`;
  $('field-note').textContent = field.note;
  // Only offer rotations meant for this field's region (no soybean in the Nevada desert).
  $('rotation-select').innerHTML = state.rotations
    .filter(r => r.region === 'any' || r.region === field.region)
    .map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  $('rotation-select').value = field.default_rotation;
  $('irrigated').checked = field.irrigated;
  $('sells-forage').checked = !!field.sells_forage;
  const soil = state.cache[id].soil;
  // Match the survey texture to our list, longest name first ("Fine sandy loam" -> "Sandy loam").
  const surveyed = soil && soil.texdesc ? soil.texdesc.toLowerCase() : '';
  const texture = [...SOIL_TEXTURES].sort((a, b) => b.length - a.length)
    .find(t => surveyed.endsWith(t.toLowerCase())) || 'Loam';
  $('texture-select').value = texture;
  showHistory();
  $('texture-hint').textContent = soil && soil.texdesc ? `USDA soil survey says: ${soil.texdesc}. Change it if your field differs.`
                       : soil ? 'The soil survey lists no texture at this exact spot. Pick your soil texture.'
                                       : 'No soil survey data saved for this field. Pick your soil texture.';
  render();
}

// ---------- finding your own field (address, my location, or a map click) ----------

// Same request and years as src/fetch_power.py, so picked spots match the demo fields.
const POWER_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP&community=AG&start=20050101&end=20251231&format=JSON';
// Same query as src/fetch_soil.py: the main soil at this point and its top layer.
const SOIL_URL = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest';
const soilQuery = (lat, lon) => `SELECT TOP 1 mu.mukey, mu.muname, mu.farmlndcl,
  c.compname, c.comppct_r, c.slope_r, c.drainagecl, c.hydgrp,
  h.hzdept_r, h.hzdepb_r, h.om_r, h.awc_r, h.kwfact,
  h.sandtotal_r, h.silttotal_r, h.claytotal_r, tg.texdesc
FROM mapunit mu
JOIN component c ON c.mukey = mu.mukey
LEFT JOIN chorizon h ON h.cokey = c.cokey AND h.hzdept_r = 0
LEFT JOIN chtexturegrp tg ON tg.chkey = h.chkey AND tg.rvindicator = 'Yes'
WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lon} ${lat})'))
ORDER BY c.comppct_r DESC`;
// A box around the lower 48 states: our crop list and the USDA soil survey cover only these.
// A box also takes in edges of Canada and Mexico; there the soil survey simply has no record.
const US = { south: 24.4, north: 49.5, west: -125, east: -66.9 };
// West of the 100th meridian is the classic dry-West line (Powell, 1878; see SOURCES.md).
const DRY_WEST_LON = -100;

const findMsg = (text, isError = false) => {
  $('find-msg').textContent = text;
  $('find-msg').classList.toggle('err', isError);
};

async function fetchPower(lat, lon) {
  const res = await fetch(`${POWER_URL}&latitude=${lat}&longitude=${lon}`);
  if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`);
  return res.json();
}

// Returns the soil record, or null if the survey has nothing here (water, town, or no answer).
async function fetchSoil(lat, lon) {
  try {
    const res = await fetch(SOIL_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'JSON+COLUMNNAME', query: soilQuery(lat, lon) }),
    });
    const table = (await res.json()).Table;
    if (!table || table.length < 2) return null;
    return { ...Object.fromEntries(table[0].map((name, i) => [name, table[1][i]])), source: SOIL_URL };
  } catch (err) { return null; }
}

// Loads NASA weather and the soil survey for any spot in the lower 48, then shows it.
// Satellite greenness is not loaded here: it takes several minutes per spot.
// MODIS greenness (MOD13Q1) for a picked spot: the last two full years, one image every 16 days.
// The ORNL service sends at most 10 images per request and each takes about 40 seconds,
// so the requests run side by side in the background while the farmer reads the rest.
const MODIS_URL = 'https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset';
const NDVI_YEARS = [2023, 2024];
async function fetchNdvi(lat, lon) {
  const dates = NDVI_YEARS.flatMap(y => Array.from({ length: 23 }, (_, i) => `A${y}${String(1 + 16 * i).padStart(3, '0')}`));
  const chunks = [];
  for (let i = 0; i < dates.length; i += 10) chunks.push(dates.slice(i, i + 10));
  const getChunk = async c => {
    try {
      const res = await fetch(`${MODIS_URL}?latitude=${lat}&longitude=${lon}&band=250m_16_days_NDVI` +
        `&startDate=${c[0]}&endDate=${c[c.length - 1]}&kmAboveBelow=0&kmLeftRight=0`, { headers: { Accept: 'application/json' } });
      return res.ok ? res.json() : null;
    } catch (err) { return null; }
  };
  // Try each chunk twice. A chunk that still fails shows up as missing images, never filled in.
  const parts = await Promise.all(chunks.map(async c => (await getChunk(c)) || getChunk(c)));
  const values = {};
  let scale = 0.0001;
  for (const part of parts.filter(Boolean)) {
    scale = Number(part.scale) || scale;
    for (const item of part.subset || []) values[item.calendar_date] = item.data[0];
  }
  return Object.keys(values).length ? { values, scale, fill_value: -3000, source: MODIS_URL } : null;
}

// Crop history from USDA CropScape, through our Netlify Function (CropScape blocks web pages).
// Only works on the live Netlify site; on a plain local server it quietly returns null.
async function fetchHistory(lat, lon) {
  try {
    const res = await fetch(`/.netlify/functions/cropscape?lat=${lat}&lon=${lon}`);
    return res.ok ? (await res.json()).history : null;
  } catch (err) { return null; }
}

// Loads NASA weather and the soil survey for any spot in the lower 48, then shows it.
// Crop history and satellite greenness keep loading in the background and update the page.
// name: the name for a new field (otherwise the name box or "Field N").
async function pickPoint(rawLat, rawLon, name) {
  const lat = Number(Number(rawLat).toFixed(3)), lon = Number(Number(rawLon).toFixed(3)); // about 100 m
  if (lat < US.south || lat > US.north || lon < US.west || lon > US.east) {
    findMsg('That spot is outside the lower 48 states. This tool\'s crop list and soil survey cover only those.', true);
    return false;
  }
  if (state.pin) state.pin.setLatLng([lat, lon]);
  else if (state.map) state.pin = L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#a8701a', fillOpacity: 1 }).addTo(state.map);
  const id = `pt_${lat}_${lon}`;
  const ticket = (state.pickTicket = (state.pickTicket || 0) + 1); // ignore answers for older clicks
  if (!state.cache[id]) {
    findMsg('Getting 21 years of NASA weather and your soil survey…');
    try {
      const [power, soil] = await Promise.all([fetchPower(lat, lon), fetchSoil(lat, lon)]);
      state.cache[id] = { power, ind: computeFieldIndicators(power, null), soil, history: null, ndviState: 'loading' };
      loadExtras(id, lat, lon);
    } catch (err) {
      console.error('pick point', err);
      if (ticket === state.pickTicket) findMsg('Couldn\'t reach NASA right now. Try again in a minute.', true);
      return false;
    }
  }
  if (ticket !== state.pickTicket) return false;

  // Which of the farmer's fields is this? A new one when adding; otherwise moving a click
  // moves the field on screen; a spot already saved just opens that field.
  let mine = state.myFields.find(f => f.id === id);
  if (!mine) {
    const current = state.field && state.field.picked && !state.adding
      ? state.myFields.find(f => f.id === state.field.id) : null;
    if (current) Object.assign(current, { id, lat, lon });
    else {
      const typed = $('field-name').value.trim();
      state.myFields.unshift({ id, lat, lon, name: name || typed || `Field ${state.myFields.length + 1}` });
    }
    mine = state.myFields.find(f => f.id === id);
    saveFields(state.myFields);
  }
  stopAdding();
  const region = lon < DRY_WEST_LON ? 'west' : 'east';
  const field = {
    id, picked: true, name: mine.name, place: mine.name, lat, lon, region,
    irrigated: false, sells_forage: false,
    default_rotation: state.rotations.find(r => r.region === region || r.region === 'any').id,
    note: 'Weather (NASA POWER) and soil (USDA soil survey) for this spot were loaded live. ' +
          'Crop history (USDA CropScape) and satellite greenness (MODIS) load in the background.',
  };
  showField(field);
  fillFieldSelect();
  findMsg(state.cache[id].soil ? 'Done. Not the right spot? Click your field on the map to move it.'
                               : 'Done, but the USDA soil survey has no record here (water, a town, or outside the US). Click right on your field, or pick your soil type on step 4.');
  return true;
}

// Background loads for a picked spot. When each one arrives, redraw if that field is on screen.
async function loadExtras(id, lat, lon) {
  const onScreen = () => state.field && state.field.id === id;
  fetchHistory(lat, lon).then(history => {
    state.cache[id].history = history;
    state.cache[id].historyState = history ? 'done' : 'failed';
    if (onScreen()) showHistory();
  });
  const ndvi = await fetchNdvi(lat, lon);
  const c = state.cache[id];
  c.ndviState = ndvi ? 'done' : 'failed';
  if (ndvi) c.ind = computeFieldIndicators(c.power, ndvi);
  if (onScreen()) render();
}

// ---------- My fields: the farmer's own named fields (kept in this browser) ----------

function fillFieldSelect() {
  const mine = state.myFields.map(f => `<option value="${f.id}">${esc(f.name)}</option>`);
  const demo = state.demo ? state.fields.map(f => `<option value="${f.id}">Demo: ${esc(f.name)}</option>`) : [];
  $('field-select').innerHTML = [...mine, ...demo, '<option value="__add">+ Add field</option>'].join('');
  $('field-select').value = state.adding || !state.field ? '__add' : state.field.id;
  const own = state.field && state.field.picked && !state.adding;
  $('field-name').value = state.adding ? `Field ${state.myFields.length + 1}` : state.field ? state.field.name : '';
  $('field-name').disabled = !(own || state.adding);
  $('field-name-label').textContent = state.adding ? 'Name this field' : 'Field name';
  $('remove-field').hidden = !own;
}

function startAdding() {
  state.adding = true;
  $('finder').hidden = false;
  fillFieldSelect();
  findMsg('Type an address, use your location, or click your field on the map.');
  $('find-address').focus();
}

function stopAdding() {
  state.adding = false;
  $('finder').hidden = state.myFields.length > 0 || state.demo;
}

function renameField(text) {
  const mine = state.field && state.myFields.find(f => f.id === state.field.id);
  if (!mine || state.adding) return;
  mine.name = text.trim() || mine.name;
  state.field.name = state.field.place = mine.name;
  saveFields(state.myFields);
  const option = $('field-select').querySelector(`option[value="${mine.id}"]`);
  if (option) option.textContent = mine.name;
}

function removeField() {
  if (!state.field || !state.field.picked) return;
  if (!confirm(`Remove "${state.field.name}" from your fields? Saved checks stay on My farm.`)) return;
  state.myFields = state.myFields.filter(f => f.id !== state.field.id);
  saveFields(state.myFields);
  state.field = null;
  if (state.myFields.length) pickPoint(state.myFields[0].lat, state.myFields[0].lon);
  else startAdding();
}

// ---------- Demo mode: two sample fields with saved data, for judges and first-time visitors ----------

function setDemo(on) {
  state.demo = on;
  $('demo-toggle').textContent = on ? 'Turn off demo mode' : 'Try demo mode (sample fields)';
  $('demo-banner').hidden = !on;
  if (state.map && state.demoLayer) on ? state.demoLayer.addTo(state.map) : state.demoLayer.remove();
  if (on) {
    stopAdding();
    selectField(state.fields[0].id).then(() => { fillFieldSelect(); location.hash = 'field'; showPage(); });
  } else {
    if (state.field && !state.field.picked) state.field = null;
    if (state.myFields.length) pickPoint(state.myFields[0].lat, state.myFields[0].lon);
    else startAdding();
  }
}

async function findAddress(text) {
  if (!text.trim()) { findMsg('Type an address or a town first.', true); return; }
  // OpenStreetMap's free search asks for one search at a time, so the button waits.
  $('find-go').disabled = true;
  findMsg('Looking up that address…');
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(text)}`);
    const [hit] = await res.json();
    if (!hit) { findMsg('Couldn\'t find that address. Try adding the town and state, or scroll the map instead.', true); return; }
    if (state.map) state.map.setView([Number(hit.lat), Number(hit.lon)], 16);
    await pickPoint(Number(hit.lat), Number(hit.lon));
  } catch (err) {
    findMsg('Address search is not answering right now. Scroll the map to your field instead.', true);
  } finally {
    setTimeout(() => { $('find-go').disabled = false; }, 1000);
  }
}

function findMe() {
  if (!navigator.geolocation) { findMsg('This browser cannot share your location. Type your address instead.', true); return; }
  findMsg('Asking your browser where you are…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      if (state.map) state.map.setView([pos.coords.latitude, pos.coords.longitude], 16);
      pickPoint(pos.coords.latitude, pos.coords.longitude);
    },
    () => findMsg('Location was not shared. Type your address or scroll the map instead.', true),
    { timeout: 15000 });
}

// The field object the scoring code needs, built from the current inputs.
function currentField() {
  const c = state.cache[state.field.id];
  return { id: state.field.id, region: state.field.region, picked: !!state.field.picked, ind: c.ind, soil: c.soil,
           irrigated: $('irrigated').checked, texture: $('texture-select').value,
           sellsForage: $('sells-forage').checked };
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
      `${signed(ind.frostFree.diff)} day(s) compared with ${early}.` + swing(ind, 'frostFreeDays', ind.frostFree.diff, 'days', x => fmt(x)) +
      ' More days can leave room for a cover crop or a second crop.'),
    card('Frost risk dates', `${dayToDateLabel(ind.medianLastSpringFrost)} → ${dayToDateLabel(ind.medianFirstFallFrost)}`,
      'Usual last spring frost and first fall frost, at or below 32 °F (0 °C) (middle year of 21). Frost-sensitive crops should sit between them.', true),
    card('Hot summer days', `${fmt(ind.heat.recent)} / year`,
      `Days above 90 °F (32 °C) in June–August. ${signed(ind.heat.diff)} compared with ${early}.` +
      swing(ind, 'heatDays', ind.heat.diff, 'days', x => fmt(x)), ind.heat.recent >= 20),
    card('Growing-season rain', rainText(ind.rain.recent),
      `April–September total. ${signed(ind.rain.diff / 25.4, 1)} in compared with ${early}.` +
      swing(ind, 'seasonRainMm', ind.rain.diff, 'in', inches)),
    card('Longest dry spell', `${fmt(ind.drySpell.recent)} days`,
      `Longest run of days with under 0.04 in (1 mm) of rain in April–September. ${signed(ind.drySpell.diff, 1)} days compared with ${early}.` +
      swing(ind, 'longestDrySpell', ind.drySpell.diff, 'days')),
    card('Extreme-rain days', `${fmt(ind.extremeRain.recent, 1)} / year`,
      `Days with over 2 in (50 mm) of rain, which can wash bare soil away. ${signed(ind.extremeRain.diff, 1)} compared with ${early}.` +
      swing(ind, 'extremeRainDays', ind.extremeRain.diff, 'days')),
    card('Summer soil-moisture anomaly', `${signed(summerAnom, 1)} points`,
      (drySummer.length ? `Root-zone soil was drier than usual in ${drySummer.map(m => m.name).join(', ')} in ${recent}.`
                        : `Root-zone soil was as wet as or wetter than usual in summer in ${recent}.`) +
      ' Wetness runs 0 (dry) to 100 (soaked); this is recent June–August minus the 21-year average.', drySummer.length > 0),
  ].join('');

  $('soil-card').innerHTML = soil ? [
    card('Soil type', esc(soil.compname), esc(soil.muname)),
    card('Slope', `${fmt(soil.slope_r)}%`, Number(soil.slope_r) >= 7 ? 'Sloped ground: bare soil here washes away more easily.' : 'Fairly flat ground.', Number(soil.slope_r) >= 7),
    card('Drainage', esc(soil.drainagecl || 'n/a'), `Hydrologic group ${esc(soil.hydgrp || 'n/a')} (A soaks in fast, D runs off).`),
    soil.om_r === null || soil.om_r === undefined
      ? card('Topsoil', 'n/a', 'The soil survey has no topsoil numbers at this exact spot (often town land, a building or water). Try clicking right on the field.')
      : card('Topsoil', `${fmt(soil.om_r, 1)}% organic matter`, `Holds about ${soil.awc_r === null ? 'n/a' : fmt(soil.awc_r * 12, 1)} in of water per foot of soil. ${esc(soil.texdesc || '')}.`),
  ].join('') : '<p class="muted">No soil survey data saved for this field.</p>';

  drawTrendChart();
  drawNdviChart();
}

function drawTrendChart() {
  const ind = state.cache[state.field.id].ind;
  const labels = { heatDays: 'Hot days (>90 °F)', frostFreeDays: 'Frost-free days',
                   seasonRainMm: 'Apr–Sep rain (in)', longestDrySpell: 'Longest dry spell (days)' };
  const value = y => (state.trendKey === 'seasonRainMm' ? Number(inches(y.seasonRainMm)) : y[state.trendKey]);
  document.querySelectorAll('#trend-toggle button')
    .forEach(b => b.classList.toggle('on', b.dataset.key === state.trendKey));
  if (typeof Chart === 'undefined') return;
  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart($('trend-chart'), {
    type: 'line',
    data: {
      labels: ind.yearly.map(y => y.year),
      datasets: [{ label: labels[state.trendKey], data: ind.yearly.map(value),
                   borderColor: '#2c5d8a', backgroundColor: '#2c5d8a', tension: 0.25 }],
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } },
  });
}

function drawNdviChart() {
  const ndvi = state.cache[state.field.id].ind.ndvi;
  if (state.charts.ndvi) { state.charts.ndvi.destroy(); state.charts.ndvi = null; }
  if (!ndvi.available) {
    const st = state.cache[state.field.id].ndviState;
    $('ndvi-note').textContent = st === 'loading'
      ? 'Loading satellite greenness for this spot (a minute or two). This page updates by itself.'
      : st === 'failed' ? 'The satellite greenness service did not answer. Bare months come from the crop calendar instead.'
      : 'Satellite greenness data is not saved for this field yet. Run src/fetch_ndvi.py.';
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
  state.results = results; // kept so "Save to My farm" saves exactly what is on screen
  // Results changed, so the AI helper starts a fresh chat with the new numbers next time.
  if (state.chat && state.chat.length) addChatNote('Your results changed. The helper will use the new numbers from here on.');
  state.chat = [];
  renderHelperContext();
  const best = Math.max(...results.slice(1).map(r => r.total));

  $('risk-strip').innerHTML = monthStrip(results[0], true);
  $('finding').innerHTML = findingSentence(results);
  renderSoilCheck(results[0]);

  const fewNote = results.length < 3
    ? `<p class="muted">Only ${results.length - 1} alternative fits your region and limits. Untick "no hay equipment" to see more.</p>` : '';
  const litNow = results[0].warnings.filter(w => w.lit).length;
  const label = id => results[0].warnings.find(w => w.id === id).label.toLowerCase();
  $('options').innerHTML = fewNote + results.map(r => {
    const lit = r.warnings.filter(w => w.lit).length;
    const fixLine = r.isCurrent
      ? `<strong>${lit} of 4</strong> soil warning signs on`
      : litNow === 0 ? 'No warning signs to fix on this field'
        : `Clears <strong>${r.fixes.length} of ${litNow}</strong> warning sign${litNow === 1 ? '' : 's'} under our rules`;
    const addLine = r.adds.length ? `<p class="adds">Adds a new warning: ${r.adds.map(label).join(', ')}</p>` : '';
    return `
    <article class="option ${r.isCurrent ? 'current' : ''} ${!r.isCurrent && r.total === best ? 'best' : ''}">
      <span class="badge">${r.isCurrent ? 'What you grow now' : r.total === best ? 'Best fit for your priorities' : 'Alternative'}</span>
      <h3>${esc(r.rotation.name)}</h3>
      <p class="seq">${esc(sequenceText(r.rotation))}</p>
      <p class="cover-line">Cover in the heavy-rain season (RUSLE C): <strong>${Math.round(r.sub.erosion.score)}%</strong>${r.isCurrent ? '' : ` <span class="muted">(now ${Math.round(results[0].sub.erosion.score)}%)</span>`}</p>
      <p class="fixes">${fixLine}</p>
      ${addLine}
      <ul class="mini-signs">${r.warnings.map(w =>
        `<li class="${w.lit ? 'on' : 'off'}"><span class="dot" aria-hidden="true"></span>${esc(w.label)}: ${w.lit ? 'warning' : 'OK'}</li>`).join('')}</ul>
      <div>
        <p class="small muted" style="margin:.2rem 0">Months with a crop growing (green) vs bare (tan) · bare months: ${r.bareMonths.length || 'none'}</p>
        <div class="month-strip">${monthStrip(r, false)}</div>
      </div>
      <div class="fit"><span class="big">${r.total}</span><span class="muted">/ 100 fit for your priorities</span></div>
      <div class="bars">${Object.entries(PRIORITIES).map(([k, name]) => `
        <div class="bar"><span>${name}</span><span class="track"><span class="fill" style="width:${Math.round(r.sub[k].score)}%; display:block"></span></span><span>${Math.round(r.sub[k].score)}</span></div>`).join('')}
      </div>
      <div class="box why"><h4>Why suggested</h4>${list(r.explain.why)}</div>
      <details class="evidence-more">
        <summary>Evidence, benefits, what we don't know (${r.explain.unknowns.length}), what to check locally</summary>
        <div class="box evidence"><h4>Evidence</h4>${list(r.explain.evidence)}</div>
        <div class="box benefits"><h4>Benefits</h4>${list(r.explain.benefits)}</div>
        <div class="box unknowns"><h4>What we don't know</h4>${list(r.explain.unknowns)}</div>
        <div class="box check"><h4>Check locally</h4>${list(r.explain.checkLocally)}</div>
      </details>
    </article>`;
  }).join('');
}

// The hero: one headline sentence and four warning-sign tiles for what the farmer grows now.
function renderSoilCheck(current) {
  const lit = current.warnings.filter(w => w.lit).length;
  const ndvi = state.cache[state.field.id].ind.ndvi;
  const monthly = state.cache[state.field.id].ind.monthly;
  let satellite = '';
  if (ndvi.available) {
    const bare = ndvi.byMonth.filter(m => m.bare);
    const total = monthly.reduce((s, m) => s + m.extremeRainPerYear, 0);
    const inBare = bare.reduce((s, m) => s + monthly[m.month - 1].extremeRainPerYear, 0);
    if (bare.length && total > 0) {
      satellite = ` Satellites saw this spot with little plant cover in ${bare.map(m => m.name).join(', ')}, ` +
        `the months that get ${Math.round(inBare / total * 100)}% of its heavy-rain days. ` +
        `<span class="tag tag-modis">MODIS NDVI</span> <span class="tag">NASA POWER</span>`;
    }
  }
  const factors = erosionFactors(current, currentField());
  const cover = factors.find(f => f.id === 'C');
  $('headline').innerHTML = `<p class="big-line">With what you grow now, your soil is covered for <strong>${cover.value.replace(' covered', '')}</strong> of the heavy-rain season.</p>` +
    (satellite ? `<p>${satellite}</p>` : '') +
    `<p>${lit} of 4 soil warning sign${lit === 1 ? ' is' : 's are'} on (below).</p>`;
  const statusWord = { measured: 'From data', partial: 'Stand-in', unknown: 'Unknown' };
  $('rusle-factors').innerHTML = factors.map(f => `
    <div class="factor ${f.status}${f.changes ? ' changes' : ''}">
      <p class="letter">${f.id}</p>
      <h4>${esc(f.name)} <span class="term">(${esc(f.term)})</span></h4>
      <p class="fvalue">${esc(f.value)}</p>
      <p class="fstatus">${statusWord[f.status]}${f.changes ? ' · you control this one' : ''}</p>
      <p class="fnote">${esc(f.note)}</p>
      <p class="source">${esc(f.source)}</p>
    </div>`).join('');
  $('soil-check').innerHTML = current.warnings.map(w => `
    <div class="sign ${w.lit ? 'on' : 'off'}">
      <p class="status">${w.lit ? 'Warning' : 'OK'}</p>
      <h3>${esc(w.label)}</h3>
      <p class="number">${esc(w.number)}</p>
      <p class="reason">${esc(w.reason)}</p>
      <p class="source">${esc(w.source)}</p>
    </div>`).join('');
}

// One plain sentence at the top: which option fits best and the biggest reasons why.
function findingSentence(results) {
  const [current, ...alts] = results;
  if (!alts.length) return '';
  const top = alts.reduce((a, b) => (b.total > a.total ? b : a));
  const field = state.field;
  const litNow = current.warnings.filter(x => x.lit).length;
  const fixes = litNow && top.fixes.length
    ? ` Under our rules it clears ${top.fixes.length} of the ${litNow} soil warning sign${litNow === 1 ? '' : 's'} on your field.` : '';
  if (top.total <= current.total) {
    return `<strong>For ${esc(field.place)}:</strong> what you grow now (${current.total}/100) already fits your priorities ` +
           `as well as any option we checked. Moving the sliders may change that.`;
  }
  const w = weights();
  const gains = Object.keys(PRIORITIES)
    .map(k => ({ k, d: top.sub[k].score - current.sub[k].score, wd: w[k] * (top.sub[k].score - current.sub[k].score) }))
    .filter(g => g.d > 0 && w[g.k] > 0).sort((a, b) => b.wd - a.wd).slice(0, 2);
  const why = gains.length ? `, mostly from ${gains.map(g => `${PRIORITIES[g.k].toLowerCase()} (+${Math.round(g.d)})`).join(' and ')}` : '';
  return `<strong>For ${esc(field.place)}:</strong> “${esc(top.rotation.name)}” scores ${top.total}/100 against ` +
         `${current.total} for what you grow now${why}.${fixes} Take it to your extension agent before changing anything.`;
}

// ---------- pages ----------
// The site is one HTML file with several <section class="page">. The #hash in the address
// (#home, #field, #compare...) picks which one shows, so Back buttons and bookmarks work.
const PAGES = ['home', 'how', 'field', 'soil', 'year', 'compare', 'myfarm', 'science', 'ask'];
const STEPS = ['field', 'soil', 'year', 'compare'];

function showPage() {
  // Old #account links open the sign-in pop-up over the home page.
  if (location.hash === '#account') { history.replaceState(null, '', '#home'); openSignIn(); }
  let id = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  // Steps 2 to 4 need a field. Send the farmer back to step 1 until they add one.
  if (state.ready && !state.field && ['soil', 'year', 'compare'].includes(id)) {
    history.replaceState(null, '', '#field');
    id = 'field';
    findMsg('Add your field first.', true);
  }
  document.querySelectorAll('.page').forEach(p => { p.hidden = p.dataset.page !== id; });
  document.querySelectorAll('[data-nav]').forEach(a =>
    a.classList.toggle('on', a.dataset.nav.split(' ').includes(id)));
  document.querySelectorAll('.progress li').forEach(li => {
    li.classList.toggle('on', li.dataset.step === id);
    li.classList.toggle('done', STEPS.indexOf(li.dataset.step) < STEPS.indexOf(id));
  });
  $('nav-links').classList.remove('open');
  $('nav-toggle').setAttribute('aria-expanded', 'false');
  window.scrollTo(0, 0);
  // The map and charts measure their size when drawn; tell them their page is now visible.
  // A map drawn while hidden zooms out to the whole world, so re-fit it to the fields.
  if (state.map && id === 'field') {
    state.map.invalidateSize();
    // Keep the farmer's own spot in view; otherwise show the two demo fields.
    if (state.field && state.field.picked) state.map.setView([state.field.lat, state.field.lon], Math.max(state.map.getZoom(), 14));
    else if (state.field) state.map.fitBounds(state.mapBounds);
    else state.map.fitBounds([[US.south, US.west], [US.north, US.east]]);
  }
  Object.values(state.charts).forEach(c => c && c.resize());
  if (id === 'myfarm') renderSaved();
  if (id === 'ask') renderHelperContext();
}

// ---------- My farm: saved checks ----------

function saveCurrentCheck() {
  if (!state.results) return;
  const [current, ...alts] = state.results;
  const check = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    fieldId: state.field.id, fieldName: state.field.name, place: state.field.place,
    lat: state.field.lat, lon: state.field.lon, // rounded to 3 decimals; the typed address is never saved
    rotationId: $('rotation-select').value, rotationName: current.rotation.name,
    irrigated: $('irrigated').checked, texture: $('texture-select').value,
    noHay: $('no-hay').checked, sellsForage: $('sells-forage').checked,
    weights: weights(),
    cover: Math.round(current.sub.erosion.score),
    warningsOn: current.warnings.filter(w => w.lit).length,
    options: [current, ...alts].map(r => ({ name: r.rotation.name, total: r.total, isCurrent: r.isCurrent })),
  };
  $('save-msg').innerHTML = saveCheck(check)
    ? 'Saved. Find it any time on <a href="#myfarm">My farm</a>.'
    : 'Could not save: this browser is blocking storage (private window?).';
}

const dateText = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function renderSaved() {
  const checks = listChecks();
  if (!checks.length) {
    $('saved-list').innerHTML = `<div class="empty panel-card"><p>No saved checks yet.</p>
      <a class="btn btn-primary" href="#field">Check my field</a></div>`;
    return;
  }
  $('saved-list').innerHTML = checks.map((c, i) => {
    const now = c.options.find(o => o.isCurrent);
    const best = c.options.filter(o => !o.isCurrent).sort((a, b) => b.total - a.total)[0];
    // The older check for the same field, so the farmer can see what changed over time.
    const prev = checks.slice(i + 1).find(p => p.fieldId === c.fieldId);
    const change = prev
      ? `<p class="change">Since ${dateText(prev.savedAt)}: heavy-rain cover ${prev.cover}% → ${c.cover}%, warning signs ${prev.warningsOn} → ${c.warningsOn}.</p>` : '';
    return `<article class="saved panel-card">
      <p class="small muted">Saved ${dateText(c.savedAt)}</p>
      <h3>${esc(c.fieldName)} <span class="small muted">${esc(c.place)}</span></h3>
      <dl class="saved-stats">
        <div><dt>You grow</dt><dd>${esc(c.rotationName)} · ${now.total}/100</dd></div>
        <div><dt>Heavy-rain cover</dt><dd>${c.cover}%</dd></div>
        <div><dt>Warning signs on</dt><dd>${c.warningsOn} of 4</dd></div>
        <div><dt>Best fit option</dt><dd>${best ? `${esc(best.name)} · ${best.total}/100` : 'none'}</dd></div>
      </dl>
      ${change}
      <div class="saved-actions">
        <button type="button" class="btn btn-primary" data-open="${c.id}">Open</button>
        <button type="button" class="btn btn-ghost" data-delete="${c.id}">Remove</button>
      </div>
    </article>`;
  }).join('');
}

// Puts a saved check's answers back into the inputs and opens the comparison.
async function openCheck(id) {
  const c = listChecks().find(x => x.id === id);
  if (!c || !state.ready) return; // data still loading
  if (c.fieldId.startsWith('pt_')) {
    if (!(await pickPoint(c.lat, c.lon, c.fieldName))) { location.hash = 'field'; return; }
  } else {
    $('field-select').value = c.fieldId;
    await selectField(c.fieldId);
  }
  $('rotation-select').value = c.rotationId;
  $('irrigated').checked = c.irrigated;
  $('texture-select').value = c.texture;
  $('no-hay').checked = c.noHay;
  $('sells-forage').checked = c.sellsForage;
  for (const [k, v] of Object.entries(c.weights)) {
    if ($(`w-${k}`)) { $(`w-${k}`).value = v; $(`o-${k}`).textContent = v; }
  }
  render();
  location.hash = 'compare';
}

// ---------- Account: optional sign-in (the Firebase code is in cloud.js) ----------

const SIGN_IN_ERRORS = {
  'auth/invalid-credential': 'That email and password do not match an account.',
  'auth/email-already-in-use': 'There is already an account with that email. Try Sign in.',
  'auth/weak-password': 'Please use at least 6 characters.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/unauthorized-domain': 'Google sign-in is not allowed on this web address yet.',
  'auth/operation-not-allowed': 'This sign-in method is not turned on yet. Use your email and a password for now.',
};
// The Firebase code in brackets helps the team find the cause.
const signInError = err => `${SIGN_IN_ERRORS[err.code] || 'Sign-in did not work.'} (${err.code || err.message})`;

function renderAccount() {
  const c = window.cloud || {};
  const user = c.user;
  $('nav-account').textContent = user ? 'Account' : 'Sign in';
  $('signed-out').hidden = !!user; // the form always shows when signed out, even before Firebase is set up
  $('signed-in').hidden = !user;
  $('account-status').textContent =
    user ? `Signed in as ${user.email || 'a Google account'}. Your saved checks follow you to any device.`
    : c.ready ? 'You are not signed in.'
    : c.reason === 'loading' ? 'Checking sign-in…'
    : 'Sign in or create an account with your email and a password.';
  $('account-note').textContent = user
    ? 'Saved to your account and this browser. Only you can see them.'
    : 'Saved on this device only. Sign in to keep them on any device.';
  if (location.hash === '#myfarm') renderSaved();
}

async function runSignIn(action) {
  $('account-error').textContent = '';
  if (!window.cloud || !window.cloud.ready) {
    $('account-error').textContent = window.cloud && window.cloud.reason === 'loading'
      ? 'Still connecting. Try again in a moment.'
      : 'Sign-in is not connected yet: add the Firebase config in js/firebase-config.js (see the README). Your checks still save in this browser.';
    return;
  }
  try { await action(); } catch (err) { $('account-error').textContent = signInError(err); }
}

// The sign-in pop-up. CSS fades it in; closeSignIn lets it fade out before it closes.
function openSignIn() {
  const d = $('signin-dialog');
  if (d.open) return;
  renderAccount();
  $('account-error').textContent = '';
  d.classList.remove('closing');
  d.showModal();
}
function closeSignIn() {
  const d = $('signin-dialog');
  if (!d.open || d.classList.contains('closing')) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { d.close(); return; }
  d.classList.add('closing');
  // 180 ms matches the fade-out in style.css. A timer always fires; animationend sometimes doesn't.
  setTimeout(() => { d.classList.remove('closing'); d.close(); }, 180);
}
$('nav-account').addEventListener('click', openSignIn);
$('signin-close').addEventListener('click', closeSignIn);
$('go-myfarm').addEventListener('click', closeSignIn);
// A click on the dimmed area outside the box lands on the <dialog> itself.
$('signin-dialog').addEventListener('click', e => { if (e.target === $('signin-dialog')) closeSignIn(); });
$('signin-dialog').addEventListener('cancel', e => { e.preventDefault(); closeSignIn(); }); // Esc key

$('google-signin').addEventListener('click', () => runSignIn(() => window.cloud.signIn()));
$('email-form').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('email').value.trim(), pw = $('password').value;
  const up = e.submitter && e.submitter.dataset.mode === 'up';
  runSignIn(() => (up ? window.cloud.signUpEmail(email, pw) : window.cloud.signInEmail(email, pw)));
});
$('sign-out').addEventListener('click', () => runSignIn(() => window.cloud.signOut()));
window.addEventListener('cloud-change', renderAccount);

// ---------- AI helper: answers questions about the results on screen ----------
// The scores come from scoring.js. The helper only gets a text copy of what the page
// already shows and is told to explain it, not to decide. The AI call and its rules (HELPER_RULES)
// are in netlify/functions/ask.mjs, which runs on Netlify so the API key stays secret.

function resultsForHelper() {
  const f = state.field;
  const text = id => ($(id) ? $(id).innerText.replace(/\n{2,}/g, '\n').trim() : '');
  const options = state.results.map(r => [
    `OPTION: ${r.rotation.name}${r.isCurrent ? ' (what the farmer grows now)' : ''}`,
    `Fit score: ${r.total}/100. Sub-scores: ${Object.entries(r.sub).map(([k, v]) => `${k} ${Math.round(v.score)}`).join(', ')}`,
    `Soil warning signs on: ${r.warnings.filter(w => w.lit).map(w => w.label).join('; ') || 'none'}`,
    `Why suggested: ${r.explain.why.join(' ')}`,
    `Evidence: ${r.explain.evidence.join(' ')}`,
    `Benefits: ${r.explain.benefits.join(' ')}`,
    `What we don't know: ${r.explain.unknowns.join(' ')}`,
    `Check locally: ${r.explain.checkLocally.join(' ')}`,
  ].join('\n'));
  return [
    `FIELD: ${f.name}, ${f.place}. Irrigated: ${$('irrigated').checked ? 'yes' : 'no'}. Soil texture: ${$('texture-select').value}.`,
    `FARMER PRIORITIES (0-5): ${Object.entries(weights()).map(([k, v]) => `${k} ${v}`).join(', ')}`,
    `HEADLINE: ${text('finding')}`,
    `WEATHER CARDS:\n${text('weather-cards')}`,
    `SOIL CARD:\n${text('soil-card')}`,
    `SOIL CHECK:\n${text('soil-check')}`,
    ...options,
  ].join('\n\n');
}

// Fills the "Answering about" card: which field, rotation and scores the helper sees.
function renderHelperContext() {
  if (!state.results || !state.field) { $('helper-context').textContent = 'Loading your field…'; return; }
  const [current, ...alts] = state.results;
  const top = alts.slice().sort((x, y) => y.total - x.total)[0];
  $('helper-context').innerHTML = `
    <strong>${esc(state.field.name)}</strong>
    <span class="place">${esc(state.field.place)}</span>
    <dl>
      <div><dt>You grow</dt><dd>${esc(current.rotation.name)} · ${current.total}/100</dd></div>
      ${top ? `<div><dt>Top alternative</dt><dd>${esc(top.rotation.name)} · ${top.total}/100</dd></div>` : ''}
      <div><dt>Soil warning signs on</dt><dd>${current.warnings.filter(w => w.lit).length} of ${current.warnings.length}</dd></div>
    </dl>`;
}

const LEAF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

// Adds one chat bubble and returns the element that holds its text.
// who: 'you', 'bot' or 'err'. Text goes in with textContent, never innerHTML,
// so an AI answer can't inject code into the page.
function addMessage(who, words) {
  $('helper-empty').hidden = true;
  const row = document.createElement('div');
  row.className = `row ${who}`;
  if (who !== 'you') row.innerHTML = `<span class="chat-avatar">${LEAF_SVG}</span>`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  // The bot's name heads every answer, and while it thinks: "Field Helper Buddy is thinking" + dots.
  // The chat header and the note under the chat still say these are AI answers.
  if (who === 'bot') bubble.innerHTML = `<span class="who">${words === null ? 'Field Helper Buddy is thinking' : 'Field Helper Buddy'}</span>`;
  const text = document.createElement('span');
  if (words === null) text.innerHTML = '<span class="typing" aria-label="Thinking"><span></span><span></span><span></span></span>';
  else text.textContent = words;
  bubble.appendChild(text);
  row.appendChild(bubble);
  $('helper-log').appendChild(row);
  $('helper-log').scrollTop = $('helper-log').scrollHeight;
  return text;
}

// A small centered line in the chat, e.g. when the results change.
function addChatNote(words) {
  const p = document.createElement('p');
  p.className = 'chat-note';
  p.textContent = words;
  $('helper-log').appendChild(p);
}

function clearChat() {
  $('helper-log').querySelectorAll('.row, .chat-note').forEach(el => el.remove());
  $('helper-empty').hidden = false;
  $('helper-log').scrollTop = 0;
  state.chat = [];
}

// What the helper says for each kind of failure. Your results never change either way.
const HELPER_ERRORS = {
  'not-set-up': 'The AI helper is not set up on this copy of the site yet (no OpenRouter key on Netlify). Every score and explanation in the tool still works without it.',
  'no-server': 'The AI helper only runs on the live Netlify site, not on a plain local server. Every score and explanation still works here.',
  busy: 'The free AI service is busy right now. Wait a minute and try again. Everything on your results pages still works.',
  other: 'The helper could not answer right now. Try again in a moment. Your results are unchanged.',
};

// Some models add markdown (**bold**, # headings) even when told not to; show plain text instead.
const plainText = s => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s+/gm, '').replace(/^\s*[*-]\s+/gm, '• ');

async function askHelper(question) {
  addMessage('you', question);
  if (!state.results) { addMessage('err', 'Your results are still loading. Try again in a moment.'); return; }
  const answer = addMessage('bot', null);
  $('helper-send').disabled = true;
  try {
    // Free AI models can stall; give up after 25 seconds instead of spinning forever.
    const stop = new AbortController();
    setTimeout(() => stop.abort(), 25000);
    const res = await fetch('/.netlify/functions/ask', {
      signal: stop.signal,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ results: resultsForHelper(), history: state.chat, question }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.answer) {
      const kind = !data ? 'no-server' : data.error === 'not-set-up' ? 'not-set-up' : data.error === 'busy' ? 'busy' : 'other';
      throw Object.assign(new Error(kind), { kind });
    }
    answer.textContent = plainText(data.answer);
    answer.closest('.row').querySelector('.who').textContent = 'Field Helper Buddy';
    state.chat.push({ role: 'user', content: question }, { role: 'assistant', content: data.answer });
  } catch (err) {
    console.error('AI helper', err);
    if (err.name === 'AbortError') err.kind = 'busy';
    const row = answer.closest('.row');
    row.className = 'row err';
    row.querySelector('.who')?.remove();
    answer.textContent = HELPER_ERRORS[err.kind] || HELPER_ERRORS.other;
  } finally {
    $('helper-send').disabled = false;
    $('helper-log').scrollTop = $('helper-log').scrollHeight;
  }
}

// The text box grows with what you type, up to a few lines.
function fitInput() {
  const box = $('helper-input');
  box.style.height = 'auto';
  box.style.height = `${box.scrollHeight}px`;
}

$('helper-form').addEventListener('submit', e => {
  e.preventDefault();
  const question = $('helper-input').value.trim();
  if (!question || $('helper-send').disabled) return;
  $('helper-input').value = '';
  fitInput();
  askHelper(question);
});
$('helper-input').addEventListener('input', fitInput);
$('helper-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('helper-form').requestSubmit(); }
});
$('helper-chips').addEventListener('click', e => {
  if (e.target.classList.contains('chip')) askHelper(e.target.textContent);
});
$('helper-new').addEventListener('click', clearChat);

$('nav-toggle').addEventListener('click', () => {
  const open = $('nav-links').classList.toggle('open');
  $('nav-toggle').setAttribute('aria-expanded', String(open));
});
$('save-check').addEventListener('click', saveCurrentCheck);
$('saved-list').addEventListener('click', e => {
  const open = e.target.dataset.open, del = e.target.dataset.delete;
  if (open) openCheck(Number(open));
  if (del) { deleteCheck(Number(del)); renderSaved(); }
});
$('find-form').addEventListener('submit', e => { e.preventDefault(); findAddress($('find-address').value); });
$('find-me').addEventListener('click', findMe);
$('field-name').addEventListener('input', e => renameField(e.target.value));
$('remove-field').addEventListener('click', removeField);
$('demo-toggle').addEventListener('click', () => setDemo(!state.demo));
window.addEventListener('hashchange', showPage);
showPage();
init();
