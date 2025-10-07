import speech from "@google-cloud/speech";

// 🔹 Nên dùng credentials dạng JSON string từ biến môi trường (không keyFilename)
const client = new speech.SpeechClient({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON),
});

export async function POST(req) {
  try {
    const { audio } = await req.json(); // base64 string

    // ✅ Đổi sang LINEAR16, vì react-mic output có thể chuyển thành WAV PCM 16-bit
    const audioRequest = {
      audio: { content: audio },
      config: {
        encoding: "WEBM_OPUS", // react-mic mặc định là WEBM_OPUS
        sampleRateHertz: 48000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
        model: "default",
      },
    };

    const [response] = await client.recognize(audioRequest);
    const transcription = response.results
      .map((r) => r.alternatives[0].transcript)
      .join(" ");

    console.log("✅ Transcription:", transcription);

    return new Response(
      JSON.stringify({ transcription }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ STT API error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
