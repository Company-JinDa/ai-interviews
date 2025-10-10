"use client"

import {
  Box,
  Button,
  Center,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Link,
  VStack,
  Text,
  Image,
  HStack,
  Flex,
} from "@chakra-ui/react"
import { FcGoogle } from "react-icons/fc"
import NextLink from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/app/lib/firebase" // db = getFirestore()
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Hàm lưu user vào Firestore nếu chưa có
  const saveUserToFirestore = async (user: User) => {
    try {
      const userRef = doc(db, "users", user.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        // Nếu chưa có trong firestore thì tạo mới
        await setDoc(userRef, {
          uid: user.uid,       // lưu uid
          email: user.email,
          role: "candidate",   // mặc định role = candidate
          createdAt: new Date(),
        })
      }
    } catch (err) {
      console.error("Failed to save user:", err)
    }
  }

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const credential = await signInWithEmailAndPassword(auth, email, password)
      await saveUserToFirestore(credential.user) // lưu user vào firestore
      router.push("/auth/dashboard") 
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)
      await saveUserToFirestore(credential.user) // lưu user vào firestore
      router.push("/auth/dashboard") 
    } catch (err: any) {
      setError(err.message)
    }
  }
  return (
    <Center minH="100vh" bg="gray.50" flexDirection="column">
      <Flex
        w="100%"
        px={8}
        py={4}
        alignItems="center"
        borderBottom="1px solid"
        borderColor="gray.300"
        mb={8}
      >
        <Image src="/logo.png" alt="AI-Interview Logo" boxSize="50px" mr={2} />
        <Text fontSize="2xl" fontWeight="semibold">
          AI-Interview
        </Text>
      </Flex>

      <Box
        bg="gray.100"
        w="full"
        maxW="md"
        p={8}
        borderRadius="md"
        boxShadow="sm"
        textAlign="center"
      >
        <Center>
          <Image src="/logo.png" alt="avatar" boxSize="80px" mb={4} />
        </Center>

        <Text fontSize="lg" fontWeight="medium" mb={1}>
          Welcome
        </Text>
        <Text fontSize="sm" color="gray.600" mb={6}>
          Log in to continue to AI-Interview
        </Text>

        <VStack spacing={4} textAlign="left">
          <FormControl>
            <FormLabel>Email address*</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Password*</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormControl>
        </VStack>

        {error && (
          <Text color="red.500" fontSize="sm" mt={2}>
            {error}
          </Text>
        )}

        <Box textAlign="left" mt={2} mb={4}>
          <Link color="cyan.500" fontSize="sm">
            Forgot password?
          </Link>
        </Box>

        <Button
          w="full"
          colorScheme="cyan"
          mb={4}
          onClick={handleLogin}
          isLoading={loading}
        >
          Continue
        </Button>

        <Text fontSize="sm" mb={4}>
          Don&apos;t have an account?{" "}
          <Link as={NextLink} href="/auth/signup" fontWeight="bold">
            Sign up
          </Link>
        </Text>

        <HStack my={4} align="center">
          <Divider />
          <Text fontSize="sm" color="gray.500">
            OR
          </Text>
          <Divider />
        </HStack>
        <Button
          w="full"
          variant="outline"
          leftIcon={<FcGoogle />}
          onClick={handleGoogleLogin}
        >
          Continue with Google
        </Button>
      </Box>
    </Center>
  )
}
