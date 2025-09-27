// giả sử bạn có 1 Map lưu orderId -> status
import { NextRequest, NextResponse } from "next/server"

const orderStatus = new Map<string, string>()

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const apiKey = req.headers.get("authorization")
    if (apiKey !== `Apikey ${process.env.SEPAY_API_KEY}`) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    console.log("📥 Nhận webhook từ SePay:", data)

    if (data.transferAmount === data.orderAmount) {
      orderStatus.set(data.orderCode, "paid")
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 500 })
  }
}

// export thêm GET để client check trạng thái
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const orderCode = searchParams.get("orderCode")
  return NextResponse.json({
    status: orderStatus.get(orderCode || "") || "pending",
  })
}
