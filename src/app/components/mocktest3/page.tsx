"use client"

import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Image,
  Button,
  Select,
} from "@chakra-ui/react"
import { useRouter } from "next/navigation"
import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"

export default function MockTest3() {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang]

  return (
    <Flex
      direction="column"
      minH="100vh"
      border="2px solid"
      borderColor="blue.300"
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

      {/* Main Box */}
      <Flex
        bg="gray.100"
        p={8}
        borderRadius="md"
        maxW="800px"
        w="full"
        justify="space-between"
        align="start"
      >
        {/* Left Section */}
        <Box flex="1">
          <Text fontSize="lg" fontWeight="bold" mb={6} textAlign="center">
            {t.mocktest3.title}
          </Text>

          <Box mb={6}>
            <Text fontWeight="semibold" mb={1}>
              {t.mocktest3.questionSource}
            </Text>
            {/* Ví dụ hardcode tạm thời vì translations chưa có sources */}
            <Select defaultValue="StackOverflow">
              <option>StackOverflow</option>
              <option>LeetCode</option>
              <option>GeeksForGeeks</option>
            </Select>
          </Box>

          <Box mb={6}>
            <Text fontWeight="semibold" mb={1}>
              {t.mocktest3.voiceReference}
            </Text>
            {/* Ví dụ hardcode tạm thời vì translations chưa có voices */}
            <Select defaultValue="AI Voice 1">
              <option>AI Voice 1</option>
              <option>AI Voice 2</option>
            </Select>
          </Box>

          <Text fontSize="sm" color="gray.600">
            {t.mocktest3.browserNote}
          </Text>
        </Box>

        {/* Right Section */}
        <Box flex="1" pl={8}>
          <VStack align="start" spacing={4}>
            {t.mocktest3.benefits.map((b: string, i: number) => (
              <HStack key={i} align="start">
                <Text fontSize="2xl" color="green.500">✔</Text>
                <Text>{b}</Text>
              </HStack>
            ))}
          </VStack>
        </Box>
      </Flex>

      {/* Action Buttons */}
      <Flex justify="space-between" mt={8} w="full" maxW="800px">
        <Button
          borderRadius="full"
          bg="blue.400"
          color="white"
          fontWeight="bold"
          w="150px"
          h="60px"
          onClick={() => router.push("/auth/dashboard")}
        >
          {t.mocktest3.exits}
        </Button>

        <Button
          borderRadius="full"
          bg="blue.400"
          color="white"
          fontWeight="bold"
          w="150px"
          h="60px"
          onClick={() => router.push("/components/mocktest4")}
        >
          {t.mocktest3.start}
        </Button>
      </Flex>
    </Flex>
  )
}
