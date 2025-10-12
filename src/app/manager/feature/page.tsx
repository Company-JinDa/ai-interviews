"use client"
import {
  Box,
  Flex,
  Text,
  HStack,
  Image,
  Button,
  VStack,
  Input,
  IconButton,
  useToast,
  Spinner,
} from "@chakra-ui/react"
import { useEffect, useState } from "react"
import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CloseIcon,
} from "@chakra-ui/icons"
import { auth, db } from "@/app/lib/firebase"
import {
  doc,
  setDoc,
  getDocs,
  collection,
  getDoc,
} from "firebase/firestore"
import { useRouter } from "next/navigation"

const CATEGORIES = {
  "Information Technology": [
    "Frontend",
    "Backend",
    "DevOps",
    "Security",
    "Intern BE",
  ],
  English: [
    "Translation & Interpretation",
    "English Language Teaching",
    "Business English",
    "English for Tourism",
    "English for Media",
    "Academic English",
  ],
}

type Question = {
  id: number
  question: string
  expected: string
  editMode?: boolean
}
export default function ManagePage() {
  const router = useRouter()
  const [tab, setTab] = useState<"question" | "result">("question")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null)

  const [questionsMap, setQuestionsMap] = useState<Record<string, Question[]>>(
    {}
  )
  const [qInput, setQInput] = useState("")
  const [eInput, setEInput] = useState("")
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>(
    {}
  )
  const [loading, setLoading] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const toast = useToast()

  const currentQuestions = selectedSpec ? questionsMap[selectedSpec] || [] : []

  // Load role và questionSets từ Firestore
  useEffect(() => {
    const fetchQuestions = async () => {
      const user = auth.currentUser
      if (!user) return
      setLoading(true)

      try {
        // Lấy role của user
        const userRef = doc(db, "users", user.uid)
        const userSnap = await getDoc(userRef)

        if (!userSnap.exists()) {
          console.error("User doc not found")
          setLoading(false)
          return
        }

        const role = userSnap.data()?.role
        if (role !== "company") {
          console.error("User is not company")
          setLoading(false)
          return
        }

        setCompanyId(user.uid)

        // Lấy questionSets trong companies/{uid}/questionSets
        const ref = collection(db, "companies", user.uid, "questionSets")
        const snapshot = await getDocs(ref)

        const data: Record<string, Question[]> = {}
        const links: Record<string, string> = {}

        snapshot.forEach((docSnap) => {
          const spec = docSnap.id
          const qData = docSnap.data()?.questions || []
          data[spec] = qData
          links[spec] = `${window.location.origin}/interview/${user.uid}/${encodeURIComponent(spec)}`
        })

        setQuestionsMap(data)
        setGeneratedLinks(links)
      } catch (err) {
        console.error("Error loading questions:", err)
      }

      setLoading(false)
    }

    fetchQuestions()
  }, [])

  // Add new question
  const handleAdd = () => {
    if (!selectedSpec || !qInput.trim() || !eInput.trim()) return

    const newQs = [
      ...(questionsMap[selectedSpec] || []),
      { id: Date.now(), question: qInput, expected: eInput, editMode: false },
    ]
    setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
    setQInput("")
    setEInput("")
  }

  // Delete question
  const handleDelete = (id: number) => {
    if (!selectedSpec) return
    const newQs = (questionsMap[selectedSpec] || []).filter((q) => q.id !== id)
    setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
  }

  // Toggle edit mode
  const handleEditToggle = (id: number) => {
    if (!selectedSpec) return
    const newQs = (questionsMap[selectedSpec] || []).map((q) =>
      q.id === id ? { ...q, editMode: !q.editMode } : q
    )
    setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
  }

  // Save after edit
  const handleEditSave = (id: number, newQ: string, newE: string) => {
    if (!selectedSpec) return
    const newQs = (questionsMap[selectedSpec] || []).map((q) =>
      q.id === id
        ? { ...q, question: newQ, expected: newE, editMode: false }
        : q
    )
    setQuestionsMap({ ...questionsMap, [selectedSpec]: newQs })
  }

  // Save to Firestore + generate link
  const handleGenerate = async () => {
    const user = auth.currentUser
    if (!user || !selectedSpec || !companyId) return

    try {
      const ref = doc(db, "companies", companyId, "questionSets", selectedSpec)
      await setDoc(ref, { questions: currentQuestions }, { merge: true })

      const link = `${window.location.origin}/interview/${companyId}/${encodeURIComponent(
        selectedSpec
      )}`

      setGeneratedLinks((prev) => ({ ...prev, [selectedSpec]: link }))

      toast({
        title: `${selectedSpec} saved & link generated!`,
        status: "success",
        duration: 3000,
      })
    } catch (err) {
      console.error("Error saving:", err)
      toast({
        title: "Error saving questions",
        status: "error",
        duration: 3000,
      })
    }
  }

  return (
    <Flex
      direction="column"
      minH="100vh"
      border="2px solid"
      borderColor="blue.300"
      p={4}
      align="center"
    >
      {/* Logo + Title */}
      <HStack
        spacing={3}
        cursor="pointer"
        mb={4}
        onClick={() => router.push("/auth/dashboard")}
      >
        <Image src="/logo.png" alt="logo" boxSize="50px" borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">
          AI-Interview
        </Text>
      </HStack>

      <Box w="100%" borderBottom="1px solid black" mb={6}></Box>

      {/* Tabs */}
      <HStack spacing={6} mb={6}>
        <Button
          colorScheme={tab === "question" ? "blue" : "gray"}
          onClick={() => setTab("question")}
        >
          Question
        </Button>
        <Button
          colorScheme={tab === "result" ? "blue" : "gray"}
          onClick={() => setTab("result")}
        >
          Result
        </Button>
      </HStack>

      {/* Loading spinner */}
      {loading && (
        <Flex flex="1" align="center" justify="center">
          <Spinner size="xl" />
        </Flex>
      )}

      {/* Question View */}
      {!loading && tab === "question" && (
        <Flex w="100%" flex="1" gap={6}>
          {/* Left side: Category + Specialization */}
          <VStack
            w="260px"
            spacing={3}
            align="stretch"
            borderRight="1px solid #ccc"
            pr={2}
          >
            {Object.entries(CATEGORIES).map(([cat, specs]) => (
              <Box key={cat}>
                <Button
                  w="100%"
                  colorScheme={selectedCategory === cat ? "blue" : "gray"}
                  onClick={() => {
                    setSelectedCategory(cat)
                    setSelectedSpec(null)
                  }}
                  mb={2}
                >
                  {cat}
                </Button>
                {selectedCategory === cat && (
                  <VStack align="stretch" pl={4} spacing={2}>
                    {specs.map((spec) => (
                      <Button
                        key={spec}
                        variant={selectedSpec === spec ? "solid" : "outline"}
                        colorScheme={selectedSpec === spec ? "blue" : "gray"}
                        onClick={() => setSelectedSpec(spec)}
                      >
                        {spec}
                      </Button>
                    ))}
                  </VStack>
                )}
              </Box>
            ))}
          </VStack>

          {/* Center: Question editor */}
          <Flex flex="1" direction="column" align="center" p={4}>
            {selectedSpec ? (
              <>
                <Text fontSize="xl" fontWeight="bold" mb={4}>
                  {selectedSpec} Questions
                </Text>

                {/* Input fields */}
                <HStack mb={4} spacing={4} w="100%">
                  <Input
                    placeholder="Insert Question"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                  />
                  <Input
                    placeholder="Expected Result"
                    value={eInput}
                    onChange={(e) => setEInput(e.target.value)}
                  />
                  <IconButton
                    aria-label="Add"
                    icon={<AddIcon />}
                    colorScheme="green"
                    onClick={handleAdd}
                  />
                </HStack>

                {/* Question list */}
                <VStack spacing={3} w="100%">
                  {currentQuestions.map((q) => (
                    <Flex
                      key={q.id}
                      w="100%"
                      p={3}
                      border="1px solid #ccc"
                      borderRadius="md"
                      justify="space-between"
                      align="center"
                      bg="white"
                    >
                      {q.editMode ? (
                        <HStack w="100%">
                          <Input
                            defaultValue={q.question}
                            onChange={(e) => (q.question = e.target.value)}
                          />
                          <Input
                            defaultValue={q.expected}
                            onChange={(e) => (q.expected = e.target.value)}
                          />
                          <IconButton
                            aria-label="Save"
                            icon={<CheckIcon />}
                            colorScheme="blue"
                            onClick={() =>
                              handleEditSave(q.id, q.question, q.expected)
                            }
                          />
                          <IconButton
                            aria-label="Cancel"
                            icon={<CloseIcon />}
                            onClick={() => handleEditToggle(q.id)}
                          />
                        </HStack>
                      ) : (
                        <>
                          <Box>
                            <Text fontWeight="bold">{q.question}</Text>
                            <Text color="gray.500" fontSize="sm">
                              Expected: {q.expected}
                            </Text>
                          </Box>
                          <HStack>
                            <IconButton
                              aria-label="Edit"
                              icon={<EditIcon />}
                              colorScheme="yellow"
                              onClick={() => handleEditToggle(q.id)}
                            />
                            <IconButton
                              aria-label="Delete"
                              icon={<DeleteIcon />}
                              colorScheme="red"
                              onClick={() => handleDelete(q.id)}
                            />
                          </HStack>
                        </>
                      )}
                    </Flex>
                  ))}
                </VStack>

                {/* Save button */}
                {currentQuestions.length > 0 && (
                  <Button colorScheme="blue" mt={6} onClick={handleGenerate}>
                    Generate
                  </Button>
                )}

                {/* Generated Link */}
                {generatedLinks[selectedSpec] && (
                  <Box mt={4} p={3} border="1px solid #ccc" borderRadius="md">
                    <Text fontWeight="bold">Candidate Link:</Text>
                    <Text color="blue.600">
                      {generatedLinks[selectedSpec]}
                    </Text>
                  </Box>
                )}
              </>
            ) : (
              <Text color="gray.500">Select a specialization to start</Text>
            )}
          </Flex>
        </Flex>
      )}

      {/* Result View */}
      {!loading && tab === "result" && (
        <Flex flex="1" w="100%" align="center" justify="center" bg="white">
          <Text fontSize="lg" color="gray.500">
            Result view (coming soon)...
          </Text>
        </Flex>
      )}
      
    </Flex>
  )
}
