// app/api/evaluate/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json", // BẮT BUỘC TRẢ JSON
    temperature: 0.7,
    topP: 0.8,
    maxOutputTokens: 1024,
  },
});

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    // Validate dữ liệu đầu vào
    if (
      !Array.isArray(questions) ||
      !Array.isArray(answers) ||
      questions.length === 0
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid data: questions and answers must be non-empty arrays of equal length" }),
        { status: 400 }
      );
    }

    // Nếu answers.length < questions.length, pad với "" để tránh lỗi
    const paddedAnswers = [...answers];
    while (paddedAnswers.length < questions.length) {
      paddedAnswers.push("(No answer given)");
    }

    const perQuestionScores: number[] = [];
    const perQuestionFeedback: string[] = [];

    // Đánh giá từng câu
    for (let i = 0; i < questions.length; i++) {
      const prompt = `
You are an expert technical interviewer for ${questions.length} questions.
Evaluate ONLY this one answer on a scale of 1-10.

Question: "${questions[i]}"
Candidate Answer: "${paddedAnswers[i] || "(No answer given)"}"

Respond with VALID JSON only (no extra text, no markdown):
{
  "score": 7,
  "feedback": "Short, clear explanation of the concept with relevant examples."
}
`.trim();

      try {
        const result = await model.generateContent(prompt);
        const text = await result.response.text();

        // Làm sạch JSON (Gemini hay thêm ```json)
        const cleaned = text.trim().replace(/^```json\s*|```$/g, "").trim();

        const json = JSON.parse(cleaned);
        const score = Math.max(1, Math.min(10, Number(json.score) || 1));
        const feedback = (json.feedback || "No feedback provided.").toString().trim();

        perQuestionScores.push(score);
        perQuestionFeedback.push(feedback);
      } catch (err) {
        console.error(`Gemini parse error at question ${i + 1}:`, err);
        perQuestionScores.push(1);
        perQuestionFeedback.push("AI failed to evaluate this answer.");
      }
    }

    // Tính điểm trung bình
    const totalScore = perQuestionScores.reduce((a, b) => a + b, 0);
    const avgScore = Math.round((totalScore / questions.length) * 10) / 10;

    // Gợi ý cải thiện nếu dưới 6.0
    let suggestion = avgScore >= 6 ? "Excellent performance! Your answers demonstrate strong knowledge and clear communication." : "Keep practicing!";

    if (avgScore < 6) {
      const weakPoints = questions
        .map((q: string, i: number) => ({
          q,
          a: paddedAnswers[i] || "(No answer)",
          s: perQuestionScores[i],
        }))
        .filter((x: any) => x.s < 6);

      if (weakPoints.length > 0) {
        const suggestionPrompt = `
You are a senior career coach. Candidate scored ${avgScore}/10 overall.

Weak answers (score < 6):
${weakPoints.map((x: any) => `Q: ${x.q}\nAnswer: ${x.a}\nScore: ${x.s}/10`).join("\n\n")}

For each weak question, provide:
- A concise explanation of what went wrong.
- A better sample answer.
- Actionable tips to improve.

Structure the response as plain text, with sections for each question like:
Q1: [Question text]
Issue: [Explanation]
Improved Answer: [Sample]
Tips: [Bullet points]

Keep overall under 300 words.
`.trim();

        try {
          const result = await model.generateContent(suggestionPrompt);
          const text = await result.response.text();
          suggestion = text.trim() || "Focus on understanding core concepts deeply.";
        } catch (err) {
          console.error("Suggestion generation failed:", err);
          suggestion = "Review fundamental concepts and practice explaining them clearly.";
        }
      }
    }

    // Trả kết quả
    return new Response(
      JSON.stringify({
        score: avgScore,
        feedback: `You scored ${avgScore}/10. ${avgScore >= 6 ? "Great job! You're ready for real interviews." : "Needs improvement – check suggestions."}`,
        perQuestionFeedback,
        suggestion,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Evaluate API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";