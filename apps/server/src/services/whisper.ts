import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "../config.js";
import { logError } from "../util/logger.js";

const run = promisify(execFile);

/**
 * 音频转写。audioPath 为浏览器上传的 webm/opus 文件。
 * 返回非空文本；失败抛错（路由层转 500，前端提示改用打字）。
 */
export async function transcribe(audioPath: string): Promise<string> {
  switch (config.whisper.provider) {
    case "openai-api":
      return transcribeViaApi(audioPath);
    case "local":
      return transcribeLocal(audioPath);
    case "mock":
      return "帮我做一个介绍我家猫咪咪咪的网页，要可爱一点的风格，粉色系。";
  }
}

async function transcribeViaApi(audioPath: string): Promise<string> {
  const fs = await import("node:fs");
  const form = new FormData();
  form.append("file", new Blob([fs.readFileSync(audioPath)], { type: "audio/webm" }), "audio.webm");
  form.append("model", config.whisper.model);
  form.append("language", "zh");
  form.append("response_format", "json");
  const res = await fetch(`${config.whisper.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.whisper.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    logError("whisper", `转写接口返回 ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`转写服务返回 ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) throw new Error("转写结果为空");
  return text;
}

async function transcribeLocal(audioPath: string): Promise<string> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  // webm → 16kHz mono wav
  const wavPath = audioPath.replace(/\.\w+$/, "") + ".wav";
  await run("ffmpeg", ["-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wavPath]);
  const { stdout } = await run(config.whisper.localCmd, [
    wavPath,
    "--model",
    "small",
    "--language",
    "zh",
    "--output_format",
    "txt",
    "--output_dir",
    path.dirname(wavPath),
  ]);
  const txtPath = wavPath.replace(/\.wav$/, ".txt");
  if (fs.existsSync(txtPath)) {
    return fs.readFileSync(txtPath, "utf-8").trim();
  }
  // whisper.cpp 的 stdout 即文本
  return stdout.trim();
}
