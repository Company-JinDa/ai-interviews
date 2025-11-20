// src/app/mocktestinspect/page.tsx   ← ĐẶT ĐÚNG ĐƯỜNG DẪN NÀY NHÉ!
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  VStack,
  HStack,
  Circle,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Center,
  Spinner,
  useToast,
  Image,
  Badge,
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaMicrophone, FaCamera, FaRedo } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

// Khai báo face-api từ CDN
declare global {
  interface Window {
    faceapi: any;
    webkitSpeechRecognition: any;
  }
}

export default function MockTestInspect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);

  const level = searchParams.get("level") || "Unknown";
  const role = searchParams.get("role") || "Unknown";
  const questionsJson = searchParams.get("questions") || "[]";

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [emotion, setEmotion] = useState("Detecting...");

  // TỰ ĐỘNG TẢI face-api.js + models từ CDN → KHÔNG CẦN CÀI GÌ HẾT
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api.js@1.7.10/dist/face-api.min.js";
    script.async = true;
    script.onload = async () => {
      console.log("face-api.js loaded");
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api.js@1.7.10/weights";
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      console.log("Models loaded – Face Analysis Ready!");
    };
    document.body.appendChild(script);
  }, []);

  // Parse questions
  useEffect(() => {
    try {
      const q = JSON.parse(questionsJson);
      if (q.length === 0) router.push("/mocktest4");
      setQuestions(q);
    } catch {
      router.push("/mocktest4");
    }
  }, [questionsJson, router]);

  // Bật camera + Face Detection realtime
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraReady(true);

        const detectFace = async () => {
          if (!videoRef.current || !canvasRef.current || finished) return;

          const detections = await window.faceapi
            .detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

          const ctx = canvasRef.current.getContext("2d")!;
          ctx.clearRect(0, 0, 640, 480);

          if (detections.length > 0) {
            const resized = window.faceapi.resizeResults(detections, { width: 640, height: 480 });
            window.faceapi.draw.drawDetections(canvasRef.current, resized);
            window.faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);

            const expr = detections[0].expressions;
            const dominant = Object.keys(expr).reduce((a: any, b: any) =>
              expr[a] > expr[b] ? a : b
            );
            setEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
            setFaceDetected(true);
          } else {
            setEmotion("No face");
            setFaceDetected(false);
          }
          requestAnimationFrame(detectFace);
        };
        detectFace();
      }
    } catch (err) {
      toast({
        title: "Camera & Mic Required!",
        description: "Vui lòng bật camera và micro để tiếp tục",
        status: "error",
        duration: null,
        isClosable: false,
      });
    }
  };

  // TTS đọc câu hỏi
  const speak = async (text: string) => {
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
  };

  // Bắt đầu phỏng vấn
  const handleStart = async () => {
    if (!faceDetected) {
      toast({ title: "Hãy nhìn vào camera!", status: "warning" });
      return;
    }

    const uid = auth.currentUser?.uid || `guest-${Date.now()}`;
    localStorage.setItem("guestUid", uid);

    const docRef = await addDoc(collection(db, "interviews"), {
      userId: uid,
      level,
      role,
      questions,
      answers: [],
      finished: false,
      createdAt: serverTimestamp(),
    });

    setStarted(true);
    await speak(questions[0]);
    startRecording();
  };

  // Ghi âm + STT tự động next
  const startRecording = () => {
    setRecording(true);
    if ("webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = "";

      recognition.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript + " ";
          }
        }
        if (finalTranscript.trim()) {
          recognition.stop();
          nextQuestion(finalTranscript.trim());
        }
      };

      recognition.onerror = () => recognition.start();
      recognition.start();
      recognitionRef.current = recognition;
    }
  };

  const nextQuestion = async (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (currentQ + 1 >= questions.length) {
      await finishInterview(newAnswers);
      return;
    }

    setCurrentQ(currentQ + 1);
    setTimeout(() => speak(questions[currentQ + 1]), 1500);
  };

  const finishInterview = async (finalAnswers: string[]) => {
    setRecording(false);
    setFinished(true);

    const res = await fetch("/api/evaluate", {
      method: "POST",
      body: JSON.stringify({ questions, answers: finalAnswers }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setResult(data);

    // Confetti khi PASS (không cần cài package)
    if (data.score >= 7) {
      const confettiScript = document.createElement("script");
      confettiScript.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
      confettiScript.onload = () => {
        // @ts-ignore
        window.confetti({
          particleCount: 200,
          spread: 70,
          origin: { y: 0.6 },
        });
      };
      document.body.appendChild(confettiScript);
    }

    // Lưu Firestore
    // (code lưu giống file cũ của bạn)
  };

  if (questions.length === 0) return <Center minH="100vh"><Spinner size="xl" /></Center>;

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="lg">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" fallbackSrc="https://via.placeholder.com/50" />
          <Text fontSize="2xl" fontWeight="extrabold" color="teal.600">AI-Interview</Text>
        </HStack>
        <Badge colorScheme="teal" fontSize="lg" px={6} py={3} borderRadius="full">
          {level} • {role}
        </Badge>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} gap={10} p={8}>
        {/* LEFT */}
        <VStack flex="3" spacing={10}>
          {/* Progress */}
          <HStack spacing={6}>
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <Circle size="70px" bg={i <= currentQ ? "teal.500" : "gray.300"} color="white" fontWeight="bold" fontSize="2xl">
                  {i + 1}
                </Circle>
                {i < questions.length - 1 && <Box w="120px" h="8px" bg={i < currentQ ? "teal.500" : "gray.300"} rounded="full" />}
              </React.Fragment>
            ))}
          </HStack>

          {/* Camera */}
          <Box position="relative" w="640px" h="480px" bg="black" rounded="2xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
            {!faceDetected && cameraReady && (
              <Center position="absolute" inset={0} bg="blackAlpha.800">
                <Text color="white" fontSize="2xl" fontWeight="bold">HÃY NHÌN VÀO CAMERA</Text>
              </Center>
            )}
          </Box>

          {/* Question */}
          <Box p={10} bg="white" rounded="2xl" shadow="lg" w="full" maxW="900px">
            <Text fontSize="lg" color="gray.600" textAlign="center">Question {currentQ + 1}</Text>
            <Text fontSize="3xl" fontWeight="bold" textAlign="center" mt={4} color="gray.800">
              {questions[currentQ]}
            </Text>
            {recording && <Text mt={6} color="red.500" fontWeight="bold" fontSize="xl">Đang ghi âm...</Text>}
          </Box>

          {/* Buttons */}
          {!started && (
            <Button size="lg" colorScheme="teal" onClick={startCamera} leftIcon={<FaCamera />} px={24} py={8} fontSize="2xl">
              Bật Camera & Bắt Đầu
            </Button>
          )}
          {started && !finished && (
            <Button size="lg" colorScheme="teal" isLoading={recording} leftIcon={<FaMicrophone />} fontSize="xl">
              Đang lắng nghe...
            </Button>
          )}
        </VStack>

        {/* RIGHT – 3 Tabs */}
        <Box flex="1" bg="white" rounded="2xl" shadow="2xl" p={8}>
          <Tabs variant="soft-rounded" colorScheme="teal">
            <TabList>
              <Tab fontWeight="bold">Result</Tab>
              <Tab fontWeight="bold">Face Analysis</Tab>
              <Tab fontWeight="bold">AI Suggestion</Tab>
            </TabList>
            <TabPanels mt={6}>
              <TabPanel>
                {result ? (
                  <VStack align="start" spacing={4}>
                    <Text fontSize="7xl" fontWeight="bold" color={result.score >= 7 ? "green.500" : "red.500"}>
                      {result.score}/10
                    </Text>
                    <Text fontSize="2xl" fontWeight="semibold">{result.score >= 7 ? "PASS" : "Cần cải thiện"}</Text>
                  </VStack>
                ) : (
                  <Text color="gray.500">Hoàn thành để xem kết quả</Text>
                )}
              </TabPanel>
              <TabPanel>
                <Text fontSize="6xl" fontWeight="bold" color="teal.500">{emotion}</Text>
                <Text mt={4} color="gray.600">Phân tích cảm xúc realtime</Text>
              </TabPanel>
              <TabPanel>
                {result ? (
                  <Text whiteSpace="pre-wrap" lineHeight="1.8" fontSize="lg">
                    {result.suggestion}
                  </Text>
                ) : (
                  <Text color="gray.500">Gợi ý xuất hiện sau khi hoàn thành</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}