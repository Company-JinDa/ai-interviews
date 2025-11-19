// lib/uploadToMocktestSet.ts   (hoặc bất kỳ đâu bạn thích)

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { mocktestSets } from "./mocktestData"; // sửa đường dẫn nếu cần

const firebaseConfig = {
  apiKey: "AIzaSyCaWIB51m3m8Sv0u_jtvXEd41c064FhYak",
  authDomain: "ai-interview-5863c.firebaseapp.com",
  projectId: "ai-interview-5863c",
  storageBucket: "ai-interview-5863c.firebasestorage.app",
  messagingSenderId: "1077521349218",
  appId: "1:1077521349218:web:535a301576444405adaf3b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function uploadMocktestSets() {
  console.log("Bắt đầu upload vào collection: mocktestSet");

  for (const item of mocktestSets) {
    const id = `${item.level}_${item.role.replace(/ /g, "_")}`;
    
    await setDoc(doc(db, "mocktestSet", id), {
      id,
      level: item.level,
      role: item.role,
      questions: item.questions,
      uploadedAt: new Date(),
    });

    console.log("Đã upload:", id);
  }

  console.log("HOÀN TẤT! Đã upload thành công", mocktestSets.length, "bộ vào mocktestSet");
}

// Gọi ngay nếu chạy file này bằng node/tsx
// uploadMocktestSets().catch(e => console.error("Lỗi:", e));