import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

function normalizeContent(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9\-_.]/g, "")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const content = searchParams.get("content")

    if (!content) return NextResponse.json({ error: "Missing content" }, { status: 400 })

    const cleanContent = normalizeContent(content)
    const q = query(collection(db, "transactions"), where("content", "==", cleanContent))
    const snap = await getDocs(q)

    if (!snap.empty) {
      console.log("✅ Giao dịch thành công:", cleanContent)
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    console.log("⏳ Chưa thấy giao dịch:", cleanContent)
    return NextResponse.json({ status: "pending" }, { status: 200 })
  } catch (err) {
    console.error("Check transaction error:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
