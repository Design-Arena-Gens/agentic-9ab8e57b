import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      // Signal client to use fallback
      return NextResponse.json({ url: null });
    }

    const replicate = new Replicate({ auth: token });
    // Pika text-to-video model (public on Replicate). May change over time.
    // Using a safe default width/height, 3s duration if supported.
    const model = "pika-labs/pika-1.4"; // fallback alias; in case, user can swap in env
    const input: Record<string, any> = {
      prompt,
      guidance_scale: 7.5,
      num_frames: 48,
      fps: 16,
      width: 720,
      height: 480,
    };

    const output = await replicate.run(model, { input });
    // Many Replicate models return an array of URLs; try to pick the first mp4/gif/webm
    const urls = Array.isArray(output) ? output : [output];
    const url = urls.find((u: string) => typeof u === 'string' && (u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.gif'))) || urls[0];

    return NextResponse.json({ url: url || null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Video generation failed" }, { status: 500 });
  }
}
