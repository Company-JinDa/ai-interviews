// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request): Promise<Response> {
  try {
    const { answers }: { answers: string[] } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Evaluate these interview answers: ${JSON.stringify(answers)}. Give a score from 0-10, feedback, and if score <6, suggest better answers. Output JSON: {score: number, feedback: string, suggestion: string}`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    const data = JSON.parse(response); // Assume Gemini outputs valid JSON

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Evaluate error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}