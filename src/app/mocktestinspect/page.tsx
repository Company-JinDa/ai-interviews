// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, Progress
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaPlay } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import { addDoc, collection, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import * as faceapi from "@vladmandic/face-api";

interface InterviewResult {
  score: number;
  feedback: string;
  perQuestionScores: number[];
  perQuestionFeedback: string[];
  suggestion: string;
}

export default function MockTestInspect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const lastSpokenAtRef = useRef<number>(0);
  const recordingStartedAtRef = useRef<number>(0);
  const interviewDocRef = useRef<any>(null);

  const level = searchParams.get("level") || "Intern";
  const role = searchParams.get("role") || "Front-End";
  const questionsJson = searchParams.get("questions") || "[]";

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [emotionLog, setEmotionLog] = useState<string[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState("Detecting...");
  const [emotionPercent, setEmotionPercent] = useState<any>({});
  const [loadingModels, setLoadingModels] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // LOAD FACE-API MODELS
  useEffect(() => {
    const load = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      setLoadingModels(false);
    };
    load();
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(questionsJson);
      setQuestions(parsed);
    } catch {
      router.push("/");
    }
  }, [questionsJson, router]);

  // START EVERYTHING: Camera + Interview
  const handleStart = async () => {
    if (started) return;

    setIsLoading(true);
    try {
      // 1. Bật camera + mic
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      // 2. Bắt đầu face detection realtime
      const detectFace = async () => {
        if (!videoRef.current || !canvasRef.current || finished) return;
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks().withFaceExpressions();

        const ctx = canvasRef.current.getContext("2d")!;
        ctx.clearRect(0, 0, 640, 480);

        if (detections.length > 0) {
          const resized = faceapi.resizeResults(detections, { width: 640, height: 480 });
          faceapi.draw.drawDetections(canvasRef.current, resized);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

          const expr = detections[0].expressions;
          const dominant = Object.keys(expr).reduce((a, b) => (expr as any)[a] > (expr as any)[b] ? a : b);
          setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
          setEmotionPercent(expr);
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
          setCurrentEmotion("No face");
        }
        if (!finished) requestAnimationFrame(detectFace);
      };
      detectFace();

      // 3. Tạo interview record
      const docRef = await addDoc(collection(db, "interviews"), {
        userId: auth.currentUser?.uid || "guest",
        level, role, questions,
        answers: [], emotionLog: [], result: null,
        createdAt: serverTimestamp(),
        finished: false,
      });
      setInterviewId(docRef.id);
      interviewDocRef.current = docRef;

      // 4. Bắt đầu phỏng vấn
      setStarted(true);
      setIsLoading(false);

      await speakAndStartRecording(0);

    } catch (err) {
      toast({ title: "Không thể truy cập camera/mic", status: "error", description: "Vui lòng cấp quyền!" });
      setIsLoading(false);
    }
  };

  const speakAndStartRecording = async (qIndex: number) => {
    if (qIndex >= questions.length) {
      finishInterview();
      return;
    }

    setCurrentQ(qIndex);
    setCountdown(60);
    setRecording(false);

    // Đọc câu hỏi
    await speak(questions[qIndex]);

    // Beep + delay nhỏ
    playBeep();
    await new Promise(r => setTimeout(r, 800));

    // Bắt đầu recording
    startRecording();
  };

  const playBeep = () => {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 800; g.gain.value = 0.1;
    o.connect(g); g.connect(ctx.destination);
    o.start(); setTimeout(() => o.stop(), 150);
  };

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const { audioContent } = await res.json();
        const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
        await audio.play();
      }
    } catch {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      speechSynthesis.speak(utter);
    }
  };

  const startRecording = () => {
    if (!stream) return;
    setRecording(true);
    setCountdown(60);
    lastSpokenAtRef.current = Date.now();
    recordingStartedAtRef.current = Date.now();
    audioChunksRef.current = [];

    // Web Speech API (live transcript + silence detection)
    if ("webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            lastSpokenAtRef.current = Date.now();
          }
        }
      };
      recognition.onerror = () => recording && recognition.start();
      recognition.onend = () => recording && recognition.start();
      recognition.start();
      recognitionRef.current = recognition;
    }

    // MediaRecorder
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = e => e.data.size > 0 && audioChunksRef.current.push(e.data);
    recorder.start();
    mediaRecorderRef.current = recorder;

    // Countdown
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timerRef.current); stopRecording(); return 0; }
        return c - 1;
      });
    }, 1000);

    // Silence detection
    const checkSilence = () => {
      if (!recording) return;
      const now = Date.now();
      if (now - lastSpokenAtRef.current > 7000 && now - recordingStartedAtRef.current > 8000) {
        stopRecording();
      } else {
        setTimeout(checkSilence, 1000);
      }
    };
    setTimeout(checkSilence, 5000);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();

    let transcript = "";
    if (audioChunksRef.current.length > 0) {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      transcript = await new Promise<string>((resolve) => {
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1];
          const res = await fetch("/api/stt", {
            method: "POST",
            body: JSON.stringify({ audio: base64 }),
            headers: { "Content-Type": "application/json" },
          });
          const data = await res.json();
          resolve(data.transcription || "");
        };
        reader.readAsDataURL(blob);
      });
    }

    const answer = transcript.trim() || "(No answer recorded)";
    const newAnswers = [...answers, answer];
    const newEmotions = [...emotionLog, currentEmotion];
    setAnswers(newAnswers);
    setEmotionLog(newEmotions);

    // Save to Firebase
    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, {
        answers: newAnswers,
        emotionLog: newEmotions,
        updatedAt: serverTimestamp(),
      });
    }

    // Next question
    setTimeout(() => speakAndStartRecording(currentQ + 1), 1200);
  };

  const finishInterview = async () => {
    setFinished(true);
    setIsLoading(true);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions, answers }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setResult(data);

      if (interviewDocRef.current) {
        await updateDoc(interviewDocRef.current, {
          result: data,
          finished: true,
          finishedAt: serverTimestamp(),
        });
      }

      if (data.score >= 7) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
        script.onload = () => (window as any).confetti({ particleCount: 300, spread: 100 });
        document.body.appendChild(script);
      }

    } catch (err) {
      toast({ title: "Lỗi đánh giá", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingModels || questions.length === 0) {
    return (
      <Center minH="100vh" flexDir="column">
        <Spinner size="xl" color="teal.500" thickness="5px" />
        <Text mt={6} fontSize="2xl" fontWeight="bold">Đang tải AI Pro...</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="2xl">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" />
          <Text fontSize="3xl" fontWeight="extrabold" color="teal.600">AI-Interview Pro</Text>
        </HStack>
        <Badge colorScheme="teal" fontSize="xl" px={8} py={4} borderRadius="full">
          {level} • {role}
        </Badge>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} gap={12} p={8}>
        <VStack flex="3" spacing={10}>
          <HStack spacing={6} flexWrap="wrap" justify="center">
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <Circle size="80px" bg={i <= currentQ ? "teal.500" : "gray.300"} color="white" fontWeight="bold" fontSize="2xl" boxShadow="lg">
                  {i + 1}
                </Circle>
                {i < questions.length - 1 && <Box w="140px" h="10px" bg={i < currentQ ? "teal.500" : "gray.300"} rounded="full" />}
              </React.Fragment>
            ))}
          </HStack>

          <Box position="relative" w="640px" h="480px" bg="black" rounded="3xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
            {!faceDetected && started && (
              <Center position="absolute" inset={0} bg="blackAlpha.900">
                <Text color="white" fontSize="4xl" fontWeight="bold">HÃY NHÌN VÀO CAMERA</Text>
              </Center>
            )}
          </Box>

          <Box p={10} bg="white" rounded="3xl" shadow="2xl" w="full" textAlign="center">
            <Text fontSize="lg" color="gray.600">Question {currentQ + 1} / {questions.length}</Text>
            <Text fontSize="3xl" fontWeight="bold" mt={4} lineHeight="1.4">
              {questions[currentQ]}
            </Text>
            {recording && (
              <Text mt={8} color="red.500" fontWeight="bold" fontSize="2xl">
                Recording... ({countdown}s)
              </Text>
            )}
          </Box>

          {/* NÚT START DUY NHẤT */}
          {!started && (
            <Button
              size="lg"
              colorScheme="teal"
              onClick={handleStart}
              isLoading={isLoading}
              loadingText="Đang khởi động..."
              leftIcon={<FaPlay />}
              px={40}
              py={10}
              fontSize="3xl"
              fontWeight="bold"
              borderRadius="full"
              boxShadow="2xl"
              _hover={{ transform: "scale(1.05)" }}
              transition="0.2s"
            >
              START
            </Button>
          )}
        </VStack>

        {/* Right Panel - Giữ nguyên đẹp như cũ */}
        <Box flex="1" bg="white" rounded="3xl" shadow="2xl" p={8}>
          <Tabs variant="soft-rounded" colorScheme="teal">
            <TabList>
              <Tab fontWeight="bold">Kết quả</Tab>
              <Tab fontWeight="bold">Cảm xúc</Tab>
              <Tab fontWeight="bold">Gợi ý AI</Tab>
            </TabList>
            <TabPanels mt={6}>
              <TabPanel>
                {result ? (
                  <VStack spacing={6}>
                    <Text fontSize="9xl" fontWeight="black" color={result.score >= 7 ? "green.500" : "red.500"}>
                      {result.score}/10
                    </Text>
                    <Text fontSize="4xl" fontWeight="bold">{result.score >= 7 ? "PASS!" : "Cần cải thiện"}</Text>
                  </VStack>
                ) : (
                  <Text color="gray.500" fontSize="lg">Đang phỏng vấn...</Text>
                )}
              </TabPanel>

              <TabPanel>
                <Text fontSize="7xl" fontWeight="bold" color="teal.500" textAlign="center">
                  {currentEmotion}
                </Text>
                {faceDetected && Object.keys(emotionPercent).length > 0 && (
                  <VStack align="start" mt={6} spacing={4}>
                    {Object.entries(emotionPercent)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([emo, val]: any) => (
                        <HStack key={emo} w="full">
                          <Text w="130px" fontSize="lg" fontWeight="medium">
                            {emo.charAt(0).toUpperCase() + emo.slice(1)}
                          </Text>
                          <Progress value={val * 100} flex="1" colorScheme="teal" height="24px" rounded="full" />
                          <Text w="60px" textAlign="right" fontWeight="bold" fontSize="lg">
                            {Math.round(val * 100)}%
                          </Text>
                        </HStack>
                      ))}
                  </VStack>
                )}
              </TabPanel>

              <TabPanel>
                {result ? (
                  <VStack align="start" spacing={5}>
                    {result.suggestion.split("\n\n").map((sug: string, i: number) => (
                      <Box key={i} p={5} bg="gray.50" rounded="xl" border="2px solid" borderColor="gray.200">
                        <Text whiteSpace="pre-wrap" lineHeight="1.8" fontSize="sm">
                          {sug}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Text color="gray.500">Sẽ hiện khi hoàn thành</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}