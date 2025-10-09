import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, addDoc } from "firebase/firestore"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("📩 Webhook SePay gửi đến:", body)

    // --- Kiểm tra loại giao dịch ---
    // Nếu SePay gửi cả tiền vào & tiền ra, ta chỉ nhận tiền vào thôi
    if (body.transfer_type && body.transfer_type !== "in") {
      console.log("🚫 Bỏ qua giao dịch tiền ra")
      return NextResponse.json({ ignored: true, reason: "Not incoming" }, { status: 200 })
    }

    // --- Lấy dữ liệu chính từ webhook ---
    const transId = body.transfer_id || body.transId || null
    const amount = Number(body.transfer_amount || body.amount || 0)
    const content = body.transfer_content || body.content || ""
    const status = body.transfer_status || body.status || "unknown"

    // --- Chỉ lưu khi giao dịch thành công ---
    if (status.toLowerCase() !== "success") {
      console.log("⚠️ Giao dịch chưa thành công, bỏ qua.")
      return NextResponse.json({ ignored: true, reason: "Not success" }, { status: 200 })
    }

    // --- Lưu giao dịch vào Firestore ---
    await addDoc(collection(db, "transactions"), {
      transId,
      amount,
      content,
      status: "success",
      createdAt: new Date(),
    })

    console.log("✅ Đã lưu giao dịch vào Firestore:", { transId, amount, content })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("❌ Webhook error:", err)
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 })
  }
}

// Chặn method GET (chỉ cho phép POST)
export async function GET() {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 })
}
