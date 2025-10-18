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

export default function Specialized2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Parse query params
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

  // State
  const [currentQ, setCurrentQ] = useState<number>(0);
  const [recording, setRecording] = useState<boolean>(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [countdown, setCountdown] = useState<number>(60);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [started, setStarted] = useState<boolean>(false);
  const [historyRealtime, setHistoryRealtime] = useState<any[]>([]);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [amplitudeLevel, setAmplitudeLevel] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [monitoring, setMonitoring] = useState(false);

  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceThreshold = 0.01;
  const minRecordingDuration = 2000; // Minimum 2 seconds of recording

  // Mic permission
  const ensureMicPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setMicStream(stream);
      setHasMicPermission(true);
      return true;
    } catch {
      setHasMicPermission(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone access in your browser settings.",
        status: "error",
        position: "top",
      });
      return false;
    }
  };

  // Play question (TTS)
  const playQuestion = async (text: string): Promise<void> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS request failed");
      const data = await res.json();
      const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
      return new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    } catch {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      return new Promise<void>((resolve) => {
        u.onend = () => resolve();
        speechSynthesis.speak(u);
      });
    }
  };

  // Play beep
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

  // Start interview
  const handleStart = async () => {
    if (started || questions.length === 0) return;
    const ok = await ensureMicPermission();
    if (!ok) return;
    setStarted(true);
    setAnswers([]);
    setCurrentQ(0);
    await runQuestionCycle(0);
  };

  // Question cycle
  const runQuestionCycle = async (index: number) => {
    if (index >= questions.length) {
      await finishInterview();
      return;
    }
    setCurrentQ(index);
    setCountdown(60);
    setIsLoading(false); // Reset loading state

    try {
      await playQuestion(questions[index]);
      playBeep();
      await new Promise((r) => setTimeout(r, 500));
      startRecording();
    } catch (err) {
      console.error("Error in question cycle:", err);
      toast({
        title: "Error",
        description: "Failed to play question. Moving to next.",
        status: "error",
        position: "top",
      });
      setAnswers([...answers, ""]); // Store empty answer on failure
      await runQuestionCycle(index + 1);
    }
  };

  // Start recording
  const startRecording = async () => {
    if (!micStream) {
      const ok = await ensureMicPermission();
      if (!ok) return;
    }

    setRecording(true);
    setAmplitudeLevel(0);
    audioChunksRef.current = [];

    const recorder = new MediaRecorder(micStream!, { mimeType: "audio/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setMonitoring(false);
      if (audioContext) {
        audioContext.close();
        setAudioContext(null);
        setAnalyser(null);
      }
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      if (blob.size > 1000) { // Ensure blob has meaningful data
        await handleRecordedBlob(blob);
      } else {
        setAnswers([...answers, ""]); // Store empty answer for silent recordings
        setIsLoading(false);
        await runQuestionCycle(currentQ + 1);
      }
    };

    // Amplitude monitor
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(ctx);
    const src = ctx.createMediaStreamSource(micStream!);
    const ana = ctx.createAnalyser();
    src.connect(ana);
    setAnalyser(ana);
    setMonitoring(true);

    const dataArray = new Uint8Array(ana.frequencyBinCount);
    const monitor = () => {
      ana.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128.0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setAmplitudeLevel(rms);
      if (recording && monitoring) requestAnimationFrame(monitor);
    };
    monitor();

    recorder.start();

    // Countdown timer
    if (timerRef.current) clearInterval(timerRef.current);
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

  // Stop recording
  const stopRecording = () => {
    setMonitoring(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  // Handle recorded audio
  const handleRecordedBlob = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (!reader.result) {
          setAnswers([...answers, ""]);
          setIsLoading(false);
          await runQuestionCycle(currentQ + 1);
          return;
        }
        const base64Audio = (reader.result as string).split(",")[1];

        let sttTimeout = false;
        const timeoutId = setTimeout(async () => {
          sttTimeout = true;
          console.log("STT timeout triggered");
          setAnswers([...answers, ""]);
          setIsLoading(false);
          await runQuestionCycle(currentQ + 1);
        }, 20000); // Increased to 20s

        try {
          const res = await fetch("/api/stt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64Audio }),
          });

          clearTimeout(timeoutId);
          if (sttTimeout) return;

          if (!res.ok) {
            throw new Error(`STT failed with status ${res.status}`);
          }

          const data = await res.json();
          console.log("STT Response:", data);
          const transcription = data.transcription?.trim() || "";
          setAnswers([...answers, transcription]);
          setIsLoading(false);
          await new Promise((r) => setTimeout(r, 700));
          await runQuestionCycle(currentQ + 1);
        } catch (err) {
          console.error("STT Error:", err);
          clearTimeout(timeoutId);
          setAnswers([...answers, ""]);
          setIsLoading(false);
          await runQuestionCycle(currentQ + 1);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Blob Error:", err);
      setAnswers([...answers, ""]);
      setIsLoading(false);
      await runQuestionCycle(currentQ + 1);
    }
  };

  // Finish interview
  const finishInterview = async () => {
    clearInterval(timerRef.current);
    setRecording(false);
    setStarted(false);
    setIsLoading(true);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, answers }),
      });
      if (!res.ok) throw new Error("Evaluation failed");
      const data = await res.json();
      setResult(data);

      const uid =
        auth.currentUser?.uid ||
        `guest-${localStorage.getItem("guestUid") || `guest-${Date.now()}`}`;
      const userDocRef = doc(db, "users", uid);
      const interviewsRef = collection(userDocRef, "interviews");

      await addDoc(interviewsRef, {
        category,
        level,
        role,
        questions,
        answers,
        score: data?.score ?? null,
        feedback: data?.feedback ?? null,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Interview Completed",
        description: "Results saved successfully.",
        status: "success",
        duration: 2000,
      });
    } catch (err) {
      console.error("Finish Error:", err);
      toast({
        title: "Error",
        description: "Failed to save interview results.",
        status: "error",
        position: "top",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Realtime history (aligned with interviews collection)
  useEffect(() => {
    let unsub: (() => void) | undefined;
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
      const interviewsCol = collection(userDocRef, "interviews");
      const q = firestoreQuery(interviewsCol, orderBy("createdAt", "desc"));
      unsub = onSnapshot(q, (snap) => {
        const arr: any[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setHistoryRealtime(arr);
      });
    })();
    return () => unsub && unsub();
  }, []);

  // Initial mic permission check
  useEffect(() => {
    ensureMicPermission();
    return () => {
      clearInterval(timerRef.current);
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // UI
  return (
    <Box p={4} minH="100vh" bg="white">
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
        {/* LEFT */}
        <Box flex="3" borderRight="1px solid black" minH="70vh" position="relative" display="flex" flexDirection="column" justifyContent="center" alignItems="center">
          {isLoading && <Spinner size="xl" color="teal.400" mb={4} />}

          <VStack spacing={4} mb={6} w="full" align="center">
            <Box p={6} border="1px solid" borderColor="teal.400" borderRadius="md" bg="teal.50" w="full" maxW="800px" mx="auto">
              <Text fontWeight="bold" textAlign="center">
                Question {currentQ + 1} / {questions.length}
              </Text>
              <Text mt={2} fontSize="lg" textAlign="center">
                {questions[currentQ] || "No question"}
              </Text>
            </Box>
          </VStack>

          {recording ? (
            <Box textAlign="center" mb={4} w="100%" maxW="800px" mx="auto">
              <Text color="red.500" mb={2}>
                Recording... ({countdown}s)
              </Text>
              <Box bg="#f7fafc" p={4} borderRadius="lg" boxShadow="md" width="100%" display="flex" flexDirection="column" alignItems="center">
                <Box mt={3} h="10px" w="200px" bg="gray.200" borderRadius="full" overflow="hidden" position="relative">
                  <Box
                    h="full"
                    bg={amplitudeLevel > silenceThreshold ? "teal.400" : "gray.400"}
                    width={`${Math.min(amplitudeLevel * 600, 100)}%`}
                    transition="width 0.1s linear"
                  />
                </Box>
                <Text fontSize="sm" mt={2} color={amplitudeLevel > silenceThreshold ? "teal.500" : "gray.500"}>
                  {amplitudeLevel > silenceThreshold ? "Speaking..." : "Silent..."}
                </Text>
              </Box>
              <Button mt={4} colorScheme="gray" onClick={() => {
                stopRecording();
                setAnswers([...answers, ""]);
                setIsLoading(false);
                runQuestionCycle(currentQ + 1);
              }}>
                Next
              </Button>
            </Box>
          ) : (
            <Box mb={4} textAlign="center">
              <Text color={hasMicPermission ? "gray.500" : "red.500"}>
                {hasMicPermission ? "Ready to record" : "Microphone not allowed"}
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
              isDisabled={started || questions.length === 0}
            >
              {started ? "Interview in progress..." : "Start"}
            </Button>
          </Flex>
        </Box>

        {/* RIGHT */}
        <Box flex="1" pl={4}>
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
                    {result.perQuestionFeedback && (
                      <VStack mt={4} align="start">
                        <Text fontWeight="bold">Per-Question Feedback:</Text>
                        {result.perQuestionFeedback.map((fb: any, i: number) => (
                          <Box key={i} p={2} border="1px solid #eee" borderRadius="md" w="full">
                            <Text fontSize="sm" fontWeight="semibold">Q{i + 1}: {questions[i]}</Text>
                            <Text fontSize="sm">Answer: {answers[i] || "No answer"}</Text>
                            <Text fontSize="sm">Feedback: {fb}</Text>
                          </Box>
                        ))}
                      </VStack>
                    )}
                  </Box>
                ) : (
                  <Text>Interview result will appear here.</Text>
                )}
                <Box mt={6}>
                  <Text fontSize="sm" fontWeight="bold">Recent Interviews</Text>
                  <VStack align="start" mt={2} spacing={2}>
                    {historyRealtime.length === 0 ? (
                      <Text fontSize="sm" color="gray.500">No interviews yet</Text>
                    ) : (
                      historyRealtime.map((h) => (
                        <Box key={h.id} p={2} border="1px solid #eee" borderRadius="md" w="full">
                          <Text fontSize="sm" fontWeight="semibold">{h.category} - {h.role} ({h.level})</Text>
                          <Text fontSize="sm">Score: {h.score || "N/A"}</Text>
                          <Text fontSize="sm">Date: {h.createdAt?.toDate().toLocaleString()}</Text>
                        </Box>
                      ))
                    )}
                  </VStack>
                </Box>
              </TabPanel>

              <TabPanel>
                {result ? (
                  <Box>
                    <Text mb={2}>AI Suggestions:</Text>
                    <Text whiteSpace="pre-wrap">
                      {result.suggestion || "No specific suggestions. Keep practicing!"}
                    </Text>
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