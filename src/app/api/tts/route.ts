// app/api/tts/route.ts
import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs";

const credentials = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-key.json', 'utf8'));
const client = new textToSpeech.TextToSpeechClient({ credentials });

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    const [response] = await client.synthesizeSpeech({
      input: { text },
      voice: { languageCode: "en-UK", ssmlGender: "NEUTRAL" },
      audioConfig: { audioEncoding: "MP3" },
    });

    const audioContent = response.audioContent
      ? response.audioContent.toString("base64")
      : "";

    return new Response(JSON.stringify({ audioContent }), { status: 200 });
  } catch (error: any) {
    console.error("TTS API error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}