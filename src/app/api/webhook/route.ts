// app/api/webhook/route.ts
import { NextResponse } from "next/server"
import { adminDb } from "@/app/lib/firebaseAdmin"
import { FieldValue } from "firebase-admin/firestore"

function normalizeContent(str: string): string {
  return str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/đ/g, "d")
    .replace(/-/g, "")
    .replace(/[^a-z0-9_.]/g, "")
    .replace(/^ibft/, "") // ← QUAN TRỌNG: BỎ "IBFT " Ở ĐẦU
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("WEBHOOK SEPAY GỬI ĐẾN:", JSON.stringify(body, null, 2))

    // 1. Chỉ xử lý tiền vào
    const transferType = (body.transferType || body.transfer_type || "").toString().toLowerCase()
    if (transferType !== "in") {
      console.log("Không phải tiền vào → bỏ qua")
      return NextResponse.json({ ok: true })
    }

    // 2. Lấy nội dung + số tiền
    let rawContent = (body.content || body.transfer_content || "").toString()
    const amount = Number(body.transferAmount || body.transfer_amount || 0)

    if (!rawContent || amount <= 0) {
      console.log("Thiếu nội dung hoặc số tiền → bỏ qua")
      return NextResponse.json({ ok: true })
    }

    // 3. BỎ "IBFT " Ở ĐẦU (SePay thêm vào)
    rawContent = rawContent.replace(/^IBFT\s+/i, "").trim()
    console.log("NỘI DUNG SAU KHI DỌN:", rawContent)

    const cleanContent = normalizeContent(rawContent)
    console.log("NỘI DUNG CHUẨN HÓA:", cleanContent)

    // 4. LƯU NGAY LẬP TỨC – KHÔNG KIỂM TRA STATUS NỮA!
    await adminDb.collection("transactions").add({
      rawContent,
      content: cleanContent,
      amount,
      gateway: body.gateway || "unknown",
      transactionDate: body.transactionDate || new Date().toISOString(),
      status: "success",
      createdAt: FieldValue.serverTimestamp(),
    })

    console.log("ĐÃ LƯU GIAO DỊCH THÀNH CÔNG!", { amount, cleanContent })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error("WEBHOOK LỖI CHẾT MẸ:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Test route
export async function GET() {
  return NextResponse.json({ message: "Webhook SePay đang chạy ngon!" })
}