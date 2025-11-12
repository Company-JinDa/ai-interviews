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

    // === GỢI Ý CẢI THIỆN: SỬA DỰA TRÊN CÂU TRẢ LỜI GỐC ===
    let suggestion = avgScore >= 6
      ? "Excellent! You're well-prepared. Keep practicing with real scenarios."
      : "Here’s how to improve each weak answer to score 6+:";

    const weakQuestions = questions
      .map((q, i) => ({ q, a: paddedAnswers[i], s: perQuestionScores[i], idx: i + 1 }))
      .filter(x => x.s < 6);

    if (weakQuestions.length > 0) {
      const suggestionPrompt = `
You are a senior interview coach. Candidate scored ${avgScore}/10.

For each weak answer (score < 6), provide:
- Issue: What's wrong with the original answer? (short, 1-2 sentences)
- Improved Answer: Rewrite the answer based on the original one. Keep good parts, fix errors, add structure (e.g., STAR method), examples, and depth to score 6+. Make it natural, confident, 100-150 words.

Format (plain text, no markdown):
Q1: [Question preview]
Issue: ...
Improved Answer: ...

Questions:
${weakQuestions.map(w => `Q${w.idx}: ${w.q}\nOriginal Answer: ${w.a}`).join("\n\n")}

Keep total under 600 words. Focus on making the improved answer reusable for retry.
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