"use client"

import {
  Box,
  Flex,
  Text,
  HStack,
  Image,
  Button,
  VStack,
} from "@chakra-ui/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

export default function PurchaseCompany() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qr = searchParams?.get("qr") || ""
  const amount = searchParams?.get("price") || "0"
  const packageName = searchParams?.get("title") || "Unknown"
  const content = searchParams?.get("content") || ""

  const [timeLeft, setTimeLeft] = useState(15 * 60) // 15 phút

  // countdown
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

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

        {/* Countdown */}
        <Text mb={4} color="red.500" fontWeight="bold">
          Thời gian còn lại: {minutes}:{seconds.toString().padStart(2, "0")}
        </Text>

        <Button colorScheme="red" onClick={() => router.push("/components/packageCompany")}>
          Hủy
        </Button>
      </Box>
    </Flex>
  )
}
