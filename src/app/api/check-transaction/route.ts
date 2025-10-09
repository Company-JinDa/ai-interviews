import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const content = searchParams.get("content")

    if (!content) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 })
    }

    const cleanContent = content.trim().toLowerCase()
    const q = query(
      collection(db, "transactions"),
      where("content", "==", cleanContent)
    )
    const snap = await getDocs(q)

    if (!snap.empty) {
      console.log("✅ Giao dịch thành công với content:", cleanContent)
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    console.log("⏳ Giao dịch chưa thấy:", cleanContent)
    return NextResponse.json({ status: "pending" }, { status: 200 })
  } catch (err) {
    console.error("Check transaction error:", err)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
