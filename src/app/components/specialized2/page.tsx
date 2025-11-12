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
  orderBy,
  query as firestoreQuery,
  updateDoc,
  where,
  getDocs,
} from "firebase/firestore";

// ==================== INTERFACE ====================
interface InterviewData {
  id?: string;
  userId: string;
  category: string;
  level: string;
  role: string;
  questions: string[];
  answers: string[];
  score: number | null;
  feedback: string;
  perQuestionFeedback: string[];
  suggestion: string;
  perQuestionScores: number[];
  createdAt: any;
  startedAt: any;
  finishedAt?: any;
  finished: boolean;
}

export default function Specialized2() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const category = searchParams.get("category") || "Information Technology";
  const level = searchParams.get("level") || "";
  const role = searchParams.get("role") || "";
  const questions: string[] = (() => {
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
  const [finished, setFinished] = useState<boolean>(false);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [retryQuestion, setRetryQuestion] = useState<number | null>(null);

  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [amplitudeLevel, setAmplitudeLevel] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [monitoring, setMonitoring] = useState(false);
  const [liveText, setLiveText] = useState<string>("");

  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const interviewDocRef = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const lastSpokenAtRef = useRef<number>(0);
  const recordingStartedAtRef = useRef<number>(0);
  const hasPlayedQuestion = useRef<boolean>(false);

  const silenceThreshold = 0.008;
  const silenceTimeout = 60000;
  const minRecordingDuration = 500;

  // ===================== MIC PERMISSION =====================
  const ensureMicPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setMicStream(stream);
      setHasMicPermission(true);
      return true;
    } catch (err) {
      setHasMicPermission(false);
      toast({ title: "Microphone denied", status: "error", description: "Please allow microphone access." });
      return false;
    }
  };

  // ===================== TTS =====================
  const playQuestion = async (text: string) => {
    if (finished && retryQuestion === null) return;
    try {
      const res = await fetch("/api/tts", { method: "POST", body: JSON.stringify({ text }), headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        const { audioContent } = await res.json();
        const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
        await new Promise(r => { audio.onended = r; audio.play().catch(r); });
      } else throw new Error();
    } catch {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      await new Promise(r => { utter.onend = r; speechSynthesis.speak(utter); });
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

  // ===================== WEB SPEECH API =====================
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e: any) => {
      let final = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? final += t + " " : interim += t;
      }
      finalTranscriptRef.current += final;
      setLiveText(finalTranscriptRef.current + interim);
      if (final || interim) lastSpokenAtRef.current = Date.now();
    };

    recognition.onerror = (e: any) => e.error === "not-allowed" && setHasMicPermission(false);
    recognition.onend = () => recording && recognitionRef.current && recognitionRef.current.start();

    recognitionRef.current = recognition;
  }, []);

  // ===================== FIND EXISTING INTERVIEW =====================
  const findExistingInterview = async (uid: string): Promise<InterviewData | null> => {
    const q = firestoreQuery(
      collection(db, "interviews"),
      where("userId", "==", uid),
      where("finished", "==", false),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    const docSnap = snapshot.docs[0];
    if (!docSnap) return null;

    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      userId: data.userId || uid,
      category: data.category || "",
      level: data.level || "",
      role: data.role || "",
      questions: Array.isArray(data.questions) ? data.questions : [],
      answers: Array.isArray(data.answers) ? data.answers : [],
      score: data.score ?? null,
      feedback: data.feedback || "",
      perQuestionFeedback: Array.isArray(data.perQuestionFeedback) ? data.perQuestionFeedback : [],
      suggestion: data.suggestion || "",
      perQuestionScores: Array.isArray(data.perQuestionScores) ? data.perQuestionScores : [],
      createdAt: data.createdAt,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt,
      finished: data.finished === true,
    };
  };

  // ===================== START INTERVIEW =====================
  const handleStart = async () => {
    if (started || finished || questions.length === 0) return;

    const uid = auth.currentUser?.uid || localStorage.getItem("guestUid") || `guest-${Date.now()}`;
    localStorage.setItem("guestUid", uid);

    const existing = await findExistingInterview(uid);
    if (existing) {
      setInterviewId(existing.id!);
      interviewDocRef.current = doc(db, "interviews", existing.id!);
      setAnswers(existing.answers);
      setCurrentQ(existing.answers.length);
      setResult(existing.score ? {
        score: existing.score,
        feedback: existing.feedback,
        perQuestionFeedback: existing.perQuestionFeedback,
        suggestion: existing.suggestion,
        perQuestionScores: existing.perQuestionScores,
      } : null);
      setFinished(existing.finished);
      setStarted(true);
      setIsResuming(true);

      if (!existing.finished && existing.answers.length < questions.length) {
        await runQuestionCycle(existing.answers.length);
      }
      return;
    }

    const ok = await ensureMicPermission();
    if (!ok) return;

    setStarted(true);
    setAnswers([]);
    setCurrentQ(0);
    setResult(null);
    setFinished(false);
    finalTranscriptRef.current = "";
    setLiveText("");
    hasPlayedQuestion.current = false;

    try {
      const docRef = await addDoc(collection(db, "interviews"), {
        userId: uid,
        category,
        level,
        role,
        questions,
        answers: [],
        score: null,
        feedback: "",
        perQuestionFeedback: [],
        suggestion: "",
        perQuestionScores: [],
        createdAt: serverTimestamp(),
        startedAt: serverTimestamp(),
        finished: false,
      });
      interviewDocRef.current = docRef;
      setInterviewId(docRef.id);
    } catch (err) {
      console.error("Failed to create interview:", err);
    }

    await runQuestionCycle(0);
  };

  // ===================== RETRY SINGLE QUESTION =====================
  const handleRetry = async (index: number) => {
    if (isLoading || !finished) return;
    setRetryQuestion(index);
    setCurrentQ(index);
    setStarted(true);
    setFinished(false);
    setRecording(false);
    setLiveText("");
    finalTranscriptRef.current = "";
    hasPlayedQuestion.current = false;
    setIsLoading(true);

    micStream?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();

    const ok = await ensureMicPermission();
    if (!ok) {
      setIsLoading(false);
      return;
    }

    await runQuestionCycle(index);
    setIsLoading(false);
  };

  // ===================== QUESTION CYCLE =====================
  const runQuestionCycle = async (index: number) => {
    if ((finished && retryQuestion === null) || index >= questions.length) return;

    setCurrentQ(index);
    setCountdown(60);
    setIsLoading(false);
    finalTranscriptRef.current = "";
    setLiveText("");
    hasPlayedQuestion.current = false;

    if (!(finished && retryQuestion === null) && !hasPlayedQuestion.current) {
      await playQuestion(questions[index]);
      hasPlayedQuestion.current = true;
    }
    playBeep();
    await new Promise(r => setTimeout(r, 300));
    await startRecording();
  };

  // ===================== RECORDING =====================
  const startRecording = async () => {
    if (!micStream) await ensureMicPermission();
    if (!micStream) return;

    setRecording(true);
    audioChunksRef.current = [];
    lastSpokenAtRef.current = Date.now();
    recordingStartedAtRef.current = Date.now();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        const checkSilence = () => {
          if (!recording || (finished && retryQuestion === null)) return;
          const now = Date.now();
          if (now - lastSpokenAtRef.current > silenceTimeout && now - recordingStartedAtRef.current > minRecordingDuration) {
            stopRecording();
          } else requestAnimationFrame(checkSilence);
        };
        checkSilence();

        timerRef.current = setInterval(() => setCountdown(c => c <= 1 ? (clearInterval(timerRef.current), stopRecording(), 0) : c - 1), 1000);
        return;
      } catch {}
    }

    const recorder = new MediaRecorder(micStream!, { mimeType: "audio/webm;codecs=opus" });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => e.data.size > 0 && audioChunksRef.current.push(e.data);
    recorder.onstop = async () => {
      setMonitoring(false); audioContext?.close();
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      blob.size > 100 ? await handleRecordedBlob(blob) : await saveAndNext("");
    };

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(micStream!);
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 2048;
    source.connect(analyserNode);
    setAudioContext(ctx); setAnalyser(analyserNode); setMonitoring(true);

    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    const monitor = () => {
      if (!monitoring || !recording || (finished && retryQuestion === null)) return;
      analyserNode.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += Math.pow((dataArray[i] - 128) / 128, 2);
      const rms = Math.sqrt(sum / dataArray.length);
      setAmplitudeLevel(rms);
      if (rms > silenceThreshold) lastSpokenAtRef.current = Date.now();
      else if (Date.now() - lastSpokenAtRef.current > silenceTimeout && Date.now() - recordingStartedAtRef.current > minRecordingDuration) {
        stopRecording();
        return;
      }
      requestAnimationFrame(monitor);
    };
    monitor();
    recorder.start();

    timerRef.current = setInterval(() => setCountdown(c => c <= 1 ? (clearInterval(timerRef.current), recorder.stop(), 0) : c - 1), 1000);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    clearInterval(timerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (finalTranscriptRef.current.trim()) {
      await saveAndNext(finalTranscriptRef.current.trim());
      return;
    }
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setTimeout(() => {
      if (audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        handleRecordedBlob(blob);
      } else saveAndNext("");
    }, 1500);
  };

  const handleRecordedBlob = async (blob: Blob) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const res = await fetch("/api/stt", { method: "POST", body: JSON.stringify({ audio: base64 }), headers: { "Content-Type": "application/json" } });
        const { transcription } = await res.json();
        await saveAndNext(transcription.trim());
      } catch {
        await saveAndNext("");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(blob);
  };

  // ===================== SAVE & NEXT =====================
  const saveAndNext = async (text: string) => {
    if ((finished && retryQuestion === null) || currentQ >= questions.length) {
      await finishInterview();
      return;
    }

    let nextAnswers = [...answers];
    if (retryQuestion !== null) {
      nextAnswers[retryQuestion] = text;
      setAnswers(nextAnswers);
      if (interviewDocRef.current) {
        await updateDoc(interviewDocRef.current, { answers: nextAnswers, updatedAt: serverTimestamp() });
      }
      await retryFinish();
      return;
    }

    nextAnswers = [...answers, text];
    setAnswers(nextAnswers);
    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, { answers: nextAnswers, updatedAt: serverTimestamp() });
    }

    const nextQ = currentQ + 1;
    if (nextQ >= questions.length) {
      setCurrentQ(questions.length);
      await finishInterview();
    } else {
      setCurrentQ(nextQ);
      await runQuestionCycle(nextQ);
    }
  };

  // ===================== FINISH INTERVIEW =====================
  const finishInterview = async () => {
    if (finished) return;
    setRecording(false);
    setStarted(false);
    setIsLoading(true);
    setFinished(true);
    setRetryQuestion(null);

    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    micStream?.getTracks().forEach(t => t.stop());

    const finalAnswers = [...answers];
    while (finalAnswers.length < questions.length) {
      finalAnswers.push("(No answer recorded)");
    }

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions, answers: finalAnswers }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Eval failed");
      const data = await res.json();
      setResult(data);

      if (interviewDocRef.current) {
        await updateDoc(interviewDocRef.current, {
          answers: finalAnswers,
          score: data.score,
          feedback: data.feedback,
          perQuestionFeedback: data.perQuestionFeedback,
          suggestion: data.suggestion,
          perQuestionScores: data.perQuestionScores,
          finished: true,
          finishedAt: serverTimestamp(),
        });
      }

      toast({
        title: "Completed!",
        description: data.score >= 6 ? "PASS!" : "See AI Suggestions",
        status: data.score >= 6 ? "success" : "warning",
        duration: 5000,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to evaluate.", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== RETRY FINISH =====================
  const retryFinish = async () => {
    setRecording(false);
    setStarted(false);
    setIsLoading(true);
    setFinished(true);
    setRetryQuestion(null);

    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    micStream?.getTracks().forEach(t => t.stop());

    try {
      const singleQ = [questions[currentQ]];
      const singleA = [answers[currentQ]];
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions: singleQ, answers: singleA }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Eval failed");
      const data = await res.json();

      const newResult = { ...result };
      newResult.perQuestionScores[currentQ] = data.perQuestionScores[0];
      newResult.perQuestionFeedback[currentQ] = data.perQuestionFeedback[0];
      newResult.suggestion = data.suggestion;
      newResult.score = Math.round(newResult.perQuestionScores.reduce((a: number, b: number) => a + b, 0) / questions.length * 10) / 10;
      newResult.feedback = `Overall: ${newResult.score}/10`;

      setResult(newResult);

      if (interviewDocRef.current) {
        await updateDoc(interviewDocRef.current, {
          answers,
          score: newResult.score,
          feedback: newResult.feedback,
          perQuestionFeedback: newResult.perQuestionFeedback,
          suggestion: newResult.suggestion,
          perQuestionScores: newResult.perQuestionScores,
          updatedAt: serverTimestamp(),
        });
      }

      toast({
        title: "Retry Completed!",
        description: "Your answer has been updated.",
        status: "success",
        duration: 5000,
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to evaluate retry.", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // ===================== CLEANUP =====================
  useEffect(() => {
    ensureMicPermission();
    return () => {
      clearInterval(timerRef.current);
      micStream?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.

 stop();
      audioContext?.close();
      setMonitoring(false);
    };
  }, []);

  // ===================== RENDER =====================
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
        <Box flex="3" borderRight="1px solid black" minH="70vh" position="relative">
          {isLoading && <Spinner size="xl" color="teal.400" position="absolute" top="20%" left="50%" transform="translateX(-50%)" zIndex={10} />}

          <VStack spacing={6} align="center" pb="200px">
            <Box p={6} border="1px solid" borderColor="teal.400" borderRadius="md" bg="teal.50" w="full" maxW="800px">
              <Text fontWeight="bold" textAlign="center">
                Question {Math.min(currentQ + 1, questions.length)} / {questions.length}
              </Text>
              <Text mt={2} fontSize="lg" textAlign="center">
                {currentQ < questions.length ? questions[currentQ] : (finished ? "Interview Completed!" : "Evaluating...")}
              </Text>
            </Box>

            {recording && (
              <Box textAlign="center" w="full" maxW="800px" p={4} bg="gray.50" borderRadius="lg">
                <Text color="red.500" fontWeight="bold" mb={2}>Recording... ({countdown}s)</Text>
                {liveText && <Text fontSize="lg" color="teal.600">Live: {liveText}</Text>}
                <Box mt={3} h="10px" w="200px" bg="gray.200" borderRadius="full" overflow="hidden" mx="auto">
                  <Box h="full" bg={amplitudeLevel > silenceThreshold ? "teal.400" : "gray.400"} width={`${Math.min(amplitudeLevel * 600, 100)}%`} transition="width 0.1s" />
                </Box>
              </Box>
            )}
          </VStack>

          <Flex justify="center" position="absolute" bottom="16" left="0" right="0" gap={6} px={8}>
            <Button
              size="lg"
              colorScheme={started || finished ? "gray" : "teal"}
              borderRadius="full"
              px={12} py={7} fontSize="xl"
              onClick={handleStart}
              isDisabled={started || finished || questions.length === 0}
            >
              {started ? "In Progress..." : finished ? "Completed" : "Start Interview"}
            </Button>
            {recording && (
              <Button size="lg" colorScheme="gray" borderRadius="full" px={10} py={7} fontSize="xl" onClick={stopRecording}>
                Next Question
              </Button>
            )}
          </Flex>

          {finished && answers.length > 0 && (
            <Box position="absolute" bottom="0" left="0" right="0" bg="gray.50" borderTop="1px solid" borderColor="gray.300" p={6} maxH="50vh" overflowY="auto">
              <Text fontSize="xl" fontWeight="bold" mb={4} textAlign="center">Your Answers</Text>
              <VStack spacing={4} align="stretch" maxW="800px" mx="auto">
                {questions.map((q, i) => (
                  <Box key={i} p={4} bg="white" borderRadius="md" boxShadow="sm">
                    <Text fontWeight="semibold" color="teal.600">Q{i + 1}: {q}</Text>
                    <Text mt={2}><strong>Answer:</strong> {answers[i] || "No answer recorded"}</Text>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}
        </Box>

        <Box flex="1" pl={6}>
          <Tabs variant="unstyled">
            <TabList borderBottom="1px solid black">
              <Tab fontSize="lg" _selected={{ fontWeight: "bold", borderBottom: "3px solid black" }}>Results</Tab>
              <Tab fontSize="lg" ml={6} _selected={{ fontWeight: "bold", borderBottom: "3px solid black" }}>AI Suggestions</Tab>
            </TabList>

            <TabPanels mt={4}>
              <TabPanel>
                {result ? (
                  <Box>
                    <Text fontSize="3xl" fontWeight="bold" color={result.score >= 6 ? "teal.500" : "red.500"}>
                      {result.score >= 6 ? "PASS" : "FAIL"}
                    </Text>
                    <Text fontSize="xl" mt={2}>Score: <strong>{result.score}/10</strong></Text>
                    <Text mt={2} color="gray.600">{result.feedback}</Text>

                    <VStack mt={6} align="start" spacing={4}>
                      <Text fontWeight="bold" fontSize="lg">Detailed Feedback</Text>
                      {result.perQuestionFeedback.map((fb: string, i: number) => (
                        <Box key={i} p={4} bg="gray.50" borderRadius="lg" border="1px solid" borderColor="gray.200" w="full">
                          <Text fontWeight="semibold" color="teal.600">
                            Q{i + 1} • Score: {result.perQuestionScores?.[i] || "?"}/10
                          </Text>
                          <Text fontSize="sm" mt={1}><strong>Answer:</strong> {answers[i] || "No answer"}</Text>
                          <Text fontSize="sm" mt={2} color="gray.800"><strong>Feedback:</strong> {fb}</Text>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : (
                  <Text color="gray.500">Complete the interview to see results.</Text>
                )}
              </TabPanel>
              <TabPanel>
                {result ? (
                  <Box>
                    <Text fontSize="lg" fontWeight="bold" color={result.score >= 6 ? "green.500" : "red.500"} mb={3}>
                      {result.score >= 6 ? "Great Job!" : "Improved Answers for Each Question"}
                    </Text>
                    <VStack align="start" spacing={4}>
                      {result.suggestion.split('\n\n').map((sug: string, i: number) => (
                        <Box key={i} p={4} bg="gray.50" borderRadius="lg" border="1px solid" borderColor="gray.200" w="full">
                          <Text whiteSpace="pre-wrap" fontSize="sm" lineHeight="1.6">
                            {sug}
                          </Text>
                          <Button
                            mt={2}
                            size="sm"
                            colorScheme="teal"
                            onClick={() => handleRetry(i)}
                            isDisabled={isLoading}
                          >
                            Try Again This Question
                          </Button>
                        </Box>
                      ))}
                    </VStack>
                  </Box>
                ) : (
                  <Text color="gray.500">Finish to get AI suggestions.</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}