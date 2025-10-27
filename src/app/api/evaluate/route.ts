// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request): Promise<Response> {
  try {
    const { answers, questions }: { answers: string[]; questions: string[] } = await req.json();

    // 🔹 Chọn model tồn tại: gemini-1.5 (không dùng -flash)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5" });

    const prompt = `Evaluate the following interview answers for these questions:
Questions: ${JSON.stringify(questions)}
Answers: ${JSON.stringify(answers)}
Provide a score from 0-10, detailed feedback, and if score < 6, suggest improved answers.
Output in strict JSON format like:
{
  "score": number,
  "feedback": string,
  "suggestion": string (or empty string if score >=6)
}`;

    const result = await model.generateContent(prompt);

    // 🔹 Lấy text an toàn, bỏ ```json nếu có
    let responseText = result.response?.text() || "";
    responseText = responseText.replace(/```json|```/g, '').trim();

    let data;
    try {
      data = JSON.parse(responseText);
      // đảm bảo suggestion luôn có key
      if (!data.suggestion) data.suggestion = "";
    } catch (err) {
      console.error("JSON parse error:", err, responseText);
      return new Response(JSON.stringify({ error: "Invalid JSON from AI" }), { status: 500 });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Evaluate API error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
