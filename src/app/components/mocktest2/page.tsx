"use client"

import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Image,
  Button,
} from "@chakra-ui/react"
import { useRouter } from "next/navigation"
import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"
import { mocktestPackages } from "@/app/lib/mocktestPackages"

export default function MockTest2() {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang]

  const handlePurchase = async (pkg: typeof mocktestPackages.oneMonth) => {
    try {
      const content = `AIInterview-MOCK-${pkg.id}-${Date.now()}`
      
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: pkg.price,
          content,
          packageName: pkg.id,
          type: "mocktest_pro", // Đánh dấu đây là gói MockTest Pro
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert("Tạo QR thất bại, vui lòng thử lại!")
        return
      }

      // Dùng chung trang purchaseCompany
      router.push(
        `/pages/purchaseCompany?title=${encodeURIComponent(pkg.title)}&price=${pkg.price}&days=${pkg.days}&qr=${encodeURIComponent(data.qr)}&content=${encodeURIComponent(data.content)}&type=mocktest_pro`
      )
    } catch (err) {
      console.error(err)
      alert("Có lỗi xảy ra, vui lòng thử lại sau")
    }
  }

  return (
    <Flex direction="column" minH="100vh" align="center" p={6} bg="gray.50">
      {/* Header */}
      <HStack spacing={4} mb={8} cursor="pointer" onClick={() => router.push("/auth/dashboard")}>
        <Image src="/logo.png" alt="logo" boxSize="60px" borderRadius="full" />
        <Text fontSize="3xl" fontWeight="extrabold">AI-Interview</Text>
      </HStack>

      {/* Title */}
      <Text fontSize="4xl" fontWeight="bold" mb={4} color="blue.600">
        Nâng cấp Mock Test Pro
      </Text>
      <Text fontSize="lg" color="gray.600" mb={10} maxW="600px" textAlign="center">
        Trải nghiệm câu hỏi khó hơn, phân tích chi tiết, không giới hạn lượt luyện tập
      </Text>

      {/* Packages */}
      <Flex gap={10} flexWrap="wrap" justify="center">
        {Object.values(mocktestPackages).map((pkg) => (
          <Box
            key={pkg.id}
            bg="white"
            p={8}
            borderRadius="2xl"
            boxShadow="xl"
            border="3px solid"
            borderColor="cyan.400"
            w="320px"
            textAlign="center"
            transition="all 0.3s"
            _hover={{ transform: "translateY(-10px)", boxShadow: "2xl" }}
          >
            <Text fontSize="2xl" fontWeight="bold" color="cyan.700">
              {pkg.title}
            </Text>
            <Text fontSize="md" color="gray.600" my={3}>
              Hiệu lực {pkg.days} ngày
            </Text>

            <Text fontSize="5xl" fontWeight="extrabold" color="blue.600">
              {lang === "vi" ? `${(pkg.price / 1000).toFixed(0)}k` : `$${pkg.priceUSD}`}
            </Text>
            <Text fontSize="sm" color="gray.500" mb={6}>
              {lang === "vi" ? "đồng" : "USD"} (một lần thanh toán)
            </Text>

            <Button
              size="lg"
              colorScheme="cyan"
              w="full"
              h="14"
              fontSize="xl"
              onClick={() => handlePurchase(pkg)}
            >
              Mua ngay
            </Button>
          </Box>
        ))}
      </Flex>

      <Text mt={12} color="gray.500">
        Thanh toán qua chuyển khoản QR • Hỗ trợ 24/7
      </Text>
    </Flex>
  )
}