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
  Spinner,
} from "@chakra-ui/react"
import { CheckCircleIcon } from "@chakra-ui/icons"
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

  const qr = searchParams.get("qr") || ""
  const rawPrice = searchParams.get("price") || "0"
  const title = searchParams.get("title") || "Gói không xác định"
  const content = searchParams.get("content") || ""
  const type = searchParams.get("type") || "company"
  const daysParam = searchParams.get("days")

  const amount = parseInt(rawPrice)
  const days = daysParam ? parseInt(daysParam) : type === "company" ? 90 : 30

  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [status, setStatus] = useState<"pending" | "checking" | "success">("pending")

  // Countdown
  useEffect(() => {
    if (timeLeft <= 0 || status !== "pending") return
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, status])

  // Polling kiểm tra giao dịch
  useEffect(() => {
    if (!content || status === "success") return

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
          console.log("POLLING THÀNH CÔNG – BẮT ĐẦU LƯU LỊCH SỬ VÀ MỞ KHÓA", { uid, type, days })

          const expireDate = new Date()
          expireDate.setDate(expireDate.getDate() + days)
          const expiresAtTimestamp = Timestamp.fromDate(expireDate)

          // Lưu lịch sử thanh toán
          await setDoc(doc(db, "payment", `${uid}_${Date.now()}`), {
            uid,
            packageName: title,
            amount,
            days,
            type,
            content,
            qr,
            status: "success",
            createdAt: serverTimestamp(),
            expiresAt: expiresAtTimestamp,
          })

          // Cập nhật user
          if (type === "mocktest_pro") {
            await updateDoc(doc(db, "users", uid), {
              hasMocktestPro: true,
              mocktestProExpiresAt: expiresAtTimestamp,
              updatedAt: serverTimestamp(),
            })
          } else {
            await updateDoc(doc(db, "users", uid), {
              role: "company",
              hasMocktestPro: true,
              mocktestProExpiresAt: expiresAtTimestamp,
              updatedAt: serverTimestamp(),
            })
          }

          toast({
            title: "THANH TOÁN THÀNH CÔNG!",
            description: type === "mocktest_pro"
              ? `Đã mở khóa MockTest Pro ${days} ngày!`
              : "Chúc mừng bạn đã trở thành Company Member!",
            status: "success",
            duration: 6000,
            isClosable: true,
          })

          setTimeout(() => router.push("/auth/dashboard"), 4000)
        } else {
          setStatus("checking")
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [content, status, router, amount, title, days, type, toast])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60

  // MÀN HÌNH THÀNH CÔNG SIÊU ĐẸP
  if (status === "success") {
    return (
      <Flex direction="column" minH="100vh" bgGradient="linear(to-br, green.50, blue.50)" align="center" justify="center" p={6}>
        <VStack spacing={10} maxW="600px">
          <CheckCircleIcon boxSize={32} color="green.500" />
          <Text fontSize="6xl" fontWeight="extrabold" color="green.600">
            THÀNH CÔNG!
          </Text>
          <Text fontSize="3xl" fontWeight="bold" color="green.700">
            Ngân hàng đã nhận tiền
          </Text>
          <Box textAlign="center" bg="white" p={8} borderRadius="2xl" boxShadow="2xl" w="full">
            <Text fontSize="2xl" fontWeight="bold" color="blue.700" mb={4}>
              {title}
            </Text>
            <Text fontSize="4xl" fontWeight="extrabold" color="green.600" mb={4}>
              {amount.toLocaleString()}đ
            </Text>
            <Text fontSize="xl" color="gray.700">
              Hiệu lực: <b>{days} ngày</b>
            </Text>
            <Text fontSize="lg" color="gray.600" mt={4}>
              Tài khoản của bạn đã được kích hoạt tự động
            </Text>
          </Box>
          <Button
            colorScheme="green"
            size="lg"
            w="full"
            h="60px"
            fontSize="xl"
            onClick={() => router.push("/auth/dashboard")}
          >
            Về Trang Chủ
          </Button>
        </VStack>
      </Flex>
    )
  }

  // MÀN HÌNH ĐANG CHỜ THANH TOÁN
  return (
    <Flex direction="column" minH="100vh" bg="gray.50" align="center" justify="center" p={4}>
      <HStack spacing={4} cursor="pointer" mb={8} onClick={() => router.push("/auth/dashboard")}>
        <Image src="/logo.png" alt="logo" boxSize="60px" borderRadius="full" />
        <Text fontSize="3xl" fontWeight="extrabold">AI-Interview</Text>
      </HStack>

      <Box bg="white" p={8} borderRadius="2xl" boxShadow="2xl" border="4px solid" borderColor="blue.400" maxW="520px" w="full" textAlign="center">
        <Text fontSize="2xl" fontWeight="bold" color="blue.700" mb={2}>
          {type === "mocktest_pro" ? "Nâng cấp MockTest Pro" : "Thanh toán gói Company"}
        </Text>
        <Text fontSize="3xl" fontWeight="extrabold" color="blue.600" mb={6}>
          {title}
        </Text>

        <Text fontSize="lg" color="gray.700" mb={6}>
          Số tiền: <Text as="span" fontWeight="bold" fontSize="2xl">{amount.toLocaleString()}đ</Text>
        </Text>

        {qr && (
          <Box mb={8}>
            <Image src={qr} alt="QR" width={280} height={280} mx="auto" borderRadius="lg" border="2px solid" borderColor="gray.300" />
          </Box>
        )}

        {content && (
          <VStack spacing={3} mb={8} p={4} bg="blue.50" borderRadius="lg">
            <Text fontWeight="bold" color="blue.800">Nội dung chuyển khoản:</Text>
            <Text fontSize="lg" color="blue.600" wordBreak="break-all" fontFamily="mono">
              {content}
            </Text>
          </VStack>
        )}

        {/* Trạng thái */}
        {status === "pending" && (
          <Text fontSize="xl" color="red.600" fontWeight="bold">
            Còn lại: {minutes}:{seconds.toString().padStart(2, "0")}
          </Text>
        )}

        {status === "checking" && (
          <HStack spacing={4} mt={6} color="orange.600">
            <Spinner size="lg" thickness="4px" speed="0.8s" />
            <Text fontSize="xl" fontWeight="bold">
              Đang kiểm tra giao dịch... (thường dưới 10s)
            </Text>
          </HStack>
        )}

        <Button mt={8} colorScheme="red" size="lg" w="full" onClick={() => router.push("/auth/dashboard")}>
          Hủy thanh toán
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