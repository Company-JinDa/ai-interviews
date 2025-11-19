// src/app/mocktest5/page.tsx
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
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaMicrophone, FaCamera } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import {
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

// Dùng CDN face-api.js → KHÔNG CẦN CÀI NPM, KHÔNG LỖI TYPE
declare global {
  interface Window {
    faceapi: any;
  }
}

export default function MockTest5() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);

  const level = searchParams.get("level") || "";
  const role = searchParams.get("role") || "";
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

  // Load face-api từ CDN
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api.js@1.7.10/dist/face-api.min.js";
    script.async = true;
    script.onload = () => {
      console.log("face-api.js loaded");
      loadModels();
    };
    document.body.appendChild(script);

    const loadModels = async () => {
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api.js@1.7.10/weights";
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      await window.faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    };

    return () => {
      document.body.removeChild(script);
    };
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

  // Bật camera + mic + face detection
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraReady(true);

        // Face detection loop
        const detect = async () => {
          if (!videoRef.current || !canvasRef.current || finished) return;

          const detections = await window.faceapi
            .detectAllFaces(videoRef.current, new window.faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
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
              setEmotion("No face detected");
              setFaceDetected(false);
            }
          }
          requestAnimationFrame(detect);
        };
        detect();
      }
    } catch (err) {
      toast({
        title: "Camera & Mic Required!",
        description: "Please allow access to continue.",
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
      toast({ title: "Please look at the camera!", status: "warning" });
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

  // Ghi âm + tự động next khi nói xong
  const startRecording = () => {
    setRecording(true);
    if ("webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = "";

      recognition.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          recognition.stop();
          nextQuestion(finalTranscript.trim());
        }
      };

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
  };

  if (questions.length === 0) return <Center minH="100vh"><Spinner size="xl" /></Center>;

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="md">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" fallbackSrc="https://via.placeholder.com/50" />
          <Text fontSize="2xl" fontWeight="extrabold" color="teal.600">AI-Interview</Text>
        </HStack>
        <Text fontWeight="bold" color="gray.700">{level} • {role}</Text>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} minH="calc(100vh - 80px)" gap={10} p={8}>
        {/* LEFT: Camera + Question */}
        <VStack flex="3" spacing={10}>
          {/* Progress Circles */}
          <HStack justify="center" spacing={6}>
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <Circle
                  size="70px"
                  bg={i <= currentQ ? "teal.500" : "gray.300"}
                  color="white"
                  fontSize="2xl"
                  fontWeight="bold"
                  boxShadow="xl"
                >
                  {i + 1}
                </Circle>
                {i < questions.length - 1 && (
                  <Box w="120px" h="8px" bg={i < currentQ ? "teal.500" : "gray.300"} borderRadius="full" />
                )}
              </React.Fragment>
            ))}
          </HStack>

          {/* Camera */}
          <Box position="relative" w="640px" h="480px" bg="black" rounded="2xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
            {!faceDetected && cameraReady && (
              <Center position="absolute" inset={0} bg="blackAlpha.800">
                <Text color="white" fontSize="2xl" fontWeight="bold">Please show your face</Text>
              </Center>
            )}
          </Box>

          {/* Current Question */}
          <Box p={10} bg="white" rounded="2xl" shadow="lg" w="full" maxW="900px">
            <Text fontSize="lg" color="gray.600" textAlign="center" mb={4}>
              Question {currentQ + 1} / {questions.length}
            </Text>
            <Text fontSize="3xl" fontWeight="bold" textAlign="center" color="gray.800">
              {questions[currentQ]}
            </Text>
          </Box>

          {/* Start Button */}
          {!started && (
            <Button
              size="lg"
              colorScheme="teal"
              px={20}
              py={8}
              fontSize="2xl"
              leftIcon={<FaCamera />}
              onClick={startCamera}
              isDisabled={cameraReady}
            >
              {cameraReady ? "Look at camera → Start" : "Turn On Camera"}
            </Button>
          )}

          {started && !finished && (
            <Button size="lg" colorScheme="teal" isLoading={recording} leftIcon={<FaMicrophone />}>
              Listening...
            </Button>
          )}
        </VStack>

        {/* RIGHT: 3 Tabs */}
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
                    <Text fontSize="6xl" fontWeight="bold" color={result.score >= 7 ? "green.500" : "red.500"}>
                      {result.score}/10
                    </Text>
                    <Text fontSize="xl">{result.feedback}</Text>
                  </VStack>
                ) : (
                  <Text color="gray.500">Complete all questions to see result</Text>
                )}
              </TabPanel>
              <TabPanel>
                <Text fontSize="5xl" fontWeight="bold" color="teal.500">{emotion}</Text>
                <Text mt={4} color="gray.600">Real-time emotion detection</Text>
              </TabPanel>
              <TabPanel>
                {result ? (
                  <Text whiteSpace="pre-wrap" fontSize="lg">{result.suggestion}</Text>
                ) : (
                  <Text color="gray.500">AI suggestions appear after completion</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}