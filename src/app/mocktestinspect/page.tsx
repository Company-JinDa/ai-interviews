// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, Progress, IconButton, Alert, AlertIcon
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaPlay, FaArrowRight, FaMicrophone, FaStop } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import { addDoc, collection, updateDoc, serverTimestamp } from "firebase/firestore";

const faceapiPromise = import("@vladmandic/face-api");

export default function MockTestInspect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const faceDetectRaf = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const silenceTimer = useRef<number | null>(null);
  const interviewDocRef = useRef<any>(null);
  const faceApiRef = useRef<any>(null);

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
  const [emotionPercent, setEmotionPercent] = useState<any>({});
  const [loadingModels, setLoadingModels] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [amplitude, setAmplitude] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const finalTranscriptRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const questionStartTime = useRef(0);

  // Load face-api
  useEffect(() => {
    (async () => {
      const faceapi = await faceapiPromise;
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      faceApiRef.current = faceapi;
      setLoadingModels(false);
    })();
  }, []);

  useEffect(() => {
    try { setQuestions(JSON.parse(questionsJson)); }
    catch { router.push("/"); }
  }, [questionsJson, router]);

  // Face detection
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !faceApiRef.current || finished) return;
    const detect = async () => {
      if (finished || !videoRef.current) return;
      const detections = await faceApiRef.current.detectAllFaces(
        videoRef.current,
        new faceApiRef.current.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceExpressions();

      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.clearRect(0, 0, 640, 480);
      if (detections.length > 0) {
        const resized = faceApiRef.current.resizeResults(detections, { width: 640, height: 480 });
        faceApiRef.current.draw.drawDetections(canvasRef.current!, resized);
        faceApiRef.current.draw.drawFaceLandmarks(canvasRef.current!, resized);

        const expr = detections[0].expressions;
        const dominant = Object.keys(expr).reduce((a: any, b: any) => expr[a] > expr[b] ? a : b);
        setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
        setEmotionPercent(expr);
      }
      if (!finished) faceDetectRaf.current = requestAnimationFrame(detect);
    };
    faceDetectRaf.current = requestAnimationFrame(detect);
  }, [finished]);

  // Dọn dẹp hoàn toàn khi xong
  const cleanup = () => {
    setRecording(false);
    setFinished(true);

    if (faceDetectRaf.current) cancelAnimationFrame(faceDetectRaf.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (countdownTimer.current) clearInterval(countdownTimer.current);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);

    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    analyserRef.current?.disconnect();
    stream?.getTracks().forEach(t => t.stop());
  };

  const handleStart = async () => {
    if (started) return;
    setIsLoading(true);

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }

      const docRef = await addDoc(collection(db, "interviews"), {
        userId: auth.currentUser?.uid || "guest",
        level, role, questions,
        answers: [], emotionLog: [], result: null,
        createdAt: serverTimestamp(), finished: false
      });
      interviewDocRef.current = docRef;

      setStarted(true);
      setIsLoading(false);
      setTimeout(() => startQuestion(0), 1200);
    } catch {
      toast({ title: "Vui lòng cấp quyền Camera & Mic!", status: "error", duration: 6000 });
      setIsLoading(false);
    }
  };

  const speak = async (text: string) => {
    const res = await fetch("/api/tts", {
      method: "POST",
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" }
    });
    if (res.ok) {
      const { audioContent } = await res.json();
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      await audio.play();
      return new Promise(r => audio.onended = r);
    }
  };

  const startQuestion = async (idx: number) => {
    if (idx >= questions.length || finished) {
      finishInterview();
      return;
    }

    setCurrentQ(idx);
    setCountdown(60);
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    setRecording(false);
    questionStartTime.current = Date.now();

    // Đọc câu hỏi
    await speak(questions[idx]);

    // Bíp báo hiệu
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    o.frequency.value = 1200;
    o.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.12);

    // Bắt đầu ghi âm sau 400ms
    setTimeout(() => {
      setRecording(true);
      startRecording();
    }, 400);
  };

  const startRecording = () => {
    if (!stream) return;

    lastSpokenAtRef.current = Date.now();
    finalTranscriptRef.current = "";

    // Speech Recognition
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e: any) => {
        let final = "";
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            final += t + " ";
            finalTranscriptRef.current += t + " ";
            lastSpokenAtRef.current = Date.now();
          } else {
            interim += t;
          }
        }
        setLiveTranscript(finalTranscriptRef.current + interim);
      };

      rec.onerror = () => rec.start();
      rec.onend = () => recording && rec.start();
      rec.start();
      recognitionRef.current = rec;
    }

    const recorder = new MediaRecorder(stream);
    recorder.start();
    mediaRecorderRef.current = recorder;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      if (!recording) return;
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += Math.abs(dataArray[i] - 128);
      const avg = sum / dataArray.length / 128;
      setAmplitude(avg);
      if (avg > 0.02) lastSpokenAtRef.current = Date.now();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    // ĐẾM NGƯỢC CHUẨN 60 GIÂY NHƯ VIDEO
    countdownTimer.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - questionStartTime.current) / 1000);
      const remain = Math.max(60 - elapsed, 0);
      setCountdown(remain);
      if (remain <= 0) {
        clearInterval(countdownTimer.current!);
        stopRecording();
      }
    }, 200);

    // Im lặng 7s → next
    silenceTimer.current = window.setTimeout(() => {
      if (recording && Date.now() - lastSpokenAtRef.current > 7000) {
        stopRecording();
      }
    }, 8000);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);

    clearInterval(countdownTimer.current!);
    clearTimeout(silenceTimer.current!);
    cancelAnimationFrame(animationRef.current);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    analyserRef.current?.disconnect();

    const answer = finalTranscriptRef.current.trim() || "(Không trả lời)";
    setAnswers(prev => [...prev, answer]);
    setEmotionLog(prev => [...prev, currentEmotion]);

    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, {
        answers: [...answers, answer],
        emotionLog: [...emotionLog, currentEmotion],
        updatedAt: serverTimestamp()
      });
    }

    setTimeout(() => startQuestion(currentQ + 1), 1000);
  };

  const finishInterview = async () => {
    cleanup();
    setIsLoading(true);

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
        import("canvas-confetti").then(c => c.default({ particleCount: 1000, spread: 120, origin: { y: 0.6 } }));
      }
    } catch {
      toast({ title: "Lỗi đánh giá", status: "error" });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (started && !loadingModels) startFaceDetection();
  }, [started, loadingModels, startFaceDetection]);

  if (loadingModels || questions.length === 0) {
    return (
      <Center minH="100vh" bg="gray.50" flexDir="column">
        <Spinner size="xl" color="teal.500" thickness="6px" />
        <Text mt={6} fontSize="2xl" fontWeight="bold">Đang tải AI Pro...</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="lg">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" />
          <Text fontSize="3xl" fontWeight="extrabold" color="teal.600">AI-Interview Pro</Text>
        </HStack>
        <Badge colorScheme="teal" fontSize="lg" px={6} py={3} borderRadius="full">{level} • {role}</Badge>
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
              Question {currentQ + 1} / {questions.length}
            </Text>
            <Text textAlign="center" fontSize="3xl" fontWeight="bold" mt={4} lineHeight="1.6">
              {questions[currentQ]}
            </Text>

            {recording && (
              <VStack mt={10} spacing={8}>
                <HStack spacing={6} align="center">
                  <FaMicrophone size={36} color="red" />
                  <Text color="red.600" fontWeight="bold" fontSize="5xl">
                    Recording... {countdown}s
                  </Text>
                </HStack>

                <Box w="560px" h="140px" bg="gray.100" rounded="3xl" overflow="hidden" position="relative" shadow="2xl">
                  <Box
                    position="absolute" top="0" left="0" right="0" bottom="0"
                    bgGradient="linear(to-r, teal.500, cyan.500)" opacity="0.85"
                    width={`${Math.min(amplitude * 1400, 100)}%`}
                    transition="width 0.06s ease-out"
                  />
                  <Center h="full">
                    <Text fontSize="4xl" fontWeight="extrabold" color="teal.800">
                      {amplitude > 0.02 ? "Đang nói..." : "Hãy trả lời..."}
                    </Text>
                  </Center>
                </Box>

                {liveTranscript && (
                  <Box p={6} bg="teal.50" rounded="2xl" maxW="700px" border="4px dashed" borderColor="teal.300" shadow="lg">
                    <Text fontSize="xl" color="teal.800" textAlign="center" fontStyle="italic">
                      "{liveTranscript}"
                    </Text>
                  </Box>
                )}

                <IconButton
                  aria-label="Next"
                  icon={<FaArrowRight />}
                  size="lg"
                  colorScheme="teal"
                  rounded="full"
                  onClick={stopRecording}
                  boxShadow="0 10px 30px rgba(0,0,0,0.3)"
                  _hover={{ transform: "scale(1.3)" }}
                  transition="all 0.2s"
                />
              </VStack>
            )}
          </Box>

          {!started && (
            <Button onClick={handleStart} isLoading={isLoading} leftIcon={<FaPlay />} size="lg" colorScheme="teal" px={40} py={10} fontSize="3xl" fontWeight="bold" borderRadius="full" boxShadow="2xl">
              BẮT ĐẦU PHỎNG VẤN
            </Button>
          )}
        </VStack>

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
                    <Text fontSize="5xl" fontWeight="bold">{result.score >= 7 ? "PASS!" : "Cần cải thiện"}</Text>
                  </VStack>
                ) : <Text color="gray.500">Đang phỏng vấn...</Text>}
              </TabPanel>
              <TabPanel>
                <Text fontSize="8xl" fontWeight="bold" color="teal.500" textAlign="center">{currentEmotion}</Text>
                {Object.keys(emotionPercent).length > 0 && (
                  <VStack align="start" mt={6} spacing={5}>
                    {Object.entries(emotionPercent)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([k, v]: any) => (
                        <HStack key={k} w="full">
                          <Text w="140px" fontWeight="semibold">{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                          <Progress value={v * 100} flex="1" colorScheme="teal" height="32px" rounded="full" />
                          <Text w="70px" textAlign="right" fontWeight="bold" fontSize="lg">{(v * 100).toFixed(0)}%</Text>
                        </HStack>
                      ))}
                  </VStack>
                  
                )}
              </TabPanel>
              <TabPanel>
                {result ? (
                  <VStack align="start" spacing={6}>
                    {result.suggestion.split("\n\n").map((s: string, i: number) => (
                      <Box key={i} p={6} bg="gray.50" rounded="xl" border="3px solid" borderColor="gray.200" shadow="md">
                        <Text whiteSpace="pre-wrap" lineHeight="2" fontSize="lg">{s}</Text>
                      </Box>
                    ))}
                  </VStack>
                ) : <Text color="gray.500">Hoàn thành để xem gợi ý AI</Text>}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}