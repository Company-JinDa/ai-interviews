// app/api/check-transaction/route.ts
import { NextResponse } from "next/server"
import { db } from "@/app/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

function normalizeContent(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/đ/g, "d")
    .replace(/-/g, "")             
    .replace(/[^a-z0-9_.]/g, "")
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const rawContent = searchParams.get("content") || ""

    if (!rawContent) {
      return NextResponse.json({ error: "Missing content" }, { status: 400 })
    }

    // ← QUAN TRỌNG: normalize cả content nhận từ frontend
    const cleanContent = normalizeContent(rawContent)

    const q = query(
      collection(db, "transactions"),
      where("content", "==", cleanContent)
    )
    const snap = await getDocs(q)

    if (!snap.empty) {
      console.log("CHECK-TRANSACTION: Tìm thấy giao dịch → trả success")
      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    return NextResponse.json({ status: "pending" }, { status: 200 })
  } catch (err: any) {
    console.error("Check transaction error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}