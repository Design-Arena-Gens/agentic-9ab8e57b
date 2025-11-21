"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";

type GenType = "image" | "video";

export default function Home() {
  const [idea, setIdea] = useState("");
  const [improved, setImproved] = useState<string>("");
  const [genType, setGenType] = useState<GenType>("image");
  const [loadingImprove, setLoadingImprove] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [error, setError] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");

  const activePrompt = useMemo(() => improved || idea, [improved, idea]);

  const handleImprove = useCallback(async () => {
    setError("");
    setLoadingImprove(true);
    setImproved("");
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: idea }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setImproved(data.improved as string);
    } catch (e: any) {
      setError(e?.message || "Failed to improve prompt");
    } finally {
      setLoadingImprove(false);
    }
  }, [idea]);

  const download = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const generateClientVideoFallback = useCallback(async (text: string) => {
    // Simple WebM generation using Canvas + MediaRecorder
    const width = 720;
    const height = 480;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const durationMs = 3000;
    const start = performance.now();

    recorder.start();

    await new Promise<void>((resolve) => {
      const render = () => {
        const t = performance.now() - start;
        // background
        const hue = (t / 20) % 360;
        ctx.fillStyle = `hsl(${hue}, 65%, 14%)`;
        ctx.fillRect(0, 0, width, height);
        // animated gradient overlay
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `hsla(${(hue+60)%360},70%,60%,0.35)`);
        grad.addColorStop(1, `hsla(${(hue+180)%360},70%,50%,0.35)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        // text typing effect
        const words = text.trim().slice(0, 240);
        const progress = Math.min(1, t / durationMs);
        const chars = Math.max(12, Math.floor(words.length * progress));
        const shown = words.slice(0, chars);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#0008";
        ctx.shadowBlur = 8;
        ctx.font = "bold 28px ui-sans-serif, system-ui";
        const lines = wrapText(ctx, shown, width - 80);
        let y = height/2 - (lines.length * 32)/2;
        for (const line of lines) {
          ctx.fillText(line, 40, y);
          y += 36;
        }
        ctx.shadowBlur = 0;

        if (t < durationMs) requestAnimationFrame(render);
        else resolve();
      };
      render();
    });

    await new Promise((r) => setTimeout(r, 150));
    recorder.stop();
    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    });
    return URL.createObjectURL(blob);
  }, []);

  const generate = useCallback(async () => {
    setError("");
    setLoadingGenerate(true);
    setImageUrl("");
    setVideoUrl("");
    try {
      if (genType === "image") {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: activePrompt }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setImageUrl(data.url);
      } else {
        // Try server video. If not available, use client fallback.
        let usedFallback = false;
        try {
          const res = await fetch("/api/video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: activePrompt }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json();
          if (data.url) setVideoUrl(data.url);
          else usedFallback = true;
        } catch {
          usedFallback = true;
        }
        if (usedFallback) {
          const url = await generateClientVideoFallback(activePrompt);
          setVideoUrl(url);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Generation failed");
    } finally {
      setLoadingGenerate(false);
    }
  }, [genType, activePrompt, generateClientVideoFallback]);

  return (
    <main className="container">
      <div className="card" style={{ marginTop: 24 }}>
        <div className="row">
          <div className="col" style={{ minWidth: 320 }}>
            <h1 className="h1">Agentic Media</h1>
            <div className="muted">Turn ideas into improved prompts, then into media you can download.</div>
          </div>
          <div className="col" style={{ textAlign: 'right' }}>
            <span className="badge">Image & Video</span>
          </div>
        </div>

        <div style={{ height: 12 }} />
        <div className="row">
          <div className="col">
            <label>Describe your idea</label>
            <textarea rows={5} placeholder="e.g., a serene sunrise over futuristic city skyline, cinematic"
              value={idea} onChange={(e) => setIdea(e.target.value)} />
            <div className="actions" style={{ marginTop: 12 }}>
              <button className="button" onClick={handleImprove} disabled={!idea || loadingImprove}>
                {loadingImprove ? "Improving..." : "Improve Prompt"}
              </button>
              <select value={genType} onChange={(e) => setGenType(e.target.value as GenType)}>
                <option value="image">Generate Image</option>
                <option value="video">Generate Video</option>
              </select>
              <button className="button" onClick={generate} disabled={!activePrompt || loadingGenerate}>
                {loadingGenerate ? "Generating..." : `Generate ${genType === 'image' ? 'Image' : 'Video'}`}
              </button>
            </div>
          </div>
          <div className="col">
            <label>Improved prompt</label>
            <textarea rows={5} placeholder="Improved prompt will appear here" value={improved} onChange={(e) => setImproved(e.target.value)} />
            <div className="muted" style={{ marginTop: 8 }}>You can edit the improved prompt before generating.</div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 16, color: '#b00020', fontWeight: 700 }}>{error}</div>
        )}

        <div style={{ height: 20 }} />

        {(imageUrl || videoUrl) && (
          <div className="row">
            <div className="col">
              {imageUrl && (
                <div>
                  <img className="media" src={imageUrl} alt="Generated" />
                  <div className="actions" style={{ marginTop: 12 }}>
                    <button className="button secondary" onClick={() => download(imageUrl, "image.png")}>Download PNG</button>
                  </div>
                </div>
              )}
              {videoUrl && (
                <div>
                  <video className="media" src={videoUrl} controls />
                  <div className="actions" style={{ marginTop: 12 }}>
                    <button className="button secondary" onClick={() => download(videoUrl, "video.webm")}>Download Video</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const { width } = ctx.measureText(testLine);
    if (width > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
}
