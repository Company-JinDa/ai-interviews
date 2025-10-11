import { SpeechClient } from "@google-cloud/speech";

const client = new SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}"),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const { audio }: { audio: string } = await req.json();
    if (!audio) {
      return new Response(
        JSON.stringify({ error: "No audio data received" }),
        { status: 400 }
      );
    }

    const request = {
      audio: { content: audio.replace(/^data:audio\/\w+;base64,/, "") },
      config: {
        encoding: "WEBM_OPUS" as const,
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
      },
    };

    const [response] = await client.recognize(request);
    const transcription =
      response.results
        ?.map((r) => r.alternatives?.[0]?.transcript)
        .join(" ")
        ?.trim() || "";

    return new Response(JSON.stringify({ transcription }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ STT API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
