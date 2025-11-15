// src/app/api/evaluate-video/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: Request) {
generationConfig: { responseMimeType: "application/json" }
  const formData = await req.formData();
  const file = formData.get("video") as File;
  const question = formData.get("question") as string;
  const role = formData.get("role") as string;
  const level = formData.get("level") as string;

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await model.generateContent([
    `Role: ${role}, Level: ${level}\nQuestion: "${question}"\nAnalyze this video interview answer. Return JSON: {transcription: "...", score: 7, feedback: "...", suggestion: "Improved answer..."}`,
    { inlineData: { data: buffer.toString("base64"), mimeType: "video/webm" } },
  ]);

  const text = await result.response.text();
  // Parse JSON from Gemini
  const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{"score":5,"feedback":"Okay","suggestion":""}');

  return Response.json({
    transcription: json.transcription || "",
    perQuestionScores: [json.score],
    perQuestionFeedback: [json.feedback],
    suggestion: json.suggestion ? `---\n${json.suggestion}` : "",
  });
}

export const dynamic = "force-dynamic";