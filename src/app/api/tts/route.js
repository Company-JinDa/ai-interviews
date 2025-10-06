import textToSpeech from "@google-cloud/text-to-speech";
import fs from "fs";
import util from "util";

const client = new textToSpeech.TextToSpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export async function POST(req) {
  const { text } = await req.json();

  const request = {
    input: { text },
    voice: { languageCode: "en-US", ssmlGender: "NEUTRAL" },
    audioConfig: { audioEncoding: "MP3" },
  };

  const [response] = await client.synthesizeSpeech(request);
  const audioContent = response.audioContent.toString("base64");

  return new Response(JSON.stringify({ audioContent }), { status: 200 });
}
