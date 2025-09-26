"use client"

import { useEffect, useState } from "react"
import { Box, Text, Image, Spinner } from "@chakra-ui/react"

export default function PurchaseCompany() {
  const [order, setOrder] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    const createOrder = async () => {
      const res = await fetch("/api/sepay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 255000,
          orderCode: "ORDER_" + Date.now(),
          description: "Thanh toán 255k / 3 tháng",
        }),
      })
      const result = await res.json()

      if (result?.data) {
        setOrder(result.data)

        const now = Math.floor(Date.now() / 1000)
        setTimeLeft(result.data.expired_at - now)
      }
    }
    createOrder()
  }, [])

  // Countdown
  useEffect(() => {
    if (!timeLeft) return
    const timer = setInterval(() => {
      setTimeLeft((t) => (t > 0 ? t - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`

  if (!order) {
    return (
      <Box textAlign="center" p={10}>
        <Spinner size="xl" />
        <Text mt={4}>Đang tạo đơn hàng...</Text>
      </Box>
    )
  }

  return (
    <Box textAlign="center" p={10}>
      <Text fontSize="xl" fontWeight="bold">
        Thanh toán {order.amount / 1000}k / 3 tháng
      </Text>

      <Text mt={4}>Quét mã bên dưới để chuyển khoản.</Text>
      <Text fontWeight="bold" color="purple.600">
        Lưu ý: GIỮ NGUYÊN nội dung để xác nhận thành công.
      </Text>

      <Image src={order.qr_code} alt="QR Code" mx="auto" my={6} boxSize="250px" />

      <Text>Đang đợi bạn chuyển tiền ⟳</Text>
      <Text>Hết hiệu lực trong: <b>{formatTime(timeLeft)}</b></Text>

      <Box border="1px solid #ddd" rounded="md" p={4} mt={4} maxW="sm" mx="auto">
        <Text>Ngân hàng: {order.bank_account.bank_name}</Text>
        <Text>STK: {order.bank_account.account_number}</Text>
        <Text>Người nhận: {order.bank_account.account_name}</Text>
        <Text>
          Nội dung: <b>{order.description}</b>
        </Text>
      </Box>
    </Box>
  )
}
