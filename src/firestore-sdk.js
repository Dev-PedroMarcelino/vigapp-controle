// ============================================================
// VigApp — Lazy Firestore SDK Loader
// ============================================================
// Dynamically imports the Firestore SDK on first use so it lands in its own
// chunk (loaded only after login), instead of bloating the initial bundle.
// Returns a memoized object with the Firestore instance (`db`) plus every
// function exported by 'firebase/firestore' (collection, doc, getDocs, ...).
import { app } from './firebase.js';

let sdkPromise = null;

export function getFirestoreSDK() {
  if (!sdkPromise) {
    sdkPromise = import('firebase/firestore').then(m =>
      Object.assign({ db: m.getFirestore(app) }, m)
    );
  }
  return sdkPromise;
}
