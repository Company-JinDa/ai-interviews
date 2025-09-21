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

export default function MockTest2() {
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
          What's cool?
        </Text>
        <Text mb={4}>(datng*****@gmail.com)</Text>

        <VStack align="start" spacing={3} pl={6}>
          <HStack>
            <Text fontSize="2xl" color="green.500">✔</Text>
            <Text>Suitable for businesses surveying candidates</Text>
          </HStack>
          <HStack>
            <Text fontSize="2xl" color="green.500">✔</Text>
            <Text>Talking is tiring :)</Text>
          </HStack>
          <HStack>
            <Text fontSize="2xl" color="green.500">✔</Text>
            <Text>Upgrade for unlimited use</Text>
          </HStack>
        </VStack>
      </Box>

      {/* Package Options */}
      <Flex justify="center" gap={10} wrap="wrap">
        {/* 1 Month */}
        <Box
          border="1px solid"
          borderColor="cyan.200"
          p={6}
          w="250px"
          textAlign="center"
        >
          <Text fontWeight="bold" color="blue.600">
            1 Month <Text as="span" fontWeight="normal">(30 days)</Text>
          </Text>
          <Text mt={2}>99.000 VNĐ</Text>
          <Text fontSize="xl" fontWeight="bold" mt={2}>
            99k/month
          </Text>
          <Button
            mt={4}
            colorScheme="blue"
            variant="outline"
            onClick={() => router.push("/components/mocktest3")}
          >
            Buy Vip
          </Button>
        </Box>

        {/* 3 Month */}
        <Box
          border="1px solid"
          borderColor="cyan.200"
          p={6}
          w="250px"
          textAlign="center"
        >
          <Text fontWeight="bold" color="blue.600">
            3 Month <Text as="span" fontWeight="normal">(90 days)</Text>
          </Text>
          <Text mt={2}>270.000 VNĐ</Text>
          <Text fontSize="xl" fontWeight="bold" mt={2}>
            90k/month
          </Text>
          <Button
            mt={4}
            colorScheme="blue"
            variant="outline"
            onClick={() => router.push("/components/mocktest3")}
          >
            Buy Vip
          </Button>
        </Box>

        {/* 6 Month */}
        <Box
          border="1px solid"
          borderColor="cyan.200"
          p={6}
          w="250px"
          textAlign="center"
        >
          <Text fontWeight="bold" color="blue.600">
            6 Month <Text as="span" fontWeight="normal">(180 days)</Text>
          </Text>
          <Text mt={2}>480.000 VNĐ</Text>
          <Text fontSize="xl" fontWeight="bold" mt={2}>
            80k/month
          </Text>
          <Button
            mt={4}
            colorScheme="blue"
            variant="outline"
            onClick={() => router.push("/components/mocktest3")}
          >
            Buy Vip
          </Button>
        </Box>
      </Flex>
    </Flex>
  )
}
