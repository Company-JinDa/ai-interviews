"use client"

import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Image,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react"
import { ChevronDownIcon } from "@chakra-ui/icons"
import { FaHome, FaBicycle, FaRegFileAlt, FaUser } from "react-icons/fa"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/app/lib/firebase"
import { useEffect, useState } from "react"

// import i18n
import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"

// import mock data (sau này thay = Firestore hoặc file riêng)
import { questionsIT } from "@/app/lib/questionsIT"
import { questionsEnglish } from "@/app/lib/questionsEnglish"

export default function Specialized1Page() {
  const router = useRouter()
  const [role, setRole] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState("Language English")

  const { lang } = useLang()
  const t = translations[lang]

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/auth/login")
  }

  // check role
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

  // 🔹 Dữ liệu tổng hợp: có thể thay bằng fetch Firestore
  const data: Record<string, any[]> = {
    "Language English": [
      {
        topic: "Plan schedule",
        questions: questionsEnglish.Intern.General,
      },
      {
        topic: "Happy things",
        questions: [
          "Do you think people are happy when buying new things?",
          "Do you feel happy when buying new things?",
        ],
      },
    ],
    "Information Technology": [
      {
        topic: "Frontend (Intern)",
        questions: questionsIT.Intern.Frontend,
      },
      {
        topic: "Backend (Intern)",
        questions: questionsIT.Intern.Backend,
      },
      {
        topic: "Frontend (Junior)",
        questions: questionsIT.Junior.Frontend,
      },
      {
        topic: "Backend (Junior)",
        questions: questionsIT.Junior.Backend,
      },
      {
        topic: "DevOps (Junior)",
        questions: questionsIT.Junior.DevOps,
      },
      {
        topic: "Security (Senior)",
        questions: questionsIT.Senior.Security,
      },
    ],
  }

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

      {/* Main content */}
      <Box flex="1" p={6} bg="white" overflow="auto">
        {/* Categories */}
        <Flex justify="center" gap={6} mb={6}>
          {Object.keys(data).map((cat) => (
            <Button
              key={cat}
              variant="outline"
              border="1px solid"
              colorScheme={activeCategory === cat ? "teal" : "gray"}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </Flex>

        {/* Topics + Questions */}
        <VStack align="stretch" spacing={6}>
          {data[activeCategory]?.map((topic, idx) => (
            <Box
              key={idx}
              border="1px solid"
              borderColor="gray.300"
              borderRadius="md"
              p={4}
            >
              <Text fontWeight="bold" mb={3}>
                {topic.topic}
              </Text>
              <Flex wrap="wrap" gap={4}>
                {topic.questions.map((q: string, i: number) => (
                  <Box
                    key={i}
                    flex="1"
                    minW="250px"
                    p={3}
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="md"
                    _hover={{ bg: "gray.50" }}
                  >
                    {q}
                  </Box>
                ))}
              </Flex>
            </Box>
          ))}
        </VStack>
      </Box>
    </Flex>
  )
}
