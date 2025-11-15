// src/app/mocktest4/VideoRecorder.tsx
"use client";
import { useRef, useState } from "react";
import { Button, Box, Spinner } from "@chakra-ui/react";

export const VideoRecorder = ({ onRecordingComplete }: { onRecordingComplete: (blob: Blob) => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;

      const recorder = new MediaRecorder(s, { mimeType: "video/webm;codecs=vp9,opus" });
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        onRecordingComplete(blob);
        s.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      alert("Please allow camera and microphone access.");
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <Box position="relative" w="100%" h="300px" bg="black" borderRadius="lg" overflow="hidden">
      <video ref={videoRef} autoPlay muted playsInline width="100%" height="100%" />
      {!recording ? (
        <Button position="absolute" bottom="4" left="50%" transform="translateX(-50%)" onClick={start}>
          Start Recording
        </Button>
      ) : (
        <Button position="absolute" bottom="4" left="50%" transform="translateX(-50%)" colorScheme="red" onClick={stop}>
          <Spinner mr={2} /> Stop & Evaluate
        </Button>
      )}
    </Box>
  );
};