import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPPsAFm7126_NqdT7Cu5HeBpx6xQArEA4",
  authDomain: "teaching-assignment.firebaseapp.com",
  projectId: "teaching-assignment",
  storageBucket: "teaching-assignment.firebasestorage.app",
  messagingSenderId: "407460554203",
  appId: "1:407460554203:web:5a16b3c1edecd99aa8b3fe",
  measurementId: "G-5XLHFS0L42"
}; // <--- ต้องใส่ปีกกาปิด } และเครื่องหมาย semicolon ; แบบนี้ครับ

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);