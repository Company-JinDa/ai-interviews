import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const apiKey = req.headers.get("authorization");
    if (apiKey !== `Apikey ${process.env.SEPAY_API_KEY}`) {
      console.warn("⚠️ Webhook bị từ chối: Sai API key");
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("📥 Nhận webhook từ SePay:", data);

    // 👉 TODO: kiểm tra orderCode hoặc referenceCode trong data
    // Ví dụ:
    // if (data.transferAmount === data.orderAmount) {
    //   updateOrderStatus(data.orderCode, "paid");
    // }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("❌ Lỗi webhook:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
