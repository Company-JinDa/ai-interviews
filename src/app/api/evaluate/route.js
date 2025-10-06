import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  const { answers } = await req.json();

  const text = answers.join("\n");
  const prompt = `
  You are an AI interview evaluator.
  Rate this interview answers (0-10) and give brief feedback.
  Answers:
  ${text}
  Return result in JSON:
  { "score": number, "feedback": string }
  `;

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const result = await model.generateContent(prompt);
  const output = result.response.text();

  try {
    const json = JSON.parse(output);
    return new Response(JSON.stringify(json), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ score: 0, feedback: output }), {
      status: 200,
    });
  }
}
