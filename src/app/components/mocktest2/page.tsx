"use client"

import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Image,
  Button,
  Tag,
} from "@chakra-ui/react"
import { useRouter } from "next/navigation"
import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"
import { mocktestPackages } from "@/app/lib/mocktestPackages"

export default function MockTest2() {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang]

  const handlePurchase = async (pkg: (typeof mocktestPackages)[keyof typeof mocktestPackages]) => {
    try {
      const content = `AIInterview-MOCK-${pkg.id}-${Date.now()}`
      
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: pkg.totalPrice,
          content,
          packageName: pkg.id,
          type: "mocktest_pro",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert("Tạo QR thất bại, vui lòng thử lại!")
        return
      }

      router.push(
        `/pages/purchaseCompany?title=${encodeURIComponent(pkg.title)}&price=${pkg.totalPrice}&days=${pkg.days}&qr=${encodeURIComponent(data.qr)}&content=${encodeURIComponent(data.content)}&type=mocktest_pro`
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
      <Text fontSize="4xl" fontWeight="bold" mb={4} color="blue.700">
        Nâng cấp Mock Test Pro
      </Text>
      <Text fontSize="lg" color="gray.600" mb={12} maxW="700px" textAlign="center">
        Trải nghiệm câu hỏi khó hơn • Phân tích chi tiết • Không giới hạn lượt luyện tập
      </Text>

      {/* Packages Grid */}
      <Flex gap={10} flexWrap="wrap" justify="center" maxW="1200px">
        {Object.values(mocktestPackages).map((pkg) => (
          <Box
            key={pkg.id}
            position="relative"
            bg="white"
            p={8}
            pt={pkg.id === "mock_180days" ? 12 : 8} // Đẩy lên để có chỗ cho tag
            borderRadius="2xl"
            boxShadow="2xl"
            border="4px solid"
            borderColor={pkg.id === "mock_180days" ? "orange.400" : "cyan.400"}
            w="340px"
            textAlign="center"
            transition="all 0.3s"
            _hover={{ transform: "translateY(-12px)", boxShadow: "0 20px 40px rgba(0,0,0,0.1)" }}
          >
            {/* Tag "Phổ biến nhất" hoặc "Rẻ nhất/tháng" */}
            {pkg.id === "mock_180days" && (
              <Tag
                position="absolute"
                top="-14px"
                left="50%"
                transform="translateX(-50%)"
                bg="orange.500"
                color="white"
                fontWeight="bold"
                px={6}
                py={2}
                borderRadius="full"
                fontSize="sm"
                boxShadow="lg"
                zIndex={1}
              >
                RẺ NHẤT/THÁNG
              </Tag>
            )}
            {pkg.id === "mock_90days" && (
              <Tag
                position="absolute"
                top="-14px"
                left="50%"
                transform="translateX(-50%)"
                bg="blue.500"
                color="white"
                fontWeight="bold"
                px={4}
                py={2}
                borderRadius="full"
                fontSize="xs"
              >
                PHỔ BIẾN NHẤT
              </Tag>
            )}

            <VStack spacing={4}>
              <Text fontSize="2xl" fontWeight="extrabold" color="gray.800">
                {pkg.title}
              </Text>
              <Text fontSize="md" color="gray.600">
                Hiệu lực {pkg.days} ngày
              </Text>

              {/* Giá chính /tháng */}
              <Text fontSize="5xl" fontWeight="extrabold" color="blue.600" lineHeight="1">
                {lang === "vi" ? pkg.displayPerMonth : `$${pkg.priceUSD}`}
              </Text>
              <Text fontSize="lg" color="gray.600" fontWeight="bold">
                {lang === "vi" ? "/tháng" : "per month"}
              </Text>

              {/* Giá gốc bị gạch */}
              {pkg.days > 30 && (
                <Text fontSize="xl" color="gray.500" textDecoration="line-through">
                  {lang === "vi" ? pkg.displayPrice : `$${Math.round(pkg.priceUSD * 1.5)}`}
                </Text>
              )}

              {/* Tiết kiệm % */}
              {pkg.days > 30 && (
                <Text fontSize="sm" color="green.600" fontWeight="bold" bg="green.50" px={3} py={1} borderRadius="full">
                  {lang === "vi"
                    ? `Tiết kiệm ${Math.round((1 - pkg.pricePerMonth / 290000) * 100)}% so với gói 1 tháng`
                    : `Save ${Math.round((1 - pkg.pricePerMonth / 290000) * 100)}%`}
                </Text>
              )}

              <Text fontSize="sm" color="gray.500" mt={2}>
                Tổng thanh toán: <b>{lang === "vi" ? pkg.displayPrice : `$${pkg.priceUSD}`}</b>
              </Text>

              <Button
                size="lg"
                colorScheme={pkg.id === "mock_180days" ? "orange" : "cyan"}
                variant={pkg.id === "mock_180days" ? "solid" : "solid"}
                w="full"
                h="56px"
                fontSize="xl"
                fontWeight="bold"
                mt={4}
                onClick={() => handlePurchase(pkg)}
              >
                {pkg.id === "mock_180days" ? "MUA GÓI RẺ NHẤT" : "Mua ngay"}
              </Button>
            </VStack>
          </Box>
        ))}
      </Flex>

      {/* Footer */}
      <VStack mt={16} spacing={3}>
        <Text color="gray.600" fontSize="lg">
          Thanh toán an toàn qua QR • Tự động kích hoạt ngay lập tức
        </Text>
        <Text color="gray.500" fontSize="sm">
          Hỗ trợ 24/7 • Đảm bảo hoàn tiền nếu không hài lòng
        </Text>
      </VStack>
    </Flex>
  )
}