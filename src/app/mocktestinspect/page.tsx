// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, Progress, Alert, AlertIcon
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaMicrophone, FaCamera } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import * as faceapi from "@vladmandic/face-api";

export default function MockTestInspect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);

  const level = searchParams.get("level") || "Intern";
  const role = searchParams.get("role") || "Front-End";
  const questionsJson = searchParams.get("questions") || "[]";

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [emotionLog, setEmotionLog] = useState<string[]>([]); // Lưu cảm xúc từng câu
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [currentEmotion, setCurrentEmotion] = useState("Detecting...");
  const [emotionPercent, setEmotionPercent] = useState<any>({});
  const [loadingModels, setLoadingModels] = useState(true);

  // LOAD MODELS
  useEffect(() => {
    const load = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      setLoadingModels(false);
      toast({ title: "AI đã sẵn sàng!", status: "success" });
    };
    load();
  }, []);

  useEffect(() => {
    try { setQuestions(JSON.parse(questionsJson)); }
    catch { router.push("/"); }
  }, [questionsJson, router]);

  // BẬT CAMERA + DETECT REALTIME + % CẢM XÚC
  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setCameraReady(true);

      const detect = async () => {
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
          const percent = Math.round((expr as any)[dominant] * 100);

          setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
          setEmotionPercent(expr);
          setFaceDetected(true);
        } else {
          setFaceDetected(false);
          setCurrentEmotion("Không thấy khuôn mặt");
        }
        requestAnimationFrame(detect);
      };
      detect();
    }
  };

  // TTS ĐỌC CÂU HỎI
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

  // BẮT ĐẦU PHỎNG VẤN
  const handleStart = async () => {
    if (!faceDetected) return toast({ title: "Hãy nhìn vào camera!", status: "warning" });
    setStarted(true);
    await speak(questions[0]);
    startRecording();
  };

  // STT + TỰ ĐỘNG NEXT
  const startRecording = () => {
    setRecording(true);
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;

    let final = "";
    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
      }
      if (final.length > 10) {
        recognition.stop();
        nextQuestion(final.trim());
      }
    };
    recognition.onerror = () => recognition.start();
    recognition.start();
    recognitionRef.current = recognition;
  };

  // NEXT CÂU HỎI + LƯU CẢM XÚC
  const nextQuestion = async (answer: string) => {
    const newAnswers = [...answers, answer];
    const newLog = [...emotionLog, currentEmotion];
    setAnswers(newAnswers);
    setEmotionLog(newLog);

    if (currentQ + 1 >= questions.length) {
      finishInterview(newAnswers, newLog);
      return;
    }

    setCurrentQ(currentQ + 1);
    setTimeout(() => speak(questions[currentQ + 1]), 1500);
  };

  // HOÀN THÀNH + EVALUATE + LƯU FIREBASE
  const finishInterview = async (finalAnswers: string[], finalEmotions: string[]) => {
    setRecording(false);
    setFinished(true);

    const res = await fetch("/api/evaluate", {
      method: "POST",
      body: JSON.stringify({ questions, answers: finalAnswers, emotions: finalEmotions }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setResult(data);

    // Lưu Firebase có cả cảm xúc từng câu
    await addDoc(collection(db, "interviews"), {
      userId: auth.currentUser?.uid || "guest",
      level, role, questions, answers: finalAnswers,
      emotions: finalEmotions,
      result: data,
      createdAt: serverTimestamp(),
    });

    // CONFETTI KHI PASS
    if (data.score >= 7) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
      script.onload = () => (window as any).confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
      document.body.appendChild(script);
    }
  };

  if (loadingModels || questions.length === 0) return <Center minH="100vh"><Spinner size="xl" /><Text mt={4}>Đang tải AI...</Text></Center>;

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="lg">
        <HStack><Image src="/logo.png" boxSize="50px" borderRadius="full" fallbackSrc="https://via.placeholder.com/50" /><Text fontSize="2xl" fontWeight="bold" color="teal.600">AI-Interview</Text></HStack>
        <Badge colorScheme="teal" fontSize="lg" px={6} py={3}>{level} • {role}</Badge>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} gap={10} p={8}>
        <VStack flex="3" spacing={10}>
          <HStack spacing={6}>
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <Circle size="70px" bg={i <= currentQ ? "teal.500" : "gray.300"} color="white" fontWeight="bold" fontSize="2xl">{i + 1}</Circle>
                {i < questions.length - 1 && <Box w="120px" h="8px" bg={i < currentQ ? "teal.500" : "gray.300"} rounded="full" />}
              </React.Fragment>
            ))}
          </HStack>

          <Box position="relative" w="640px" h="480px" bg="black" rounded="2xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
            {!faceDetected && cameraReady && (
              <Center position="absolute" inset={0} bg="blackAlpha.900">
                <Text color="white" fontSize="3xl" fontWeight="bold">HÃY NHÌN VÀO CAMERA</Text>
              </Center>
            )}
          </Box>

          <Box p={10} bg="white" rounded="2xl" shadow="lg" w="full">
            <Text fontSize="lg" color="gray.600" textAlign="center">Question {currentQ + 1}</Text>
            <Text fontSize="3xl" fontWeight="bold" textAlign="center" mt={4}>{questions[currentQ]}</Text>
            {recording && <Text mt={6} color="red.500" fontWeight="bold" fontSize="2xl">Đang ghi âm...</Text>}
          </Box>

          {!cameraReady && <Button size="lg" colorScheme="teal" onClick={startCamera} leftIcon={<FaCamera />} px={24} py={8} fontSize="2xl">BẬT CAMERA</Button>}
          {cameraReady && !started && faceDetected && <Button size="lg" colorScheme="teal" onClick={handleStart} px={32} py={10} fontSize="3xl">BẮT ĐẦU</Button>}
        </VStack>

        <Box flex="1" bg="white" rounded="2xl" shadow="2xl" p={8}>
          <Tabs variant="soft-rounded" colorScheme="teal">
            <TabList><Tab>Kết quả</Tab><Tab>Phân tích khuôn mặt</Tab><Tab>Gợi ý AI</Tab></TabList>
            <TabPanels mt={6}>
              <TabPanel>
                {result ? (
                  <VStack>
                    <Text fontSize="8xl" fontWeight="bold" color={result.score >= 7 ? "green.500" : "red.500"}>{result.score}/10</Text>
                    <Text fontSize="3xl">{result.score >= 7 ? "PASS" : "Cần cải thiện"}</Text>
                  </VStack>
                ) : <Text color="gray.500">Hoàn thành để xem kết quả</Text>}
              </TabPanel>
              <TabPanel>
                <Text fontSize="6xl" fontWeight="bold" color="teal.500">{currentEmotion}</Text>
                {faceDetected && (
                  <VStack align="start" mt={4} spacing={2}>
                    {Object.entries(emotionPercent).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([emo, val]: any) => (
                      <HStack key={emo} w="full">
                        <Text w="100px">{emo.charAt(0).toUpperCase() + emo.slice(1)}</Text>
                        <Progress value={val * 100} flex="1" colorScheme="teal" rounded="full" />
                        <Text w="50px" textAlign="right">{Math.round(val * 100)}%</Text>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </TabPanel>
              <TabPanel>
                {result ? <Text whiteSpace="pre-wrap" lineHeight="2">{result.suggestion}</Text> : <Text color="gray.500">Sẽ hiện sau khi hoàn thành</Text>}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}