"use client"

import {
  Box,
  Flex,
  Text,
  VStack,
  Input,
  FormControl,
  FormLabel,
  Button,
  useToast,
  Spinner,
  HStack,
  Image,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
} from "@chakra-ui/react"
import { useEffect, useState } from "react"
import { auth, db } from "@/app/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { signOut } from "firebase/auth"
import { ChevronDownIcon } from "@chakra-ui/icons"
import { FaHome, FaBicycle, FaRegFileAlt, FaUser } from "react-icons/fa"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>({
    name: "",
    email: "",
    phone: "",
    address: "",
    job: "",
  })

  const toast = useToast()
  const router = useRouter()

  // Lấy thông tin user từ Firestore + Auth
  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser
      if (!user) return

      try {
        const ref = doc(db, "users", user.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setProfile(snap.data()) // Lấy từ Firestore
        } else {
          // Nếu chưa có thì chỉ lấy email từ Auth
          setProfile((prev: any) => ({ ...prev, email: user.email }))
        }
      } catch (err) {
        console.error("Error loading profile:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  // Lưu thông tin vào Firestore
  const handleSave = async () => {
    const user = auth.currentUser
    if (!user) return

    setSaving(true)
    try {
      const ref = doc(db, "users", user.uid)
      // Luôn đảm bảo email là từ Auth, không cho người dùng chỉnh sửa
      await setDoc(ref, { ...profile, email: user.email }, { merge: true })
      toast({
        title: "Profile saved successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      })
    } catch (err) {
      console.error("Error saving profile:", err)
      toast({
        title: "Error saving profile.",
        status: "error",
        duration: 3000,
        isClosable: true,
      })
    } finally {
      setSaving(false)
    }
  }

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
      {/* Sidebar bên trái */}
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
              color="blue.500"
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

      {/* Nội dung bên phải */}
      <Box flex="1" p={6} bg="gray.100" minH="100vh" overflow="auto">
        <Flex direction="column" align="center" mb={10}>
          <Text fontSize="3xl" fontWeight="bold" textAlign="center" mb={2}>
            Profile
          </Text>
          <Text color="gray.600" textAlign="center" maxW="lg">
            Manage and update your personal information.
          </Text>
        </Flex>

        <Box
          maxW="600px"
          mx="auto"
          p={6}
          bg="white"
          borderRadius="md"
          boxShadow="md"
        >
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel>Full Name</FormLabel>
              <Input
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                placeholder="Enter your full name"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Email</FormLabel>
              <Input value={profile.email} isDisabled /> {/* Không cho sửa */}
            </FormControl>

            <FormControl>
              <FormLabel>Phone Number</FormLabel>
              <Input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
                placeholder="Enter your phone number"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Address</FormLabel>
              <Input
                value={profile.address}
                onChange={(e) =>
                  setProfile({ ...profile, address: e.target.value })
                }
                placeholder="Enter your address"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Job / Occupation</FormLabel>
              <Input
                value={profile.job}
                onChange={(e) =>
                  setProfile({ ...profile, job: e.target.value })
                }
                placeholder="Enter your job"
              />
            </FormControl>

            <Button
              colorScheme="teal"
              onClick={handleSave}
              isLoading={saving}
              loadingText="Saving..."
            >
              Save Profile
            </Button>
          </VStack>
        </Box>
      </Box>
    </Flex>
  )
}
