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

export default function MockTest2() {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang]

  return (
    <Flex
      direction="column"
      minH="100vh"
      border="2px solid"
      borderColor="gray.400"
      p={6}
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

      {/* What's Cool Box */}
      <Box
        border="1px solid"
        borderColor="cyan.200"
        p={6}
        maxW="700px"
        w="full"
        mb={10}
        textAlign="center"
      >
        <Text fontSize="xl" fontWeight="bold" mb={2}>
          {t.mocktest2.title}
        </Text>
        <Text mb={4}>{t.mocktest2.email}</Text>

        <VStack align="start" spacing={3} pl={6}>
          {t.mocktest2.features.map((feature: string, i: number) => (
            <HStack key={i}>
              <Text fontSize="2xl" color="green.500">✔</Text>
              <Text>{feature}</Text>
            </HStack>
          ))}
        </VStack>
      </Box>

      {/* Package Options */}
      <Flex justify="center" gap={10} wrap="wrap">
        {Object.values(t.mocktest2.packages).map((pkg: any, i: number) => (
          <Box
            key={i}
            border="1px solid"
            borderColor="cyan.200"
            p={6}
            w="250px"
            textAlign="center"
          >
            <Text fontWeight="bold" color="blue.600">
              {pkg.title}{" "}
              <Text as="span" fontWeight="normal">
                {pkg.days}
              </Text>
            </Text>
            <Text mt={2}>{pkg.price}</Text>
            <Text fontSize="xl" fontWeight="bold" mt={2}>
              {pkg.perMonth}
            </Text>
            <Button
              mt={4}
              colorScheme="blue"
              variant="outline"
              onClick={() => router.push("/pages/purchaseCompany")}
            >
              {t.buyVip}
            </Button>
          </Box>
        ))}
      </Flex>
    </Flex>
  )
}
