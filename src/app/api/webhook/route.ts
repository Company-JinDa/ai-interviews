// app/api/webhook/route.ts
import { NextResponse } from "next/server"
import { adminDb } from "@/app/lib/firebaseAdmin"
import { FieldValue } from "firebase-admin/firestore"

function normalizeContent(str: string): string {
  return str
    .toString()
    .trim()
    .replace(/^IBFT\s+/i, "")  // ← BỎ "IBFT " Ở ĐẦU
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/đ/g, "d")
    .replace(/-/g, "")
    .replace(/[^a-z0-9_.]/g, "")
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("WEBHOOK SEPAY GỬI ĐẾN:", JSON.stringify(body, null, 2))

    // 1. CHỈ KIỂM TRA TIỀN VÀO
    const transferType = (body.transferType || body.transfer_type || "").toString().toLowerCase()
    if (transferType !== "in") {
      console.log("Không phải tiền vào → bỏ qua")
      return NextResponse.json({ ok: true })
    }

    // 2. LẤY DỮ LIỆU
    let rawContent = (body.content || body.transfer_content || "").toString()
    const amount = Number(body.transferAmount || body.transfer_amount || 0)

    if (!rawContent || amount <= 0) {
      console.log("Thiếu nội dung hoặc số tiền → bỏ qua")
      return NextResponse.json({ ok: true })
    }

    // 3. DỌN SẠCH "IBFT "
    rawContent = rawContent.replace(/^IBFT\s+/i, "").trim()
    const cleanContent = normalizeContent(rawContent)

    console.log("NỘI DUNG GỐC:", rawContent)
    console.log("NỘI DUNG SAU CHUẨN HÓA:", cleanContent)
    console.log("SỐ TIỀN:", amount)

    // 4. LƯU NGAY – KHÔNG KIỂM TRA STATUS NỮA!!!
    if (!adminDb) {
      console.error("adminDb is not initialized")
      return NextResponse.json({ error: "adminDb is not initialized" }, { status: 500 })
    }

    await adminDb.collection("transactions").add({
      rawContent,
      content: cleanContent,
      amount,
      gateway: body.gateway || "unknown",
      transactionId: body.id || body.transfer_id,
      transactionDate: body.transactionDate || new Date().toISOString(),
      status: "success",
      createdAt: FieldValue.serverTimestamp(),
    })

    console.log("ĐÃ LƯU GIAO DỊCH THÀNH CÔNG VÀO FIRESTORE!", cleanContent)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error("WEBHOOK LỖI:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
export async function GET() {
  return NextResponse.json({ message: "Webhook SePay đang chạy ngon!" })
}