import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();
    if (!questions || !answers || questions.length !== answers.length) {
      return new Response(JSON.stringify({ error: "Invalid data" }), { status: 400 });
    }

    const perQuestionScores: number[] = [];
    const perQuestionFeedback: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const prompt = `
You are an expert interviewer. Evaluate this answer on a scale of 1-10.

Question: "${questions[i]}"
Answer: "${answers[i] || "(No answer)"}"

Return ONLY JSON:
{
  "score": <1-10>,
  "feedback": "<1 short sentence>"
}
      `.trim();

      const result = await model.generateContent(prompt);
      const text = await result.response.text();

      try {
        const json = JSON.parse(text);
        perQuestionScores.push(json.score || 1);
        perQuestionFeedback.push(json.feedback || "No feedback.");
      } catch {
        perQuestionScores.push(1);
        perQuestionFeedback.push("Failed to evaluate.");
      }
    }

    const totalScore = perQuestionScores.reduce((a, b) => a + b, 0);
    const avgScore = Math.round((totalScore / questions.length) * 10) / 10;

    let suggestion = "";
    if (avgScore < 6) {
      const weak = questions
        .map((q: string, i: number) => ({ q, a: answers[i], s: perQuestionScores[i] }))
        .filter((x: any) => x.s < 6);

      const prompt = `
You are a career coach. Candidate scored ${avgScore}/10.

Weak answers:
${weak.map((x: any) => `Q: ${x.q}\nA: ${x.a}`).join("\n\n")}

Give 1 short, professional suggestion (under 100 words).
      `.trim();

      const result = await model.generateContent(prompt);
      suggestion = (await result.response.text()).trim();
    }

    return new Response(
      JSON.stringify({
        score: avgScore,
        feedback: `You scored ${avgScore}/10. ${avgScore >= 6 ? "Great job!" : "Needs improvement."}`,
        perQuestionFeedback,
        suggestion: suggestion || "Keep practicing!",
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Evaluate error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}