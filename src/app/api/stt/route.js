import { SpeechClient } from "@google-cloud/speech";

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "{}");

const client = new SpeechClient({ credentials });

export async function POST(req) {
  try {
    const { audio } = await req.json();

    if (!audio) {
      return new Response(
        JSON.stringify({ error: "No audio data received" }),
        { status: 400 }
      );
    }

    const request = {
      audio: { content: audio },
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "default",
      },
    };

    // 🧠 Gửi đến Google Cloud
    const [response] = await client.recognize(request);

    const transcription = response.results
      ?.map(r => r.alternatives?.[0]?.transcript || "")
      .join(" ")
      .trim();

    console.log("🎙️ Transcribed:", transcription);

    return new Response(
      JSON.stringify({ transcription }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ STT API error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "STT error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
