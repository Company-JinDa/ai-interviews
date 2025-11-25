// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// Model chính cho chấm điểm (trả JSON ngắn gọn)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const scoringModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash", // hoặc gemini-1.5-pro nếu muốn chất hơn
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.4,
    maxOutputTokens: 512,        // Đủ cho JSON + feedback ngắn
    topP: 0.8,
    topK: 40,
  },
});

// Model riêng cho phần gợi ý cải thiện (cần output dài ~150 từ/câu)
const suggestionModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048,       // QUAN TRỌNG: phải lớn để đủ 100-150 từ x 5 câu
    topP: 0.95,
    topK: 64,
  },
});

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
    }

    // Đảm bảo đủ answer cho từng câu
    const paddedAnswers = answers.length < questions.length
      ? [...answers, ...Array(questions.length - answers.length).fill("(No answer given)")]
      : answers.slice(0, questions.length);

    const perQuestionScores: number[] = [];
    const perQuestionFeedback: string[] = [];

    // === CHẤM ĐIỂM TỪNG CÂU ===
    for (let i = 0; i < questions.length; i++) {
      const prompt = `Rate this interview answer from 1-10. Only return valid JSON.

Question: "${questions[i]}"
Answer: "${paddedAnswers[i]}"

Respond with ONLY this JSON format, no extra text:
{"score": 8, "feedback": "Strong use of STAR method with clear example."}`;

      let score = 5;
      let feedback = "Average answer.";

      try {
        const result = await scoringModel.generateContent(prompt);
        const text = (await result.response.text()).trim();

        // Làm sạch và parse JSON an toàn
        let jsonStr = text.replace(/^```json\n?|```$/g, "").trim();
        if (!jsonStr.startsWith("{")) {
          const match = jsonStr.match(/\{[\s\S]*\}/);
          jsonStr = match ? match[0] : "{}";
        }

        let parsed = JSON.parse(jsonStr);
        score = Math.max(1, Math.min(10, Number(parsed.score) || 5));
        feedback = String(parsed.feedback || "No feedback").slice(0, 150);
      } catch (err: any) {
        console.warn(`Scoring failed on Q${i + 1}:`, err.message);
        const len = paddedAnswers[i].length;
        if (len === 0) { score = 1; feedback = "No answer recorded."; }
        else if (len < 60) { score = 3; feedback = "Too short. Add more details."; }
        else if (len < 180) { score = 6; feedback = "Basic answer. Add examples."; }
        else { score = 7; feedback = "Good length. Could be more structured."; }
      }

      perQuestionScores.push(score);
      perQuestionFeedback.push(feedback);
    }

    // Tính điểm trung bình
// Chỉ thay dòng này để điểm đẹp hơn:
const avgScore = Number((perQuestionScores.reduce((a, b) => a + b, 0) / questions.length).toFixed(1));
    // === TẠO GỢI Ý CẢI THIỆN (phần hay bị die nhất) ===
    let suggestion = "";
    for (let i = 0; i < questions.length; i++) {
      const sp = `You are an expert interviewer. Improve this answer.

Question ${i + 1}: ${questions[i]}
Candidate's answer: "${paddedAnswers[i]}"

Write:
1. Issue: 1 short sentence about the main problem.
2. Improved Answer: 100–150 words, natural, confident, professional English. Use STAR method if behavioral. Add specific examples/numbers.

Format:
Q${i + 1}: ${questions[i]}
Issue: ...
Improved Answer: ...`;

      try {
        const result = await suggestionModel.generateContent(sp);
        const text = (await result.response.text()).trim();
        suggestion += text + "\n\n";
      } catch (err: any) {
        console.warn(`Suggestion failed on Q${i + 1}:`, err.message);
        suggestion += `Q${i + 1}: ${questions[i]}\nIssue: Answer was incomplete or unclear.\nImproved Answer: Use the STAR method (Situation, Task, Action, Result), include specific examples and numbers, speak slowly and confidently.\n\n`;
      }
    }

    suggestion = suggestion.trim();

    return new Response(
      JSON.stringify({
        score: avgScore,
        feedback: `Overall Score: ${avgScore}/10`,
        perQuestionFeedback,
        perQuestionScores,
        suggestion,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Evaluate API error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";