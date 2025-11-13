// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0.5,
    maxOutputTokens: 256,
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

    for (let i = 0; i < questions.length; i++) {
      const prompt = `Rate 1-10. Q: "${questions[i]}". A: "${paddedAnswers[i]}". Return ONLY JSON: {"score":7,"feedback":"Good but add example."}`;

      let score = 3;
      let feedback = "Basic answer.";
      try {
        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        const jsonStr = text.replace(/```json|```/g, "").trim();
        let json;
        
        try {
          json = JSON.parse(jsonStr);
        } catch {
          json = { score: 3, feedback: "AI parse error." };
        }
        score = Math.max(1, Math.min(10, Number(json.score) || 3));
        feedback = (json.feedback || "No feedback").slice(0, 100);
      } catch (err) {
        console.warn(`Gemini failed on Q${i + 1}`);
        const len = paddedAnswers[i].length;
        if (len === 0) { score = 1; feedback = "No answer."; }
        else if (len < 50) { score = 3; feedback = "Too short. Add details."; }
        else if (len < 150) { score = 5; feedback = "Basic. Add structure."; }
        else { score = 7; feedback = "Good length. Add examples."; }
      }
      perQuestionScores.push(score);
      perQuestionFeedback.push(feedback);
    }
    const avgScore = Math.round(perQuestionScores.reduce((a, b) => a + b, 0) / questions.length * 10) / 10;

    let suggestion = "";
    for (let i = 0; i < questions.length; i++) {
      const sp = `Q${i+1}: ${questions[i]}\nOriginal: "${paddedAnswers[i]}"\nIssue: 1-2 sentences.\nImproved Answer: 100-150 words, natural, confident, fix errors, add STAR/examples.`;
      try {
        const r = await model.generateContent(sp);
        suggestion += (await r.response.text()).trim() + "\n\n";
      } catch {
        suggestion += `Q${i+1}: ${questions[i]}\nIssue: Incomplete.\nImproved Answer: Use STAR, add examples, speak clearly.\n\n`;
      }
    }
    suggestion = suggestion.trim();
    return new Response(JSON.stringify({
      score: avgScore,
      feedback: `Overall: ${avgScore}/10`,
      perQuestionFeedback,
      suggestion,
      perQuestionScores,
    }), { status: 200 });
  } catch (error: any) {
    console.error("Evaluate error:", error);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
export const dynamic = "force-dynamic";