// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, Progress, Alert, AlertIcon
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaMicrophone, FaCamera, FaPlay } from "react-icons/fa";
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

  const level = searchParams.get("level") || "Intern";
  const role = searchParams.get("role") || "Front-End";
  const questionsJson = searchParams.get("questions") || "[]";

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [emotionLog, setEmotionLog] = useState<string[]>([]);
  const [cameraReady, setCameraReady] = useState(false);
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
  const [retryQuestion, setRetryQuestion] = useState<number | null>(null);

  // === LOAD FACE-API MODELS ===
  useEffect(() => {
    const load = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      setLoadingModels(false);
      toast({ title: "AI Face Detection đã sẵn sàng!", status: "success" });
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

  // === CAMERA + FACE DETECTION REALTIME ===
  const startCamera = async () => {
    try {
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
            setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
            setEmotionPercent(expr);
            setFaceDetected(true);
          } else {
            setFaceDetected(false);
            setCurrentEmotion("No face");
          }
          if (!finished) requestAnimationFrame(detect);
        };
        detect();
      }
    } catch (err) {
      toast({ title: "Không thể bật camera/mic", status: "error" });
    }
  };

  // === TTS - ĐỌC CÂU HỎI ===
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
    } catch (err) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      speechSynthesis.speak(utter);
    }
  };

  // === BẮT ĐẦU PHỎNG VẤN ===
  const handleStart = async () => {
    if (!faceDetected) return toast({ title: "Hãy nhìn thẳng vào camera!", status: "warning" });
    setStarted(true);
    setCountdown(60);

    // Tạo interview record
    try {
      const docRef = await addDoc(collection(db, "interviews"), {
        userId: auth.currentUser?.uid || "guest",
        level, role, questions,
        answers: [], emotionLog: [], result: null,
        createdAt: serverTimestamp(),
        finished: false,
      });
      setInterviewId(docRef.id);
    } catch (err) { console.error(err); }

    await speak(questions[0]);
    setTimeout(() => startRecording(), 1000);
  };

  // === RECORDING THÔNG MINH ===
  const startRecording = async () => {
    setRecording(true);
    setCountdown(60);
    lastSpokenAtRef.current = Date.now();
    recordingStartedAtRef.current = Date.now();
    audioChunksRef.current = [];

    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    // Web Speech Recognition (fallback + live)
    if ("webkitSpeechRecognition" in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (e: any) => {
        let final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        }
        if (final) lastSpokenAtRef.current = Date.now();
      };
      recognition.onerror = () => recognition.start();
      recognition.onend = () => recording && recognition.start();
      recognition.start();
      recognitionRef.current = recognition;
    }

    // MediaRecorder fallback
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = e => e.data.size > 0 && audioChunksRef.current.push(e.data);
    recorder.start();
    mediaRecorderRef.current = recorder;

    // Timer + Silence Detection
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { stopRecording(); return 0; }
        return c - 1;
      });
    }, 1000);

    const checkSilence = () => {
      if (!recording) return;
      const now = Date.now();
      if (now - lastSpokenAtRef.current > 8000 && now - recordingStartedAtRef.current > 8000) {
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
          try {
            const res = await fetch("/api/stt", {
              method: "POST",
              body: JSON.stringify({ audio: base64 }),
              headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            resolve(data.transcription || "");
          } catch {
            resolve("");
          }
        };
        reader.readAsDataURL(blob);
      });
    }

    await saveAnswerAndNext(transcript.trim() || "(No answer)");
  };

  // === LƯU + NEXT ===
  const saveAnswerAndNext = async (answer: string) => {
    const newAnswers = [...answers, answer];
    const newEmotions = [...emotionLog, currentEmotion];
    setAnswers(newAnswers);
    setEmotionLog(newEmotions);

    // Update Firebase
    if (interviewId) {
      await updateDoc(doc(db, "interviews", interviewId), {
        answers: newAnswers,
        emotionLog: newEmotions,
        updatedAt: serverTimestamp(),
      });
    }

    if (currentQ + 1 >= questions.length) {
      finishInterview(newAnswers, newEmotions);
    } else {
      setCurrentQ(currentQ + 1);
      setCountdown(60);
      await speak(questions[currentQ + 1]);
      setTimeout(() => startRecording(), 1500);
    }
  };

  // === HOÀN THÀNH + EVALUATE ===
  const finishInterview = async (finalAnswers: string[], finalEmotions: string[]) => {
    setRecording(false);
    setFinished(true);
    setIsLoading(true);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions, answers: finalAnswers }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setResult(data);

      if (interviewId) {
        await updateDoc(doc(db, "interviews", interviewId), {
          result: data,
          finished: true,
          finishedAt: serverTimestamp(),
        });
      }

      // CONFETTI
      if (data.score >= 7) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
        script.onload = () => (window as any).confetti({ particleCount: 300, spread: 100, origin: { y: 0.6 } });
        document.body.appendChild(script);
      }
    } catch (err) {
      toast({ title: "Lỗi đánh giá", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // === RETRY CÂU HỎI ===
  const handleRetry = async (idx: number) => {
    setRetryQuestion(idx);
    setCurrentQ(idx);
    setStarted(true);
    setFinished(false);
    setCountdown(60);
    await speak(questions[idx]);
    setTimeout(() => startRecording(), 1000);
  };

  if (loadingModels || questions.length === 0) {
    return (
      <Center minH="100vh" flexDir="column">
        <Spinner size="xl" color="teal.500" thickness="4px" />
        <Text mt={4} fontSize="xl">Đang tải AI Face Detection...</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="lg">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" />
          <Text fontSize="2xl" fontWeight="bold" color="teal.600">AI-Interview Pro</Text>
        </HStack>
        <Badge colorScheme="teal" fontSize="lg" px={6} py={3}>{level} • {role}</Badge>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} gap={10} p={8}>
        <VStack flex="3" spacing={10}>
          {/* Progress Circles */}
          <HStack spacing={6} flexWrap="wrap" justify="center">
            {questions.map((_, i) => (
              <React.Fragment key={i}>
                <Circle size="70px" bg={i <= currentQ ? "teal.500" : "gray.300"} color="white" fontWeight="bold" fontSize="2xl">
                  {i + 1}
                </Circle>
                {i < questions.length - 1 && <Box w="120px" h="8px" bg={i < currentQ ? "teal.500" : "gray.300"} rounded="full" />}
              </React.Fragment>
            ))}
          </HStack>

          {/* Video + Canvas */}
          <Box position="relative" w="640px" h="480px" bg="black" rounded="2xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
            {!faceDetected && cameraReady && (
              <Center position="absolute" inset={0} bg="blackAlpha.900">
                <Text color="white" fontSize="3xl" fontWeight="bold">HÃY NHÌN VÀO CAMERA</Text>
              </Center>
            )}
          </Box>

          {/* Question Box */}
          <Box p={10} bg="white" rounded="2xl" shadow="lg" w="full" textAlign="center">
            <Text fontSize="lg" color="gray.600">Question {currentQ + 1} / {questions.length}</Text>
            <Text fontSize="3xl" fontWeight="bold" mt={4}>{questions[currentQ]}</Text>
            {recording && (
              <Text mt={6} color="red.500" fontWeight="bold" fontSize="2xl">
                Recording... ({countdown}s)
              </Text>
            )}
          </Box>

          {/* Buttons */}
          {!cameraReady && (
            <Button size="lg" colorScheme="teal" onClick={startCamera} leftIcon={<FaCamera />} px={24} py={8} fontSize="2xl">
              BẬT CAMERA & MIC
            </Button>
          )}
          {cameraReady && !started && faceDetected && (
            <Button size="lg" colorScheme="teal" onClick={handleStart} leftIcon={<FaPlay />} px={32} py={10} fontSize="3xl">
              BẮT ĐẦU PHỎNG VẤN
            </Button>
          )}
          {recording && (
            <Button size="lg" colorScheme="orange" onClick={stopRecording}>
              Dừng & Chuyển câu
            </Button>
          )}
        </VStack>

        {/* Right Panel */}
        <Box flex="1" bg="white" rounded="2xl" shadow="2xl" p={8}>
          <Tabs variant="soft-rounded" colorScheme="teal">
            <TabList>
              <Tab>Kết quả</Tab>
              <Tab>Cảm xúc</Tab>
              <Tab>Gợi ý AI</Tab>
            </TabList>
            <TabPanels mt={6}>
              <TabPanel>
                {result ? (
                  <VStack spacing={6}>
                    <Text fontSize="8xl" fontWeight="bold" color={result.score >= 7 ? "green.500" : "red.500"}>
                      {result.score}/10
                    </Text>
                    <Text fontSize="3xl">{result.score >= 7 ? "PASS!" : "Cần cải thiện"}</Text>
                    <Text color="gray.600">{result.feedback}</Text>
                  </VStack>
                ) : (
                  <Text color="gray.500">Hoàn thành để xem kết quả</Text>
                )}
              </TabPanel>

              <TabPanel>
                <Text fontSize="6xl" fontWeight="bold" color="teal.500" textAlign="center">
                  {currentEmotion}
                </Text>
                {faceDetected && Object.keys(emotionPercent).length > 0 && (
                  <VStack align="start" mt={6} spacing={3}>
                    {Object.entries(emotionPercent)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([emo, val]: any) => (
                        <HStack key={emo} w="full">
                          <Text w="120px" fontSize="sm">{emo.charAt(0).toUpperCase() + emo.slice(1)}</Text>
                          <Progress value={val * 100} flex="1" colorScheme="teal" rounded="full" />
                          <Text w="50px" textAlign="right" fontWeight="bold">{Math.round(val * 100)}%</Text>
                        </HStack>
                      ))}
                  </VStack>
                )}
              </TabPanel>

              <TabPanel>
                {result ? (
                  <VStack align="start" spacing={4}>
                    {result.suggestion.split("\n\n").map((sug: string, i: number) => (
                      <Box key={i} p={4} bg="gray.50" rounded="lg" border="1px solid" borderColor="gray.200">
                        <Text whiteSpace="pre-wrap" fontSize="sm" lineHeight="1.7">{sug}</  Text>
                        {finished && (
                          <Button mt={2} size="sm" colorScheme="teal" onClick={() => handleRetry(i)}>
                            Thử lại câu này
                          </Button>
                        )}
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Text color="gray.500">Sẽ hiện sau khi hoàn thành</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}