// app/lib/mocktestPackages.ts
export const mocktestPackages = {
  oneMonth: {
    id: "mock_30days",
    title: "Gói 1 tháng",
    days: 30,
    totalPrice: 290000,        // Giá thực tế thanh toán
    pricePerMonth: 290000,     // 290k/tháng
    displayPrice: "290k",      // Hiển thị trên giao diện
    displayPerMonth: "290k/tháng",
    priceUSD: 12,
  },
  threeMonth: {
    id: "mock_90days",
    title: "Gói 3 tháng",
    days: 90,
    totalPrice: 690000,
    pricePerMonth: Math.round(690000 / 3), // 230k/tháng
    displayPrice: "690k",
    displayPerMonth: "230k/tháng",         // Đẹp nhất ở đây
    priceUSD: 28,
  },
  sixMonth: {
    id: "mock_180days",
    title: "Gói 6 tháng",
    days: 180,
    totalPrice: 990000,
    pricePerMonth: Math.round(990000 / 6), // 165k/tháng
    displayPrice: "990k",
    displayPerMonth: "165k/tháng",         // Rẻ nhất/tháng → nổi bật
    priceUSD: 40,
  },
} as const