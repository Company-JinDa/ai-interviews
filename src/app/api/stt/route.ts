import { SpeechClient } from "@google-cloud/speech";
import fs from "fs";
import path from "path";

const keyPath = path.join(process.cwd(), "google-key.json");
const credentials = JSON.parse(fs.readFileSync(keyPath, "utf8"));

const client = new SpeechClient({
  credentials,
});

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const audioBase64 = body.audio.split(",")[1];

    const [response] = await client.recognize({
      audio: { content: audioBase64 },
      config: {
        encoding: "WEBM_OPUS",
        languageCode: "vi-VN",
      },
    });

    const transcription = response.results
      ?.map(r => r.alternatives?.[0].transcript)
      .join(" ") || "";

    return new Response(JSON.stringify({ text: transcription }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("❌ STT Error:", err);
    return new Response(JSON.stringify({ error: "STT failed" }), { status: 500 });
  }
}
