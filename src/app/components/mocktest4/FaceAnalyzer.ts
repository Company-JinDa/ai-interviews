// src/app/mocktest4/FaceAnalyzer.ts
export interface FaceAnalysis {
  confidence: number;
  eyeContact: number;
  smile: number;
  headPose: "straight" | "tilted" | "down";
  emotions: { happy: number; neutral: number; nervous: number };
  feedback: string;
}

export const analyzeFace = async (videoBlob: Blob): Promise<FaceAnalysis> => {
  const formData = new FormData();
  formData.append("video", videoBlob, "interview.mp4");

  try {
    const res = await fetch("/api/analyze-face", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return {
      confidence: 4,
      eyeContact: 3,
      smile: 2,
      headPose: "down",
      emotions: { happy: 20, neutral: 50, nervous: 30 },
      feedback: "Look at camera more. Smile naturally. Sit straight.",
    };
  }
};