import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  where,
  getDocs,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDQnrtzcTHT6R_aMElwgoem2bSRkYNyU5o",
  authDomain: "karyana-dev.firebaseapp.com",
  projectId: "karyana-dev",
  storageBucket: "karyana-dev.appspot.com",
  messagingSenderId: "207795231930",
  appId: "1:207795231930:web:83cfca99fcb8d3175e3683",
  measurementId: "G-QL1KG2Z4B2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db, doc, onSnapshot, collection, query, orderBy, where, getDocs };
export default app;