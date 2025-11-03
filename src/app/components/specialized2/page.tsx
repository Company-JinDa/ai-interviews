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
  updateDoc,
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
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [amplitudeLevel, setAmplitudeLevel] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [monitoring, setMonitoring] = useState(false);

  const interviewDocRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceThreshold = 0.02; // TĂNG LÊN ĐỂ NHẬN ÂM THANH DỄ HƠN
  const minRecordingDuration = 1000;
  const silenceTimeout = 1200;
  const lastSpokenAtRef = useRef<number>(0);
  const recordingStartedAtRef = useRef<number>(0);

  const ensureMicPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });
      setMicStream(stream);
      setHasMicPermission(true);
      return true;
    } catch (err) {
      console.error("Mic error:", err);
      setHasMicPermission(false);
      toast({
        title: "Microphone Access Denied",
        description: "Please allow microphone in browser settings.",
        status: "error",
      });
      return false;
    }
  };

  const playQuestion = async (text: string): Promise<void> => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      const { audioContent } = await res.json();
      const audio = new Audio("data:audio/mp3;base64," + audioContent);
      await new Promise((r) => { audio.onended = r; audio.play().catch(r); });
    } catch {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      await new Promise((r) => { u.onend = r; speechSynthesis.speak(u); });
    }
  };

  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 800; g.gain.value = 0.1;
      o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 150);
    } catch {}
  };

  const handleStart = async () => {
    if (started || questions.length === 0) return;
    const ok = await ensureMicPermission();
    if (!ok) return;

    setStarted(true); setAnswers([]); setCurrentQ(0); setResult(null);

    const uid = auth.currentUser?.uid || localStorage.getItem("guestUid") || `guest-${Date.now()}`;
    localStorage.setItem("guestUid", uid);
    const userDocRef = doc(db, "users", uid);
    const interviewsRef = collection(userDocRef, "interviews");

    try {
      const docRef = await addDoc(interviewsRef, {
        category, level, role, questions, answers: [], score: null, feedback: null, suggestion: null,
        createdAt: serverTimestamp(), startedAt: serverTimestamp(), finished: false,
      });
      interviewDocRef.current = docRef;
    } catch (err) { console.error(err); }

    await runQuestionCycle(0);
  };

  const runQuestionCycle = async (index: number) => {
    if (index >= questions.length) {
      await finishInterview();
      return;
    }

    setCurrentQ(index);
    setCountdown(60);
    setIsLoading(false);

    try {
      await playQuestion(questions[index]);
      playBeep();
      await new Promise((r) => setTimeout(r, 300));
      await startRecording();
    } catch {
      await saveAndNext("");
    }
  };

  const startRecording = async () => {
    if (!micStream) {
      const ok = await ensureMicPermission();
      if (!ok) return;
    }

    setRecording(true);
    setAmplitudeLevel(0);
    audioChunksRef.current = [];
    lastSpokenAtRef.current = Date.now();
    recordingStartedAtRef.current = Date.now();

    const recorder = new MediaRecorder(micStream!, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);

    recorder.onstop = async () => {
      setMonitoring(false);
      audioContext?.close();
      setAudioContext(null);
      setAnalyser(null);

      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      if (blob.size > 1000) {
        await handleRecordedBlob(blob);
      } else {
        await saveAndNext(""); // im lặng → bỏ qua
      }
    };

    // TẠO AUDIO CONTEXT RIÊNG ĐỂ ĐO ÂM THANH
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = ctx.createMediaStreamSource(micStream!);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    setAudioContext(ctx);
    setAnalyser(analyser);
    setMonitoring(true);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const monitor = () => {
      if (!monitoring || !recording) return;
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const v = (dataArray[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      setAmplitudeLevel(rms);

      const now = Date.now();
      if (rms > silenceThreshold) {
        lastSpokenAtRef.current = now;
      } else if (now - lastSpokenAtRef.current > silenceTimeout && now - recordingStartedAtRef.current > minRecordingDuration) {
        stopRecording();
        return;
      }

      requestAnimationFrame(monitor);
    };
    monitor();

    recorder.start();

    // Countdown
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          stopRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    clearInterval(timerRef.current);
  };

  const handleRecordedBlob = async (blob: Blob) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/stt", {
          method: "POST",
          body: JSON.stringify({ audio: base64 }),
          headers: { "Content-Type": "application/json" },
        });
        const { transcription } = res.ok ? await res.json() : { transcription: "" };
        await saveAndNext(transcription.trim());
      } catch (err) {
        console.error("STT error:", err);
        await saveAndNext("");
      }
    };
    reader.readAsDataURL(blob);
  };

  const saveAndNext = async (text: string) => {
    const nextAnswers = [...answers, text];
    setAnswers(nextAnswers);
    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, { answers: nextAnswers, updatedAt: serverTimestamp() });
    }
    setIsLoading(false);
    await new Promise((r) => setTimeout(r, 500));
    const nextQ = currentQ + 1;
    setCurrentQ(nextQ);
    if (nextQ < questions.length) {
      await runQuestionCycle(nextQ);
    } else {
      await finishInterview();
    }
  };

  const finishInterview = async () => {
    setRecording(false);
    setStarted(false);
    setIsLoading(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions, answers }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
      if (interviewDocRef.current) {
        await updateDoc(interviewDocRef.current, {
          score: data.score,
          feedback: data.feedback,
          perQuestionFeedback: data.perQuestionFeedback,
          suggestion: data.suggestion,
          finished: true,
          finishedAt: serverTimestamp(),
        });
      }
      toast({
        title: "Completed!",
        description: data.score >= 6 ? "PASS!" : "See AI Suggestions!",
        status: data.score >= 6 ? "success" : "warning",
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to evaluate.", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const uid = auth.currentUser?.uid || localStorage.getItem("guestUid") || `guest-${Date.now()}`;
    localStorage.setItem("guestUid", uid);
    const q = firestoreQuery(collection(doc(db, "users", uid), "interviews"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (s) => setHistoryRealtime(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  useEffect(() => {
    ensureMicPermission();
    return () => {
      clearInterval(timerRef.current);
      micStream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <Box p={4} minH="100vh" bg="white">
      <Flex align="center" borderBottom="1px solid black" pb={2}>
        <Image src="/logo.png" alt="Logo" boxSize="40px" mr={2} borderRadius="full" />
        <Text fontSize="2xl" fontWeight="bold">AI-Interview</Text>
      </Flex>

      <HStack spacing={2} mt={2} mb={4}>
        <Button variant="ghost" p={0} onClick={() => router.push("/auth/dashboard")}><Icon as={FaHome} boxSize={5} mr={1} /><Text>Home</Text></Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Button variant="ghost" p={0} onClick={() => router.push("/components/specialized")}><Icon as={MdDirectionsBike} boxSize={5} /><Text>Specialized Practice</Text></Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Button variant="ghost" p={0} onClick={() => router.push(`/components/specialized1?category=${category}`)}><Icon as={FaMicrophone} boxSize={5} /><Text>{category}</Text></Button>
        <Icon as={MdOutlineKeyboardArrowRight} />
        <Icon as={FaPlay} color="teal.400" />
        <Text>{role ? `${role} - ${level}` : ""}</Text>
      </HStack>

      <Flex>
        <Box flex="3" borderRight="1px solid black" minH="70vh" position="relative" display="flex" flexDirection="column" justifyContent="center" alignItems="center">
          {isLoading && <Spinner size="xl" color="teal.400" mb={4} />}

          <VStack spacing={4} mb={6} w="full" align="center">
            <Box p={6} border="1px solid" borderColor="teal.400" borderRadius="md" bg="teal.50" w="full" maxW="800px" mx="auto">
              <Text fontWeight="bold" textAlign="center">Question {currentQ + 1} / {questions.length}</Text>
              <Text mt={2} fontSize="lg" textAlign="center">{questions[currentQ] || "No question"}</Text>
            </Box>
          </VStack>

          {recording ? (
            <Box textAlign="center" w="100%" maxW="800px" mx="auto">
              <Text color="red.500" mb={2}>Recording... ({countdown}s)</Text>
              <Box bg="#f7fafc" p={4} borderRadius="lg" boxShadow="md" width="100%" display="flex" flexDirection="column" alignItems="center">
                <Box mt={3} h="10px" w="200px" bg="gray.200" borderRadius="full" overflow="hidden">
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
            </Box>
          ) : (
            <Box mb={4} textAlign="center">
              <Text color={hasMicPermission ? "gray.500" : "red.500"}>
                {hasMicPermission ? "Ready to record (auto after TTS)" : "Microphone not allowed"}
              </Text>
            </Box>
          )}

          <Flex justify="center" position="absolute" bottom="16" left="0" right="0" gap={4}>
            <Button
              size="lg" color="white" bg={started ? "gray.400" : "teal.400"} borderRadius="full" px={10} py={6} fontSize="xl"
              _hover={{ bg: started ? "gray.400" : "teal.500" }} onClick={handleStart}
              isDisabled={started || questions.length === 0}
            >
              {started ? "Interview in progress..." : "Start"}
            </Button>
            {recording && (
              <Button size="lg" colorScheme="gray" borderRadius="full" px={8} py={6} fontSize="xl" onClick={stopRecording}>
                Next
              </Button>
            )}
          </Flex>
        </Box>

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
                      {result.score >= 6 ? "PASS" : "FAIL"}
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
                          <Text fontSize="sm">Date: {h.createdAt?.toDate?.()?.toLocaleString?.() || "N/A"}</Text>
                        </Box>
                      ))
                    )}
                  </VStack>
                </Box>
              </TabPanel>
              <TabPanel>
                {result ? (
                  <Box>
                    <Text mb={2} fontWeight="bold" color={result.score < 6 ? "red.500" : "green.500"}>
                      {result.score < 6 ? "AI Suggestions to Improve" : "Great Job!"}
                    </Text>
                    <Text whiteSpace="pre-wrap" fontSize="sm">
                      {result.suggestion || "No suggestions needed."}
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