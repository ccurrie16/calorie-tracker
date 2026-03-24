import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBzk6rYv1up1gwZQIojxGRr493UxTd3HU0",
  authDomain: "calorie-tracker-52e0f.firebaseapp.com",
  projectId: "calorie-tracker-52e0f",
  storageBucket: "calorie-tracker-52e0f.firebasestorage.app",
  messagingSenderId: "841391591318",
  appId: "1:841391591318:web:a5d9a7b09130b7405417b7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);