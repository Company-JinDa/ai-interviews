// app/api/stt/route.ts - CHỈ DÙNG KHI BROWSER KHÔNG HỖ TRỢ WEB SPEECH API
import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-key.json',
});

export async function POST(req: Request) {
  try {
    const { audio } = await req.json();
    const audioBuffer = Buffer.from(audio, "base64");

    // Dùng LongRunningRecognize luôn để không giới hạn thời gian
    const [operation] = await client.longRunningRecognize({
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
      },
      audio: { content: audioBuffer },
    });

    const [response] = await operation.promise();
    const transcription = response.results
      ?.map((r) => r.alternatives?.[0]?.transcript)
      .join(" ") || "";

    return new Response(JSON.stringify({ transcription }), { status: 200 });
  } catch (error: any) {
    console.error("Fallback STT error:", error);
    return new Response(JSON.stringify({ transcription: "" }), { status: 200 });
  }
}