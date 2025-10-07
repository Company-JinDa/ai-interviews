"use client";

import dynamic from "next/dynamic";
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
import { db, auth } from "@/app/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  query as firestoreQuery,
} from "firebase/firestore";

// Dynamic import react-mic
const ReactMic: any = dynamic(
  async () => {
    const mod = await import("react-mic");
    return mod.ReactMic;
  },
  { ssr: false }
);

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

  const [currentQ, setCurrentQ] = useState<number>(0);
  const [recording, setRecording] = useState<boolean>(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [historyRealtime, setHistoryRealtime] = useState<any[]>([]);
  const timerRef = useRef<any>(null);

  // 🔹 Check & request microphone permission
  const ensureMicPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setHasMicPermission(true);
      return true;
    } catch {
      setHasMicPermission(false);
      toast({
        title: "Microphone chưa được phép",
        description:
          "Hãy cho phép truy cập micro trong trình duyệt (biểu tượng camera/micro trên thanh địa chỉ).",
        status: "error",
        position: "top",
      });
      return false;
    }
  };

  // 🔹 Play question (TTS)
  const playQuestion = async (text: string): Promise<void> => {
    if (typeof window === "undefined") return;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
      return new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } catch {
      return new Promise<void>((resolve) => {
        if (!("speechSynthesis" in window)) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-US";
        u.onend = () => resolve();
        speechSynthesis.speak(u);
      });
    }
  };

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 800;
      g.gain.value = 0.1;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close();
      }, 150);
    } catch {}
  };

  // 🔹 Start interview flow (only once)
  const handleStart = async () => {
    if (started) return;
    const ok = await ensureMicPermission();
    if (!ok) return;
    setStarted(true);
    await runQuestionCycle(0);
  };

  // 🔹 Run one full question cycle (ask → beep → record)
  const runQuestionCycle = async (index: number) => {
    if (index >= questions.length) {
      finishInterview();
      return;
    }

    setCurrentQ(index);
    setCountdown(60);

    // 1️⃣ Play question (TTS)
    await playQuestion(questions[index]);

    // 2️⃣ Beep & start recording
    playBeep();
    await new Promise((res) => setTimeout(res, 500)); // short delay after beep
    startRecording(index);
  };

  // 🔹 Start recording
  const startRecording = (index: number) => {
    setRecording(true);
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setRecording(false); // trigger onStop
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // 🔹 When recording stops
  const onStop = async (recordedBlob: any) => {
    if (!started) return; // ignore if not in flow
    setIsLoading(true);
    try {
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

        const uid =
          auth.currentUser?.uid ||
          `guest-${localStorage.getItem("guestUid") ||
            (() => {
              const g = `guest-${Date.now()}`;
              localStorage.setItem("guestUid", g);
              return g;
            })()}`;

        const userDocRef = doc(db, "users", uid);
        const historyColRef = collection(userDocRef, "history");
        await addDoc(historyColRef, {
          question: questions[currentQ],
          answer: text,
          createdAt: serverTimestamp(),
        });

        const next = currentQ + 1;
        if (next < questions.length) {
          await runQuestionCycle(next);
        } else {
          await finishInterview();
        }
      };
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Finish entire interview
  const finishInterview = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      setResult(data);

      const uid =
        auth.currentUser?.uid ||
        `guest-${localStorage.getItem("guestUid") || `guest-${Date.now()}`}`;
      const userDocRef = doc(db, "users", uid);
      const interviewsRef = collection(userDocRef, "interviews");
      await addDoc(interviewsRef, {
        questions,
        answers,
        score: data?.score ?? null,
        feedback: data?.feedback ?? null,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // 🔹 Realtime Firestore listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    let unsub: (() => void) | null = null;
    (async () => {
      const uid =
        auth.currentUser?.uid ||
        (localStorage.getItem("guestUid") ||
          (() => {
            const g = `guest-${Date.now()}`;
            localStorage.setItem("guestUid", g);
            return g;
          })());
      const userDocRef = doc(db, "users", uid);
      const histCol = collection(userDocRef, "history");
      const q = firestoreQuery(histCol, orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        const arr: any[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setHistoryRealtime(arr);
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 🔹 On mount
  useEffect(() => {
    ensureMicPermission();
    return () => clearInterval(timerRef.current);
  }, []);

  // ✅ UI
  return (
    <Box p={4} border="1px solid #1E90FF" minH="100vh" bg="white">
      <Flex align="center" borderBottom="1px solid black" pb={2}>
        <Image src="/logo.png" alt="Logo" boxSize="40px" mr={2} borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">AI-Interview</Text>
      </Flex>

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
        <Button variant="ghost" p={0} onClick={() => router.push(`/components/specialized1?category=${category}`)}>
          <Icon as={FaMicrophone} boxSize={5} />
          <Text>{category}</Text>
        </Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={FaPlay} color="teal.400" />
        <Text>{role ? `${role} - ${level}` : ""}</Text>
      </HStack>

      <Flex>
        {/* Left side: Question and recording */}
        <Box flex="2" borderRight="1px solid black" minH="70vh" position="relative" display="flex" flexDirection="column" justifyContent="center" alignItems="center">
          {isLoading && <Spinner size="xl" color="teal.400" mb={4} />}

          <VStack spacing={4} mb={6} w="full">
            <Box p={6} border="1px solid" borderColor="teal.400" borderRadius="md" bg="teal.50" w="full" maxW="800px">
              <Text fontWeight="bold">Question {currentQ + 1} / {questions.length}</Text>
              <Text mt={2} fontSize="lg">{questions[currentQ] || "No question"}</Text>
            </Box>
          </VStack>

          {recording ? (
            <Box textAlign="center" mb={4}>
              <Text color="red.500">Đang ghi âm... ({countdown}s)</Text>
              <ReactMic
                key={currentQ}
                record={recording}
                onStop={onStop}
                mimeType="audio/webm"
                strokeColor="#00b894"
                backgroundColor="#f1f6f4"
              />
            </Box>
          ) : (
            <Box mb={4}>
              <Text color={hasMicPermission ? "gray.500" : "red.500"}>
                {hasMicPermission ? "Sẵn sàng để ghi âm" : "Microphone chưa được phép"}
              </Text>
            </Box>
          )}

          <Flex justify="center" position="absolute" bottom="16" left="0" right="0">
            <Button
              size="lg"
              color="white"
              bg={started ? "gray.400" : "teal.400"}
              borderRadius="full"
              px={10}
              py={6}
              fontSize="xl"
              _hover={{ bg: started ? "gray.400" : "teal.500" }}
              onClick={handleStart}
              isDisabled={started}
            >
              {started ? "Interview in progress..." : "Start"}
            </Button>
          </Flex>
        </Box>

        {/* Right side: Result and history */}
        <Box flex="1" pl={4} borderLeft="1px solid black">
          <Tabs variant="unstyled">
            <TabList borderBottom="1px solid black">
              <Tab fontSize="lg" _selected={{ fontWeight: "bold", borderBottom: "2px solid black" }}>Interview Results</Tab>
              <Tab fontSize="lg" ml={4} _selected={{ fontWeight: "bold", borderBottom: "2px solid black" }}>AI Suggestions</Tab>
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

                <Box mt={6}>
                  <Text fontSize="sm" fontWeight="bold">Realtime history (last answers)</Text>
                  <VStack align="start" mt={2} spacing={2}>
                    {historyRealtime.length === 0 ? (
                      <Text fontSize="sm" color="gray.500">No answers yet</Text>
                    ) : (
                      historyRealtime.map((h) => (
                        <Box key={h.id} p={2} border="1px solid #eee" borderRadius="md" w="full">
                          <Text fontSize="sm" fontWeight="semibold">{h.question}</Text>
                          <Text fontSize="sm">{h.answer}</Text>
                        </Box>
                      ))
                    )}
                  </VStack>
                </Box>
              </TabPanel>

              <TabPanel>
                {result && result.score < 6 ? (
                  <Box>
                    <Text mb={2}>AI Suggestion:</Text>
                    <Text whiteSpace="pre-wrap">{result.suggestion || "Try to be more structured..."}</Text>
                  </Box>
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
