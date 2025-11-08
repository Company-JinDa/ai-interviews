// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.5,
    topP: 0.8,
    maxOutputTokens: 1024,
  },
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    if (
      !Array.isArray(questions) ||
      !Array.isArray(answers) ||
      questions.length === 0 ||
      questions.length !== answers.length
    ) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400 });
    }

    const perQuestionScores: number[] = [];
    const perQuestionFeedback: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const prompt = `
You are an expert interviewer. Evaluate this answer ONLY.

Question: "${questions[i]}"
Answer: "${answers[i] || "(No answer)"}"

Return VALID JSON only:
{
  "score": 8,
  "feedback": "Clear and detailed explanation with good examples."
}
`.trim();

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Xử lý chắc chắn JSON (Gemini hay thêm ```json)
        const jsonStr = text.replace(/^```json\s*|```$/g, "").trim();
        const parsed = JSON.parse(jsonStr);

        const score = Math.max(1, Math.min(10, Number(parsed.score) || 5));
        const feedback = (parsed.feedback || "No feedback.").trim();

        perQuestionScores.push(score);
        perQuestionFeedback.push(feedback);
      } catch (err) {
        perQuestionScores.push(3);
        perQuestionFeedback.push("AI could not evaluate this answer.");
      }
    }

    const avgScore = Math.round(
      (perQuestionScores.reduce((a, b) => a + b, 0) / questions.length) * 10
    ) / 10;

    let suggestion = "Keep practicing!";

    if (avgScore < 6) {
      const weak = questions
        .map((q: string, i: number) => ({ q, a: answers[i] || "", s: perQuestionScores[i] }))
        .filter((x: any) => x.s < 6);

      if (weak.length > 0) {
        const prompt = `
Senior career coach. Score: ${avgScore}/10

Weak answers:
${weak.map((x: any) => `Q: ${x.q}\nA: ${x.a}\nScore: ${x.s}/10`).join("\n\n")}

One short actionable tip (<80 words), plain text.
`.trim();

        try {
          const res = await model.generateContent(prompt);
          suggestion = (await res.response.text()).trim();
        } catch {}
      }
    }

    return new Response(
      JSON.stringify({
        score: avgScore,
        feedback: `You scored ${avgScore}/10. ${
          avgScore >= 6 ? "Great job! Ready for real interviews." : "Needs improvement."
        }`,
        perQuestionFeedback,
        suggestion,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Evaluate error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
}