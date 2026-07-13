// ============================================================
// VigApp — Auth Module
// ============================================================
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from './firebase.js';
import { getFirestoreSDK } from './firestore-sdk.js';

let currentUser = null;
let currentUserData = null;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

// Max time to wait for the Firestore user profile before booting the app
// anyway. Keeps the app responsive when Firestore is slow or blocked by a
// browser extension (ERR_BLOCKED_BY_CLIENT) instead of hanging on boot.
const PROFILE_FETCH_TIMEOUT = 2500;

/**
 * Initialize auth state listener.
 */
export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      // Set an immediate fallback profile so nothing downstream depends on
      // Firestore being reachable.
      currentUserData = {
        uid: user.uid,
        email: user.email,
        name: user.email ? user.email.split('@')[0] : 'Usuario',
        role: 'user',
      };
      // Enrich from Firestore, but never let it block boot for more than
      // PROFILE_FETCH_TIMEOUT ms.
      await Promise.race([
        loadUserProfile(user),
        new Promise(resolve => setTimeout(resolve, PROFILE_FETCH_TIMEOUT)),
      ]);
    } else {
      currentUser = null;
      currentUserData = null;
    }
    authReadyResolve();
  });
}

/**
 * Fetch the user's profile document from Firestore and merge it into the
 * cached user data. Failures are swallowed — the fallback profile stays.
 */
async function loadUserProfile(user) {
  try {
    const { db, doc, getDoc } = await getFirestoreSDK();
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      currentUserData = { uid: user.uid, ...userDoc.data() };
    }
  } catch (e) {
    console.warn('Failed to fetch user data:', e);
  }
}

/**
 * Wait for auth to be ready.
 */
export function waitForAuth() {
  return authReady;
}

/**
 * Login with email and password.
 */
export async function login(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Login with Google.
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  // Check if we need to create a user doc in Firestore
  try {
    const { db, doc, getDoc, setDoc, serverTimestamp } = await getFirestoreSDK();
    const userDoc = await getDoc(doc(db, 'users', result.user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', result.user.uid), {
        email: result.user.email,
        name: result.user.displayName || result.user.email.split('@')[0],
        role: 'user',
        createdAt: serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn('Failed to ensure user document exists for Google login:', e);
  }
  
  return result.user;
}

/**
 * Register a new user.
 */
export async function register(email, password, name) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Create user document in Firestore
  const { db, doc, setDoc, serverTimestamp } = await getFirestoreSDK();
  await setDoc(doc(db, 'users', result.user.uid), {
    email,
    name,
    role: 'user',
    createdAt: serverTimestamp(),
  });
  return result.user;
}

/**
 * Logout.
 */
export async function logout() {
  await signOut(auth);
}

/**
 * Get current Firebase user.
 */
export function getUser() {
  return currentUser;
}

/**
 * Get current user data (from Firestore).
 */
export function getUserData() {
  return currentUserData;
}

/**
 * Check if current user is admin.
 */
export function isAdmin() {
  return currentUserData?.role === 'admin';
}

/**
 * Get user initials for avatar.
 */
export function getUserInitials() {
  if (!currentUserData?.name) return '?';
  return currentUserData.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
