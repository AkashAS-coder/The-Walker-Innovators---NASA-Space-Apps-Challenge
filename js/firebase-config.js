// firebase-config.js
// Paste the web app config from the Firebase console here (Project settings > Your apps > Web app).
// This config is NOT a secret: Firebase web configs are meant to be public, and the Firestore
// security rules in firestore.rules are what keep each farmer's data private.
// Never put a service-account key or any other private key in this repo.
//
// If this is set to null, the site still works: checks save in this browser only,
// and the sign-in pop-up says sign-in is not connected yet.
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyC_Gmg7uU3APNPQ1fZBcutvQe97VSA_7WU",
  authDomain: "nasa-space-apps-challeng-53f63.firebaseapp.com",
  projectId: "nasa-space-apps-challeng-53f63",
  storageBucket: "nasa-space-apps-challeng-53f63.firebasestorage.app",
  messagingSenderId: "366152959080",
  appId: "1:366152959080:web:330fa59662904c5565e7dd"
};

// Example of what it looks like once filled in:
// window.FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.appspot.com",
//   messagingSenderId: "...",
//   appId: "..."
// };
