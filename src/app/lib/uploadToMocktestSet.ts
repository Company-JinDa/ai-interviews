// app/lib/uploadToMocktestSet.ts   (đã sửa hoàn chỉnh)

import { db } from "@/app/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { mocktestSets } from "./mocktestData"; // điều chỉnh đường dẫn cho đúng

/**
 * Upload toàn bộ mocktestSets lên Firestore
 * Collection: mocktestSets
 * Document ID: level_role  (ví dụ: Intern_Front-End, Senior_DevOps)
 */
export async function uploadQuestions() {
  try {
    console.log("Bắt đầu upload mocktestSets...");

    for (const item of mocktestSets) {
      const { level, role, questions } = item;

      // Tạo ID an toàn: thay khoảng trắng và ký tự đặc biệt bằng "_", viết hoa chữ cái đầu mỗi từ
      const safeLevel = level.trim();
      const safeRole = role.trim().replace(/\s+/g, "_"); // "Cyber security" → "Cyber_security"
      const docId = `${safeLevel}_${safeRole}`;

      const ref = doc(db, "mocktestSets", docId);

      await setDoc(ref, {
        level: safeLevel,
        role: safeRole.replace(/_/g, " "), // lưu lại dạng có dấu cách để hiển thị đẹp
        originalRole: role,               // giữ nguyên tên gốc (nếu cần)
        questions,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log("Uploaded:", docId);
    }

    console.log("Tất cả dữ liệu đã được upload thành công!");
    alert("Upload mocktestSets thành công! Xem console để chi tiết.");
  } catch (error) {
    console.error("Lỗi khi upload:", error);
    alert("Upload thất bại! Xem console.");
  }
}