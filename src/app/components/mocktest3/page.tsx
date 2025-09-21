"use client"

import {
  Box,
  Flex,
  Text,
  HStack,
  Image,
  Button,
  Select,
} from "@chakra-ui/react"
import { useRouter } from "next/navigation"

export default function MockTest3() {
  const router = useRouter()

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
            Test IT - Take the test, get results and fix errors
          </Text>

          <Box mb={6}>
            <Text fontWeight="semibold" mb={1}>
              Question source
            </Text>
            <Select defaultValue="Stack Overflow">
              <option>Stack Overflow</option>
              <option>LeetCode</option>
              <option>HackerRank</option>
            </Select>
          </Box>

          <Box mb={6}>
            <Text fontWeight="semibold" mb={1}>
              Voice reference
            </Text>
            <Select defaultValue="Asteria (Female-US)">
              <option>Asteria (Female-US)</option>
              <option>Nova (Male-UK)</option>
              <option>Luna (Female-AU)</option>
            </Select>
          </Box>

          <Text fontSize="sm" color="gray.600">
            *Use Google Chrome or Microsoft Edge browser for better stability.
          </Text>
        </Box>

        {/* Right Section */}
        <Box flex="1" pl={8}>
          <HStack align="start" mb={4}>
            <Text fontSize="2xl" color="green.500">
              ✔
            </Text>
            <Text>Get used to the test structure and pressure like the real test.</Text>
          </HStack>
          <HStack align="start" mb={4}>
            <Text fontSize="2xl" color="green.500">
              ✔
            </Text>
            <Text>Get detailed results and fixes.</Text>
          </HStack>
          <HStack align="start">
            <Text fontSize="2xl" color="green.500">
              ✔
            </Text>
            <Text>Upgrade for unlimited use</Text>
          </HStack>
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
          Exits
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
          Start
        </Button>
      </Flex>
    </Flex>
  )
}
