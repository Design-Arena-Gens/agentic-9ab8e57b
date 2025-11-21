import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM = `You are an expert creative prompt engineer for image and video generation.
Rewrite the user's idea into a single, concise, production-ready prompt that maximizes visual specificity: subjects, style, composition, camera, lighting, mood, colors, resolution, aspect ratio, and temporal motion cues (if video).
Avoid verbosity, no preambles, just the improved prompt.`;

function heuristicImprove(input: string): string {
  const base = input.trim();
  if (!base) return "";
  const extras = [
    "ultra-detailed, high dynamic range, 4k",
    "cinematic lighting, volumetric light",
    "rule of thirds composition, shallow depth of field",
    "physically-based rendering, photorealistic textures",
  ];
  const style = /cartoon|anime|illustration|pixel|low poly/i.test(base)
    ? "stylized, bold shapes, clean lines"
    : "photorealistic, filmic, natural skin tones";
  return `${base}, ${style}, ${extras.join(", ")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ improved: heuristicImprove(prompt) });
    }

    const client = new OpenAI({ apiKey });
    const chat = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    });
    const improved = chat.choices[0]?.message?.content?.trim() || heuristicImprove(prompt);
    return NextResponse.json({ improved });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Improve failed" }, { status: 500 });
  }
}
