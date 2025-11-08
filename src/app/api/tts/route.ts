import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || "./google-key.json",
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || text.trim() === "") {
      return new Response(JSON.stringify({ audioContent: "" }), { status: 200 });
    }

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "en-US", name: "en-US-Standard-C" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
    });

    // response.audioContent may be a Buffer/Uint8Array — convert to base64 safely
    const audioBuffer = response.audioContent as any;
    const audioContent = audioBuffer ? Buffer.from(audioBuffer).toString("base64") : "";

    return new Response(JSON.stringify({ audioContent }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("TTS Error:", error?.message || error);
    return new Response(JSON.stringify({ audioContent: "" }), { status: 200 });
  }
}