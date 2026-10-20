/**
 * src/services/FirestoreUtils.js
 * Shared Firestore utilities.
 */
import { db } from '../config/firebase.js';

export function isDbAvailable() {
  return !!db;
}
