// Firebase is not used by Connectifi. Keep this module inert so a stale import
// cannot expose project configuration or open client-side data access.
export const firebaseApp = null;
export const firestore = null;
export const firebaseAuth = null;
export const firebaseStorage = null;

window.firebaseApp = null;
window.firestore = null;
window.firebaseAuth = null;
window.firebaseStorage = null;
