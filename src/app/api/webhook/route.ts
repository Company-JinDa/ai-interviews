import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, addDoc } from "firebase/firestore"

function normalizeContent(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")           
    .replace(/đ/g, "d")
    .replace(/-/g, "")             
    .replace(/[^a-z0-9_.]/g, "")   
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log("📩 Webhook SePay gửi đến:", body)

    if (body.transfer_type && body.transfer_type !== "in") {
      return NextResponse.json({ ignored: true, reason: "Not incoming" }, { status: 200 })
    }

    const transId = body.transfer_id || body.id || null
    const amount = Number(body.transfer_amount || body.amount || 0)
    const rawContent = body.transfer_content || body.content || ""
    const status = (body.transfer_status || body.status || "").toLowerCase()

    if (!rawContent) return NextResponse.json({ ignored: true, reason: "Missing content" }, { status: 200 })
    if (status !== "success") return NextResponse.json({ ignored: true, reason: "Not success" }, { status: 200 })

    const cleanContent = normalizeContent(rawContent)

          await addDoc(collection(db, "transactions"), {
            transId,
            amount,
            content: cleanContent,        
            rawContent: rawContent,       
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
