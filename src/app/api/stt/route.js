import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}"),
});

export async function POST(req) {
  try {
    const { audio } = await req.json();

    if (!audio) {
      return new Response(JSON.stringify({ error: "No audio data received" }), { status: 400 });
    }

    const audioRequest = {
      audio: { content: audio },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await client.recognize(audioRequest);

    const transcription = response.results
      .map(r => r.alternatives?.[0]?.transcript)
      .join(" ")
      .trim();

    console.log("🗣️ Transcribed text:", transcription);

    return new Response(JSON.stringify({ transcription }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ STT API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
