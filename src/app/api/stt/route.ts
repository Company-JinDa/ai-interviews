// app/api/stt/route.ts
import { SpeechClient } from "@google-cloud/speech";
import fs from "fs";

const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-key.json', 'utf8'));
const client = new SpeechClient({ credentials });

export async function POST(req: Request) {
  try {
    const { audio } = await req.json();
    const audioBuffer = Buffer.from(audio, "base64");

    if (audioBuffer.length > 1 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Audio too long" }), { status: 400 });
    }
    const [response] = await client.recognize({
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
      },
      audio: { content: audioBuffer },
    });
    const transcription = response.results
      ?.map((r) => r.alternatives?.[0]?.transcript)
      .join(" ") || "";

    return new Response(JSON.stringify({ transcription }), { status: 200 });
  } catch (error: any) {
    console.error("STT error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}