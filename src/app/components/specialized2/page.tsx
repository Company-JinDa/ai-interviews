"use client";

import {
  Box,
  Flex,
  Text,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  HStack,
  Image,
  Icon,
  VStack,
  useToast,
  Spinner,
} from "@chakra-ui/react";
import { FaHome, FaMicrophone, FaPlay } from "react-icons/fa";
import { MdDirectionsBike, MdOutlineKeyboardArrowRight } from "react-icons/md";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { db } from "@/app/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ReactMic } from "react-mic";

export default function Specialized2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const category = searchParams.get("category") || "Information Technology";
  const level = searchParams.get("level") || "";
  const role = searchParams.get("role") || "";
  const questions = (() => {
    try {
      return JSON.parse(searchParams.get("questions") || "[]");
    } catch {
      return [];
    }
  })();

  // ---------------------- STATE ----------------------
  const [currentQ, setCurrentQ] = useState(0);
  const [recording, setRecording] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [audioData, setAudioData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [countdown, setCountdown] = useState(60);
  const timerRef = useRef<any>(null);

  // ---------------------- HANDLE ----------------------
  const playQuestion = async (text: string) => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
    audio.play();
  };

  const handleStart = async () => {
    if (!navigator.mediaDevices.getUserMedia) {
      toast({
        title: "Microphone not supported",
        status: "error",
        position: "top",
      });
      return;
    }

    toast({
      title: "Interview started!",
      status: "success",
      position: "top",
    });

    setCurrentQ(0);
    await playQuestion(questions[0]);
    startRecordingCycle(0);
  };

  const startRecordingCycle = async (index: number) => {
    if (index >= questions.length) {
      finishInterview();
      return;
    }

    setRecording(true);
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onStop = async (recordedBlob: any) => {
    setIsLoading(true);
    setRecording(false);

    const reader = new FileReader();
    reader.readAsDataURL(recordedBlob.blob);
    reader.onloadend = async () => {
      const base64Audio = (reader.result as string).split(",")[1];

      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio }),
      });

      const data = await res.json();
      const text = data.transcription || "";

      setAnswers((prev) => [...prev, text]);
      await addDoc(collection(db, "historyAnswer"), {
        question: questions[currentQ],
        answer: text,
        createdAt: serverTimestamp(),
      });

      const next = currentQ + 1;
      if (next < questions.length) {
        setCurrentQ(next);
        await playQuestion(questions[next]);
        startRecordingCycle(next);
      } else {
        finishInterview();
      }

      setIsLoading(false);
    };
  };

  const stopRecording = () => {
    setRecording(false);
  };

  const finishInterview = async () => {
    setIsLoading(true);
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    setResult(data);
    setIsLoading(false);
  };

  // ---------------------- UI ----------------------
  return (
    <Box p={4} border="1px solid #1E90FF" minH="100vh" bg="white">
      {/* HEADER */}
      <Flex align="center" borderBottom="1px solid black" pb={2}>
        <Image src="/logo.png" alt="Logo" boxSize="40px" mr={2} borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">
          AI-Interview
        </Text>
      </Flex>

      {/* NAVIGATION */}
      <HStack spacing={2} mt={2} mb={4}>
        <Button variant="ghost" p={0} onClick={() => router.push("/auth/dashboard")}>
          <Icon as={FaHome} boxSize={5} mr={1} />
          <Text>Home</Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Button variant="ghost" p={0} onClick={() => router.push("/components/specialized")}>
          <Icon as={MdDirectionsBike} boxSize={5} />
          <Text>Specialized Practice</Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Button
          variant="ghost"
          p={0}
          onClick={() => router.push(`/components/specialized1?category=${category}`)}
        >
          <Icon as={FaMicrophone} boxSize={5} />
          <Text>{category}</Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={FaPlay} color="teal.400" />
        <Text>{role ? `${role} - ${level}` : ""}</Text>
      </HStack>

      {/* MAIN CONTENT */}
      <Flex>
        <Box
          flex="2"
          borderRight="1px solid black"
          minH="70vh"
          position="relative"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
        >
          {isLoading && <Spinner size="xl" color="teal.400" mb={4} />}

          {recording && (
            <Text fontSize="lg" color="teal.500" mb={2}>
              Answer now... {countdown}s left
            </Text>
          )}

          <VStack spacing={4} mb={10} w="full">
            {questions.map((q: string, idx: number) => (
              <Box
                key={idx}
                p={3}
                border="1px solid"
                borderColor={idx === currentQ ? "teal.400" : "gray.200"}
                borderRadius="md"
                bg={idx === currentQ ? "teal.50" : "gray.50"}
                w="full"
              >
                <Text>{q}</Text>
              </Box>
            ))}
          </VStack>

          <ReactMic record={recording} className="sound-wave" onStop={onStop} mimeType="audio/webm" />

          <Flex justify="center" position="absolute" bottom="10" left="0" right="0">
            <Button
              size="lg"
              mt={50}
              color="white"
              bg="teal.400"
              borderRadius="full"
              px={10}
              py={6}
              fontSize="xl"
              onClick={handleStart}
              _hover={{ bg: "teal.400" }}
            >
              Start
            </Button>
          </Flex>
        </Box>

        {/* RESULTS + SUGGESTIONS */}
        <Box flex="1" pl={4} borderLeft="1px solid black">
          <Tabs variant="unstyled">
            <TabList borderBottom="1px solid black">
              <Tab
                fontSize="lg"
                _selected={{
                  fontWeight: "bold",
                  borderBottom: "2px solid black",
                }}
              >
                Interview Results
              </Tab>
              <Tab
                fontSize="lg"
                ml={4}
                _selected={{
                  fontWeight: "bold",
                  borderBottom: "2px solid black",
                }}
              >
                AI Suggestions
              </Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                {result ? (
                  <Box>
                    <Text fontSize="2xl" fontWeight="bold" color={result.score >= 6 ? "teal.500" : "red.500"}>
                      {result.score >= 6 ? "✅ PASS" : "❌ FAIL"}
                    </Text>
                    <Text mt={2}>Score: {result.score}</Text>
                    <Text mt={2}>{result.feedback}</Text>
                  </Box>
                ) : (
                  <Text>Interview result will appear here.</Text>
                )}
              </TabPanel>

              <TabPanel>
                {result && result.score < 6 ? (
                  <Text>
                    {`AI Suggestion: Try to provide more structured and confident answers.
                    Speak clearly, explain your reasoning, and connect your experience to the job role.`}
                  </Text>
                ) : (
                  <Text>No suggestions yet.</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}
