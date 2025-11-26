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
  Select,
  Spinner,
  useColorMode,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react"
import { ChevronDownIcon, MoonIcon, SunIcon } from "@chakra-ui/icons"
import { FaHome, FaBicycle, FaRegFileAlt, FaUser, FaGlobe } from "react-icons/fa"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { auth, db } from "@/app/lib/firebase"
import { signOut, onAuthStateChanged } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { useEffect, useState } from "react"

import { useLang } from "@/app/context/LangContext/LangContext"
import { translations } from "@/app/lib/translations"

const generateData = (year: number) => {
  const data: Record<string, boolean> = {}
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    data[d.toISOString().split("T")[0]] = Math.random() > 0.8
  }
  return data
}

export default function DashboardPage() {
  const router = useRouter()
  const [year, setYear] = useState<number>(2025)
  const [contributions, setContributions] = useState<Record<string, boolean>>({})
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { lang, toggleLang } = useLang()
  const t = translations[lang]
  const { colorMode, toggleColorMode } = useColorMode()

  // Modal state cho ảnh to
  const { isOpen, onOpen, onClose } = useDisclosure()
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  // Danh sách ảnh feature (bạn có thể thêm bao nhiêu tùy thích)
  const featureImages = [
    "/f1.png",
    "/f2.png",
    "/f3.png",
    "/f4.png",
    "/f5.png",
    "/f6.png", // thêm thoải mái ở đây
    "/f7.png",
    "/f8.png",
    // ...
  ]

  useEffect(() => {
    setContributions(generateData(year))
  }, [year])

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
      setLoading(false)
    })

    return () => unsubscribe()
  }, [router])

  const handleLogout = async () => {
    await signOut(auth)
    router.push("/auth/login")
  }

  if (loading) {
    return (
      <Flex justify="center" align="center" h="100vh">
        <Spinner size="xl" />
      </Flex>
    )
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

        <VStack align="start" spacing={4} fontSize="lg" mb="auto">
          <Button
            as={Link}
            href="/auth/dashboard"
            variant="ghost"
            leftIcon={<FaHome />}
            justifyContent="flex-start"
            w="full"
            color="blue.500"
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
            <MenuButton
              as={Button}
              leftIcon={<FaUser />}
              rightIcon={<ChevronDownIcon />}
              w="full"
              justifyContent="space-between"
            >
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

      {/* Main Content */}
      <Box flex="1" p={6} bg={colorMode === "light" ? "gray.50" : "gray.800"} overflow="auto">
        {/* Top Section */}
        <Flex justify="space-between" align="start" mb={8}>
          <Box maxW="lg">
            <Text fontSize="2xl" fontWeight="bold" mb={2}>
              {t.practiceTitle}
            </Text>
            <Text color={colorMode === "light" ? "gray.600" : "gray.300"}>
              {t.practiceDesc}
            </Text>
          </Box>

          <Box>
            <Flex justify="flex-end" mb={2} gap={2}>
              <Select
                size="sm"
                w="100px"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </Select>

              <Button size="sm" leftIcon={<FaGlobe />} onClick={toggleLang}>
                {lang === "en" ? "EN" : "VI"}
              </Button>

              <IconButton
                size="sm"
                aria-label="Toggle Dark Mode"
                icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
                onClick={toggleColorMode}
              />
            </Flex>

            {/* Contribution Graph */}
            <Flex direction="row" gap={2}>
              {t.months.map((month: string, mIdx: number) => (
                <Box key={mIdx}>
                  <Text fontSize="xs" mb={1} textAlign="center">
                    {month}
                  </Text>
                  <Flex direction="row" gap={1}>
                    {[0, 1, 2, 3].map((week) => (
                      <Flex direction="column" gap={1} key={week}>
                        {Array.from({ length: 7 }).map((_, day) => {
                          const dateKey = new Date(year, mIdx, week * 7 + day + 1)
                            .toISOString()
                            .split("T")[0]
                          const active = contributions[dateKey]
                          return (
                            <Box
                              key={day}
                              w="10px"
                              h="10px"
                              borderRadius="2px"
                              bg={active ? "green.400" : "gray.200"}
                            />
                          )
                        })}
                      </Flex>
                    ))}
                  </Flex>
                </Box>
              ))}
            </Flex>
          </Box>
        </Flex>

        {/* Feature Section */}
        <Flex direction="column" align="center" mt={150}>
          <Flex align="center" mb={65} w="full" justify="center">
            <Divider flex="1" borderWidth="2px" />
            <Text mx={3} fontSize="lg" fontWeight="bold" whiteSpace="nowrap">
              {t.feature}
            </Text>
            <Divider flex="1" borderWidth="2px" />
          </Flex>

          {/* Danh sách ảnh feature – click để zoom */}
          <Flex justify="center" gap={6} wrap="wrap">
            {featureImages.map((src, i) => (
              <Box
                key={i}
                w="200px"
                h="250px"
                bg={colorMode === "light" ? "white" : "gray.700"}
                border="10px solid"
                borderColor="gray.300"
                borderRadius="md"
                overflow="hidden"
                cursor="pointer"
                transition="all 0.3s"
                _hover={{
                  transform: "scale(1.05)",
                  boxShadow: "xl",
                }}
                onClick={() => {
                  setSelectedImage(src)
                  onOpen()
                }}
              >
                <Image
                  src={src}
                  alt={`Feature ${i + 1}`}
                  objectFit="cover"
                  w="100%"
                  h="100%"
                  transition="0.3s"
                />
              </Box>
            ))}
          </Flex>
        </Flex>

        {/* Modal Lightbox – hiện ảnh to */}
        <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
          <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(10px)" />
          <ModalContent bg="transparent" boxShadow="none">
            <ModalCloseButton
              color="white"
              size="lg"
              zIndex="tooltip"
              _hover={{ bg: "whiteAlpha.300" }}
            />
            <ModalBody p={0} display="flex" justifyContent="center" alignItems="center">
              {selectedImage && (
                <Image
                  src={selectedImage}
                  alt="Zoomed feature"
                  maxW="90vw"
                  maxH="90vh"
                  objectFit="contain"
                  borderRadius="lg"
                  boxShadow="0 0 50px rgba(0,0,0,0.8)"
                />
              )}
            </ModalBody>
          </ModalContent>
        </Modal>
      </Box>
    </Flex>
  )
}