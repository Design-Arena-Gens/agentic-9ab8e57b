import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

function svgPlaceholder(text: string): string {
  const safe = (text || "").replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]!));
  const content = safe.slice(0, 160).replace(/\n/g, " ");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1024' height='1024'>
    <defs>
      <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
        <stop offset='0%' stop-color='#343a7a'/>
        <stop offset='100%' stop-color='#6b7cff'/>
      </linearGradient>
    </defs>
    <rect width='100%' height='100%' fill='url(#g)'/>
    <g>
      <text x='64' y='160' font-size='48' font-family='ui-sans-serif, system-ui' fill='white'>Generated Placeholder</text>
      <foreignObject x='64' y='220' width='896' height='720'>
        <div xmlns='http://www.w3.org/1999/xhtml' style='color:#fff;background:rgba(0,0,0,0.15); padding:16px; border-radius:12px; font-size:28px; line-height:1.3;'>
          ${content}
        </div>
      </foreignObject>
    </g>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ url: svgPlaceholder(prompt) });
    }

    const client = new OpenAI({ apiKey });
    const image = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      quality: "high",
      response_format: "b64_json",
    });

    const b64 = image.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: "No image from model" }, { status: 500 });
    const url = `data:image/png;base64,${b64}`;
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Image generation failed" }, { status: 500 });
  }
}
