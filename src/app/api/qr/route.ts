import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { amount, content } = body

    if (!amount || !content) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 })
    }

    const acc = "96247EYOKE"
    const bank = "BIDV"

    const qr = `https://qr.sepay.vn/img?acc=${acc}&bank=${bank}&amount=${amount}&des=${encodeURIComponent(content)}`

    return NextResponse.json({ qr, content, amount })
  } catch (err: any) {
    console.error("QR error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
