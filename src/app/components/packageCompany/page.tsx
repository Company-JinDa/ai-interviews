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
import { transactions } from "@/app/lib/transactions"

export default function PackageCompany() {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang]

  // Hàm tạo QR và lưu giao dịch
  const handlePurchase = async (pkg: { key: "threeMonth" | "sixMonth" }) => {
    try {
      const tx = transactions[pkg.key] // lấy số sạch
      const res = await fetch("/api/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: tx.price, // số sạch
          content: `AIInterview-${tx.id}-${Date.now()}`,
          packageName: tx.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        alert("Tạo QR thất bại: " + JSON.stringify(data))
        return
      }

      router.push(
        `/pages/purchaseCompany?title=${encodeURIComponent(
          tx.id
        )}&price=${encodeURIComponent(tx.price.toString())}&qr=${encodeURIComponent(
          data.qr
        )}&content=${encodeURIComponent(data.content)}`
      )
    } catch (err) {
      console.error("Purchase error:", err)
      alert("Có lỗi xảy ra khi xử lý thanh toán")
    }
  }

  return (
    <Flex
      direction="column"
      minH="100vh"
      border="2px solid"
      borderColor="blue.300"
      p={4}
      align="center"
    >
      {/* Logo + Title */}
      <HStack
        spacing={3}
        cursor="pointer"
        mb={4}
        onClick={() => router.push("/auth/dashboard")}
      >
        <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">
          AI-Interview
        </Text>
      </HStack>

      <Box w="100%" borderBottom="1px solid black" mb={6}></Box>

      {/* What's cool section */}
      <Box
        border="1px solid"
        borderColor="blue.200"
        p={6}
        borderRadius="md"
        maxW="700px"
        mb={10}
        textAlign="center"
      >
        <Text fontSize="xl" fontWeight="bold" mb={2}>
          {t.packageCompanyTitle}
        </Text>
        <Text mb={4} color="gray.600">
          {t.packageCompanyEmail}
        </Text>

        <VStack spacing={3} align="start">
          {t.packageCompanyFeatures.map((feature: string, idx: number) => (
            <HStack key={idx} align="start">
              <Text fontSize="2xl" color="green.500">
                ✔
              </Text>
              <Text>{feature}</Text>
            </HStack>
          ))}
        </VStack>
      </Box>

      {/* Packages */}
      <Flex justify="center" gap={10}>
        {/* Gói 3 tháng */}
        <Box
          border="1px solid"
          borderColor="blue.200"
          p={6}
          w="250px"
          textAlign="center"
          borderRadius="md"
        >
          <Text fontWeight="bold" fontSize="lg" color="blue.700">
            {t.packages.threeMonth.title}
          </Text>
          <Text fontSize="sm" color="gray.600" mb={2}>
            {t.packages.threeMonth.days}
          </Text>
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            {/* hiển thị text dịch */}
            {lang === "vi" ? "23.000.000đ" : "$1000"}
          </Text>
          <Button
            colorScheme="blue"
            w="full"
            onClick={() => handlePurchase({ key: "threeMonth" })}
          >
            {t.packages.buyVip}
          </Button>
        </Box>

        <Box
          border="1px solid"
          borderColor="blue.200"
          p={6}
          w="250px"
          textAlign="center"
          borderRadius="md"
        >
          <Text fontWeight="bold" fontSize="lg" color="blue.700">
            {t.packages.sixMonth.title}
          </Text>
          <Text fontSize="sm" color="gray.600" mb={2}>
            {t.packages.sixMonth.days}
          </Text>
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            {lang === "vi" ? "42.000.000đ" : "$1850"}
          </Text>
          <Button
            colorScheme="blue"
            w="full"
            onClick={() => handlePurchase({ key: "sixMonth" })}
          >
            {t.packages.buyVip}
          </Button>
        </Box>
      </Flex>
    </Flex>
  )
}
