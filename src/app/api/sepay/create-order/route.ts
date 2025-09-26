import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { amount, orderCode, description } = await req.json();

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
    });

    const data = await response.json();
    console.log("📤 Response từ SePay:", data);

    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Lỗi tạo đơn hàng:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
