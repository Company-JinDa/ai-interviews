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
  Spinner,
} from "@chakra-ui/react"
import { ChevronDownIcon } from "@chakra-ui/icons"
import { FaHome, FaBicycle, FaRegFileAlt, FaUser } from "react-icons/fa"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signOut, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { auth, db } from "@/app/lib/firebase"
import { Suspense, useEffect, useState } from "react"

// import i18n
import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"

function Specialized1Content() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCategory = searchParams?.get("category") || "Information Technology"

  const [role, setRole] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory)
  const [levels, setLevels] = useState<string[]>([]) // available levels for category
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [rolesList, setRolesList] = useState<string[]>([]) // roles for selected level
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [questionsList, setQuestionsList] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(false)

  const { lang } = useLang()
  const t = translations[lang]

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/auth/login")
  }

  // check role for sidebar (unchanged)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid)
        const snap = await getDoc(userRef)
        if (snap.exists()) {
          setRole((snap.data() as any).role || "candidate")
        } else {
          setRole("candidate")
        }
      } else {
        router.push("/auth/login")
      }
    })
    return () => unsubscribe()
  }, [router])

  // fetch all docs for activeCategory and build structure { level: { role: questions[] } }
  useEffect(() => {
    let mounted = true
    const fetchForCategory = async () => {
      setLoading(true)
      try {
        const q = query(collection(db, "questions"), where("category", "==", activeCategory))
        const snap = await getDocs(q)
        const structured: Record<string, Record<string, string[]>> = {}

        snap.forEach((d) => {
          const data = d.data() as any
          const lvl = data.level || "General"
          const rl = data.role || "General"
          const qs = Array.isArray(data.questions) ? data.questions : []

          if (!structured[lvl]) structured[lvl] = {}
          structured[lvl][rl] = qs
        })

        if (!mounted) return
        const levelKeys = Object.keys(structured)
        setLevels(levelKeys)
        const defaultLevel = levelKeys[0] || null
        setSelectedLevel(defaultLevel)

        if (defaultLevel) {
          const roleKeys = Object.keys(structured[defaultLevel])
          setRolesList(roleKeys)
          const defaultRole = roleKeys[0] || null
          setSelectedRole(defaultRole)
          setQuestionsList(defaultRole ? structured[defaultLevel][defaultRole] : [])
        } else {
          setRolesList([])
          setSelectedRole(null)
          setQuestionsList([])
        }
      } catch (err) {
        console.error("Error fetching questions:", err)
        setLevels([])
        setRolesList([])
        setSelectedLevel(null)
        setSelectedRole(null)
        setQuestionsList([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchForCategory()
    return () => {
      mounted = false
    }
  }, [activeCategory])

  // when selectedLevel changes, update roles and default role/questions
  useEffect(() => {
    if (!selectedLevel) return
    const fetchRolesForLevel = async () => {
      setLoading(true)
      try {
        const q = query(
          collection(db, "questions"),
          where("category", "==", activeCategory),
          where("level", "==", selectedLevel)
        )
        const snap = await getDocs(q)
        const roleKeys: string[] = []
        const mapRoleToQs: Record<string, string[]> = {}
        snap.forEach((d) => {
          const data = d.data() as any
          const rl = data.role || "General"
          const qs = Array.isArray(data.questions) ? data.questions : []
          roleKeys.push(rl)
          mapRoleToQs[rl] = qs
        })

        setRolesList(roleKeys)
        const defaultRole = roleKeys[0] || null
        setSelectedRole(defaultRole)
        setQuestionsList(defaultRole ? mapRoleToQs[defaultRole] : [])
      } catch (err) {
        console.error("Error fetching roles for level:", err)
        setRolesList([])
        setSelectedRole(null)
        setQuestionsList([])
      } finally {
        setLoading(false)
      }
    }

    fetchRolesForLevel()
  }, [selectedLevel, activeCategory])

  // when user clicks a role, fetch that questions (or use already loaded)
  const handleRoleClick = async (roleName: string) => {
    setSelectedRole(roleName)
    // try to get questions from Firestore document (id built same as upload)
    try {
      setLoading(true)
      const id = `${activeCategory}_${selectedLevel}_${roleName}`.replace(/\s+/g, "_")
      const docRef = doc(db, "questions", id)
      const snap = await getDoc(docRef)
      if (snap.exists()) {
        const data = snap.data() as any
        setQuestionsList(Array.isArray(data.questions) ? data.questions : [])
      } else {
        // fallback: query
        const q = query(
          collection(db, "questions"),
          where("category", "==", activeCategory),
          where("level", "==", selectedLevel),
          where("role", "==", roleName)
        )
        const qsnap = await getDocs(q)
        let found: string[] = []
        qsnap.forEach((d) => {
          const data = d.data() as any
          if (Array.isArray(data.questions)) found = data.questions
        })
        setQuestionsList(found)
      }
    } catch (err) {
      console.error("Error loading questions for role:", err)
      setQuestionsList([])
    } finally {
      setLoading(false)
    }
  }

  const categories = ["Information Technology", "Language English"]

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

      <Box flex="1" p={6} bg="white" overflow="auto">
        <Flex justify="center" gap={6} mb={6}>
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={activeCategory === cat ? "solid" : "outline"}
              colorScheme={activeCategory === cat ? "teal" : undefined}
              onClick={() => {
                setActiveCategory(cat)
                // selectedLevel / selectedRole will be set by fetch effect
              }}
            >
              {cat}
            </Button>
          ))}
        </Flex>

        <Flex justify="center" gap={4} mb={6} wrap="wrap">
          {loading ? (
            <Spinner />
          ) : levels.length === 0 ? (
            <Text color="gray.500">No levels found for {activeCategory}</Text>
          ) : (
            levels.map((lvl) => (
              <Button
                key={lvl}
                variant={selectedLevel === lvl ? "solid" : "outline"}
                onClick={() => setSelectedLevel(lvl)}
              >
                {lvl}
              </Button>
            ))
          )}
        </Flex>

        <Flex gap={6} align="flex-start">
          {/* Roles list (left column) */}
          <Box w="320px" border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
            <Text fontWeight="bold" mb={3}>
              Roles
            </Text>
            {loading ? (
              <Spinner />
            ) : rolesList.length === 0 ? (
              <Text color="gray.500">No roles</Text>
            ) : (
              <VStack align="stretch">
                {rolesList.map((r) => (
                  <Button
                    key={r}
                    variant={selectedRole === r ? "solid" : "ghost"}
                    justifyContent="flex-start"
                    onClick={() => handleRoleClick(r)}
                  >
                    {r}
                  </Button>
                ))}
              </VStack>
            )}
          </Box>

        <Box flex="1" border="1px solid" borderColor="gray.200" borderRadius="md" p={4}>
              <Text fontWeight="bold" mb={3}>
                {selectedRole ? `${selectedRole} - ${selectedLevel}` : "Questions"}
              </Text>

              {loading ? (
                <Spinner />
              ) : questionsList.length === 0 ? (
                <Text color="gray.500">No questions for selected role</Text>
              ) : (
                <VStack align="stretch" spacing={4}>
                  {questionsList.map((q, i) => (
                    <Box
                      key={i}
                      p={3}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      bg="gray.50"
                    >
                      <Text>{q}</Text>
                    </Box>
                  ))}
                  <Button
                    colorScheme="teal"
                    size="lg"
                    mt={5}
                    onClick={() => {
                      const params = new URLSearchParams({
                        category: activeCategory,
                        level: selectedLevel || "",
                        role: selectedRole || "",
                        questions: JSON.stringify(questionsList),
                      }).toString()
                      router.push(`/components/specialized2?${params}`)
                    }}
                  >
                    Luyện Tập
                  </Button>
                </VStack>
              )}
            </Box>
        </Flex>
      </Box>
    </Flex>
  )
}

export default function Specialized1Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <Specialized1Content />
    </Suspense>
  )
}
