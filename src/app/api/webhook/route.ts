import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, addDoc } from "firebase/firestore"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("📩 Webhook SePay gửi đến:", body)

    // --- Bỏ qua nếu không phải tiền vào ---
    if (body.transfer_type && body.transfer_type !== "in") {
      console.log("🚫 Bỏ qua giao dịch tiền ra")
      return NextResponse.json({ ignored: true, reason: "Not incoming" }, { status: 200 })
    }

    const transId = body.transfer_id || body.id || null
    const amount = Number(body.transfer_amount || body.amount || 0)
    const rawContent = body.transfer_content || body.content || ""
    const status = (body.transfer_status || body.status || "").toLowerCase()

    if (!rawContent) {
      console.warn("⚠️ Không có nội dung giao dịch, bỏ qua.")
      return NextResponse.json({ ignored: true, reason: "Missing content" }, { status: 200 })
    }

    // --- Chỉ lưu khi thành công ---
    if (status !== "success") {
      console.log("⚠️ Giao dịch chưa thành công, bỏ qua.")
      return NextResponse.json({ ignored: true, reason: "Not success" }, { status: 200 })
    }

    const cleanContent = rawContent.trim().toLowerCase()

    await addDoc(collection(db, "transactions"), {
      transId,
      amount,
      content: cleanContent,
      status: "success",
      createdAt: new Date(),
    })

    console.log("✅ Đã lưu giao dịch Firestore:", { transId, amount, cleanContent })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("❌ Webhook error:", err)
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
