// storage.js
// Saves a farmer's soil checks so they can come back and see them over time.
// For now the checks live in this browser only (localStorage): no account, no server,
// nothing leaves the computer. Firebase sign-in is planned (docs/PLAN.md); when it lands,
// only these three functions need to change. app.js does not touch storage directly.

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
}
