// src/app/mocktest4/page.tsx
"use client";

import {
  Box, Flex, Text, Button, Tabs, TabList, Tab, TabPanels, TabPanel,
  VStack, HStack, Spinner, Progress, Alert, AlertIcon, Icon, useToast
} from "@chakra-ui/react";
import { FaVideo, FaMicrophone, FaHome, FaRedo } from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { storage } from "@/app/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { questionsIT } from "@/app/lib/questionsIT";

export default function MockTest4() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // LẤY THAM SỐ TỪ URL
  const level = searchParams.get("level") || "Junior";
  const role = searchParams.get("role") || "Frontend";

  // TÌM BỘ CÂU HỎI TỪ questionsIT.ts
  const questionSet = questionsIT.find(
    (q: any) => q.level === level && q.role === role
  );

  // Nếu không tìm thấy → về trang chọn
  useEffect(() => {
    if (!questionSet) {
      toast({ title: "Not found", description: "No questions for this role/level.", status: "error" });
      setTimeout(() => router.push("/components/specialized2"), 1500);
    }
  }, [questionSet, router, toast]);

  if (!questionSet) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" />
        <Text mt={4}>Loading questions...</Text>
      </Box>
    );
  }

  const { questions, category } = questionSet;

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>(new Array(questions.length).fill(""));
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [faceAnalysis, setFaceAnalysis] = useState<any>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Kiểm tra quyền
  useEffect(() => {
    const check = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setHasPermission(true);
        stream.getTracks().forEach(t => t.stop());
      } catch {
        setHasPermission(false);
      }
    };
    check();
  }, []);

  // Bắt đầu ghi
  const startRecording = async () => {
    if (!hasPermission) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9,opus" });
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = handleStop;
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      toast({ title: "Error", description: "Camera/Microphone access denied.", status: "error" });
    }
  };

  // Dừng & xử lý
  const handleStop = async () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setRecording(false);
    setIsEvaluating(true);

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    chunksRef.current = [];

    // Lưu vào Firebase Storage
    const fileName = `mocktest4/${Date.now()}_${currentQ}.webm`;
    const storageRef = ref(storage, fileName);
    await uploadBytes(storageRef, blob);
    const videoUrl = await getDownloadURL(storageRef);

    // Gửi đánh giá
    const formData = new FormData();
    formData.append("video", blob);
    formData.append("question", questions[currentQ]);
    formData.append("role", role);
    formData.append("level", level);

    const [evalRes, faceRes] = await Promise.all([
      fetch("/api/evaluate-video", { method: "POST", body: formData }),
      fetch("/api/analyze-face", { method: "POST", body: formData }),
    ]);

    const evalData = await evalRes.json();
    const faceData = await faceRes.json();

    // Cập nhật
    const newAnswers = [...answers];
    newAnswers[currentQ] = evalData.transcription || "No speech detected";
    setAnswers(newAnswers);

    const newUrls = [...videoUrls];
    newUrls[currentQ] = videoUrl;
    setVideoUrls(newUrls);

    // Nếu là câu cuối → tổng hợp
    if (currentQ === questions.length - 1) {
      const scores = evalData.perQuestionScores || Array(questions.length).fill(5);
      const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length * 10) / 10;
      setResult({
        score: avg,
        feedback: `Overall: ${avg}/10`,
        perQuestionScores: scores,
        perQuestionFeedback: evalData.perQuestionFeedback || [],
        suggestion: evalData.suggestion || "",
        videoUrls: newUrls,
      });
      setFaceAnalysis(faceData);
    } else {
      setCurrentQ(currentQ + 1);
      chunksRef.current = [];
    }

    setIsEvaluating(false);
  };

  // Try Again
  const handleRetry = async (index: number) => {
    setRetrying(index);
    setCurrentQ(index);
    setRecording(false);
    setIsEvaluating(false);
    chunksRef.current = [];
    await startRecording();
  };

  // UI: Chưa bắt đầu
  if (!recording && !result) {
    return (
      <Box p={6} minH="100vh" bg="gray.50">
        <Flex justify="space-between" mb={6}>
          <HStack>
            <Icon as={FaHome} onClick={() => router.push("/")} cursor="pointer" />
            <Text fontSize="2xl" fontWeight="bold">Video Mock Interview</Text>
          </HStack>
          <HStack>
            <Text fontSize="lg" fontWeight="semibold">{role}</Text>
            <Text fontSize="lg" color="gray.600">• {level}</Text>
          </HStack>
        </Flex>

        <VStack spacing={6} maxW="900px" mx="auto">
          <Box p={6} bg="teal.50" borderRadius="xl" w="full" shadow="sm">
            <Text fontWeight="bold" textAlign="center" fontSize="lg">
              Question 1 / {questions.length}
            </Text>
            <Text mt={3} fontSize="xl" color="teal.700" textAlign="center" lineHeight="1.6">
              {questions[0]}
            </Text>
          </Box>

          <Button
            size="lg"
            colorScheme="teal"
            leftIcon={<FaVideo />}
            onClick={startRecording}
            w="full"
            h="100px"
            fontSize="xl"
          >
            Start Recording
          </Button>
        </VStack>
      </Box>
    );
  }

  // UI: Đang ghi
  if (recording) {
    return (
      <Box p={6} minH="100vh" bg="gray.50">
        <VStack spacing={6} maxW="900px" mx="auto">
          <Box p={4} bg="teal.50" borderRadius="lg" w="full">
            <Text fontWeight="bold" textAlign="center">
              Question {currentQ + 1} / {questions.length}
            </Text>
            <Text mt={2} textAlign="center" fontSize="lg" color="teal.700">
              {questions[currentQ]}
            </Text>
          </Box>

          <Box position="relative" w="full" h="500px" bg="black" borderRadius="lg" overflow="hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Button
              position="absolute"
              bottom="4"
              left="50%"
              transform="translateX(-50%)"
              colorScheme="red"
              size="lg"
              onClick={handleStop}
            >
              Stop & Submit
            </Button>
          </Box>

          <Progress value={((currentQ + 1) / questions.length) * 100} w="300px" colorScheme="teal" />
        </VStack>
      </Box>
    );
  }

  // UI: Đang đánh giá
  if (isEvaluating) {
    return (
      <Box p={6} textAlign="center">
        <Spinner size="xl" color="teal.500" />
        <Text mt={4} fontSize="lg">AI is analyzing your answer and facial expressions...</Text>
      </Box>
    );
  }

  // UI: Kết quả
  return (
    <Box p={6} minH="100vh" bg="gray.50">
      <Flex justify="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Interview Results</Text>
        <Button onClick={() => router.push("/")}>Back</Button>
      </Flex>

      <Tabs variant="soft-rounded" colorScheme="teal">
        <TabList>
          <Tab>Overall</Tab>
          <Tab>Answers</Tab>
          <Tab>Body Language</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <VStack align="start" spacing={4}>
              <Text fontSize="3xl" fontWeight="bold" color={result?.score >= 7 ? "green.500" : "red.500"}>
                {result?.score >= 7 ? "PASS" : "IMPROVE"} • {result?.score}/10
              </Text>
              <Text>{result?.feedback}</Text>
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={5}>
              {questions.map((q: string, i: number) => (
                <Box key={i} p={5} bg="white" borderRadius="lg" shadow="sm" w="full">
                  <HStack justify="space-between">
                    <Text fontWeight="bold" color="teal.600">Q{i + 1}: {q}</Text>
                    <Text fontWeight="semibold" color={result?.perQuestionScores?.[i] >= 7 ? "green.500" : "orange.500"}>
                      {result?.perQuestionScores?.[i] || "?"}/10
                    </Text>
                  </HStack>
                  <Text mt={2} fontSize="sm"><strong>Your Answer:</strong> {answers[i]}</Text>
                  <Text mt={2} fontSize="sm" color="gray.600"><strong>Feedback:</strong> {result?.perQuestionFeedback?.[i]}</Text>

                  {result?.perQuestionScores?.[i] < 7 && (
                    <Box mt={4} p={4} bg="blue.50" borderRadius="md">
                      <Text fontWeight="bold" color="blue.600" mb={2}>AI Suggestion:</Text>
                      <Text whiteSpace="pre-wrap" fontSize="sm">
                        {result?.suggestion?.split("---")[i]?.trim() || "No suggestion."}
                      </Text>
                      <Button
                        mt={3}
                        size="sm"
                        colorScheme="blue"
                        leftIcon={<FaRedo />}
                        onClick={() => handleRetry(i)}
                        isDisabled={retrying !== null}
                      >
                        Try Again
                      </Button>
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          </TabPanel>

          <TabPanel>
            <VStack align="start" spacing={4}>
              <Text fontWeight="bold" fontSize="lg">Facial Analysis</Text>
              {faceAnalysis && (
                <>
                  <HStack><Text>Confidence:</Text><Progress value={faceAnalysis.confidence * 10} w="200px" /><Text>{faceAnalysis.confidence}/10</Text></HStack>
                  <HStack><Text>Eye Contact:</Text><Progress value={faceAnalysis.eyeContact * 10} w="200px" /><Text>{faceAnalysis.eyeContact}/10</Text></HStack>
                  <HStack><Text>Smile:</Text><Progress value={faceAnalysis.smile * 10} w="200px" /><Text>{faceAnalysis.smile}/10</Text></HStack>
                  <Box p={4} bg="yellow.50" borderRadius="md" w="full">
                    <Text fontWeight="bold" color="orange.600">Tips:</Text>
                    <Text mt={1}>{faceAnalysis.feedback}</Text>
                  </Box>
                </>
              )}
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
}