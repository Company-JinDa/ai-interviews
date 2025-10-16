import speech from "@google-cloud/speech";
import { NextResponse } from "next/server";

const client = new speech.SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_KEY || "{}"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const audioBytes = body.audio;

    const [response] = await client.recognize({
      audio: { content: audioBytes },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
      },
    });
    const transcription =
      response.results?.map((r) => r.alternatives?.[0]?.transcript).join("\n") || "";

    return NextResponse.json({ transcription });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
