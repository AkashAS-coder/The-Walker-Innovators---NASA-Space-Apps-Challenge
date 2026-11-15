// app.js
// Page code: loads the saved data files, draws the field report, and redraws the
// three option cards whenever the farmer changes an input. All the math lives in
// indicators.js and scoring.js; this file only reads inputs and writes HTML.

const state = {
  fields: [],
  crops: {},
  rotationByFarmer: {}, // field id -> true once the farmer picked the crop cycle themselves
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
    // Ask for the three small files at the same time instead of one after another.
    const [fields, cropsCsv, rotationsCsv] = await Promise.all([
      getJson('data/fields.json'), getText('data/crops.csv'), getText('data/rotations.csv')]);
    state.fields = fields;
    state.crops = parseCrops(parseCsv(cropsCsv));
    state.rotations = parseRotations(parseCsv(rotationsCsv), state.crops);
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
  if (state.exampleWanted) showExample(); // the example button was clicked while this was loading
}

function showError(err) {
  $('loading').hidden = true;
  const box = $('load-error');
  box.hidden = false;
  box.textContent = 'The page could not load its data. Check your internet connection and reload the page.';
  // For the team: opening index.html straight from disk fails; run "python3 -m http.server 8000" instead.
  console.error('Load failed', err);
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

  // Once the farmer picks a crop cycle, the crop record no longer changes it for that field.
  $('rotation-select').addEventListener('change', () => {
    if (state.field) state.rotationByFarmer[state.field.id] = true;
    $('rotation-note').textContent = '';
  });
  for (const id of ['rotation-select', 'texture-select', 'irrigated', 'no-hay', 'sells-forage', 'want-crop']) {
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
  map.fitBounds(VIRGINIA_VIEW);
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
    : '<p class="muted">Crop history could not be loaded for this spot right now.</p>';
}

// Is the field on screen in Virginia? A picked field: the soil survey area code starts with VA.
// A saved example field: its place name says so.
function inVirginia() {
  if (!state.field) return false;
  const soil = state.cache[state.field.id] && state.cache[state.field.id].soil;
  return !!(soil && String(soil.areasymbol || '').startsWith('VA')) || /Virginia$/.test(state.field.place || '');
}
const agentWords = () => (inVirginia() ? 'Virginia Cooperative Extension agent' : 'extension agent');

// A picked field starts on the listed crop cycle closest to its CropScape record (matchRotation in
// scoring.js), unless the farmer has already chosen one. The note under the box says where it came from.
function applyHistoryRotation() {
  const f = state.field, c = f && state.cache[f.id];
  $('rotation-note').textContent = '';
  if (!f || !f.picked || !c.history || state.rotationByFarmer[f.id]) return false;
  const match = matchRotation(c.history, state.rotations, f.region);
  if (!match) return false;
  f.default_rotation = match.id;
  $('rotation-select').value = match.id;
  $('rotation-note').textContent = 'From this field\'s crop record (USDA CropScape). Change it if wrong.';
  return true;
}

// The crops a farmer can ask for: every crop that is in a listed crop cycle for this field's region.
function fillWantCrop(field) {
  const ids = new Set(state.rotations.filter(r => r.region === 'any' || r.region === field.region)
    .flatMap(r => r.years.flatMap(y => [y.main, y.winter])).filter(Boolean).map(c => c.id));
  const names = Object.values(state.crops).filter(c => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  $('want-crop').innerHTML = '<option value="">No preference</option>' +
    names.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
}

const placeLine = field => `${field.place} · latitude ${field.lat}, longitude ${field.lon}`;

// Fills the field page from a field that is already loaded in state.cache
// (a demo field or a spot the farmer picked), then redraws everything.
function showField(field) {
  const id = field.id;
  state.field = field;
  $('field-place').textContent = placeLine(field);
  $('field-note').textContent = field.note;
  // Only offer rotations meant for this field's region (no soybean in the Nevada desert).
  $('rotation-select').innerHTML = state.rotations
    .filter(r => r.region === 'any' || r.region === field.region)
    .map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
  $('rotation-select').value = field.default_rotation;
  fillWantCrop(field);
  applyHistoryRotation();
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
// Same query as src/fetch_soil.py (the main soil at this point and its top layer), plus the
// soil survey area. Its code starts with the state's two letters (VA067), which tells us the state.
const SOIL_URL = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest';
const soilQuery = (lat, lon) => `SELECT TOP 1 mu.mukey, mu.muname, mu.farmlndcl,
  c.compname, c.comppct_r, c.slope_r, c.drainagecl, c.hydgrp,
  h.hzdept_r, h.hzdepb_r, h.om_r, h.awc_r, h.kwfact,
  h.sandtotal_r, h.silttotal_r, h.claytotal_r, tg.texdesc, l.areasymbol, l.areaname
FROM mapunit mu
JOIN legend l ON l.lkey = mu.lkey
JOIN component c ON c.mukey = mu.mukey
LEFT JOIN chorizon h ON h.cokey = c.cokey AND h.hzdept_r = 0
LEFT JOIN chtexturegrp tg ON tg.chkey = h.chkey AND tg.rvindicator = 'Yes'
WHERE mu.mukey IN (SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lon} ${lat})'))
ORDER BY c.comppct_r DESC`;
// A box around the lower 48 states: our crop list and the USDA soil survey cover only these.
// A box also takes in edges of Canada and Mexico; there the soil survey simply has no record.
const US = { south: 24.4, north: 49.5, west: -125, east: -66.9 };
// Where the map opens: a box around Virginia, the team's home state. Only a starting view;
// any field in the lower 48 can still be picked.
const VIRGINIA_VIEW = [[36.5, -83.7], [39.5, -75.2]];
// West of the 100th meridian is the classic dry-West line (Powell, 1878; see SOURCES.md).
const DRY_WEST_LON = -100;

const findMsg = (text, isError = false) => {
  $('find-msg').textContent = text;
  $('find-msg').classList.toggle('err', isError);
};

// Gives up on a service that has not answered after this long, so the page never waits forever.
const FETCH_TIMEOUT_MS = 20000;
async function fetchWithTimeout(url, options = {}) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), FETCH_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: stop.signal }); }
  finally { clearTimeout(timer); }
}

async function fetchPower(lat, lon) {
  const res = await fetchWithTimeout(`${POWER_URL}&latitude=${lat}&longitude=${lon}`);
  if (!res.ok) throw new Error(`NASA POWER answered ${res.status}`);
  return res.json();
}

// Returns the soil record, or null if the survey has nothing here (water, town, or no answer).
// state.soilNoAnswer tells the two apart, so the message on screen is honest.
async function fetchSoil(lat, lon) {
  state.soilNoAnswer = false;
  try {
    const res = await fetchWithTimeout(SOIL_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'JSON+COLUMNNAME', query: soilQuery(lat, lon) }),
    });
    const table = (await res.json()).Table;
    if (!table || table.length < 2) return null;
    return { ...Object.fromEntries(table[0].map((name, i) => [name, table[1][i]])), source: SOIL_URL };
  } catch (err) { state.soilNoAnswer = true; return null; }
}

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
  // complete: every request answered. Only a complete set is kept for the next visit.
  return Object.keys(values).length
    ? { values, scale, fill_value: -3000, source: MODIS_URL, complete: parts.every(Boolean) } : null;
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
  // A field looked up before in this browser shows at once from its saved numbers.
  const saved = state.cache[id] ? null : loadFieldData(id);
  if (saved) {
    state.cache[id] = { ind: { ...saved.ind, ndvi: ndviIndicators(saved.ndvi) }, soil: saved.soil,
                        history: saved.history, ndviRaw: saved.ndvi, ndviState: saved.ndvi ? 'done' : 'loading' };
    loadExtras(id, lat, lon); // only asks for the parts that are still missing
  }
  if (!state.cache[id]) {
    findMsg('Getting 21 years of NASA weather and your soil survey…');
    try {
      const [power, soil] = await Promise.all([fetchPower(lat, lon), fetchSoil(lat, lon)]);
      state.cache[id] = { ind: computeFieldIndicators(power, null), soil, soilNoAnswer: state.soilNoAnswer,
                          history: null, ndviState: 'loading' };
      rememberField(id);
      loadExtras(id, lat, lon);
    } catch (err) {
      console.error('pick point', err);
      if (ticket === state.pickTicket) {
        findMsg(err.name === 'AbortError' ? 'NASA\'s weather service is slow right now. Try again in a minute.'
                                          : 'Couldn\'t reach NASA right now. Try again in a minute.', true);
      }
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
          : state.cache[id].soilNoAnswer ? 'Done, but the USDA soil survey did not answer in time. Pick your soil type on step 4, or try this field again later.'
                               : 'Done, but the USDA soil survey has no record here (water, a town, or outside the US). Click right on your field, or pick your soil type on step 4.');
  return true;
}

// Background loads for a picked spot. When each one arrives, redraw if that field is on screen.
async function loadExtras(id, lat, lon) {
  const c = state.cache[id];
  const onScreen = () => state.field && state.field.id === id;
  if (!c.history) {
    fetchHistory(lat, lon).then(history => {
      c.history = history;
      c.historyState = history ? 'done' : 'failed';
      if (history) rememberField(id);
      if (onScreen()) { showHistory(); if (applyHistoryRotation()) render(); }
    });
  }
  if (c.ndviRaw) return; // satellite greenness was saved on an earlier visit
  const ndvi = await fetchNdvi(lat, lon);
  c.ndviState = ndvi ? 'done' : 'failed';
  if (ndvi) { c.ndviRaw = ndvi; c.ind.ndvi = ndviIndicators(ndvi); }
  rememberField(id);
  if (onScreen()) render();
}

// Keeps a picked field's worked-out numbers in this browser (js/storage.js) for the next visit.
// A field with no soil record is not kept, so the soil survey is asked again next time.
function rememberField(id) {
  const c = state.cache[id];
  if (!c.soil) return;
  const { ndvi, ...weather } = c.ind; // the satellite part is rebuilt from the saved images
  saveFieldData(id, { ind: weather, soil: c.soil, history: c.history,
                      ndvi: c.ndviRaw && c.ndviRaw.complete ? c.ndviRaw : null });
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
  // The name also shows under the field list, on the answer card and on the Ask AI page.
  $('field-place').textContent = placeLine(state.field);
  if (state.results) { $('finding').innerHTML = answerCard(state.results); renderHelperContext(); }
}

function removeField() {
  if (!state.field || !state.field.picked) return;
  if (!confirm(`Remove "${state.field.name}" from your fields? Saved checks stay on My farm.`)) return;
  state.myFields = state.myFields.filter(f => f.id !== state.field.id);
  saveFields(state.myFields);
  saveFieldData(state.field.id, null);
  state.field = null;
  if (state.myFields.length) pickPoint(state.myFields[0].lat, state.myFields[0].lon);
  else startAdding();
}

// ---------- Demo mode: two sample fields with saved data, for judges and first-time visitors ----------

// page: where to land after turning it on ('field', or 'compare' to go straight to the answer).
function setDemo(on, page = 'field') {
  state.demo = on;
  $('demo-toggle').textContent = on ? 'Turn off demo mode' : 'Try demo mode (sample fields)';
  $('demo-banner').hidden = !on;
  if (state.map && state.demoLayer) on ? state.demoLayer.addTo(state.map) : state.demoLayer.remove();
  if (on) {
    stopAdding();
    selectField(state.fields[0].id).then(() => { fillFieldSelect(); location.hash = page; showPage(); });
  } else {
    if (state.field && !state.field.picked) state.field = null;
    if (state.myFields.length) pickPoint(state.myFields[0].lat, state.myFields[0].lon);
    else startAdding();
  }
}

// One click for a first-time visitor or a judge: the saved Henry County, Virginia field,
// straight to its answer, with no waiting on any outside service.
function showExample() {
  if (!state.ready) { state.exampleWanted = true; return; }
  state.exampleWanted = false;
  setDemo(true, 'compare');
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

// One-sentence meanings for the technical words, shown right where the word first appears.
// Same wording as the "Words we use" list on the science page.
const TERMS = {
  'frost risk': 'Frost risk is the chance of a night at or below freezing (32 °F, 0 °C) while a frost-sensitive crop is in the ground.',
  'soil-moisture anomaly': 'A soil-moisture anomaly is how much wetter or drier the soil is than usual for that month. Negative means drier than normal.',
  NDVI: 'NDVI is a satellite measure of how green and leafy the ground is, from about 0 (bare soil) to 1 (thick green crop).',
};
// A small "What is ...?" line that opens to show the meaning.
const define = word => `<details class="define"><summary>What is ${esc(word)}?</summary><p>${esc(TERMS[word])}</p></details>`;

function card(label, value, meaning, alert = false, word = null) {
  return `<div class="card${alert ? ' alert' : ''}"><p class="label">${label}</p>
    <p class="value">${value}</p><p class="meaning">${meaning}</p>${word ? define(word) : ''}</div>`;
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
      'Usual last spring frost and first fall frost, at or below 32 °F (0 °C) (middle year of 21). Frost-sensitive crops should sit between them.', true, 'frost risk'),
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
      ' Wetness runs 0 (dry) to 100 (soaked); this is recent June–August minus the 21-year average.', drySummer.length > 0, 'soil-moisture anomaly'),
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
      : 'Satellite greenness is not available for this field yet. Bare months come from the crop calendar instead.';
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

// "What we don't know" shows this many items first; the rest sit behind "Show all".
const UNKNOWNS_SHOWN = 3;

function renderOptions() {
  const field = currentField();
  const results = compareRotations(state.rotations, $('rotation-select').value, field, weights(),
                                   { noHay: $('no-hay').checked, wantCrop: $('want-crop').value });
  const want = state.crops[$('want-crop').value];
  $('crop-fit').hidden = !want;
  $('crop-fit').innerHTML = want ? cropFitPanel(want, field) : '';
  renderLocalExperts();
  state.results = results; // kept so "Save to My farm" saves exactly what is on screen
  // Results changed. The chat stays; each question sends the newest numbers. Say so once.
  const lastInChat = $('helper-log').lastElementChild;
  if (state.chat.length && !(lastInChat && lastInChat.classList.contains('chat-note'))) {
    addChatNote('Your results changed. The helper will use the new numbers from here on.');
  }
  renderHelperContext();
  const best = Math.max(...results.slice(1).map(r => r.total));
  // The farmer's pick starts on the best fit and follows it until they choose one themselves.
  const bestFit = results.slice(1).find(r => r.total === best) || results[0];
  if (!state.chosenByFarmer || !results.some(r => r.rotation.id === state.chosenId)) {
    state.chosenId = bestFit.rotation.id;
    state.chosenByFarmer = false;
  }

  $('risk-strip').innerHTML = monthStrip(results[0], true);
  $('finding').innerHTML = answerCard(results);
  renderSoilCheck(results[0]);

  const fewNote = results.length >= 3 ? ''
    : want ? `<p class="muted">${results.length - 1 || 'No'} crop cycle${results.length === 2 ? '' : 's'} in our list with ${esc(want.name)} fit${results.length === 2 ? 's' : ''} your region and limits, besides what you grow now.</p>`
    : `<p class="muted">Only ${results.length - 1} alternative fits your region and limits. Untick "no hay equipment" to see more.</p>`;
  const virginia = inVirginia();
  const litNow = results[0].warnings.filter(w => w.lit).length;
  const label = id => results[0].warnings.find(w => w.id === id).label.toLowerCase();
  $('options').innerHTML = fewNote + results.map(r => {
    const lit = r.warnings.filter(w => w.lit).length;
    const fixLine = r.isCurrent
      ? `<strong>${lit} of 4</strong> soil warning signs on`
      : litNow === 0 ? 'No warning signs to fix on this field'
        : `Clears <strong>${r.fixes.length} of ${litNow}</strong> warning sign${litNow === 1 ? '' : 's'}`;
    const addLine = r.adds.length ? `<p class="adds">Adds a new warning: ${r.adds.map(label).join(', ')}</p>` : '';
    return `
    <article class="option ${r.isCurrent ? 'current' : ''} ${!r.isCurrent && r.total === best ? 'best' : ''}">
      <span class="badge">${r.isCurrent ? 'What you grow now' : r.total === best ? 'Best fit for your priorities' : 'Alternative'}</span>
      <h3>${esc(r.rotation.name)}</h3>
      <p class="seq">${esc(sequenceText(r.rotation))}</p>
      <p class="cover-line">Soil covered in heavy-rain season: <strong>${Math.round(r.sub.erosion.score)}%</strong>${r.isCurrent ? '' : ` <span class="muted">(now ${Math.round(results[0].sub.erosion.score)}%)</span>`}</p>
      <p class="fixes">${fixLine}</p>
      ${addLine}
      ${virginia ? regionNotes(r.rotation).map(n => `<p class="region-note">${esc(n.text)} <a href="${n.url}" target="_blank" rel="noopener">Source: ${esc(n.source)}</a></p>`).join('') : ''}
      <div class="fit"><span class="big">${r.total}</span><span class="muted">/ 100 fit</span></div>
      <div class="box why"><h4>Why suggested</h4>${list(r.explain.why)}</div>
      <button type="button" class="btn choose" data-choose="${r.rotation.id}" data-label="${r.isCurrent ? 'Keep what I grow now' : 'Choose this plan'}"></button>
      <details class="evidence-more">
        <summary>Evidence, benefits, limits, local checks</summary>
        <div class="box evidence"><h4>Evidence</h4>${list(r.explain.evidence)}</div>
        <div class="box benefits"><h4>Benefits</h4>${list(r.explain.benefits)}</div>
        <div class="box unknowns"><h4>What we don't know</h4>${list(r.explain.unknowns.slice(0, UNKNOWNS_SHOWN))}
          ${r.explain.unknowns.length > UNKNOWNS_SHOWN ? `<details class="show-all">
            <summary>Show all ${r.explain.unknowns.length}</summary>${list(r.explain.unknowns.slice(UNKNOWNS_SHOWN))}</details>` : ''}
        </div>
        <div class="box check"><h4>Check locally</h4>${list(r.explain.checkLocally)}</div>
        <h4 class="detail-head">The four soil warning signs</h4>
        <ul class="mini-signs">${r.warnings.map(w =>
          `<li class="${w.lit ? 'on' : 'off'}"><span class="dot" aria-hidden="true"></span>${esc(w.label)}: ${w.lit ? 'warning' : 'OK'}</li>`).join('')}</ul>
        <h4 class="detail-head">Month by month</h4>
        <p class="small muted" style="margin:0">Crop growing (green) or bare (tan) · bare months: ${r.bareMonths.length || 'none'}</p>
        <div class="month-strip">${monthStrip(r, false)}</div>
        <h4 class="detail-head">Score for each priority</h4>
        <div class="bars">${Object.entries(PRIORITIES).map(([k, name]) => `
          <div class="bar"><span>${name}</span><span class="track"><span class="fill" style="width:${Math.round(r.sub[k].score)}%; display:block"></span></span><span>${Math.round(r.sub[k].score)}</span></div>`).join('')}
        </div>
      </details>
    </article>`;
  }).join('');
  markChoice();
}

// Shows which of the three options the farmer has picked to save as their plan.
function markChoice() {
  document.querySelectorAll('#options .choose').forEach(b => {
    const on = b.dataset.choose === state.chosenId;
    b.textContent = on ? 'Your choice' : b.dataset.label;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('btn-primary', on);
    b.classList.toggle('btn-ghost', !on);
    b.closest('.option').classList.toggle('chosen', on);
  });
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
    (satellite ? `<p>${satellite}</p>${define('NDVI')}` : '') +
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

// "I want to grow ...": how the chosen crop fits this field (words from cropFit in scoring.js).
function cropFitPanel(crop, field) {
  const fit = cropFit(crop, field, state.crops);
  const block = (title, lines) => `<div class="box"><h4>${title}</h4>${list(lines)}</div>`;
  return `<h3>How ${esc(crop.name)} fits this field</h3>
    <p class="small muted">Worth checking with your ${agentWords()}. Not advice to plant it.</p>
    <div class="fit-grid">
      ${block('Calendar and frost', fit.calendar)}
      ${block('Water', fit.water)}
      ${block('Bare months', fit.bare)}
    </div>
    <p class="small muted">${esc(fit.notGiven)} ${fit.source ? `<a href="${esc(fit.source)}" target="_blank" rel="noopener">Crop guide</a>` : 'No source link for this crop.'}</p>`;
}

// Virginia fields get the people to take the results to. Both links were opened and checked (SOURCES.md).
function renderLocalExperts() {
  const va = inVirginia();
  $('local-experts').hidden = !va;
  for (const el of document.querySelectorAll('.ext-agent')) el.textContent = agentWords();
  if (!va) return;
  $('local-experts').innerHTML = `<h3>Your local experts</h3>
    <p>Take these results to people who know Virginia soils and markets.</p>
    <ul>
      <li><a href="https://ext.vt.edu/offices.html" target="_blank" rel="noopener">Find your county's Virginia Cooperative Extension office</a></li>
      <li><a href="https://www.arec.vaes.vt.edu/arec/southern-piedmont.html" target="_blank" rel="noopener">Southern Piedmont research center</a> (Virginia Tech, Blackstone)</li>
    </ul>`;
}

// The "Your answer" card at the top of Compare: three short lines (the words come from
// answerLines in scoring.js) and the reminder that the farmer and local experts decide.
function answerCard(results) {
  const a = answerLines(results);
  const line = (title, words) => `<li><span class="k">${title}</span><span class="v">${esc(words)}</span></li>`;
  // A sample field is labeled as one, so nobody takes it for their own land.
  const whose = state.field.picked ? 'Your answer for' : 'Example field:';
  return `<p class="answer-for">${whose} ${esc(state.field.place)}</p>
    <ol class="answer-lines">
      ${line('Biggest risk now', a.risk)}
      ${line('Option worth a look', a.option)}
      ${line('Check locally first', a.check)}
    </ol>
    <p class="answer-trail">From NASA POWER, MODIS, the USDA soil survey and our crop table. <a href="#proof">Proof and limits</a></p>
    <p class="answer-note">This supports your decision. It does not replace your judgment or your local ${agentWords()}.</p>`;
}

// ---------- pages ----------
// The site is one HTML file with several <section class="page">. The #hash in the address
// (#home, #field, #compare...) picks which one shows, so Back buttons and bookmarks work.
const PAGES = ['home', 'how', 'field', 'soil', 'year', 'compare', 'myfarm', 'plan', 'science', 'proof', 'ask'];
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
  // The plan page needs a plan opened from My farm (a reload forgets it). Leaving it stops the playing.
  if (id === 'plan' && !state.plan) { history.replaceState(null, '', '#myfarm'); id = 'myfarm'; }
  if (id !== 'plan' && state.plan) playPlan(false);
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
    else state.map.fitBounds(VIRGINIA_VIEW);
  }
  Object.values(state.charts).forEach(c => c && c.resize());
  if (id === 'myfarm') renderSaved();
  if (id === 'ask') renderHelperContext();
  if (id === 'proof') renderProof();
}

// ---------- Proof page: the problem in numbers and a back-test, for the saved Henry County field ----------
// Everything here is worked out from the saved files in data/raw/. Nothing is typed in by hand.

const PROOF_FIELD = 'henry_va';

async function renderProof() {
  if (!state.proof) {
    try {
      const [power, ndvi, soil, drought] = await Promise.all([
        getJson(`data/raw/power_${PROOF_FIELD}.json`), getJson(`data/raw/ndvi_${PROOF_FIELD}.json`, true),
        getJson(`data/raw/soil_${PROOF_FIELD}.json`, true), getJson(`data/raw/drought_${PROOF_FIELD}.json`, true)]);
      state.proof = {
        ind: computeFieldIndicators(power, ndvi), soil, drought,
        backtest: drought ? droughtBacktest(dryMonthsByYear(parsePower(power)), drought.weeks) : null,
      };
    } catch (err) {
      console.error('Proof page', err);
      $('proof-numbers').innerHTML = '<p class="muted">The saved data for this page could not be loaded. Reload the page to try again.</p>';
      return;
    }
  }
  const { ind, soil, backtest } = state.proof;
  const early = `${THRESHOLDS.EARLY_YEARS[0]}–${THRESHOLDS.EARLY_YEARS[1]}`;
  const recent = `${THRESHOLDS.RECENT_YEARS[0]}–${THRESHOLDS.RECENT_YEARS[1]}`;

  // 1. The problem in numbers
  const bare = ind.ndvi.available ? ind.ndvi.byMonth.filter(m => m.bare) : [];
  const allHeavy = ind.monthly.reduce((s, m) => s + m.extremeRainPerYear, 0);
  const bareHeavy = bare.reduce((s, m) => s + ind.monthly[m.month - 1].extremeRainPerYear, 0);
  $('proof-numbers').innerHTML = [
    card('Heavy-rain days', `${fmt(ind.extremeRain.recent, 1)} / year`,
      `Days with over 2 in (50 mm) of rain in ${recent}. It was ${fmt(ind.extremeRain.early, 1)} a year in ${early}.` +
      swing(ind, 'extremeRainDays', ind.extremeRain.diff, 'days') + ' <span class="tag">NASA POWER</span>'),
    ind.ndvi.available
      ? card('Months with little plant cover', bare.length ? bare.map(m => m.name).join(', ') : 'None',
          `From ${ind.ndvi.points.length} satellite images of this spot.` +
          (bare.length && allHeavy > 0 ? ` These months get ${Math.round(bareHeavy / allHeavy * 100)}% of the heavy-rain days.` : '') +
          ' <span class="tag tag-modis">MODIS NDVI</span>', bare.length > 0)
      : card('Months with little plant cover', 'n/a', 'No satellite images are saved for this field.'),
    soil && soil.kwfact !== null && soil.kwfact !== undefined
      ? card('How easily this soil washes', `K = ${fmt(soil.kwfact, 2)}`,
          `Soil erodibility (the K in RUSLE) for ${esc(soil.compname)} soil. A higher K means soil that washes away more easily. ` +
          `Slope here: ${fmt(soil.slope_r)}%. <span class="tag tag-usda">USDA soil survey</span>`)
      : card('How easily this soil washes', 'n/a', 'The soil survey has no erodibility value saved for this spot.'),
    card('Growing-season rain', rainText(ind.rain.recent),
      `April–September in ${recent}; ${signed(ind.rain.diff / 25.4, 1)} in compared with ${early}.` +
      swing(ind, 'seasonRainMm', ind.rain.diff, 'in', inches) + ' <span class="tag">NASA POWER</span>'),
  ].join('');

  // 2. Back-test against the U.S. Drought Monitor
  if (!backtest) {
    $('proof-backtest').innerHTML = '<p class="muted">The Drought Monitor record is not saved, so the back-test cannot be shown.</p>';
    return;
  }
  const t = backtest.total;
  const drought = t.hits + t.missed, flagged = t.hits + t.extra;
  const pct = (a, b) => (b ? `${Math.round(a / b * 100)}%` : 'n/a');
  $('proof-backtest').innerHTML = `
    <div class="cards">
      ${card('Drought months we caught', `${t.hits} of ${drought}`, `Our dry-soil flag was on in ${pct(t.hits, drought)} of the months the Drought Monitor recorded drought in Henry County.`)}
      ${card('Drought months we missed', `${t.missed} of ${drought}`, 'Months with drought on record where our flag stayed off.', t.missed > 0)}
      ${card('Flags with no drought on record', `${t.extra} of ${flagged}`, `${pct(t.extra, flagged)} of our flagged months were not drought months. A flag means soil drier than usual for the month, which is not always an official drought.`, true)}
    </div>
    <details class="panel">
      <summary>Year by year (${backtest.byYear[0].year}–${backtest.byYear[backtest.byYear.length - 1].year})</summary>
      <div class="table-scroll"><table class="proof-table">
        <thead><tr><th scope="col">Year</th><th scope="col">Drought months on record</th><th scope="col">We flagged</th><th scope="col">We missed</th><th scope="col">Flagged, no drought</th></tr></thead>
        <tbody>${backtest.byYear.map(y => `<tr><th scope="row">${y.year}</th><td>${y.hits + y.missed}</td><td>${y.hits}</td><td>${y.missed}</td><td>${y.extra}</td></tr>`).join('')}</tbody>
      </table></div>
    </details>`;
}

// ---------- My farm: saved checks ----------

function saveCurrentCheck() {
  if (!state.results) return;
  const [current, ...alts] = state.results;
  const chosen = state.results.find(r => r.rotation.id === state.chosenId) || current;
  const check = {
    id: Date.now(),
    savedAt: new Date().toISOString(),
    fieldId: state.field.id, fieldName: state.field.name, place: state.field.place,
    lat: state.field.lat, lon: state.field.lon, // rounded to 3 decimals; the typed address is never saved
    rotationId: $('rotation-select').value, rotationName: current.rotation.name,
    chosenId: chosen.rotation.id, chosenName: chosen.rotation.name, chosenTotal: chosen.total, // the plan the farmer picked
    irrigated: $('irrigated').checked, texture: $('texture-select').value,
    noHay: $('no-hay').checked, sellsForage: $('sells-forage').checked,
    weights: weights(),
    cover: Math.round(current.sub.erosion.score),
    warningsOn: current.warnings.filter(w => w.lit).length,
    options: [current, ...alts].map(r => ({ name: r.rotation.name, total: r.total, isCurrent: r.isCurrent })),
  };
  $('save-msg').innerHTML = saveCheck(check)
    ? `Saved “${esc(chosen.rotation.name)}” as your plan. Open it any time on <a href="#myfarm">My farm</a>.`
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
        ${c.chosenName ? `<div><dt>Your plan</dt><dd>${esc(c.chosenName)} · ${c.chosenTotal}/100</dd></div>` : ''}
      </dl>
      ${change}
      <div class="saved-actions">
        <button type="button" class="btn btn-primary" data-plan="${c.id}">Open plan</button>
        <button type="button" class="btn btn-ghost" data-open="${c.id}">Change inputs</button>
        <button type="button" class="btn btn-ghost" data-delete="${c.id}">Remove</button>
      </div>
    </article>`;
  }).join('');
}

// Puts a saved check's answers back into the inputs. Returns the check, or null if it could not load.
async function restoreCheck(id) {
  const c = listChecks().find(x => x.id === id);
  if (!c || !state.ready) return null; // data still loading
  if (c.fieldId.startsWith('pt_')) {
    if (!(await pickPoint(c.lat, c.lon, c.fieldName))) { location.hash = 'field'; return null; }
  } else {
    $('field-select').value = c.fieldId;
    await selectField(c.fieldId);
  }
  state.rotationByFarmer[state.field.id] = true; // a saved check keeps its own crop cycle
  $('rotation-note').textContent = '';
  $('rotation-select').value = c.rotationId;
  // A saved crop cycle can drop out of the list (the crop table changed). Say so instead of silently swapping it.
  const lostCycle = $('rotation-select').value !== c.rotationId;
  if (lostCycle) $('rotation-select').value = state.field.default_rotation;
  $('save-msg').textContent = lostCycle
    ? `"${c.rotationName}" is no longer in the list for this field, so this shows a different crop cycle.` : '';
  $('irrigated').checked = c.irrigated;
  $('texture-select').value = c.texture;
  $('no-hay').checked = c.noHay;
  $('sells-forage').checked = c.sellsForage;
  for (const [k, v] of Object.entries(c.weights)) {
    if ($(`w-${k}`)) { $(`w-${k}`).value = v; $(`o-${k}`).textContent = v; }
  }
  // Put the farmer's saved pick back too (an older save has none and gets the best fit).
  state.chosenId = c.chosenId || null;
  state.chosenByFarmer = !!c.chosenId;
  render();
  return c;
}

// "Change inputs" on My farm: back to the comparison with the saved answers.
async function openCheck(id) {
  if (await restoreCheck(id)) location.hash = 'compare';
}

// ---------- Your plan: a saved plan played back year by year (My farm > Open plan) ----------
// The steps come from planSteps in scoring.js. This part only shows them one at a time.

const PLAN_STEP_MS = 4000; // how long each step stays up while playing

async function openPlan(id) {
  const c = await restoreCheck(id);
  if (!c) return;
  const [current] = state.results;
  const saved = state.results.find(r => r.rotation.id === c.chosenId);
  const result = saved || state.results.find(r => r.rotation.id === state.chosenId) || current;
  const note = saved ? ''
    : c.chosenId ? `“${c.chosenName}” is no longer one of the three options for this field, so this shows today's best fit instead.`
    : 'This check was saved before you could pick a plan, so this shows its best fit.';
  state.plan = { result, steps: planSteps(result, current, currentField()), shown: -1, note, timer: null };
  location.hash = 'plan';
  renderPlan();
}

function renderPlan() {
  const p = state.plan;
  const r = p.result.rotation;
  $('plan-title').textContent = r.name;
  $('plan-sub').textContent = `${state.field.name} · ${p.result.total}/100 for your priorities` +
    (p.result.isCurrent ? ' · this is what you grow now' : '');
  $('plan-note').textContent = p.note;
  $('plan-note').hidden = !p.note;
  // One row of 12 months for each year of the cycle. Cells start empty and fill in as the steps play.
  $('plan-years').innerHTML = r.years.map((_, i) => `
    <div class="plan-year">
      <p class="plan-year-name">Year ${i + 1}</p>
      <div class="month-strip">${MONTH_NAMES.map((name, k) =>
        `<div class="month todo" data-cell="${i + 1}-${k + 1}"><span class="m">${name}</span><span class="what"></span></div>`).join('')}</div>
    </div>`).join('') +
    (r.years.length > 1 ? `<p class="small muted">After year ${r.years.length} the cycle starts again at year 1.</p>` : '');
  $('plan-steps').innerHTML = '';
  p.shown = -1;
  // People who ask their device for less motion get the whole plan at once, with no playing.
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) showPlanStep(p.steps.length - 1);
  else { showPlanStep(0); playPlan(true); }
}

// Shows every step up to and including number n (so Back removes the later ones).
function showPlanStep(n) {
  const p = state.plan;
  n = Math.max(0, Math.min(p.steps.length - 1, n));
  if (n < p.shown) { $('plan-steps').innerHTML = ''; p.shown = -1; }
  for (let i = p.shown + 1; i <= n; i++) {
    const s = p.steps[i];
    const li = document.createElement('li');
    li.className = `plan-step ${s.kind}`;
    li.innerHTML = `<p class="plan-step-when">${s.year ? `Year ${s.year}` : 'The whole cycle'}</p>
      <h3>${esc(s.title)}</h3>${list(s.notes)}`;
    $('plan-steps').appendChild(li);
  }
  p.shown = n;
  // Fill in the months for the steps shown so far; the newest step's months are outlined.
  document.querySelectorAll('#plan-years .month').forEach(cell => {
    cell.className = 'month todo';
    cell.querySelector('.what').textContent = '';
  });
  p.steps.slice(0, n + 1).forEach((s, i) => {
    for (const c of s.cells) {
      const cell = document.querySelector(`#plan-years [data-cell="${c.year}-${c.month}"]`);
      cell.className = `month ${s.kind === 'crop' ? 'covered' : 'bare'}${i === n ? ' now' : ''}`;
      cell.querySelector('.what').textContent = s.kind === 'crop' ? s.title.split(':')[0].split(' (')[0] : 'bare';
    }
  });
  document.querySelectorAll('#plan-steps .plan-step').forEach((li, i) => li.classList.toggle('now', i === n));
  $('plan-count').textContent = `Step ${n + 1} of ${p.steps.length}`;
  $('plan-back').disabled = n === 0;
  $('plan-next').disabled = n === p.steps.length - 1;
  // The newest step is also named right under the year rows, so it is in view while they fill in.
  const s = p.steps[n];
  $('plan-now').innerHTML = `<strong>${s.year ? `Year ${s.year}` : 'The whole cycle'}: ${esc(s.title)}.</strong> ${esc(s.notes[s.kind === 'crop' && s.notes.length > 1 ? 1 : 0])}`;
  if (n === p.steps.length - 1) playPlan(false);
}

function playPlan(on) {
  const p = state.plan;
  if (!p) return;
  clearInterval(p.timer);
  p.timer = null;
  if (on && p.shown >= p.steps.length - 1) showPlanStep(0); // Play at the end starts over
  if (on) p.timer = setInterval(() => showPlanStep(p.shown + 1), PLAN_STEP_MS);
  $('plan-play').textContent = on ? 'Pause' : (p.shown >= p.steps.length - 1 ? 'Play again' : 'Play');
}

$('plan-play').addEventListener('click', () => playPlan(!state.plan.timer));
$('plan-next').addEventListener('click', () => { playPlan(false); showPlanStep(state.plan.shown + 1); });
$('plan-back').addEventListener('click', () => { playPlan(false); showPlanStep(state.plan.shown - 1); });
$('plan-all').addEventListener('click', () => { playPlan(false); showPlanStep(state.plan.steps.length - 1); });

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
// The farmer sees a plain message; the Firebase code goes to the console for the team.
const signInError = err => {
  console.error('Sign-in', err.code || err.message);
  return SIGN_IN_ERRORS[err.code] || 'Sign-in did not work. Your checks still save in this browser.';
};

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
  if (window.cloud && window.cloud.load) await window.cloud.load(); // sign-in code loads on first use
  if (!window.cloud || !window.cloud.ready) {
    $('account-error').textContent = window.cloud && window.cloud.reason === 'loading'
      ? 'Still connecting. Try again in a moment.'
      : 'Sign-in is not available right now. Your checks still save in this browser.';
    return;
  }
  try { await action(); } catch (err) { $('account-error').textContent = signInError(err); }
}

// The sign-in pop-up. CSS fades it in; closeSignIn lets it fade out before it closes.
function openSignIn() {
  const d = $('signin-dialog');
  if (d.open) return;
  if (window.cloud && window.cloud.load) window.cloud.load(); // start loading the sign-in code now
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
  'not-set-up': 'The AI helper is not turned on for this site yet. Every score and explanation in the tool still works without it.',
  'no-server': 'The AI helper is not available here. Every score and explanation still works without it.',
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
    var giveUp = setTimeout(() => stop.abort(), 25000);
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
    clearTimeout(giveUp);
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
$('options').addEventListener('click', e => {
  const id = e.target.dataset.choose;
  if (!id) return;
  state.chosenId = id;
  state.chosenByFarmer = true;
  markChoice();
});
$('saved-list').addEventListener('click', e => {
  const open = e.target.dataset.open, del = e.target.dataset.delete, plan = e.target.dataset.plan;
  if (plan) openPlan(Number(plan));
  if (open) openCheck(Number(open));
  if (del) { deleteCheck(Number(del)); renderSaved(); }
});
$('find-form').addEventListener('submit', e => { e.preventDefault(); findAddress($('find-address').value); });
$('find-me').addEventListener('click', findMe);
$('field-name').addEventListener('input', e => renameField(e.target.value));
$('remove-field').addEventListener('click', removeField);
$('demo-toggle').addEventListener('click', () => setDemo(!state.demo));
document.querySelectorAll('.show-example').forEach(b => b.addEventListener('click', showExample));
window.addEventListener('hashchange', showPage);
showPage();
init();
