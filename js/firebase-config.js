// firebase-config.js
// Paste the web app config from the Firebase console here (Project settings > Your apps > Web app).
// This config is NOT a secret: Firebase web configs are meant to be public, and the Firestore
// security rules in firestore.rules are what keep each farmer's data private.
// Never put a service-account key or any other private key in this repo.
//
// While this is null, the site works exactly as before: checks save in this browser only,
// and the sign-in button and the "Ask about these results" helper say they are not set up yet.
window.FIREBASE_CONFIG = null;

// Example of what it looks like once filled in:
// window.FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.appspot.com",
//   messagingSenderId: "...",
//   appId: "..."
// };
