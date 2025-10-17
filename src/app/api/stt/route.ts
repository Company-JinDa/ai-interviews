// app/api/stt/route.ts
import { SpeechClient, protos } from "@google-cloud/speech";
import { Storage } from "@google-cloud/storage";

// Load credentials from environment variable, fallback to empty object if invalid
const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
  : {};

const client = new SpeechClient({ credentials });
const storage = new Storage({ credentials });

const bucketName = "ai-interview-audio-bucket"; // Ensure this bucket exists

export async function POST(req: Request): Promise<Response> {
  try {
    if (!credentials.client_email) {
      throw new Error("Credentials are invalid or missing client_email");
    }

    const { audio }: { audio: string } = await req.json(); // base64 audio

    const audioBuffer = Buffer.from(audio, "base64");

    // Upload to GCS
    const fileName = `audio_${Date.now()}.webm`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    await file.save(audioBuffer, { contentType: "audio/webm" });

    const uri = `gs://${bucketName}/${fileName}`;

    const request: protos.google.cloud.speech.v1.ILongRunningRecognizeRequest = {
      config: {
        encoding: "WEBM_OPUS" as const,
        sampleRateHertz: 48000,
        languageCode: "en-US",
      },
      audio: {
        uri,
      },
    };

    const [operation] = await client.longRunningRecognize(request);
    const [response] = await operation.promise();

    const transcription =
      response.results
        ?.map((result: protos.google.cloud.speech.v1.ISpeechRecognitionResult) =>
          result.alternatives?.[0]?.transcript
        )
        .join("\n") || "";

    // Clean up the file
    await file.delete().catch((err) => console.error("Failed to delete GCS file:", err));

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