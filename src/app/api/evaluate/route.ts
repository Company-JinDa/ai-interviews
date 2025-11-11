// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.6,
    topP: 0.8,
    maxOutputTokens: 1024,
  },
});

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
    }

    const paddedAnswers = answers.length < questions.length
      ? [...answers, ...Array(questions.length - answers.length).fill("(No answer given)")]
      : answers.slice(0, questions.length);

    const perQuestionScores: number[] = [];
    const perQuestionFeedback: string[] = [];

    // Đánh giá từng câu – BẮT BUỘC JSON chuẩn
    for (let i = 0; i < questions.length; i++) {
      const prompt = `
You are a senior technical interviewer.

Question: "${questions[i]}"
Answer: "${paddedAnswers[i]}"

Rate 1-10 and give short, clear feedback.

Return ONLY this JSON (no extra text, no markdown):
{
  "score": 7,
  "feedback": "Good structure, but lacks real-world example."
}
`.trim();

      let score = 1;
      let feedback = "No feedback generated.";

      try {
        const result = await model.generateContent(prompt);
        const text = (await result.response.text()).trim();
        const cleaned = text.replace(/^```json|```$/g, "").trim();
        const json = JSON.parse(cleaned);
        score = Math.max(1, Math.min(10, Number(json.score) || 1));
        feedback = (json.feedback || "No feedback.").trim();
      } catch (err) {
        console.warn(`Gemini failed on Q${i + 1}, using fallback`);
        // Fallback: Đánh giá đơn giản dựa trên độ dài
        const len = paddedAnswers[i].length;
        if (len < 20) {
          score = 2;
          feedback = "Answer too short. Need more details.";
        } else if (len < 100) {
          score = 5;
          feedback = "Basic answer. Add examples and structure.";
        } else {
          score = 7;
          feedback = "Decent length. Improve clarity and depth.";
        }
      }

      perQuestionScores.push(score);
      perQuestionFeedback.push(feedback);
    }

    const avgScore = Math.round((perQuestionScores.reduce((a, b) => a + b, 0) / questions.length) * 10) / 10;

    // === GỢI Ý CẢI THIỆN: CHI TIẾT, TỪNG CÂU, CÁCH ĐẠT ≥ 6 ĐIỂM ===
    let suggestion = avgScore >= 6
      ? "Excellent! You're well-prepared. Keep practicing with real scenarios."
      : "Here’s how to improve each weak answer to score 6+:";

    const weakQuestions = questions
      .map((q, i) => ({ q, a: paddedAnswers[i], s: perQuestionScores[i], idx: i + 1 }))
      .filter(x => x.s < 6);

    if (weakQuestions.length > 0) {
      const suggestionPrompt = `
You are a senior interview coach. Candidate scored ${avgScore}/10.

Improve these weak answers (score < 6) to reach 6+.

For EACH question:
- Issue: What’s wrong?
- How to score 6+: Key points to include
- Sample Answer: Natural, confident, structured (100-150 words)

Format (plain text):
Q1: [Short preview]
Issue: ...
How to score 6+: ...
Sample Answer: ...

Questions:
${weakQuestions.map(w => `Q${w.idx}: ${w.q}\nAnswer given: ${w.a}`).join("\n\n")}

Keep total under 600 words.
`.trim();

      try {
        const result = await model.generateContent(suggestionPrompt);
        const text = await result.response.text();
        suggestion = text.trim() || "Add more structure, examples, and confidence.";
      } catch (err) {
        suggestion = "For each weak answer: explain with examples, use STAR method, speak clearly.";
      }
    }

    return new Response(
      JSON.stringify({
        score: avgScore,
        feedback: `Overall: ${avgScore}/10. ${avgScore >= 6 ? "PASS!" : "See suggestions to improve."}`,
        perQuestionFeedback,
        suggestion,
        perQuestionScores,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Evaluate error:", error);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}

export const dynamic = "force-dynamic";