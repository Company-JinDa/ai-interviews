import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, addDoc } from "firebase/firestore"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Lưu giao dịch vào Firestore
    await addDoc(collection(db, "transactions"), {
      transId: body.transId || null,
      amount: body.amount || 0,
      content: body.content || "",
      status: "success",
      createdAt: new Date(),
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("Webhook error:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

// Nếu ai đó gọi sai method
export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
