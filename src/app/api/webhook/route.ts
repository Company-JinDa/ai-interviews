import { NextResponse } from "next/server"
import * as admin from "firebase-admin"
import fs from "fs"

// Init Firebase admin (singleton tránh init nhiều lần khi hot reload)
if (!admin.apps.length) {
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT as string
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"))
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log("Webhook SePay received:", body)

    const {
      amount,
      description,
      transaction_id,
      status,
      bank_code,
      account_number,
    } = body

    if (!amount || !description) {
      return NextResponse.json({ error: "Missing amount or description" }, { status: 400 })
    }

    // description ví dụ: "AIInterview-Gói 3 tháng-1695984939201"
    const [prefix, packageName, timestamp] = description.split("-")

    // Save transaction vào Firestore
    await db.collection("transactions").doc(transaction_id).set({
      amount,
      description,
      packageName,
      timestamp: Number(timestamp),
      status,
      bank_code,
      account_number,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    // TODO: nếu status = success → cập nhật user → active gói vip

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("Webhook error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
