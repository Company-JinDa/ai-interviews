// src/app/mocktestinspect/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Box, Flex, Text, Button, VStack, HStack, Circle, Center, Spinner, useToast, Image, Badge, IconButton
} from "@chakra-ui/react";
import { useSearchParams, useRouter } from "next/navigation";
import { FaPlay, FaArrowRight, FaMicrophone } from "react-icons/fa";
import { db, auth } from "@/app/lib/firebase";
import { addDoc, collection, updateDoc, serverTimestamp } from "firebase/firestore";

// Tách riêng face-api để KHÔNG BAO GIỜ bị lỗi TextEncoder nữa!
// Simple local FaceOverlay fallback (avoids external dependency and missing module)
const FaceOverlay: React.FC<{
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onEmotion: React.Dispatch<React.SetStateAction<string>>;
}> = ({ videoRef, onEmotion }) => {
  useEffect(() => {
    // Minimal placeholder: keep emitting a neutral emotion so the UI works without face-api
    const id = setInterval(() => onEmotion("Neutral"), 2000);
    return () => clearInterval(id);
  }, [onEmotion]);

  return (
    <Box position="absolute" top="4" left="4" bg="rgba(0,0,0,0.5)" color="white" px={3} py={2} borderRadius="md">
      <Text fontWeight="bold">FaceOverlay</Text>
      <Text fontSize="sm">Emotion: Neutral</Text>
    </Box>
  );
};
export default function MockTestInspect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const countdownRef = useRef<number | null>(null);
  const silenceRef = useRef<number | null>(null);
  const interviewRef = useRef<any>(null);

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
  const [result, setResult] = useState<any>(null);
  const [countdown, setCountdown] = useState(60);
  const [amplitude, setAmplitude] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentEmotion, setCurrentEmotion] = useState("Neutral");

  const finalTranscript = useRef("");
  const lastSpokenTime = useRef(0);
  const questionStartTime = useRef(0);

  // Parse questions
  useEffect(() => {
    try {
      const q = JSON.parse(decodeURIComponent(questionsJson));
      setQuestions(q);
    } catch {
      router.push("/");
    }
  }, [questionsJson, router]);

  // Beep sound
  const beep = () => {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1200;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  };

  // TTS
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
    } catch (e) {
      console.log("TTS skipped");
    }
  };

  // Bắt đầu câu hỏi
  const startQuestion = async (idx: number) => {
    if (idx >= questions.length || finished) {
      finishInterview();
      return;
    }

    setCurrentQ(idx);
    setCountdown(60);
    setLiveTranscript("");
    finalTranscript.current = "";
    questionStartTime.current = Date.now();
    setRecording(false);

    await speak(questions[idx]);
    beep(); // Píp!

    setTimeout(() => {
      setRecording(true);
      startRecording();
    }, 350); // Bắt đầu thu ngay sau píp
  };

  // Ghi âm + STT + Waveform
  const startRecording = () => {
    if (!stream) return;

    lastSpokenTime.current = Date.now();
    finalTranscript.current = "";

    // STT - Câu đầu cũng nhận được!
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
          if (e.results[i].isFinal) {
            final += t + " ";
            finalTranscript.current += t + " ";
            lastSpokenTime.current = Date.now();
          } else {
            interim += t;
          }
        }
        setLiveTranscript(finalTranscript.current + interim);
      };

      rec.onerror = () => setTimeout(() => recording && rec.start(), 500);
      rec.onend = () => recording && rec.start();
      rec.start();
      recognitionRef.current = rec;
    }

    // Waveform
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
      if (avg > 0.02) lastSpokenTime.current = Date.now();
      animationRef.current = requestAnimationFrame(draw);
    };
    draw();

    // Đếm ngược chuẩn từng giây
    countdownRef.current = window.setInterval(() => {
      const remain = Math.max(60 - Math.floor((Date.now() - questionStartTime.current) / 1000), 0);
      setCountdown(remain);
      if (remain === 0) stopRecording();
    }, 200);

    // Im lặng 7s → next
    silenceRef.current = window.setTimeout(() => {
      if (recording && Date.now() - lastSpokenTime.current > 7000) {
        stopRecording();
      }
    }, 8000);
  };

  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false);

    clearInterval(countdownRef.current!);
    clearTimeout(silenceRef.current!);
    cancelAnimationFrame(animationRef.current);
    recognitionRef.current?.stop();
    analyserRef.current?.disconnect();

    const answer = finalTranscript.current.trim() || "(Không trả lời)";
    setAnswers(prev => [...prev, answer]);
    setEmotionLog(prev => [...prev, currentEmotion]);

    if (interviewRef.current) {
      await updateDoc(interviewRef.current, {
        answers: [...answers, answer],
        emotionLog: [...emotionLog, currentEmotion],
        updatedAt: serverTimestamp()
      });
    }

    setTimeout(() => startQuestion(currentQ + 1), 1000);
  };

  const finishInterview = async () => {
    setFinished(true);
    setRecording(false);
    stream?.getTracks().forEach(t => t.stop());
    clearInterval(countdownRef.current!);
    clearTimeout(silenceRef.current!);
    cancelAnimationFrame(animationRef.current);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ questions, answers }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setResult(data);

      if (interviewRef.current) {
        await updateDoc(interviewRef.current, {
          result: data,
          finished: true,
          finishedAt: serverTimestamp()
        });
      }

      if (data.score >= 7) {
        import("canvas-confetti").then(c => c.default({ particleCount: 1500, spread: 150 }));
      }
    } catch (e) {
      toast({ title: "Đánh giá lỗi nhưng đã lưu!", status: "warning" });
    }
  };

  const startInterview = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;

      const doc = await addDoc(collection(db, "interviews"), {
        userId: auth.currentUser?.uid || "guest",
        level, role, questions,
        answers: [], emotionLog: [], result: null,
        createdAt: serverTimestamp(), finished: false
      });
      interviewRef.current = doc;

      setStarted(true);
      setTimeout(() => startQuestion(0), 1000);
    } catch {
      toast({ title: "Cần cấp quyền Camera & Mic!", status: "error", duration: 8000 });
    }
  };

  if (questions.length === 0) return <Center minH="100vh"><Spinner size="xl" /></Center>;

  return (
    <Box minH="100vh" bg="white">
      <Flex align="center" justify="space-between" p={6} bg="white" shadow="md">
        <HStack>
          <Image src="/logo.png" boxSize="50px" borderRadius="full" />
          <Text fontSize="2xl" fontWeight="bold" color="teal.600">AI Interview Pro</Text>
        </HStack>
        <Badge colorScheme="teal" fontSize="lg" px={6} py={2} borderRadius="full">
          {level} • {role}
        </Badge>
      </Flex>

      <VStack spacing={10} maxW="900px" mx="auto" py={8} px={6}>
        {/* Progress */}
        <HStack spacing={4}>
          {questions.map((_, i) => (
            <React.Fragment key={i}>
              <Circle size="60px" bg={i <= currentQ ? "teal.500" : "gray.300"} color="white" fontWeight="bold">
                {i + 1}
              </Circle>
              {i < questions.length - 1 && <Box w="80px" h="4px" bg={i < currentQ ? "teal.500" : "gray.300"} />}
            </React.Fragment>
          ))}
        </HStack>

        {/* Camera */}
        <Box position="relative" w="full" h="500px" bg="black" rounded="3xl" overflow="hidden" shadow="2xl">
          <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
          {started && <FaceOverlay videoRef={videoRef} onEmotion={setCurrentEmotion} />}
        </Box>

        {/* Question */}
        <Box textAlign="center" py={6}>
          <Text fontSize="md" color="gray.600">Question {currentQ + 1} / {questions.length}</Text>
          <Text fontSize="4xl" fontWeight="bold" mt={3} lineHeight="1.4">
            {questions[currentQ]}
          </Text>
        </Box>

        {/* Recording UI */}
        {recording && (
          <VStack spacing={8}>
            <HStack spacing={4}>
              <FaMicrophone size={40} color="red" />
              <Text color="red.600" fontSize="5xl" fontWeight="bold">
                Recording... {countdown}s
              </Text>
            </HStack>

            <Box w="600px" h="140px" bg="gray.100" rounded="full" overflow="hidden" position="relative" shadow="2xl">
              <Box
                position="absolute" top="0" left="0" right="0" bottom="0"
                bgGradient="linear(to-r, teal.400, cyan.500)" opacity="0.9"
                width={`${Math.min(amplitude * 1800, 100)}%`}
                transition="width 0.05s"
              />
              <Center h="full">
                <Text fontSize="4xl" fontWeight="extrabold" color="white" textShadow="2px 2px 10px black">
                  Hãy trả lời...
                </Text>
              </Center>
            </Box>

            {liveTranscript && (
              <Box p={6} bg="teal.50" rounded="full" maxW="700px" shadow="lg" border="4px dashed" borderColor="teal.300">
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
              boxShadow="0 15px 35px rgba(0,0,0,0.3)"
              _hover={{ transform: "scale(1.3)" }}
            />
          </VStack>
        )}

        {/* Start */}
        {!started && !finished && (
          <Button onClick={startInterview} leftIcon={<FaPlay />} size="lg" colorScheme="teal" px={16} py={10} fontSize="3xl" fontWeight="bold" rounded="full" shadow="2xl">
            BẮT ĐẦU PHỎNG VẤN
          </Button>
        )}

        {/* Result */}
        {finished && result && (
          <Box textAlign="center" p={10} bg="gray.50" rounded="3xl" shadow="2xl" maxW="800px">
            <Text fontSize="9xl" fontWeight="black" color={result.score >= 7 ? "green.500" : "red.500"}>
              {result.score}/10
            </Text>
            <Text fontSize="5xl" fontWeight="bold" mt={4} color={result.score >= 7 ? "green.600" : "red.600"}>
              {result.score >= 7 ? "PASS!" : "Cần cải thiện"}
            </Text>
            <Box mt={10} textAlign="left" bg="white" p={8} rounded="2xl" shadow="lg">
              <Text fontSize="lg" whiteSpace="pre-wrap" lineHeight="2">
                {result.suggestion}
              </Text>
            </Box>
          </Box>
        )}
      </VStack>
    </Box>
  );
}