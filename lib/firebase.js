import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBAMIF5CSHmurFtmsa2z22PQjkewe0N4Ng",
  authDomain: "ine-map.firebaseapp.com",
  projectId: "ine-map",
  storageBucket: "ine-map.firebasestorage.app", // ここOK！
  messagingSenderId: "651457489279",
  appId: "1:651457489279:web:5928085705bb3877b0524a",
  measurementId: "G-W9KCCVWMK0"
};

// ここから追加
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
