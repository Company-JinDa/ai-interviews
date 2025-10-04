"use client"

import {
  Box,
  Flex,
  Text,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  HStack,
  Image,
  Icon,
  VStack,
} from "@chakra-ui/react"
import { FaHome, FaMicrophone, FaPlay } from "react-icons/fa"
import { MdDirectionsBike } from "react-icons/md"
import { MdOutlineKeyboardArrowRight } from "react-icons/md"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

export default function Specialized2() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get("category") || "Information Technology"
  const level = searchParams.get("level") || ""
  const role = searchParams.get("role") || ""
  const questions = (() => {
    try {
      return JSON.parse(searchParams.get("questions") || "[]")
    } catch {
      return []
    }
  })()

  return (
    <Box p={4} border="1px solid #1E90FF" minH="100vh" bg="white">
      {/* Header */}
      <Flex align="center" borderBottom="1px solid black" pb={2}>
        <Image
          src="/logo.png"
          alt="Logo"
          boxSize="40px"
          mr={2}
          borderRadius="full"
        />
        <Text fontSize="2xl" fontWeight="bold">
          AI-Interview
        </Text>
      </Flex>

      {/* Breadcrumb */}
      <HStack spacing={2} mt={2} mb={4}>
        <Button variant="ghost" p={0} onClick={() => router.push("/auth/dashboard")}>
          <Icon as={FaHome} boxSize={5} mr={1} />
          <Text>Home</Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Button variant="ghost" p={0} onClick={() => router.push("/components/specialized")}>
          <Icon as={MdDirectionsBike} boxSize={5} />
          <Text>Specialized Practice</Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Button variant="ghost" p={0} onClick={() => router.push(`/components/specialized1?category=${category}`)}>
          <Icon as={FaMicrophone} boxSize={5} />
          <Text>
            {category}
          </Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={FaPlay} color="teal.400" />
        <Text>
          {role ? `${role} - ${level}` : ""}
        </Text>
      </HStack>

      {/* Main Content */}
      <Flex>
        {/* Left Side */}
        <Box
          flex="2"
          borderRight="1px solid black"
          minH="70vh"
          position="relative"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
        >
          <Text fontSize="lg" textAlign="center" mb={6}>
            Click the{" "}
            <Text as="span" fontWeight="bold" color="teal.500">
              Start
            </Text>{" "}
            button below to answer the questions.
          </Text>

          {/* Hiển thị từng câu hỏi */}
          <VStack spacing={4} mb={10} w="full">
            {questions.map((q: string, idx: number) => (
              <Box
                key={idx}
                p={3}
                border="1px solid"
                borderColor="gray.200"
                borderRadius="md"
                bg="gray.50"
                w="full"
              >
                <Text>{q}</Text>
              </Box>
            ))}
          </VStack>

          <Flex justify="center" position="absolute" bottom="10" left="0" right="0">
            <Button
              size="lg"
              mt={50}
              color="white"
              bg="teal.400"
              borderRadius="full"
              px={10}
              py={6}
              fontSize="xl"
              _hover={{ bg: "teal.400" }}
            >
              Start
            </Button>
          </Flex>
        </Box>

        {/* Right Side */}
        <Box flex="1" pl={4} borderLeft="1px solid black">
          <Tabs variant="unstyled">
            <TabList borderBottom="1px solid black">
              <Tab
                fontSize="lg"
                _selected={{
                  fontWeight: "bold",
                  borderBottom: "2px solid black",
                }}
              >
                Interview Results
              </Tab>
              <Tab
                fontSize="lg"
                ml={4}
                _selected={{
                  fontWeight: "bold",
                  borderBottom: "2px solid black",
                }}
              >
                AI Suggestions
              </Tab>
            </TabList>
            <TabPanels>
              <TabPanel>
                <Text></Text>
              </TabPanel>
              <TabPanel>
                <Text></Text>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  )
}