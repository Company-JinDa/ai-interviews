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
import { signOut, onAuthStateChanged } from "firebase/auth"
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore"
import { useEffect, useState } from "react"

// import i18n
import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"

export default function SpecializedPracticePage() {
  const router = useRouter()
  const [history, setHistory] = useState<any[]>([])
  const [filter, setFilter] = useState<string>("IT")
  const [role, setRole] = useState<string | null>(null)

  const { lang } = useLang()
  const t = translations[lang]

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

  // 🔹 Check role từ Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid)
        const snap = await getDoc(userRef)
        if (snap.exists()) {
          setRole(snap.data().role || "candidate")
        } else {
          setRole("candidate")
        }
      } else {
        router.push("/auth/login")
      }
    })
    return () => unsubscribe()
  }, [router])

  return (
    <Flex h="100vh" border="1px solid" borderColor="gray.300">
      {/* Sidebar */}
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

        {/* Menu */}
        <VStack align="start" spacing={4} fontSize="lg" mb="auto">
          <Button
            as={Link}
            href="/auth/dashboard"
            variant="ghost"
            leftIcon={<FaHome />}
            justifyContent="flex-start"
            w="full"
          >
            {t.home}
          </Button>
          <Button
            as={Link}
            href="/components/specialized"
            variant="ghost"
            leftIcon={<FaBicycle />}
            justifyContent="flex-start"
            w="full"
            color="blue.500"
          >
            {t.specialized}
          </Button>
          <Button
            as={Link}
            href="/components/mocktest"
            variant="ghost"
            leftIcon={<FaRegFileAlt />}
            justifyContent="flex-start"
            w="full"
          >
            {t.mocktest}
          </Button>

          {/* 🔹 Manager button nếu role = company */}
          {role === "company" && (
            <Button
              as={Link}
              href="/manager/manage"
              variant="ghost"
              leftIcon={<FaUser />}
              justifyContent="flex-start"
              w="full"
            >
              {t.manager}
            </Button>
          )}
        </VStack>

        <Button
          as={Link}
          href="/components/packageCompany"
          variant="ghost"
          justifyContent="flex-start"
          w="full"
          mb={2}
        >
          {t.premium}
        </Button>

        <Box>
          <Menu>
            <MenuButton as={Button} leftIcon={<FaUser />} rightIcon={<ChevronDownIcon />} w="full">
              {t.account}
            </MenuButton>
            <MenuList>
              <MenuItem as={Link} href="/components/profile">
                {t.profile}
              </MenuItem>
              <MenuItem onClick={handleLogout}>{t.logout}</MenuItem>
            </MenuList>
          </Menu>
        </Box>
      </Box>

      {/* Main */}
      <Box flex="1" p={6} bg="gray.100" overflow="auto">
        <Flex justify="space-between" align="center" mb={10}>
          <Box maxW="lg">
            <Text fontSize="2xl" fontWeight="bold" mb={2}>
              {t.specializedTitle}
            </Text>
            <Text color="gray.600">{t.specializedDesc}</Text>
          </Box>
          <Image src="/m1.png" alt="Mock Test" boxSize="300px" objectFit="contain" />
        </Flex>

        {/* Categories */}
        <Flex justify="center" gap={6} mb={10}>
          {t.categories.map((cat: string, idx: number) => (
            <Button
              key={idx}
              variant="outline"
              colorScheme="teal"
              onClick={() => {
                setFilter(cat)
                router.push(`/components/specialized1?category=${cat}`)

              }}
            >
              {cat}
            </Button>
          ))}
        </Flex>

        {/* History */}
        <Flex direction="column" align="center" mt={10}>
          <Flex align="center" mb={6} w="full" justify="center">
            <Divider flex="1" borderWidth="1px" />
            <Text mx={3} fontSize="lg" fontWeight="bold" whiteSpace="nowrap">
              {t.practiceHistory}
            </Text>
            <Divider flex="1" borderWidth="1px" />
          </Flex>

          {history.filter((item) => item.category === filter).length === 0 ? (
            <Text color="gray.500">{t.noTests}</Text>
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
