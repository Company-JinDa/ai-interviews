"use client"

import { Box, Flex, Text, VStack, HStack, Image, Button } from "@chakra-ui/react"
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
          type: "mocktest_pro",
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error("Tạo QR thất bại")

      router.push(
        `/pages/purchaseMocktest?package=${pkg.id}&price=${pkg.price}&days=${pkg.days}&title=${encodeURIComponent(pkg.title)}&qr=${encodeURIComponent(data.qr)}&content=${encodeURIComponent(data.content)}`
      )
    } catch (err) {
      alert("Có lỗi khi tạo thanh toán. Vui lòng thử lại!")
      console.error(err)
    }
  }

  return (
    <Flex direction="column" minH="100vh" p={6} align="center" bg="gray.50">
      <HStack spacing={3} cursor="pointer" mb={6} onClick={() => router.push("/auth/dashboard")}>
        <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">AI-Interview</Text>
      </HStack>

      <Box border="1px solid" borderColor="cyan.300" p={8} borderRadius="xl" maxW="800px" textAlign="center" bg="white">
        <Text fontSize="3xl" fontWeight="bold" mb={4}>Nâng cấp Mock Test Pro</Text>
        <Text fontSize="lg" color="gray.600" mb={8}>
          Truy cập không giới hạn, câu hỏi khó hơn, phân tích chi tiết
        </Text>

        <Flex justify="center" gap={8} flexWrap="wrap">
          {Object.values(mocktestPackages).map((pkg) => (
            <Box key={pkg.id} border="2px solid" borderColor="cyan.400" p={6} borderRadius="lg" w="280px" bg="cyan.50">
              <Text fontSize="xl" fontWeight="bold" color="cyan.700">{pkg.title}</Text>
              <Text fontSize="sm" color="gray.600" my={2}>Hiệu lực: {pkg.days} ngày</Text>
              <Text fontSize="4xl" fontWeight="bold" color="blue.600">
                {lang === "vi" ? `${(pkg.price / 1000).toFixed(0)}k` : `$${pkg.priceUSD}`}
              </Text>
              <Text fontSize="sm" color="gray.500" mb={6}>
                {lang === "vi" ? "đồng/tháng" : "per month"}
              </Text>
              <Button colorScheme="cyan" size="lg" w="full" onClick={() => handlePurchase(pkg)}>
                Mua ngay
              </Button>
            </Box>
          ))}
        </Flex>
      </Box>
    </Flex>
  )
}