// app/api/stt/route.ts
import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export async function POST(req: Request): Promise<Response> {
  try {
    const { audio }: { audio: string } = await req.json(); // base64 audio

    const audioBuffer = Buffer.from(audio, "base64");

    const request = {
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
      },
      audio: {
        content: audioBuffer,
      },
    };

    // avoid destructuring the possibly-void-overloaded return type by indexing the awaited result
    const responseArr = (await client.recognize(request as any)) as any;
    const response = responseArr?.[0];
    const transcription =
      response?.results?.[0]?.alternatives?.[0]?.transcript || "";

    return new Response(JSON.stringify({ transcription }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("STT API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}