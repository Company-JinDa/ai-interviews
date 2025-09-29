import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { amount, content } = body

    if (!amount || !content) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 })
    }

    const qr = `https://qr.sepay.vn/img?acc=96247EYOKE&bank=BIDV&amount=${amount}&des=${encodeURIComponent(content)}`

    return NextResponse.json({ qr, content, amount })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
