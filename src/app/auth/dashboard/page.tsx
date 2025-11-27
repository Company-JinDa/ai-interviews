"use client"

import {
  Box,
  Flex,
  Text,
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
  VStack,
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

// Lightbox
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

  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  // 5 ảnh chính - nằm 1 hàng, không click
  const mainFeatures = ["/f1.png", "/f2.png", "/f3.png", "/f4.png", "/f5.png"]

  // Ảnh gallery - sẽ được chia 2 cột chồng lên nhau
  const galleryImages = [
    "/f6.png", "/f7.png", "/f8.png",   // cột trái
    "/f9.png", "/f10.png", "/f11.png", // cột phải
    "/f12.png", "/f13.png", "/f14.png",
    "/f15.png", "/f16.png", "/f17.png",
    // Thêm bao nhiêu cũng được → tự động chia cột
  ]

  // Tạo slides cho lightbox
  const lightboxSlides = galleryImages.map(src => ({ src }))

  useEffect(() => setContributions(generateData(year)), [year])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid)
        const snap = await getDoc(userRef)
        setRole(snap.exists() ? snap.data()?.role || "candidate" : "candidate")
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

  if (loading) return <Flex justify="center" align="center" h="100vh"><Spinner size="xl" /></Flex>

  return (
    <Flex h="100vh" border="1px solid" borderColor="gray.300">
      {/* Sidebar - giữ nguyên */}
      <Box w="250px" borderRight="1px solid" borderColor="gray.300" p={4} display="flex" flexDirection="column">
        <Flex align="center" mb={6} gap={3}>
          <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
          <Text fontSize="2xl" fontWeight="bold">AI-Interview</Text>
        </Flex>

        <VStack align="start" spacing={4} fontSize="lg" mb="auto">
          <Button as={Link} href="/auth/dashboard" variant="ghost" leftIcon={<FaHome />} justifyContent="flex-start" w="full" color="blue.500">{t.home}</Button>
          <Button as={Link} href="/components/specialized" variant="ghost" leftIcon={<FaBicycle />} justifyContent="flex-start" w="full">{t.specialized}</Button>
          <Button as={Link} href="/components/mocktest" variant="ghost" leftIcon={<FaRegFileAlt />} justifyContent="flex-start" w="full">{t.mocktest}</Button>
          {role === "company" && <Button as={Link} href="/manager/manage" variant="ghost" leftIcon={<FaUser />} justifyContent="flex-start" w="full">{t.manager}</Button>}
        </VStack>

        <Button as={Link} href="/components/packageCompany" variant="ghost" justifyContent="flex-start" w="full" mb={2}>{t.premium}</Button>

        <Menu>
          <MenuButton as={Button} leftIcon={<FaUser />} rightIcon={<ChevronDownIcon />} w="full" justifyContent="space-between">{t.account}</MenuButton>
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
              <Select size="sm" w="100px" value={year} onChange={e => setYear(Number(e.target.value))}>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </Select>
              <Button size="sm" leftIcon={<FaGlobe />} onClick={toggleLang}>{lang === "en" ? "EN" : "VI"}</Button>
              <IconButton size="sm" aria-label="Toggle Dark Mode" icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />} onClick={toggleColorMode} />
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
                          return <Box key={day} w="10px" h="10px" borderRadius="2px" bg={active ? "green.400" : "gray.200"} />
                        })}
                      </Flex>
                    ))}
                  </Flex>
                </Box>
              ))}
            </Flex>
          </Box>
        </Flex>

        {/* 5 ảnh chính */}
        <Flex direction="column" align="center" mb={20}>
          <Flex align="center" mb={10} w="full" justify="center">
            <Divider flex="1" borderWidth="2px" />
            <Text mx={4} fontSize="lg" fontWeight="bold">{t.feature}</Text>
            <Divider flex="1" borderWidth="2px" />
          </Flex>

          <Flex justify="center" gap={8} flexWrap="wrap" maxW="1400px">
            {mainFeatures.map((src, i) => (
              <Box key={i} w={{ base: "150px", md: "200px" }} h={{ base: "190px", md: "250px" }} border="10px solid" borderColor="gray.300" borderRadius="md" overflow="hidden" boxShadow="lg">
                <Image src={src} alt={`Feature ${i + 1}`} objectFit="cover" w="100%" h="100%" />
              </Box>
            ))}
          </Flex>
        </Flex>

        {/* Phần chồng ảnh kiểu Messenger */}
        <Box>
          <Text textAlign="center" fontSize="xl" fontWeight="semibold" mb={10} color="gray.600" _dark={{ color: "gray.300" }}>
            Xem thêm ảnh chi tiết
          </Text>

          <Flex justify="center" gap={{ base: 6, md: 12 }} flexWrap="wrap" maxW="1000px" mx="auto">
            {/* Cột trái */}
            <Box position="relative" w={{ base: "100%", md: "45%" }} maxW="420px" cursor="pointer">
              {galleryImages.slice(0, 3).map((src, i) => (
                <Box
                  key={i}
                  position={i === 0 ? "relative" : "absolute"}
                  top={i === 0 ? 0 : `${i * 60}px`}
                  left={i === 0 ? 0 : `${i * 20}px`}
                  zIndex={3 - i}
                  borderRadius="xl"
                  overflow="hidden"
                  boxShadow="2xl"
                  transform={i > 0 ? "rotate(-4deg)" : "rotate(0deg)"}
                  _hover={{ transform: i > 0 ? "rotate(-4deg) scale(1.05)" : "scale(1.03)", zIndex: 10 }}
                  transition="all 0.3s"
                  onClick={() => { setIndex(i); setOpen(true) }}
                >
                  <Image
                    src={src}
                    alt={`Gallery ${i + 6}`}
                    w={i === 0 ? "100%" : "85%"}
                    h="auto"
                    display="block"
                    loading="lazy"
                  />
                </Box>
              ))}
            </Box>

            {/* Cột phải */}
            <Box position="relative" w={{ base: "100%", md: "45%" }} maxW="420px" cursor="pointer">
              {galleryImages.slice(3, 6).map((src, i) => (
                <Box
                  key={i}
                  position={i === 0 ? "relative" : "absolute"}
                  top={i === 0 ? 0 : `${i * 60}px`}
                  right={i === 0 ? 0 : `${i * 20}px`}
                  zIndex={3 - i}
                  borderRadius="xl"
                  overflow="hidden"
                  boxShadow="2xl"
                  transform={i > 0 ? "rotate(6deg)" : "rotate(0deg)"}
                  _hover={{ transform: i > 0 ? "rotate(6deg) scale(1.05)" : "scale(1.03)", zIndex: 10 }}
                  transition="all 0.3s"
                  onClick={() => { setIndex(i + 3); setOpen(true) }}
                >
                  <Image
                    src={src}
                    alt={`Gallery ${i + 9}`}
                    w={i === 0 ? "100%" : "85%"}
                    h="auto"
                    display="block"
                    loading="lazy"
                  />
                </Box>
              ))}
            </Box>
          </Flex>
        </Box>

        {/* Lightbox */}
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={index}
          slides={lightboxSlides}
          plugins={[Thumbnails]}
          thumbnails={{ position: "bottom", width: 120, height: 80, gap: 16 }}
          styles={{ container: { backgroundColor: "rgba(0,0,0,0.95)" } }}
        />
      </Box>
    </Flex>
  )
}