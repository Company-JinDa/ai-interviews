import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, addDoc } from "firebase/firestore"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Kiểm tra có dữ liệu hợp lệ không
    const {
      transfer_id,
      transfer_amount,
      transfer_content,
      transfer_status,
    } = body

    // Log ra để test webhook thực tế
    console.log("🔔 Webhook nhận từ SePay:", body)

    // Nếu không có content hoặc status khác success thì bỏ qua
    if (!transfer_content || transfer_status !== "success") {
      return NextResponse.json({ ignored: true }, { status: 200 })
    }

    // Lưu vào Firestore collection "transactions"
    await addDoc(collection(db, "transactions"), {
      transId: transfer_id || null,
      amount: transfer_amount || 0,
      content: transfer_content || "",
      status: "success",
      createdAt: new Date(),
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("❌ Webhook error:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}

// Nếu ai đó gọi sai method
export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
