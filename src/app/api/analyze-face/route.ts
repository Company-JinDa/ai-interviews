// src/app/api/analyze-face/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: Request) {
  const formData = await req.formData();
generationConfig: { responseMimeType: "application/json" }
  const file = formData.get("video") as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await model.generateContent([
    "Analyze facial expressions in this interview video. Rate each from 1-10: confidence, eye contact, smile. Detect head pose (straight, tilted, down). Give 1-2 sentence feedback on body language.",
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "video/webm",
      },
    },
  ]);

  const text = await result.response.text();

  // Parse kết quả từ Gemini (nếu có JSON) hoặc dùng fallback
  let parsed = { confidence: 5, eyeContact: 5, smile: 5, headPose: "unknown", feedback: "Analysis failed." };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      // Nếu không có JSON, trích xuất thủ công
      const conf = text.match(/confidence[:\s]*(\d+)/i)?.[1] || "5";
      const eye = text.match(/eye contact[:\s]*(\d+)/i)?.[1] || "5";
      const smile = text.match(/smile[:\s]*(\d+)/i)?.[1] || "5";
      const pose = text.match(/head pose[:\s]*([a-z]+)/i)?.[1] || "straight";
      parsed = {
        confidence: parseInt(conf),
        eyeContact: parseInt(eye),
        smile: parseInt(smile),
        headPose: pose,
        feedback: text.slice(0, 150),
      };
    }
  } catch (e) {
    console.warn("Gemini face analysis parse failed:", e);
  }

  return Response.json({
    confidence: Math.max(1, Math.min(10, parsed.confidence || 5)),
    eyeContact: Math.max(1, Math.min(10, parsed.eyeContact || 5)),
    smile: Math.max(1, Math.min(10, parsed.smile || 5)),
    headPose: parsed.headPose || "straight",
    feedback: (parsed.feedback || "Keep good posture and eye contact.").slice(0, 150),
  });
}

export const dynamic = "force-dynamic";