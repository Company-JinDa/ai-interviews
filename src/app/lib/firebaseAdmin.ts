// app/lib/firebaseAdmin.ts
import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getAuth } from "firebase-admin/auth"

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : null

if (!serviceAccount) {
  throw new Error("Thiếu GOOGLE_APPLICATION_CREDENTIALS_JSON trong .env.local")
}

const firebaseAdminApp =
  getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
      })
    : getApps()[0]

export const adminDb = getFirestore(firebaseAdminApp)
export const adminAuth = getAuth(firebaseAdminApp)

console.log("Firebase Admin SDK khởi tạo thành công!")