import speech from "@google-cloud/speech";

const client = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

export async function POST(req) {
  const { audio } = await req.json(); // base64 từ client

  const audioBytes = audio;
  const audioRequest = {
    audio: { content: audioBytes },
    config: {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: "en-US",
    },
  };

  const [response] = await client.recognize(audioRequest);
  const transcription = response.results
    .map((r) => r.alternatives[0].transcript)
    .join("\n");

  return new Response(JSON.stringify({ transcription }), { status: 200 });
}
