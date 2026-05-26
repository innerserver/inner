import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAP2uqcSF-tu8avNQhqRdBVwAcS8rzsDkU',
  authDomain: 'inner-79133.firebaseapp.com',
  projectId: 'inner-79133',
  storageBucket: 'inner-79133.firebasestorage.app',
  messagingSenderId: '1061388899666',
  appId: '1:1061388899666:web:5e0626c7f9af28b363d68b'
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseStorage = getStorage(firebaseApp);

window.firebaseApp = firebaseApp;
window.firestore = firestore;
window.firebaseAuth = firebaseAuth;
window.firebaseStorage = firebaseStorage;
