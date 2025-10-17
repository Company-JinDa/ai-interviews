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

  const category = searchParams.get("category") || "Information Technology";
  const level = searchParams.get("level") || "";
  const role = searchParams.get("role") || "";
  const questions = (() => {
    try {
      return JSON.parse(decodeURIComponent(searchParams.get("questions") || "[]"));
    } catch {
      return [];
    }
  })();

  // 🎯 State
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

  const silenceThreshold = 0.003; // Further lowered for sensitivity

  // ✅ Mic permission
  const ensureMicPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      setMicStream(stream);
      setHasMicPermission(true);
      return true;
    } catch {
      setHasMicPermission(false);
      toast({
        title: "Microphone chưa được phép",
        description:
          "Hãy cho phép truy cập micro trong trình duyệt (icon micro trên thanh địa chỉ).",
        status: "error",
        position: "top",
      });
      return false;
    }
  };

  // 🔊 Play question (TTS)
  const playQuestion = async (text: string): Promise<void> => {
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
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      return new Promise<void>((resolve) => {
        u.onend = () => resolve();
        speechSynthesis.speak(u);
      });
    }
  };

  // 🔔 Beep nhỏ
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

  // ▶️ Start
  const handleStart = async () => {
    if (started) return;
    const ok = await ensureMicPermission();
    if (!ok) return;
    setStarted(true);
    setAnswers([]);
    await runQuestionCycle(0);
  };

  // 🔁 Loop
  const runQuestionCycle = async (index: number) => {
    if (index >= questions.length) return await finishInterview();
    setCurrentQ(index);
    setCountdown(60);

    await playQuestion(questions[index]);
    playBeep();
    await new Promise((r) => setTimeout(r, 500));
    startRecording();
  };

  // 🎙️ Start recording (MediaRecorder) + Amplitude monitor
  const startRecording = async () => {
    if (!micStream) {
      const ok = await ensureMicPermission();
      if (!ok) return;
    }

    setRecording(true);
    setAmplitudeLevel(0);
    audioChunksRef.current = [];

    // MediaRecorder setup with explicit sample rate and codec
    const recorder = new MediaRecorder(micStream!, {
      mimeType: "audio/webm; codecs=opus",
      audioBitsPerSecond: 128000, // Higher bitrate for quality
    });
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
      if (blob.size > 0) {
        await handleRecordedBlob(blob);
      } else {
        console.log("No audio data recorded");
        setIsLoading(false);
        await runQuestionCycle(currentQ + 1);
      }
    };

    // Amplitude monitor setup
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000 // Match STT sample rate
    });
    setAudioContext(ctx);
    const src = ctx.createMediaStreamSource(micStream!);
    const ana = ctx.createAnalyser();
    ana.fftSize = 4096; // Increased FFT size for better resolution
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
      console.log("RMS Level:", rms); // Debug RMS
      setAmplitudeLevel(rms);

      if (recording && monitoring) requestAnimationFrame(monitor);
    };
    monitor();

    recorder.start(1000); // Record in 1-second chunks

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

  // 🛑 Stop recording
  const stopRecording = () => {
    setMonitoring(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null);
    }
  };

  // 🎧 Handle blob -> STT
  const handleRecordedBlob = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (!reader.result) {
          console.log("No reader result");
          setIsLoading(false);
          await runQuestionCycle(currentQ + 1);
          return;
        }
        const base64Audio = (reader.result as string).split(",")[1];

        let sttTimeout = false;
        const timeoutId = setTimeout(async () => {
          sttTimeout = true;
          console.log("STT timeout triggered");
          setIsLoading(false);
          await runQuestionCycle(currentQ + 1);
        }, 30000); // Increased timeout for longRunningRecognize

        try {
          const res = await fetch("/api/stt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64Audio }),
          });

          clearTimeout(timeoutId);
          if (sttTimeout) return;

          if (!res.ok) {
            console.error("STT failed with status", res.status);
            throw new Error(`STT failed with status ${res.status}`);
          }

          const data = await res.json();
          console.log("STT Response:", data); // Debug log
          let transcription = data.transcription || "";
          if (transcription.trim()) {
            const newAnswers = [...answers, transcription];
            setAnswers(newAnswers);
          } else {
            console.log("Empty transcription, proceeding");
          }
          setIsLoading(false);
          await new Promise((r) => setTimeout(r, 700));
          await runQuestionCycle(currentQ + 1);
        } catch (err) {
          console.error("STT Error:", err);
          clearTimeout(timeoutId);
          setIsLoading(false);
          await runQuestionCycle(currentQ + 1);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Blob Error:", err);
      setIsLoading(false);
      await runQuestionCycle(currentQ + 1);
    }
  };

  // 🏁 Finish
  const finishInterview = async () => {
    clearInterval(timerRef.current);
    setRecording(false);
    setStarted(false);
    setIsLoading(true);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, questions }),
      });
      if (!res.ok) {
        throw new Error("Evaluate API failed");
      }
      const data = await res.json();
      setResult(data);

      const uid =
        auth.currentUser?.uid ||
        `guest-${localStorage.getItem("guestUid") || `guest-${Date.now()}`}`;
      const userDocRef = doc(db, "users", uid);
      const historyAnswerRef = collection(userDocRef, "historyAnswer");

      await addDoc(historyAnswerRef, {
        questions,
        answers,
        score: data?.score ?? null,
        feedback: data?.feedback ?? null,
        suggestion: data?.suggestion ?? null,
        createdAt: serverTimestamp(),
      });

      toast({
        title: "Interview finished!",
        description: "Results saved successfully.",
        status: "success",
        duration: 2000,
      });
    } catch (err) {
      console.error("Finish Interview Error:", err);
      toast({
        title: "Error finishing interview",
        description: "Please try again.",
        status: "error",
        duration: 2000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 🧠 Realtime history
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
      const histCol = collection(userDocRef, "historyAnswer");
      const q = firestoreQuery(histCol, orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        const arr: any[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setHistoryRealtime(arr);
      });
    })();
    return () => unsub && unsub();
  }, []);

  useEffect(() => {
    ensureMicPermission();
    return () => {
      clearInterval(timerRef.current);
      if (micStream) {
        micStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ✅ UI
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
                    width={`${Math.min(amplitudeLevel * 1000, 100)}%`}
                    transition="width 0.1s linear"
                  />
                </Box>
                <Text fontSize="sm" mt={2} color={amplitudeLevel > silenceThreshold ? "teal.500" : "gray.500"}>
                  {amplitudeLevel > silenceThreshold ? "Đang nói..." : "Đang im lặng..."}
                </Text>
              </Box>
              <Button mt={4} colorScheme="teal" onClick={stopRecording}>
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
            <Button size="lg" color="white" bg={started ? "gray.400" : "teal.400"} borderRadius="full" px={10} py={6} fontSize="xl" _hover={{ bg: started ? "gray.400" : "teal.500" }} onClick={handleStart} isDisabled={started}>
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
                          <Text fontSize="sm" fontWeight="semibold">{h.questions[h.id]}</Text>
                          <Text fontSize="sm">{h.answers[h.id]}</Text>
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
                    <Text whiteSpace="pre-wrap">
                      {result.suggestion || "Try to be more structured..."}
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