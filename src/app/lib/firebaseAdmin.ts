import { initializeApp, getApps, cert, type App } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
import { getAuth } from "firebase-admin/auth"

let firebaseAdminApp: App | undefined

function getFirebaseAdminApp(): App {
  if (firebaseAdminApp) return firebaseAdminApp

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (!credentialsJson) {
    throw new Error("Thiếu GOOGLE_APPLICATION_CREDENTIALS_JSON trong môi trường server")
  }

  let serviceAccount: Record<string, unknown>
  try {
    serviceAccount = JSON.parse(credentialsJson) as Record<string, unknown>
  } catch {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON không phải JSON hợp lệ")
  }

  firebaseAdminApp = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) })
  return firebaseAdminApp
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp())
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp())
}