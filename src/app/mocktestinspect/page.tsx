// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, IconButton, Progress
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaPlay, FaArrowRight, FaMicrophone } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import { addDoc, collection, updateDoc, serverTimestamp } from "firebase/firestore";
import confetti from "canvas-confetti";

export default function MockTestInspect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const faceDetectRaf = useRef<number | null>(null);
  const monitorRaf = useRef<number | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const interviewDocRef = useRef<any>(null);

  const TIME_PER_QUESTION = 60; // 60 seconds per question
  const SILENCE_THRESHOLD = 0.012;

  const audioChunksRef = useRef<Blob[]>([]);
  const finalTranscriptRef = useRef<string>("");
  const lastSpokenAtRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);

  const level = searchParams.get("level") || "Intern";
  const role = searchParams.get("role") || "Front-End";
  const questionsJson = searchParams.get("questions") || "[]";

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [emotionLog, setEmotionLog] = useState<string[]>([]);
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [currentEmotion, setCurrentEmotion] = useState("Neutral");
  const [loadingModels, setLoadingModels] = useState(true);
  const [countdown, setCountdown] = useState(TIME_PER_QUESTION);
  const [amplitude, setAmplitude] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ==================== LOAD FACE-API ====================
  useEffect(() => {
    let mounted = true;
    import("@vladmandic/face-api").then(async (faceapi) => {
      if (!mounted) return;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models"),
      ]);
      if (mounted) {
        (window as any).faceapi = faceapi;
        setLoadingModels(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(questionsJson);
      setQuestions(parsed);
    } catch {
      router.push("/");
    }
  }, [questionsJson, router]);

  // ==================== FACE DETECTION ====================
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || loadingModels || finished) return;
    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    const detect = async () => {
      if (!videoRef.current || finished) return;
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceExpressions();

        if (detections.length > 0) {
          const expr = detections[0].expressions;
          const dominant = Object.keys(expr).reduce((a: any, b: any) => expr[a] > expr[b] ? a : b);
          setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
        }
        faceDetectRaf.current = requestAnimationFrame(detect);
      } catch {}
    };
    faceDetectRaf.current = requestAnimationFrame(detect);
  }, [finished, loadingModels]);

  // ==================== SPEAK QUESTION ====================
  const speak = async (text: string) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    speechSynthesis.speak(utter);
    await new Promise(resolve => utter.onend = resolve);
  };

  const playBeep = () => {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 900;
    g.gain.value = 0.2;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  };

  // ==================== START INTERVIEW ====================
  const handleStart = async () => {
    setIsLoading(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }

      const docRef = await addDoc(collection(db, "prointerviews"), {
        userId: auth.currentUser?.uid || "guest",
        level, role, questions,
        answers: [], emotionLog: [], result: null,
        createdAt: serverTimestamp(), finished: false
      });
      interviewDocRef.current = docRef;

      setStarted(true);
      setIsLoading(false);

      // Start first question immediately
      startQuestion(0);
    } catch (err) {
      toast({
        title: "Permission Denied",
        description: "Please allow camera and microphone access.",
        status: "error",
        duration: 8000
      });
      setIsLoading(false);
    }
  };

  // ==================== START QUESTION ====================
  const startQuestion = async (idx: number) => {
    if (idx >= questions.length || finished) {
      finishInterview();
      return;
    }

    setCurrentQ(idx);
    setCountdown(TIME_PER_QUESTION);
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    setRecording(true);
    setAmplitude(0);

    await speak(questions[idx]);
    playBeep();

    recordingStartTimeRef.current = Date.now();
    lastSpokenAtRef.current = Date.now();

    startRecording(stream!);

    // Auto countdown 60s
    countdownInterval.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      const remain = Math.max(TIME_PER_QUESTION - elapsed, 0);
      setCountdown(remain);
      if (remain <= 0) {
        stopRecording();
      }
    }, 100);
  };

  // ==================== RECORDING ENGINE ====================
  const startRecording = (stream: MediaStream) => {
    // Speech Recognition
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e: any) => {
        let final = "", interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += transcript + " ";
          else interim += transcript;
        }
        if (final) {
          finalTranscriptRef.current += final;
          lastSpokenAtRef.current = Date.now();
        }
        setLiveTranscript(finalTranscriptRef.current + interim);
      };

      rec.onerror = (e: any) => console.warn("STT Error:", e.error);
      rec.onend = () => { if (recording) rec.start(); };
      rec.start();
      recognitionRef.current = rec;
    }

    // Audio Analyzer (Waveform)
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = ctx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const monitor = () => {
        if (!recording || finished) return;
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += Math.pow((dataArray[i] - 128) / 128, 2);
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setAmplitude(rms);
        if (rms > SILENCE_THRESHOLD) lastSpokenAtRef.current = Date.now();
        monitorRaf.current = requestAnimationFrame(monitor);
      };
      monitor();
    } catch (err) {}
  };

  // ==================== STOP & SAVE ANSWER ====================
  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);

    clearInterval(countdownInterval.current!);
    if (monitorRaf.current) cancelAnimationFrame(monitorRaf.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    const answer = finalTranscriptRef.current.trim() || "(No answer recorded)";
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    setEmotionLog(prev => [...prev, currentEmotion]);

    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, {
        answers: newAnswers,
        emotionLog: [...emotionLog, currentEmotion],
        updatedAt: serverTimestamp()
      });
    }

    // Next question or finish
    if (currentQ + 1 < questions.length) {
      setTimeout(() => startQuestion(currentQ + 1), 1200);
    } else {
      finishInterview();
    }
  };

  // ==================== FINISH INTERVIEW ====================
  const finishInterview = async () => {
    setFinished(true);
    setRecording(false);
    setIsLoading(true);

    stream?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(faceDetectRaf.current!);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions, answers }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setResult(data);

      if (interviewDocRef.current) {
        await updateDoc(interviewDocRef.current, {
          result: data,
          finished: true,
          finishedAt: serverTimestamp()
        });
      }

      if (data.score >= 7) {
        confetti({ particleCount: 1200, spread: 100, origin: { y: 0.6 } });
      }
    } catch (err) {
      toast({ title: "Evaluation failed", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (started && !loadingModels) startFaceDetection();
  }, [started, loadingModels, startFaceDetection]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      clearInterval(countdownInterval.current!);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (monitorRaf.current) cancelAnimationFrame(monitorRaf.current);
    };
  }, []);

  // ==================== RENDER ====================
  if (loadingModels || questions.length === 0) {
    return (
      <Center minH="100vh" bg="gray.50" flexDir="column">
        <Spinner size="xl" color="teal.500" thickness="6px" />
        <Text mt={6} fontSize="2xl" fontWeight="bold">Loading AI Interview Pro...</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex
        as="header"
        align="center"
        justify="space-between"
        p={4}
        bg="white"
        shadow="lg"
        cursor="pointer"
        onClick={() => router.push("/auth/dashboard")}
        _hover={{ shadow: "xl" }}
      >
        <HStack spacing={3}>
          <Image src="/logo.png" boxSize={{ base: "40px", md: "50px" }} borderRadius="full" />
          <Text fontSize={{ base: "xl", md: "3xl" }} fontWeight="extrabold" color="teal.600">
            AI Interview Pro
          </Text>
        </HStack>
        <Badge colorScheme="teal" fontSize={{ base: "md", md: "lg" }} px={4} py={2} borderRadius="full">
          {level} • {role}
        </Badge>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} gap={10} p={8}>
        <VStack flex="3" spacing={8}>
          <HStack spacing={4} flexWrap="wrap" justify="center">
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <Circle size="70px" bg={i <= currentQ ? "teal.500" : "gray.300"} color="white" fontWeight="bold" fontSize="xl">
                  {i + 1}
                </Circle>
                {i < questions.length - 1 && <Box w="100px" h="8px" bg={i < currentQ ? "teal.500" : "gray.300"} rounded="full" />}
              </React.Fragment>
            ))}
          </HStack>

          <Box position="relative" w="640px" h="480px" bg="black" rounded="3xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
          </Box>

          <Box p={8} bg="white" rounded="3xl" shadow="2xl" w="full">
            <Text textAlign="center" fontSize="lg" color="gray.600">
              Question {currentQ + 1} of {questions.length}
            </Text>
            <Text textAlign="center" fontSize="3xl" fontWeight="bold" mt={4} lineHeight="1.6">
              {questions[currentQ]}
            </Text>

            {recording && (
              <VStack mt={12} spacing={10}>
                <HStack spacing={6}>
                  <FaMicrophone size={40} color="red" className="animate-pulse" />
                  <Text color="red.600" fontWeight="bold" fontSize="5xl">
                    {countdown}s
                  </Text>
                </HStack>

                <Box w="600px" h="140px" bg="gray.100" rounded="full" overflow="hidden" position="relative" shadow="2xl">
                  <Box
                    position="absolute" top="0" left="0" right="0" bottom="0"
                    bgGradient="linear(to-r, teal.400, cyan.500)"
                    opacity="0.9"
                    width={`${Math.min(amplitude * 1200, 100)}%`}
                    transition="width 0.05s ease-out"
                  />
                  <Center h="full">
                    <Text fontSize="5xl" fontWeight="black" color="white" textShadow="3px 3px 15px rgba(0,0,0,0.6)">
                      {amplitude > 0.012 ? "Speaking..." : "Start speaking..."}
                    </Text>
                  </Center>
                </Box>

                {liveTranscript && (
                  <Box p={5} bg="teal.50" rounded="2xl" maxW="800px" border="4px dashed" borderColor="teal.300">
                    <Text fontSize="xl" color="teal.800" textAlign="center" fontStyle="italic">
                      "{liveTranscript}"
                    </Text>
                  </Box>
                )}

                <Button
                  onClick={stopRecording}
                  rightIcon={<FaArrowRight />}
                  size="lg"
                  colorScheme="teal"
                  fontSize="xl"
                  px={12}
                  py={8}
                  rounded="full"
                  boxShadow="2xl"
                  _hover={{ transform: "scale(1.1)" }}
                >
                  Next Question
                </Button>
              </VStack>
            )}
          </Box>

          {!started && (
            <Button
              onClick={handleStart}
              isLoading={isLoading}
              leftIcon={<FaPlay />}
              size="lg"
              colorScheme="teal"
              px={40} py={10}
              fontSize="3xl"
              fontWeight="bold"
              borderRadius="full"
              boxShadow="2xl"
            >
              START INTERVIEW
            </Button>
          )}
        </VStack>

        {/* Result Panel */}
        <Box flex="1" bg="white" rounded="3xl" shadow="2xl" p={8}>
          <Tabs variant="soft-rounded" colorScheme="teal">
            <TabList>
              <Tab fontWeight="bold">Result</Tab>
              <Tab fontWeight="bold">Emotion</Tab>
              <Tab fontWeight="bold">AI Feedback</Tab>
            </TabList>
            <TabPanels mt={6}>
              <TabPanel>
                {result ? (
                  <VStack spacing={6} align="stretch">
                    <Center>
                      <Text fontSize="9xl" fontWeight="black" color={result.score >= 7 ? "green.500" : "red.500"}>
                        {result.score.toFixed(1)}/10
                      </Text>
                    </Center>
                    <Center>
                      <Text fontSize="5xl" fontWeight="bold" color={result.score >= 7 ? "green.500" : "red.500"}>
                        {result.score >= 7 ? "PASSED!" : "NEED IMPROVEMENT"}
                      </Text>
                    </Center>

                    <Text fontWeight="bold" fontSize="2xl" textAlign="center">Score per Question</Text>
                    <VStack spacing={4}>
                      {questions.map((q: string, i: number) => (
                        <Box key={i} p={4} bg="gray.50" rounded="xl" border="2px" borderColor="teal.200">
                          <HStack justify="space-between" mb={2}>
                            <Text fontWeight="bold">Q{i + 1}:</Text>
                            <Badge colorScheme={result.perQuestionScores[i] >= 7 ? "green" : "orange"} fontSize="lg">
                              {result.perQuestionScores[i]}/10
                            </Badge>
                          </HStack>
                          <Text fontSize="sm" color="gray.600" noOfLines={2}>{q}</Text>
                          <Text fontSize="sm" color="gray.500" mt={2} fontStyle="italic">
                            Answer: {answers[i] || "(No answer)"}
                          </Text>
                          <Text fontSize="sm" color="teal.600" mt={2}>
                            Feedback: {result.perQuestionFeedback[i]}
                          </Text>
                        </Box>
                      ))}
                    </VStack>
                  </VStack>
                ) : (
                  <Text color="gray.500" textAlign="center">Interview in progress...</Text>
                )}
              </TabPanel>

              <TabPanel>
                <Text fontWeight="bold" fontSize="2xl" mb={4}>Current Emotion: {currentEmotion}</Text>
                <VStack align="start">
                  {emotionLog.map((e, i) => (
                    <Text key={i}>Q{i + 1}: {e}</Text>
                  ))}
                </VStack>
              </TabPanel>

              <TabPanel>
                {result?.suggestion ? (
                  <Text whiteSpace="pre-wrap" fontSize="md" lineHeight="1.8">{result.suggestion}</Text>
                ) : (
                  <Text color="gray.500">Complete the interview to see AI suggestions</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}