// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request): Promise<Response> {
  try {
    const { answers, questions }: { answers: string[]; questions: string[] } = await req.json();

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Evaluate the following interview answers for these questions: Questions: ${JSON.stringify(questions)}, Answers: ${JSON.stringify(answers)}. Provide a score from 0-10, detailed feedback, and if score < 6, suggest improved answers. Output in JSON format: { "score": number, "feedback": string, "suggestion": string if score <6 else "" }`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const data = JSON.parse(responseText.replace(/```json|```/g, '').trim());

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Evaluate API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}