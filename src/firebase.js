// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, doc, onSnapshot, collection, query, orderBy } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDQnrtzcTHT6R_aMElwgoem2bSRkYNyU5o",
  authDomain: "karyana-dev.firebaseapp.com",
  projectId: "karyana-dev",
  storageBucket: "karyana-dev.appspot.com",
  messagingSenderId: "207795231930",
  appId: "1:207795231930:web:83cfca99fcb8d3175e3683",
  measurementId: "G-QL1KG2Z4B2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Export Firebase services
export { db, doc, onSnapshot, collection, query, orderBy };
export default app;