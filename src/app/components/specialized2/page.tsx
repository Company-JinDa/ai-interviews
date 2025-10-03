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

export default function Specialized2() {
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
        <Link href="/" style={{ display: "flex", alignItems: "center" }}>
          <Icon as={FaHome} boxSize={5} mr={1} />
          <Text>Home</Text>
        </Link>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={MdDirectionsBike} boxSize={5} />
        <Text>Specialized Practice</Text>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={FaMicrophone} boxSize={5} />
        <Text>Language English</Text>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={FaPlay} color="green.400" />
        <Text>Why is it that some people don’t make plans?</Text>
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
          <Text fontSize="lg" textAlign="center" mb={20}>
            Click the{" "}
            <Text as="span" fontWeight="bold" color="blue.500">
              Start
            </Text>{" "}
            button below to answer the question.
          </Text>

          <Flex justify="center" position="absolute" bottom="10" left="0" right="0">
            <Button
              size="lg"
              color="white"
              bg="blue.400"
              borderRadius="full"
              px={10}
              py={6}
              fontSize="xl"
              _hover={{ bg: "blue.500" }}
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
