"use client"

import {
  Box,
  Flex,
  Text,
  HStack,
  Image,
  Button,
  VStack,
  useToast,
} from "@chakra-ui/react"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { auth, db } from "@/app/lib/firebase"
import {
  doc,
  setDoc,
  serverTimestamp,
  updateDoc,
  Timestamp,
} from "firebase/firestore"

function PurchaseCompanyContent() {
  const router = useRouter()
  const toast = useToast()
  const searchParams = useSearchParams()

  // Lấy params
  const qr = searchParams.get("qr") || ""
  const rawPrice = searchParams.get("price") || "0"
  const title = searchParams.get("title") || "Gói không xác định"
  const content = searchParams.get("content") || ""
  const type = searchParams.get("type") || "company" // "company" hoặc "mocktest_pro"
  const daysParam = searchParams.get("days")

  const amount = parseInt(rawPrice)
  const days = daysParam ? parseInt(daysParam) : type === "company" ? 90 : 30

  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 phút
  const [status, setStatus] = useState<"pending" | "success">("pending")

  // Countdown 15 phút
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  // Polling kiểm tra giao dịch
  useEffect(() => {
    if (!content) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-transaction?content=${encodeURIComponent(content)}`)
        const data = await res.json()

        if (data.status === "success") {
          setStatus("success")
          clearInterval(interval)

          const user = auth.currentUser
          if (!user) {
            toast({ title: "Lỗi", description: "Không tìm thấy người dùng", status: "error" })
            return
          }

          const uid = user.uid

          // Tính ngày hết hạn
          const expireDate = new Date()
          expireDate.setDate(expireDate.getDate() + days)
          const expiresAtTimestamp = Timestamp.fromDate(expireDate)

          // 1. Lưu lịch sử thanh toán (collection payment)
          await setDoc(doc(db, "payment", `${uid}_${Date.now()}`), {
            uid,
            packageName: title,
            amount,
            days,
            type, // "company" hoặc "mocktest_pro"
            content,
            qr,
            status: "success",
            createdAt: serverTimestamp(),
            expiresAt: expiresAtTimestamp,
          })

          // 2. Cập nhật user theo loại gói
          if (type === "mocktest_pro") {
            // Chỉ mở khóa MockTest Pro (cá nhân)
            await updateDoc(doc(db, "users", uid), {
              hasMocktestPro: true,
              mocktestProExpiresAt: expiresAtTimestamp,
              updatedAt: serverTimestamp(),
            })
          } else {
            // Gói Company → nâng role + tự động mở MockTest Pro
            await updateDoc(doc(db, "users", uid), {
              role: "company",
              hasMocktestPro: true,
              mocktestProExpiresAt: expiresAtTimestamp,
              updatedAt: serverTimestamp(),
            })
          }

          toast({
            title: "Thanh toán thành công!",
            description: type === "mocktest_pro" 
              ? `Bạn đã mở khóa MockTest Pro ${days} ngày!` 
              : `Chúc mừng trở thành Company Member!`,
            status: "success",
            duration: 5000,
            isClosable: true,
          })

          // Quay về dashboard sau 3s
          setTimeout(() => router.push("/auth/dashboard"), 3000)
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [content, router, amount, title, days, type, toast])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <Flex direction="column" minH="100vh" bg="gray.50" align="center" justify="center" p={4}>
      {/* Header */}
      <HStack
        spacing={4}
        cursor="pointer"
        mb={8}
        onClick={() => router.push("/auth/dashboard")}
      >
        <Image src="/logo.png" alt="logo" boxSize="60px" borderRadius="full" />
        <Text fontSize="3xl" fontWeight="extrabold">AI-Interview</Text>
      </HStack>

      {/* Main Card */}
      <Box
        bg="white"
        p={8}
        borderRadius="2xl"
        boxShadow="2xl"
        border="4px solid"
        borderColor="blue.400"
        maxW="520px"
        w="full"
        textAlign="center"
      >
        <Text fontSize="2xl" fontWeight="bold" color="blue.700" mb={2}>
          {type === "mocktest_pro" ? "Nâng cấp MockTest Pro" : "Thanh toán gói Company"}
        </Text>
        <Text fontSize="3xl" fontWeight="extrabold" color="blue.600" mb={6}>
          {title}
        </Text>

        <Text fontSize="lg" color="gray.700" mb={6}>
          Số tiền: <Text as="span" fontWeight="bold" fontSize="2xl">{amount.toLocaleString()}đ</Text>
        </Text>

        {/* QR Code */}
        {qr && (
          <Box mb={8}>
            <Image
              src={qr}
              alt="QR Thanh toán"
              width={280}
              height={280}
              mx="auto"
              borderRadius="lg"
              border="2px solid"
              borderColor="gray.300"
            />
          </Box>
        )}

        {/* Nội dung chuyển khoản */}
        {content && (
          <VStack spacing={3} mb={8} p={4} bg="blue.50" borderRadius="lg">
            <Text fontWeight="bold" color="blue.800">Nội dung chuyển khoản:</Text>
            <Text fontSize="lg" color="blue.600" wordBreak="break-all" fontFamily="mono">
              {content}
            </Text>
          </VStack>
        )}

        {/* Trạng thái */}
        {status === "pending" ? (
          <Text fontSize="xl" color="red.600" fontWeight="bold">
            Còn lại: {minutes}:{seconds.toString().padStart(2, "0")}
          </Text>
        ) : (
          <Text fontSize="xl" color="green.600" fontWeight="bold">
            Thành công! Đang chuyển hướng...
          </Text>
        )}

        {/* Nút hủy */}
        <Button
          mt={8}
          colorScheme="red"
          size="lg"
          w="full"
          onClick={() => router.push("/auth/dashboard")}
        >
          Về trang chủ
        </Button>
      </Box>

      <Text mt={8} color="gray.500" fontSize="sm">
        Hỗ trợ 24/7 • Thanh toán an toàn qua SePay
      </Text>
    </Flex>
  )
}

export default function PurchaseCompany() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <PurchaseCompanyContent />
    </Suspense>
  )
}