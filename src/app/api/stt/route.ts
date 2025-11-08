// app/api/stt/route.ts
import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./google-key.json",
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { audio } = await req.json();
    if (!audio) {
      return new Response(JSON.stringify({ transcription: "" }), { status: 200 });
    }

    const audioBuffer = Buffer.from(audio, "base64");

    // Dùng LongRunningRecognize để hỗ trợ audio dài bất kỳ
    const [operation] = await client.longRunningRecognize({
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
      },
      audio: { content: audioBuffer },
    });

    const [response] = await operation.promise();

    const transcription = response.results
      ?.map((result) => result.alternatives?.[0]?.transcript || "")
      .join(" ")
      .trim();

    return new Response(JSON.stringify({ transcription }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("STT Fallback Error:", error.message);
    return new Response(JSON.stringify({ transcription: "" }), { status: 200 });
  }
}