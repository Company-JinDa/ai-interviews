"use client"

import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Image,
  Button,
  Divider,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react"
import { ChevronDownIcon } from "@chakra-ui/icons"
import { FaHome, FaBicycle, FaRegFileAlt, FaUser } from "react-icons/fa"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { auth, db } from "@/app/lib/firebase"
import { signOut } from "firebase/auth"
import { collection, query, getDocs } from "firebase/firestore"
import { useEffect, useState } from "react"

export default function MockTestPage() {
  const router = useRouter()
  const [history, setHistory] = useState<any[]>([])
  const [filter, setFilter] = useState<string>("IT")

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/auth/login")
  }

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, "practiceHistory"))
        const snap = await getDocs(q)
        const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        setHistory(data)
      } catch (error) {
        console.error("Error loading history:", error)
      }
    }
    fetchHistory()
  }, [])

  return (
    <Flex h="100vh" border="1px solid" borderColor="gray.300">
      <Box
        w="250px"
        borderRight="1px solid"
        borderColor="gray.300"
        p={4}
        display="flex"
        flexDirection="column"
      >
        <HStack spacing={3} mb={6}>
          <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
          <Text fontSize="2xl" fontWeight="bold">
            AI-Interview
          </Text>
        </HStack>

        <VStack align="start" spacing={4} fontSize="lg" mb="auto">
          <Button
            as={Link}
            href="/auth/dashboard"
            variant="ghost"
            leftIcon={<FaHome />}
            justifyContent="flex-start"
            w="full"
          >
            Home
          </Button>
          <Button
            as={Link}
            href="/components/specialized"
            variant="ghost"
            leftIcon={<FaBicycle />}
            justifyContent="flex-start"
            w="full"
          >
            Specialized Practice
          </Button>
          <Button
            as={Link}
            href="/components/mocktest"
            variant="ghost"
            leftIcon={<FaRegFileAlt />}
            justifyContent="flex-start"
            w="full"
            color="blue.500"
          >
            Mock Test
          </Button>
        </VStack>

        <Button
          as={Link}
          href="/components/packageCompany"
          variant="ghost"
          justifyContent="flex-start"
          w="full"
          mb={2}
        >
          Premium Package Company
        </Button>

        <Box>
          <Menu>
            <MenuButton
              as={Button}
              leftIcon={<FaUser />}
              rightIcon={<ChevronDownIcon />}
              w="full"
              justifyContent="space-between"
            >
              Account
            </MenuButton>
            <MenuList>
              <MenuItem as={Link} href="/components/profile">
                Profile
              </MenuItem>
              <MenuItem onClick={handleLogout}>Log out</MenuItem>
            </MenuList>
          </Menu>
        </Box>
      </Box>

      <Box flex="1" p={6} bg="gray.100" overflow="auto">
        <Flex justify="space-between" align="center" mb={10}>
          <Box maxW="lg">
            <Text fontSize="2xl" fontWeight="bold" mb={2}>
              Mock Test
            </Text>
            <Text color="gray.600">
              Take a mock interview and get score estimates, corrections,
              and improvement guidance.
            </Text>
          </Box>
          <Image
            src="/m1.png" 
            alt="Mock Test"
            boxSize="300px"
            objectFit="contain"
          />
        </Flex>

        <Flex justify="center" gap={6} mb={10}>
          {["IT", "Language English", "Business Administration"].map((cat) => (
            <Button
              key={cat}
              variant="outline"
              colorScheme="teal"
              onClick={() => router.push("/components/mocktest1")}
            >
              {cat}
            </Button>
          ))}
        </Flex>


        <Flex direction="column" align="center" mt={10}>
          <Flex align="center" mb={6} w="full" justify="center">
            <Divider flex="1" borderWidth="1px" />
            <Text mx={3} fontSize="lg" fontWeight="bold" whiteSpace="nowrap">
                Mock History
            </Text>
            <Divider flex="1" borderWidth="1px" />
          </Flex>

          {history.filter((item) => item.category === filter).length === 0 ? (
            <Text color="gray.500">There are no new tests yet.</Text>
          ) : (
            <VStack w="full" spacing={4} align="stretch">
              {history
                .filter((item) => item.category === filter)
                .map((item) => (
                  <Box
                    key={item.id}
                    p={4}
                    border="1px solid"
                    borderColor="gray.300"
                    borderRadius="md"
                    bg="white"
                  >
                    <Text fontWeight="bold">{item.question}</Text>
                    <Text mt={2} color="gray.600">
                      {item.answer}
                    </Text>
                    <Text mt={1} fontSize="sm" color="gray.400">
                      {item.createdAt}
                    </Text>
                  </Box>
                ))}
            </VStack>
          )}
        </Flex>
      </Box>
    </Flex>
  )
}
