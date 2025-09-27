import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { amount, orderCode, description } = await req.json()

    const response = await fetch(`${process.env.SEPAY_API_URL}/v1/order/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${process.env.SEPAY_API_KEY}`,
      },
      body: JSON.stringify({
        amount,
        orderCode,
        description,
      }),
    })

    const text = await response.text() // đọc raw text
    console.log("📤 Raw response từ SePay:", text)

    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error("❌ Không parse được JSON:", e)
      return NextResponse.json(
        { success: false, error: "SePay không trả JSON", raw: text },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("❌ Lỗi tạo đơn hàng:", error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
