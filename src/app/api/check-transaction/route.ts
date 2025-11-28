// app/api/check-transaction/route.ts
import { NextResponse } from "next/server"
import { db, auth } from "@/app/lib/firebase"
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore"
import { adminDb } from "@/app/lib/firebaseAdmin" // nếu dùng firebase-admin thì tốt hơn

function normalizeContent(str: string) {
  return str.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9\-_.]/g, "")
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
      // Tìm thấy giao dịch → xử lý mở khóa (chỉ chạy 1 lần)
      const url = new URL(req.url)
      const rawContent = url.searchParams.get("raw") || content
      const match = rawContent.match(/(MOCK|threeMonth|sixMonth)/)
      const pkgType = match?.[0]

      if (pkgType === "MOCK") {
        // Gói MockTest Pro → mở khóa cá nhân
        // Bạn có thể thêm logic ghi log hoặc gọi Cloud Function ở đây
        console.log("Mở khóa MockTest Pro cho nội dung:", rawContent)
      } else if (pkgType === "threeMonth" || pkgType === "sixMonth") {
        // Gói Company → nâng cấp role
        console.log("Nâng cấp Company cho:", rawContent)
      }

      return NextResponse.json({ status: "success" }, { status: 200 })
    }

    return NextResponse.json({ status: "pending" }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}