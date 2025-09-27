"use client"

import {
  Box,
  Flex,
  VStack,
  HStack,
  Text,
  Button,
  Image,
  Divider,
} from "@chakra-ui/react"
import { useRouter } from "next/navigation"

export default function PurchaseCompanyPage() {
  const router = useRouter()

  return (
    <Flex
      direction="column"
      minH="100vh"
      p={6}
      bg="gray.50"
      align="center"
      justify="center"
    >
      <VStack
        spacing={6}
        w={{ base: "100%", md: "600px" }}
        bg="white"
        p={8}
        rounded="2xl"
        shadow="md"
      >
        {/* Header */}
        <Text fontSize="2xl" fontWeight="bold" color="teal.600">
          Purchase Company Package
        </Text>
        <Divider />

        {/* Company Info */}
        <HStack spacing={4}>
          <Image
            src="/company-logo.png"
            alt="Company Logo"
            boxSize="64px"
            objectFit="contain"
          />
          <VStack align="start" spacing={0}>
            <Text fontSize="lg" fontWeight="semibold">
              Company ABC
            </Text>
            <Text fontSize="sm" color="gray.500">
              Premium Business Package
            </Text>
          </VStack>
        </HStack>

        {/* Package details */}
        <Box w="100%" p={4} bg="gray.100" rounded="lg">
          <Text fontSize="md" fontWeight="medium">
            Package Includes:
          </Text>
          <Text fontSize="sm" color="gray.600" mt={2}>
            • 10 business accounts <br />
            • Unlimited storage <br />
            • 24/7 Support <br />
            • Advanced analytics
          </Text>
        </Box>

        {/* Pricing */}
        <Text fontSize="xl" fontWeight="bold" color="teal.700">
          $299 / month
        </Text>

        {/* Buttons */}
        <HStack spacing={4}>
          <Button
            colorScheme="teal"
            size="lg"
            onClick={() => alert("Redirect to payment")}
          >
            Purchase Now
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push("/dashboard")}
          >
            Cancel
          </Button>
        </HStack>
      </VStack>
    </Flex>
  )
}
