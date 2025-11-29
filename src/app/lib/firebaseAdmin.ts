// app/lib/firebaseAdmin.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { cert } from "firebase-admin/app";

// Exported variables must be declared at top-level; assign them inside the conditional branches.
export let adminDb: Firestore | null = null;
export let adminAuth: Auth | null = null;

// Cách 1: Vercel / Production → dùng env variables (đã set ở Vercel)
if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  const firebaseAdminApp =
    getApps().length === 0
      ? initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // QUAN TRỌNG NHẤT
          }),
        })
      : getApps()[0];

  adminDb = getFirestore(firebaseAdminApp);
  adminAuth = getAuth(firebaseAdminApp);
  console.log("Firebase Admin khởi tạo từ Vercel env variables");
}

// Cách 2: Local dev → tự động dùng file JSON (nếu có)
else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || require("fs").existsSync("./serviceAccountKey.json")) {
  const firebaseAdminApp =
    getApps().length === 0
      ? initializeApp() // Firebase tự đọc file JSON từ GOOGLE_APPLICATION_CREDENTIALS hoặc file gần nhất
      : getApps()[0];

  adminDb = getFirestore(firebaseAdminApp);
  adminAuth = getAuth(firebaseAdminApp);
  console.log("Firebase Admin khởi tạo từ file JSON (local)");
}

// Nếu cả 2 đều không có → báo lỗi rõ ràng
else {
  throw new Error(
    "Thiếu Firebase credentials! " +
      "Vercel cần: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY\n" +
      "Local cần: file serviceAccountKey.json hoặc GOOGLE_APPLICATION_CREDENTIALS"
  );
}