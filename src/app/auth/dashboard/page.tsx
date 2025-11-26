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

// Import Lightbox
import Lightbox from "yet-another-react-lightbox"
import "yet-another-react-lightbox/styles.css"
import "yet-another-react-lightbox/plugins/thumbnails.css"
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails"

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

  // Lightbox state
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  // Danh sách ảnh – bạn thêm bao nhiêu cũng được
  const galleryImages = [
    { src: "/f1.png", width: 800, height: 1000 },
    { src: "/f2.png", width: 800, height: 1200 },
    { src: "/f3.png", width: 800, height: 900 },
    { src: "/f4.png", width: 800, height: 1100 },
    { src: "/f5.png", width: 800, height: 950 },
    { src: "/f6.png", width: 800, height: 1300 },
    { src: "/f7.png", width: 800, height: 1050 },
    { src: "/f8.png", width: 800, height: 1150 },
    { src: "/f9.png", width: 800, height: 1000 },
    { src: "/f10.png", width: 800, height: 1250 },
    // Thêm thoải mái ở đây...
  ]

  useEffect(() => {
    setContributions(generateData(year))
  }, [year])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid)
        const snap = await getDoc(userRef)
        setRole(snap.exists() ? snap.data().role || "candidate" : "candidate")
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
      {/* Sidebar – giữ nguyên */}
      <Box w="250px" borderRight="1px solid" borderColor="gray.300" p={4} display="flex" flexDirection="column">
        <HStack spacing={3} mb={6}>
          <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
          <Text fontSize="2xl" fontWeight="bold">AI-Interview</Text>
        </HStack>

        <VStack align="start" spacing={4} fontSize="lg" mb="auto">
          <Button as={Link} href="/auth/dashboard" variant="ghost" leftIcon={<FaHome />} justifyContent="flex-start" w="full" color="blue.500">
            {t.home}
          </Button>
          <Button as={Link} href="/components/specialized" variant="ghost" leftIcon={<FaBicycle />} justifyContent="flex-start" w="full">
            {t.specialized}
          </Button>
          <Button as={Link} href="/components/mocktest" variant="ghost" leftIcon={<FaRegFileAlt />} justifyContent="flex-start" w="full">
            {t.mocktest}
          </Button>
          {role === "company" && (
            <Button as={Link} href="/manager/manage" variant="ghost" leftIcon={<FaUser />} justifyContent="flex-start" w="full">
              {t.manager}
            </Button>
          )}
        </VStack>

        <Button as={Link} href="/components/packageCompany" variant="ghost" justifyContent="flex-start" w="full" mb={2}>
          {t.premium}
        </Button>

        <Menu>
          <MenuButton as={Button} leftIcon={<FaUser />} rightIcon={<ChevronDownIcon />} w="full" justifyContent="space-between">
            {t.account}
          </MenuButton>
          <MenuList>
            <MenuItem as={Link} href="/components/profile">{t.profile}</MenuItem>
            <MenuItem onClick={handleLogout}>{t.logout}</MenuItem>
          </MenuList>
        </Menu>
      </Box>

      {/* Main Content */}
      <Box flex="1" p={6} bg={colorMode === "light" ? "gray.50" : "gray.800"} overflow="auto">
        {/* Header + Contribution */}
        <Flex justify="space-between" align="start" mb={8}>
          <Box maxW="lg">
            <Text fontSize="2xl" fontWeight="bold" mb={2}>{t.practiceTitle}</Text>
            <Text color={colorMode === "light" ? "gray.600" : "gray.300"}>{t.practiceDesc}</Text>
          </Box>

          <Box>
            <Flex justify="flex-end" mb={2} gap={2}>
              <Select size="sm" w="100px" value={year} onChange={(e) => setYear(Number(e.target.value))}>
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

            {/* Contribution graph giữ nguyên */}
            <Flex direction="row" gap={2}>
              {t.months.map((month: string, mIdx: number) => (
                <Box key={mIdx}>
                  <Text fontSize="xs" mb={1} textAlign="center">{month}</Text>
                  <Flex direction="row" gap={1}>
                    {[0, 1, 2, 3].map((week) => (
                      <Flex direction="column" gap={1} key={week}>
                        {Array.from({ length: 7 }).map((_, day) => {
                          const dateKey = new Date(year, mIdx, week * 7 + day + 1).toISOString().split("T")[0]
                          const active = contributions[dateKey]
                          return (
                            <Box key={day} w="10px" h="10px" borderRadius="2px" bg={active ? "green.400" : "gray.200"} />
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

        {/* Feature Gallery – Masonry + Lightbox */}
        <Flex direction="column" align="center" mt={20}>
          <Flex align="center" mb={10} w="full" justify="center">
            <Divider flex="1" borderWidth="2px" />
            <Text mx={4} fontSize="lg" fontWeight="bold">{t.feature}</Text>
            <Divider flex="1" borderWidth="2px" />
          </Flex>

          {/* Masonry Grid */}
          <Box
            maxW="1400px"
            mx="auto"
            sx={{
              columnCount: { base: 2, md: 3, lg: 4 },
              columnGap: "16px",
            }}
          >
            {galleryImages.map((img, i) => (
              <Box
                key={i}
                mb={4}
                cursor="pointer"
                borderRadius="lg"
                overflow="hidden"
                boxShadow="md"
                transition="all 0.3s"
                _hover={{ transform: "scale(1.03)", boxShadow: "xl" }}
                onClick={() => {
                  setIndex(i)
                  setOpen(true)
                }}
                css={{ breakInside: "avoid" }}
              >
                <Image
                  src={img.src}
                  alt={`Feature ${i + 1}`}
                  width="100%"
                  height="auto"
                  display="block"
                  loading="lazy"
                />
              </Box>
            ))}
          </Box>
        </Flex>

        {/* Lightbox Carousel – giống Zalo/FB */}
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={index}
          slides={galleryImages}
          plugins={[Thumbnails]}
          thumbnails={{
            position: "bottom",
            width: 120,
            height: 80,
            border: 2,
            borderRadius: 8,
            padding: 4,
            gap: 12,
          }}
          styles={{
            container: { backgroundColor: "rgba(0, 0, 0, 0.95)" },
            thumbnailsContainer: { backgroundColor: "rgba(0, 0, 0, 0.7)" },
          }}
        />
      </Box>
    </Flex>
  )
}