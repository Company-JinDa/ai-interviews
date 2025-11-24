// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Tabs, TabList, Tab, TabPanels, TabPanel,
  Center, Spinner, useToast, Image, Badge, Progress, IconButton
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

  // Cấu hình pro
  const SILENCE_THRESHOLD = 0.008;
  const SILENCE_TIMEOUT = 60000;
  const MIN_RECORDING_TIME = 1000;
  const RECORDING_START_DELAY = 500;

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
  const [emotionPercent, setEmotionPercent] = useState<any>({});
  const [loadingModels, setLoadingModels] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [amplitude, setAmplitude] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);

  // ==================== DYNAMIC IMPORT FACE-API (Fix SSR + Critical Dependency) ====================
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
    }).catch(() => {
      if (mounted) setLoadingModels(false);
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

  // ==================== FACE DETECTION (Safe) ====================
  const startFaceDetection = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || loadingModels || finished) return;
    const faceapi = (window as any).faceapi;
    if (!faceapi) return;

    const detect = async () => {
      if (!videoRef.current || finished) return;
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceExpressions();

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
          const displaySize = { width: 640, height: 480 };
          const resized = faceapi.resizeResults(detections, displaySize);
          faceapi.draw.drawDetections(canvas, resized);
          faceapi.draw.drawFaceLandmarks(canvas, resized);

          const expr = detections[0].expressions;
          const dominant = Object.keys(expr).reduce((a: any, b: any) => expr[a] > expr[b] ? a : b);
          setCurrentEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
          setEmotionPercent(expr);
        }

        faceDetectRaf.current = requestAnimationFrame(detect);
      } catch (err) {
        // Ignore occasional errors
      }
    };
    faceDetectRaf.current = requestAnimationFrame(detect);
  }, [finished, loadingModels]);

  // ==================== TTS + BEEP ====================
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
        await new Promise(r => { audio.onended = r; audio.play().catch(() => r); });
      }
    } catch {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      speechSynthesis.speak(utter);
      await new Promise(r => utter.onend = r);
    }
  };

  const playBeep = () => {
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 1000;
      g.gain.value = 0.15;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => o.stop(), 120);
    } catch {}
  };

  // ==================== START INTERVIEW ====================
  const handleStart = async () => {
    if (started) return;
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

      const docRef = await addDoc(collection(db, "interviews"), {
        userId: auth.currentUser?.uid || "guest",
        level, role, questions,
        answers: [], emotionLog: [], result: null,
        createdAt: serverTimestamp(), finished: false
      });
      interviewDocRef.current = docRef;

      setStarted(true);
      setIsLoading(false);
      setTimeout(() => startQuestion(0), 1000);
    } catch (err) {
      toast({ title: "Cần cấp quyền Camera & Mic!", status: "error", duration: 5000 });
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
    setCountdown(60);
    setLiveTranscript("");
    finalTranscriptRef.current = "";
    setRecording(false);
    setAmplitude(0);

    await speak(questions[idx]);
    playBeep();

    setRecording(true);
    setTimeout(startRecording, RECORDING_START_DELAY);
  };

  // ==================== START RECORDING – SIÊU ỔN ĐỊNH ====================
  const startRecording = () => {
    if (!stream || !recording) return;

    recordingStartTimeRef.current = Date.now();
    lastSpokenAtRef.current = Date.now();
    audioChunksRef.current = [];
    finalTranscriptRef.current = "";

    // Speech Recognition - chỉ khởi tạo 1 lần
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e: any) => {
        let final = "", interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript.trim();
          if (e.results[i].isFinal) final += t + " ";
          else interim += t;
        }
        if (final) {
          finalTranscriptRef.current += final;
          lastSpokenAtRef.current = Date.now();
        }
        setLiveTranscript(finalTranscriptRef.current + interim);
      };

      rec.onerror = (e: any) => {
        if (e.error === "not-allowed") toast({ title: "Mic bị chặn", status: "error" });
      };

      rec.onend = () => {
        if (recording) rec.start();
      };

      try {
        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.warn("SpeechRecognition already started or failed");
      }
    }

    // MediaRecorder
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("MediaRecorder failed to start");
    }

    // Amplitude monitoring
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;

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

      const elapsed = Date.now() - recordingStartTimeRef.current;
      if (elapsed > MIN_RECORDING_TIME && Date.now() - lastSpokenAtRef.current > SILENCE_TIMEOUT) {
        stopRecording();
        return;
      }

      monitorRaf.current = requestAnimationFrame(monitor);
    };
    monitor();

    // Countdown chính xác
    countdownInterval.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
      const remain = Math.max(60 - elapsed, 0);
      setCountdown(remain);
      if (remain <= 0) stopRecording();
    }, 100);
  };

  // ==================== STOP RECORDING ====================
  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);

    clearInterval(countdownInterval.current!);
    cancelAnimationFrame(monitorRaf.current!);
    recognitionRef.current?.stop();
    mediaRecorderRef.current?.stop();
    audioContextRef.current?.close();

    const text = finalTranscriptRef.current.trim() || "(Không trả lời)";
    const newAnswers = [...answers, text];
    setAnswers(newAnswers);
    setEmotionLog(prev => [...prev, currentEmotion]);

    if (interviewDocRef.current) {
      await updateDoc(interviewDocRef.current, {
        answers: newAnswers,
        emotionLog: [...emotionLog, currentEmotion],
        updatedAt: serverTimestamp()
      });
    }

    setTimeout(() => startQuestion(currentQ + 1), 800);
  };

  // ==================== FINISH ====================
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
        confetti({ particleCount: 800, spread: 100, origin: { y: 0.6 } });
      }
    } catch (err) {
      toast({ title: "Lỗi đánh giá", status: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (started && !loadingModels) startFaceDetection();
  }, [started, loadingModels, startFaceDetection]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      cancelAnimationFrame(faceDetectRaf.current!);
      cancelAnimationFrame(monitorRaf.current!);
      clearInterval(countdownInterval.current!);
    };
  }, []);

  // ==================== RENDER ====================
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
          {/* Progress */}
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

          {/* Video */}
          <Box position="relative" w="640px" h="480px" bg="black" rounded="3xl" overflow="hidden" shadow="2xl">
            <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
            <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0" />
          </Box>

          {/* Question + Recording UI */}
          <Box p={8} bg="white" rounded="3xl" shadow="2xl" w="full">
            <Text textAlign="center" fontSize="lg" color="gray.600">
              Question {currentQ + 1} / {questions.length}
            </Text>
            <Text textAlign="center" fontSize="3xl" fontWeight="bold" mt={4} lineHeight="1.6">
              {questions[currentQ] || "Đang tải câu hỏi..."}
            </Text>

            {recording && (
              <VStack mt={12} spacing={10}>
                <HStack spacing={6}>
                  <FaMicrophone size={40} color="red" className="animate-pulse" />
                  <Text color="red.600" fontWeight="bold" fontSize="5xl">
                    Recording... {countdown}s
                  </Text>
                </HStack>

                <Box w="500px" h="120px" bg="gray.100" rounded="full" overflow="hidden" position="relative" shadow="xl">
                  <Box
                    position="absolute" top="0" left="0" right="0" bottom="0"
                    bgGradient="linear(to-r, teal.400, cyan.500)"
                    opacity="0.9"
                    width={`${Math.min(amplitude * 800, 100)}%`}
                    transition="width 0.05s ease-out"
                  />
                  <Center h="full">
                    <Text fontSize="4xl" fontWeight="black" color="white" textShadow="2px 2px 10px rgba(0,0,0,0.5)">
                      {amplitude > 0.01 ? "Đang nói..." : "Hãy trả lời..."}
                    </Text>
                  </Center>
                </Box>

                {liveTranscript && (
                  <Box p={5} bg="teal.50" rounded="2xl" maxW="700px" border="4px dashed" borderColor="teal.300">
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
                  boxShadow="lg"
                  _hover={{ transform: "scale(1.2)" }}
                />
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
              BẮT ĐẦU PHỎNG VẤN
            </Button>
          )}
        </VStack>

        {/* Right Panel */}
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
                  <VStack spacing={6} align="center">
                    <Text fontSize="9xl" fontWeight="black" color={result.score >= 7 ? "green.500" : "red.500"}>
                      {result.score}/10
                    </Text>
                    <Text fontSize="5xl" fontWeight="bold">{result.score >= 7 ? "PASS!" : "Cần cải thiện"}</Text>
                    <Text fontSize="lg" color="gray.600" textAlign="center">{result.feedback}</Text>
                  </VStack>
                ) : (
                  <Text color="gray.500" textAlign="center">Đang phỏng vấn...</Text>
                )}
              </TabPanel>
              <TabPanel>
                <Text fontWeight="bold" fontSize="2xl" mb={4}>Cảm xúc hiện tại: {currentEmotion}</Text>
                <VStack align="start">
                  {emotionLog.map((e, i) => (
                    <Text key={i}>Q{i + 1}: {e}</Text>
                  ))}
                  
                </VStack>
              </TabPanel>
              <TabPanel>
                {result?.suggestion ? (
                  <Text whiteSpace="pre-wrap">{result.suggestion}</Text>
                ) : (
                  <Text color="gray.500">Hoàn thành để xem gợi ý AI</Text>
                )}
              </TabPanel>
            </TabPanels>
          </Tabs>
        </Box>
      </Flex>
    </Box>
  );
}