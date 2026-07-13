// ============================================================
// VigApp — Firestore CRUD Helpers
// ============================================================
import { getFirestoreSDK } from '../firestore-sdk.js';
import { getUserData } from '../auth.js';

/**
 * Add a document to a collection with audit fields.
 */
export async function createDocument(collectionName, data) {
  const { db, collection, addDoc, serverTimestamp } = await getFirestoreSDK();
  const user = getUserData();
  const docData = {
    ...data,
    createdBy: user ? { uid: user.uid, name: user.name, email: user.email } : null,
    createdAt: serverTimestamp(),
    updatedBy: user ? { uid: user.uid, name: user.name, email: user.email } : null,
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, collectionName), docData);
  return { id: ref.id, ...docData };
}

/**
 * Update a document with audit fields.
 */
export async function updateDocument(collectionName, docId, data) {
  const { db, doc, updateDoc, serverTimestamp } = await getFirestoreSDK();
  const user = getUserData();
  const docData = {
    ...data,
    updatedBy: user ? { uid: user.uid, name: user.name, email: user.email } : null,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, collectionName, docId), docData);
  return docData;
}

/**
 * Delete a document.
 */
export async function deleteDocument(collectionName, docId) {
  const { db, doc, deleteDoc } = await getFirestoreSDK();
  await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Get all documents from a collection with optional filters.
 */
export async function getDocuments(collectionName, filters = [], sortBy = null, limitCount = null) {
  const { db, collection, query, where, orderBy, limit, getDocs } = await getFirestoreSDK();
  let q = collection(db, collectionName);

  const constraints = [];
  filters.forEach(({ field, op, value }) => {
    constraints.push(where(field, op, value));
  });

  if (sortBy) {
    constraints.push(orderBy(sortBy.field, sortBy.direction || 'asc'));
  }

  if (limitCount) {
    constraints.push(limit(limitCount));
  }

  if (constraints.length > 0) {
    q = query(q, ...constraints);
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Get a single document by ID.
 */
export async function getDocument(collectionName, docId) {
  const { db, doc, getDoc } = await getFirestoreSDK();
  const docSnap = await getDoc(doc(db, collectionName, docId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

/**
 * Format a Firestore Timestamp to a readable date string.
 */
export function formatTimestamp(timestamp) {
  if (!timestamp) return '--';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a Firestore Timestamp to date + time.
 */
export function formatTimestampFull(timestamp) {
  if (!timestamp) return '--';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
