// cloud.js
// Optional extras that need Firebase: sign-in (Google or email and password), saving checks to Firestore so they follow
// the farmer to any device, and the "Ask about these results" helper (Gemini via Firebase AI Logic).
// Everything here is optional. If js/firebase-config.js is empty or Firebase fails to load,
// the site keeps working with browser-only saves and the scores never change.
//
// The scores never come from here. They come from the fixed rules in js/scoring.js.
// The helper only explains numbers that are already on screen.

const FIREBASE_VERSION = '12.6.0';
// Gemini model used by the helper. If Google retires it, change this one name.
const AI_MODEL = 'gemini-2.5-flash';

const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

// What the helper is told before every conversation. It keeps the helper inside our rules:
// explain, don't decide; use only the numbers we give it; say when it doesn't know.
const HELPER_RULES = `You help a farmer read the results of the Field Shift Rotation Explorer, a rule-based tool
that compares three crop rotations for one field using NASA POWER weather data, MODIS greenness data,
USDA soil survey data and a crop-traits table.
Rules you must follow:
- Use only the facts in the RESULTS block. If the answer is not there, say you don't know and suggest
  asking a local extension agent.
- Never tell the farmer what to plant. Say what the results show and what is worth checking locally.
- Never invent numbers, yields, prices or crop facts. Never change or recompute the scores.
- Use plain words and short sentences. Explain any technical term in one sentence.
- Use US units first (°F, inches).
- Keep answers under 120 words.`;

window.cloud = { ready: false, user: null, reason: 'loading' };
const announce = () => window.dispatchEvent(new Event('cloud-change'));

async function start() {
  const config = window.FIREBASE_CONFIG;
  if (!config) { window.cloud.reason = 'not-set-up'; announce(); return; }

  const [{ initializeApp }, authLib, store, ai] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-ai.js`),
  ]);
  const app = initializeApp(config);
  const auth = authLib.getAuth(app);
  const db = store.getFirestore(app);
  const model = ai.getGenerativeModel(ai.getAI(app, { backend: new ai.GoogleAIBackend() }),
                                      { model: AI_MODEL, systemInstruction: HELPER_RULES });

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
    // A new chat each time the results change, so the helper always sees what is on screen.
    newChat(resultsText) {
      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: `RESULTS:\n${resultsText}` }] },
          { role: 'model', parts: [{ text: 'Got it. I will answer only from these results.' }] },
        ],
      });
      return async question => (await chat.sendMessage(question)).response.text();
    },
  });

  authLib.onAuthStateChanged(auth, async user => {
    window.cloud.user = user;
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

start().catch(err => {
  console.error('Firebase did not start; using browser-only saves', err);
  window.cloud.reason = 'failed';
  announce();
});
