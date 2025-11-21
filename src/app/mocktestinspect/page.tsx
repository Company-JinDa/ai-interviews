// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, Progress, IconButton
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaPlay, FaArrowRight } from "react-icons/fa";
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
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const interviewDocRef = useRef<any>(null);
  const faceApiRef = useRef<any>(null);

  const level = searchParams.get("level") || "Intern";
  const role = searchParams.get("role") || "Front-End";
  const questionsJson = searchParams.get("questions") || "[]";

  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [emotionLog, setEmotionLog] = useState<string[]>([]);
  const [faceDetected, setFaceDetected] = useState(false);
  const [started, setStarted] = useState(false);
  const [recording, setRecording] = useState(false); // QUAN TRỌNG: phải bật true khi bắt đầu trả lời
  const [finished, setFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [currentEmotion, setCurrentEmotion] = useState("Detecting...");
  const [emotionPercent, setEmotionPercent] = useState<any>({});
  const [loadingModels, setLoadingModels] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [amplitude, setAmplitude] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const finalTranscriptRef = useRef("");
  const lastSpokenAtRef = useRef(0);
  const recordingStartedAtRef = useRef(0);

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

  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !faceApiRef.current || finished) return;

    const detect = async () => {
      if (!videoRef.current || finished) return;
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
        const dominant = Object.keys(expr).reduce((a: any, b: any) => (expr as any)[a] > (expr as any)[b] ? a : b);
        setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
        setEmotionPercent(expr);
        setFaceDetected(true);
      } else {
        setFaceDetected(false);
      }

      if (!finished) requestAnimationFrame(detect);
    };
    detect();
  }, [finished]);

  const handleStart = async () => {
    if (started) return;
    setIsLoading(true);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
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
      // BẮT ĐẦU CÂU HỎI ĐẦU TIÊN
      setTimeout(() => startQuestion(0), 1500);
    } catch (err) {
      toast({ title: "Cần cấp quyền Camera & Mic!", status: "error", duration: 8000 });
      setIsLoading(false);
    }
  };

  const speak = async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "Content-Type": "application/json" }
      });
      if (res.ok) {
        const { audioContent } = await res.json();
        const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
        await audio.play();
        await new Promise(r => audio.onended = r);
      }
    } catch {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      speechSynthesis.speak(utter);
      await new Promise(r => utter.onend = r);
    }
  };

  const startQuestion = async (idx: number) => {
    if (idx >= questions.length) {
      finishInterview();
      return;
    }

    setCurrentQ(idx);
    setCountdown(60);
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    setRecording(false); // reset

    // Đọc câu hỏi
    await speak(questions[idx]);

    // Bíp 1 tiếng rồi bắt đầu ghi âm
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = 800; g.gain.value = 0.1;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.2);

    // CHỜ 1 GIÂY RỒI BẮT ĐẦU GHI ÂM + HIỆN UI
    setTimeout(() => {
      setRecording(true); // QUAN TRỌNG: bật recording để hiện UI
      startRecording();
    }, 1200);
  };

  const startRecording = () => {
    if (!stream) return;

    lastSpokenAtRef.current = Date.now();
    recordingStartedAtRef.current = Date.now();
    audioChunksRef.current = [];
    finalTranscriptRef.current = "";
    setLiveTranscript("");

    // Speech Recognition
    if ("webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        let final = "", interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript.trim();
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

    // MediaRecorder
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => e.data.size > 0 && audioChunksRef.current.push(e.data);
    recorder.start();
    mediaRecorderRef.current = recorder;

    // Waveform
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      if (avg > 0.03) lastSpokenAtRef.current = Date.now();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    // Countdown
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timer);
          stopRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    // Auto next khi im lặng 7s
    const check = () => {
      if (!recording) return;
      const now = Date.now();
      if (now - lastSpokenAtRef.current > 7000 && now - recordingStartedAtRef.current > 8000) {
        stopRecording();
      } else {
        setTimeout(check, 1000);
      }
    };
    setTimeout(check, 5000);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);
    cancelAnimationFrame(animationRef.current);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    analyserRef.current?.disconnect();

    let transcript = finalTranscriptRef.current.trim() || "(Không trả lời)";

    setAnswers(prev => [...prev, transcript]);
    setEmotionLog(prev => [...prev, currentEmotion]);

    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, {
        answers: [...answers, transcript],
        emotionLog: [...emotionLog, currentEmotion],
        updatedAt: serverTimestamp()
      });
    }

    setTimeout(() => startQuestion(currentQ + 1), 1500);
  };

  const finishInterview = async () => {
    setFinished(true);
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
        await updateDoc(interviewDocRef.current, { result: data, finished: true, finishedAt: serverTimestamp() });
      }
      if (data.score >= 7) {
        import("canvas-confetti").then(confetti => confetti.default({ particleCount: 600, spread: 120 }));
      }
    } catch {
      toast({ title: "Lỗi đánh giá", status: "error" });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (started && !loadingModels) startFaceDetection();
  }, [started, loadingModels, startFaceDetection]);

  if (questions.length === 0 || loadingModels) {
    return (
      <Center minH="100vh" bg="gray.50" flexDir="column">
        <Spinner size="xl" color="teal.500" thickness="6px" />
        <Text mt={6} fontSize="2xl" fontWeight="bold">Đang tải AI Pro...</Text>
      </Center>
    );
  }

  return (
    <Box minH="100vh" bg="gray.50">
      {/* Header */}
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="lg">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" />
          <Text fontSize="3xl" fontWeight="extrabold" color="teal.600">AI-Interview Pro</Text>
        </HStack>
        <Badge colorScheme="teal" fontSize="lg" px={6} py={3} borderRadius="full">{level} • {role}</Badge>
      </Flex>

      <Flex direction={{ base: "column", lg: "row" }} gap={10} p={8}>
        <VStack flex="3" spacing={8}>
          {/* Progress bar */}
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

          {/* Video + Face API */}
          <Box position="relative" w="640px" h="480px" bg="black" rounded="3xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
            {!faceDetected && started && (
              <Center position="absolute" inset={0} bg="blackAlpha.800">
                <Text color="white" fontSize="5xl" fontWeight="bold">
                  HÃY NHÌN VÀO CAMERA
                </Text>
              </Center>
            )}
          </Box>

          {/* Question + Recording UI */}
          <Box p={8} bg="white" rounded="3xl" shadow="2xl" w="full">
            <Text textAlign="center" fontSize="lg" color="gray.600">
              Question {currentQ + 1} / {questions.length}
            </Text>
            <Text textAlign="center" fontSize="3xl" fontWeight="bold" mt={4}>
              {questions[currentQ]}
            </Text>

            {/* ĐÂY LÀ PHẦN BẠN ĐANG THIẾU – BÂY GIỜ HIỆN ĐẦY ĐỦ! */}
            {recording && (
              <VStack mt={8} spacing={6}>
                <Text color="red.500" fontWeight="bold" fontSize="4xl">
                  Recording... {countdown}s
                </Text>

                {/* Sóng âm thanh */}
                <Box w="500px" h="120px" bg="gray.100" rounded="2xl" overflow="hidden" position="relative" shadow="lg">
                  <Box
                    position="absolute"
                    top="0" left="0" right="0" bottom="0"
                    bgGradient="linear(to-r, teal.400, cyan.400)"
                    opacity="0.8"
                    width={`${Math.min(amplitude * 1200, 100)}%`}
                    transition="width 0.08s ease-out"
                  />
                  <Center h="full">
                    <Text fontSize="3xl" fontWeight="bold" color="teal.700">
                      {amplitude > 0.03 ? "Đang nói..." : "Đang chờ bạn nói..."}
                    </Text>
                  </Center>
                </Box>

                {/* Live STT */}
                {liveTranscript && (
                  <Box p={5} bg="teal.50" rounded="xl" maxW="700px" border="3px dashed" borderColor="teal.300">
                    <Text fontStyle="italic" color="teal.800" fontSize="lg" textAlign="center">
                      "{liveTranscript}"
                    </Text>
                  </Box>
                )}

                {/* Nút Next thủ công */}
                <IconButton
                  aria-label="Next question"
                  icon={<FaArrowRight />}
                  size="lg"
                  colorScheme="teal"
                  rounded="full"
                  onClick={stopRecording}
                  boxShadow="2xl"
                  _hover={{ transform: "scale(1.2)" }}
                />
              </VStack>
            )}
          </Box>

          {/* Nút bắt đầu */}
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
              BẮT ĐẦU PHỎNG VẤN
            </Button>
          )}
        </VStack>

        {/* Sidebar */}
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
                ) : <Text color="gray.500">Đang phỏng vấn...</Text>}
              </TabPanel>
              <TabPanel>
                <Text fontSize="7xl" fontWeight="bold" color="teal.500" textAlign="center">{currentEmotion}</Text>
                {faceDetected && Object.keys(emotionPercent).length > 0 && (
                  <VStack align="start" mt={6} spacing={4}>
                    {Object.entries(emotionPercent)
                      .sort((a: any, b: any) => b[1] - a[1])
                      .map(([k, v]: any) => (
                        <HStack key={k} w="full">
                          <Text w="130px">{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
                          <Progress value={v * 100} flex="1" colorScheme="teal" height="28px" rounded="full" />
                          <Text w="60px" textAlign="right" fontWeight="bold">{(v * 100).toFixed(0)}%</Text>
                        </HStack>
                      ))}
                  </VStack>
                )}
              </TabPanel>
              <TabPanel>
                {result ? (
                  <VStack align="start" spacing={5}>
                    {result.suggestion.split("\n\n").map((s: string, i: number) => (
                      <Box key={i} p={5} bg="gray.50" rounded="xl" border="2px solid" borderColor="gray.200">
                        <Text whiteSpace="pre-wrap" lineHeight="1.8">{s}</Text>
                      </Box>
                    ))}
                  </VStack>
                ) : <Text color="gray.500">Hoàn thành để xem gợi ý</Text>}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}