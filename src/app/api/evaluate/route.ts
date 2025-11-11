// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.7,
    topP: 0.8,
    maxOutputTokens: 1024,
  },
});

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    if (
      !Array.isArray(questions) ||
      !Array.isArray(answers) ||
      questions.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid data: questions and answers must be non-empty arrays" }),
        { status: 400 }
      );
    }

    // Pad answers
    const paddedAnswers = answers.length < questions.length
      ? [...answers, ...Array(questions.length - answers.length).fill("(No answer given)")]
      : answers.slice(0, questions.length);

    const perQuestionScores: number[] = [];
    const perQuestionFeedback: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const prompt = `
You are an expert interviewer.

Question: "${questions[i]}"
Answer: "${paddedAnswers[i]}"

Rate 1-10 and give short feedback.

Return ONLY JSON:
{
  "score": 7,
  "feedback": "Good structure, missing performance tip."
}
`.trim();

      try {
        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        const cleaned = text.trim().replace(/^```json\s*|```$/g, "").trim();
        const json = JSON.parse(cleaned);

        // Sửa lỗi TypeScript: Number(json.score) → Number(json.score)
        const score = Math.max(1, Math.min(10, Number(json.score) || 1));
        const feedback = (json.feedback || "No feedback.").trim();

        perQuestionScores.push(score);
        perQuestionFeedback.push(feedback);
      } catch (err) {
        perQuestionScores.push(1);
        perQuestionFeedback.push("Evaluation failed.");
      }
    }

    const avgScore = Math.round((perQuestionScores.reduce((a, b) => a + b, 0) / questions.length) * 10) / 10;

    // Gợi ý cho TẤT CẢ câu < 6
    let suggestion = avgScore >= 6
      ? "Strong performance! You're interview-ready. Keep practicing!"
      : "Here are suggestions to improve your weak answers:";

    const weakQuestions = questions
      .map((q: string, i: number) => ({
        q,
        a: paddedAnswers[i],
        s: perQuestionScores[i],
        idx: i + 1,
      }))
      .filter(x => x.s < 6);

    if (weakQuestions.length > 0) {
      const suggestionPrompt = `
You are a senior career coach. Overall score: ${avgScore}/10.

Improve ALL these weak answers (score < 6):

${weakQuestions.map(w => `Q${w.idx}: ${w.q}\nAnswer: ${w.a}\nScore: ${w.s}/10`).join("\n\n")}

For EACH question, output:
Q[Num]: [Short preview...]
Issue: [What went wrong]
Improved Answer: [Strong sample]
Tips:
• [Tip 1]
• [Tip 2]

Keep total < 600 words. Plain text only.
`.trim();

      try {
        const result = await model.generateContent(suggestionPrompt);
        const text = await result.response.text();
        suggestion = text.trim() || "Practice explaining concepts with examples.";
      } catch (err) {
        suggestion = "Focus on depth, structure, and real-world examples.";
      }
    }

    return new Response(
      JSON.stringify({
        score: avgScore,
        feedback: `Score: ${avgScore}/10. ${avgScore >= 6 ? "PASS!" : "See suggestions."}`,
        perQuestionFeedback,
        suggestion,
        perQuestionScores,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Evaluate error:", error);
    return new Response(
      JSON.stringify({ error: "Server error", details: error.message }),
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";