/**
 * src/services/firebase.js
 * Dedicated Firebase service adapter and exports for Auth and Firestore persistence.
 */

export * from '../config/firebase.js';
export { db, auth, ensureAuthPersistence, HOUSEHOLD_ID, FIREBASE_CONFIG } from '../config/firebase.js';
