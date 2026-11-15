// storage.js
// Saves a farmer's soil checks so they can come back and see them over time.
// Checks always live in this browser (localStorage), so the site works with no account.
// If the farmer signs in (js/cloud.js), each save and delete is also sent to their own
// Firestore folder, and their checks from other devices are merged in here.
// app.js does not touch storage directly.

const STORE_KEY = 'fieldshift.checks.v1';

// All saved checks, newest first. Returns [] if nothing is saved or storage is blocked.
function listChecks() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch (err) {
    return [];
  }
}

// Adds one check. Returns true if it was saved.
function saveCheck(check) {
  try {
    const all = listChecks();
    all.unshift(check);
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
    if (window.cloud && window.cloud.user) {
      check.cloud = true;
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
      window.cloud.pushCheck(check).catch(err => console.error('Cloud save failed', err));
    }
    return true;
  } catch (err) {
    return false; // private browsing or storage full
  }
}

// Removes the check with this id.
function deleteCheck(id) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(listChecks().filter(c => c.id !== id)));
  } catch (err) { /* nothing to do: storage is blocked */ }
  if (window.cloud && window.cloud.user) {
    window.cloud.removeCheck(id).catch(err => console.error('Cloud delete failed', err));
  }
}

// After sign-in: keep the checks that never went to the cloud, and replace the rest with the
// signed-in farmer's checks from Firestore. Each one is marked cloud: true.
function mergeChecks(fromCloud) {
  try {
    const ids = new Set(fromCloud.map(c => c.id));
    const keep = listChecks().filter(c => !c.cloud && !ids.has(c.id));
    const all = [...keep, ...fromCloud.map(c => ({ ...c, cloud: true }))].sort((a, b) => b.id - a.id);
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch (err) { /* storage blocked: the cloud copy is still safe */ }
}

// After sign-out: remove the signed-in farmer's checks from this browser.
function clearCloudChecks() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(listChecks().filter(c => !c.cloud)));
  } catch (err) { /* nothing to do */ }
}

// The farmer's own fields: [{ id, name, lat, lon }], newest first. Only the name and a
// location rounded to about 100 m are kept, in this browser. Typed addresses are never saved.
const FIELDS_KEY = 'fieldshift.fields.v1';

function listFields() {
  try {
    return JSON.parse(localStorage.getItem(FIELDS_KEY)) || [];
  } catch (err) {
    return [];
  }
}

function saveFields(fields) {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify(fields));
  } catch (err) { /* storage blocked: fields last until the page closes */ }
}

// The numbers already worked out for each of the farmer's fields, so a return visit shows
// the field at once instead of asking NASA again. Only the small results are kept (a few KB
// per field), not the full daily weather file. The weather request covers fixed years
// (2005 to 2025), so a saved copy does not go out of date.
// Shape: { fieldId: { savedAt, ind, soil, history, ndvi } }
const FIELD_DATA_KEY = 'fieldshift.fielddata.v1';
const FIELD_DATA_MAX = 8; // keep the newest few fields so browser storage never fills up

function loadFieldData(id) {
  try {
    return (JSON.parse(localStorage.getItem(FIELD_DATA_KEY)) || {})[id] || null;
  } catch (err) {
    return null;
  }
}

// Saves one field's record. Pass null to forget that field.
function saveFieldData(id, record) {
  try {
    const all = JSON.parse(localStorage.getItem(FIELD_DATA_KEY)) || {};
    delete all[id];
    if (record) all[id] = { ...record, savedAt: new Date().toISOString() };
    const newest = Object.entries(all).sort((a, b) => b[1].savedAt.localeCompare(a[1].savedAt)).slice(0, FIELD_DATA_MAX);
    localStorage.setItem(FIELD_DATA_KEY, JSON.stringify(Object.fromEntries(newest)));
  } catch (err) { /* storage blocked or full: the field just loads live next time */ }
}
