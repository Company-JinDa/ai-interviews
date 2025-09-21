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

export default function MockTest1() {
  const router = useRouter()

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

      {/* Content Box */}
      <Box
        bg="gray.100"
        p={8}
        borderRadius="md"
        maxW="900px"
        w="full"
        textAlign="left"
      >
        <Text fontSize="lg" fontWeight="bold" textAlign="center" mb={6}>
          Test IT - Take the test, get results and fix errors
        </Text>

        <Flex justify="space-between" gap={10}>
          {/* Left Side */}
          <VStack align="start" spacing={4} flex="1">
            <Box>
              <Text fontWeight="bold" mb={2}>
                Question source
              </Text>
              <Select defaultValue="stackoverflow" w="250px">
                <option value="stackoverflow">Stack Overflow</option>
                <option value="github">GitHub</option>
                <option value="leetCode">LeetCode</option>
              </Select>
            </Box>

            <Box>
              <Text fontWeight="bold" mb={2}>
                Voice reference
              </Text>
              <Select defaultValue="asteria" w="250px">
                <option value="asteria">Asteria (Female-US)</option>
                <option value="brandon">Brandon (Male-UK)</option>
              </Select>
            </Box>

            <Text fontSize="sm" color="gray.600" mt={4}>
              *Use Google Chrome or Microsoft Edge browser for better stability.
            </Text>
          </VStack>

          {/* Right Side */}
          <VStack align="start" spacing={4} flex="1">
            <HStack>
              <Text fontSize="2xl" color="green.500">
                ✔
              </Text>
              <Text>
                Get used to the test structure and pressure like the real test.
              </Text>
            </HStack>

            <HStack>
              <Text fontSize="2xl" color="green.500">
                ✔
              </Text>
              <Text>Get detailed results and fixes.</Text>
            </HStack>

            <HStack>
              <Text fontSize="2xl" color="green.500">
                ✔
              </Text>
              <Text>Upgrade for unlimited use</Text>
            </HStack>
          </VStack>
        </Flex>

        <Box borderBottom="1px solid black" my={6}></Box>

        <Flex justify="center">
          <Button
            size="lg"
            colorScheme="blue"
            variant="outline"
            onClick={() => router.push("/components/mocktest2")}
          >
            Buy Vip
          </Button>
        </Flex>
      </Box>
    </Flex>
  )
}
