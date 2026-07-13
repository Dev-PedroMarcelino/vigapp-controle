// ============================================================
// VigApp — Auth Module
// ============================================================
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, db, doc, getDoc, collection, addDoc, serverTimestamp } from './firebase.js';

let currentUser = null;
let currentUserData = null;
let authReadyResolve;
const authReady = new Promise(resolve => { authReadyResolve = resolve; });

/**
 * Initialize auth state listener.
 */
export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      // Fetch user doc from Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          currentUserData = { uid: user.uid, ...userDoc.data() };
        } else {
          currentUserData = {
            uid: user.uid,
            email: user.email,
            name: user.email.split('@')[0],
            role: 'user',
          };
        }
      } catch (e) {
        console.warn('Failed to fetch user data:', e);
        currentUserData = {
          uid: user.uid,
          email: user.email,
          name: user.email.split('@')[0],
          role: 'user',
        };
      }
    } else {
      currentUser = null;
      currentUserData = null;
    }
    authReadyResolve();
  });
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
 * Register a new user.
 */
export async function register(email, password, name) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  // Create user document in Firestore
  const { setDoc } = await import('firebase/firestore');
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
