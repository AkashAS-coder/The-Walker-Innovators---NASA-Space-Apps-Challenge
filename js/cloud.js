// cloud.js
// Optional extras that need Firebase: sign-in (email and password), and saving checks to
// Firestore so they follow the farmer to any device.
// Everything here is optional. If js/firebase-config.js is empty or Firebase fails to load,
// the site keeps working with browser-only saves and the scores never change.
// (The "Ask AI" helper does not use Firebase. It calls netlify/functions/ask.mjs.)
// Firebase is three large files, so it is only downloaded when it is needed: when the farmer
// opens the sign-in box, or when this browser was signed in last time.

const FIREBASE_VERSION = '12.6.0';
const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

const SIGNED_IN_KEY = 'fieldshift.signedin'; // set while signed in, so the next visit loads Firebase
const announce = () => window.dispatchEvent(new Event('cloud-change'));

// load() starts Firebase the first time it is called and returns the same promise after that.
let loading = null;
function load() {
  if (!loading) {
    window.cloud.reason = 'loading';
    announce();
    loading = start().catch(err => {
      console.error('Firebase did not start; using browser-only saves', err);
      window.cloud.reason = 'failed';
      announce();
    });
  }
  return loading;
}
window.cloud = { ready: false, user: null, reason: 'idle', load };

async function start() {
  const config = window.FIREBASE_CONFIG;
  if (!config) { window.cloud.reason = 'not-set-up'; announce(); return; }

  const [{ initializeApp }, authLib, store] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = authLib.getAuth(app);
  const db = store.getFirestore(app);

  // Each farmer's checks live at users/{uid}/checks/{checkId}. firestore.rules allows
  // a signed-in user to read and write only their own folder.
  const checksOf = uid => store.collection(db, 'users', uid, 'checks');

  Object.assign(window.cloud, {
    ready: true,
    reason: '',
    signIn: () => authLib.signInWithPopup(auth, new authLib.GoogleAuthProvider()),
    signInEmail: (email, pw) => authLib.signInWithEmailAndPassword(auth, email, pw),
    signUpEmail: (email, pw) => authLib.createUserWithEmailAndPassword(auth, email, pw),
    signOut: () => authLib.signOut(auth),
    async pushCheck(check) {
      if (!this.user) return;
      await store.setDoc(store.doc(checksOf(this.user.uid), String(check.id)), check);
    },
    async removeCheck(id) {
      if (!this.user) return;
      await store.deleteDoc(store.doc(checksOf(this.user.uid), String(id)));
    },
  });

  authLib.onAuthStateChanged(auth, async user => {
    window.cloud.user = user;
    try {
      if (user) localStorage.setItem(SIGNED_IN_KEY, '1');
      else localStorage.removeItem(SIGNED_IN_KEY);
    } catch (err) { /* storage blocked: sign-in still works for this visit */ }
    if (user) {
      // Bring this farmer's saved checks down and upload any made on this device before signing in.
      try {
        const snap = await store.getDocs(checksOf(user.uid));
        const remote = snap.docs.map(d => d.data());
        const remoteIds = new Set(remote.map(c => c.id));
        const localOnly = listChecks().filter(c => !c.cloud && !remoteIds.has(c.id));
        await Promise.all(localOnly.map(c => window.cloud.pushCheck(c)));
        mergeChecks([...remote, ...localOnly]);
      } catch (err) {
        window.cloud.reason = 'sync-failed';
        console.error('Could not load saved checks from Firebase', err);
      }
    } else {
      clearCloudChecks(); // so the next person on a shared computer doesn't see them
    }
    announce();
  });
}

try {
  if (localStorage.getItem(SIGNED_IN_KEY)) load();
} catch (err) { /* storage blocked: Firebase loads when the sign-in box opens */ }
