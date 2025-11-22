// src/components/FaceOverlay.tsx
"use client";

import { useEffect, useRef } from "react";

export default function FaceOverlay({ videoRef, onEmotion }: { videoRef: any; onEmotion: (e: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let faceapi: any;
    let interval: any;

    (async () => {
      faceapi = await import("@vladmandic/face-api");
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceExpressionNet.loadFromUri("/models")
      ]);

      interval = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceExpressions();

        if (detections.length > 0) {
          const expr = detections[0].expressions;
          const dominant = Object.keys(expr).reduce((a: any, b: any) => expr[a] > expr[b] ? a : b);
          onEmotion(dominant.charAt(0).toUpperCase() + dominant.slice(1));
        }
      }, 1000);
    })();

    return () => clearInterval(interval);
  }, [videoRef, onEmotion]);

  return <canvas ref={canvasRef} width={640} height={480} className="absolute top-0 left-0 opacity-0 pointer-events-none" />;
}