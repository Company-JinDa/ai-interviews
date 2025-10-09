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
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { auth, db } from "@/app/lib/firebase"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"

export default function PurchaseCompany() {
  const router = useRouter()
  const toast = useToast()
  const searchParams = useSearchParams()

  const qr = searchParams?.get("qr") || ""
  const amount = searchParams?.get("price") || "0"
  const packageName = searchParams?.get("title") || "Unknown"
  const content = searchParams?.get("content") || ""

  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 phút
  const [status, setStatus] = useState<"pending" | "success">("pending")

  // countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  // polling check giao dịch
  useEffect(() => {
    if (!content) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/check-transaction?content=${content}`)
        const data = await res.json()

        if (data.status === "success") {
          setStatus("success")
          clearInterval(interval)

          // ✅ Lưu lịch sử thanh toán
          const user = auth.currentUser
          if (user) {
            const uid = user.uid
            const paymentRef = doc(
              db,
              "historyPayment",
              `${uid}_${Date.now()}`
            )
            await setDoc(paymentRef, {
              uid,
              packageName,
              amount: parseInt(amount),
              content,
              qr,
              status: "success",
              createdAt: serverTimestamp(),
            })
          }

          toast({
            title: "Thanh toán thành công!",
            description: "Giao dịch của bạn đã được ghi nhận.",
            status: "success",
            duration: 4000,
            isClosable: true,
          })

          // 3s sau về dashboard
          setTimeout(() => router.push("/auth/dashboard"), 3000)
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 5000) // check mỗi 5s

    return () => clearInterval(interval)
  }, [content, router, amount, packageName, qr, toast])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  return (
    <Flex direction="column" minH="100vh" p={6} align="center">
      {/* Logo + title */}
      <HStack
        spacing={3}
        cursor="pointer"
        mb={6}
        onClick={() => router.push("/auth/dashboard")}
      >
        <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">
          AI-Interview
        </Text>
      </HStack>

      <Box
        border="1px solid"
        borderColor="blue.300"
        p={6}
        borderRadius="md"
        maxW="500px"
        textAlign="center"
      >
        <Text fontSize="xl" fontWeight="bold" mb={2}>
          Thanh toán gói {packageName}
        </Text>
        <Text mb={4} color="gray.600">
          Số tiền cần thanh toán:{" "}
          <Text as="span" fontWeight="bold">
            {amount} VND
          </Text>
        </Text>

        {/* QR */}
        <Box mb={4}>
          <Image src={qr} alt="QR Code SePay" width={200} height={200} mx="auto" />
        </Box>

        {/* Nội dung chuyển khoản */}
        <VStack spacing={2} mb={4}>
          <Text fontWeight="bold">Nội dung chuyển khoản:</Text>
          <Text color="blue.600">{content}</Text>
        </VStack>

        {/* Countdown hoặc trạng thái */}
        {status === "pending" ? (
          <Text mb={4} color="red.500" fontWeight="bold">
            Thời gian còn lại: {minutes}:{seconds.toString().padStart(2, "0")}
          </Text>
        ) : (
          <Text mb={4} color="green.500" fontWeight="bold">
            Thanh toán thành công ✅. Đang chuyển về trang chủ...
          </Text>
        )}

        <Button
          colorScheme="red"
          onClick={() => router.push("/components/packageCompany")}
        >
          Hủy
        </Button>
      </Box>
    </Flex>
  )
}
