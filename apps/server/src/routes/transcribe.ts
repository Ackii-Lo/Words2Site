import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config.js";
import { transcribe } from "../services/whisper.js";
import { allow } from "../services/ratelimit.js";
import { newTaskId } from "../util/ids.js";

export const transcribeRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(config.dataDir, "audio-tmp"),
    filename: (_req, _file, cb) =>
      cb(null, `${Date.now()}-${newTaskId(6)}.webm`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

transcribeRouter.post("/transcribe", upload.single("audio"), (req, res) => {
  const ip = req.ip ?? "unknown";
  if (!allow(`t:${ip}`, config.rate.transcribePerHour)) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(429).json({ error: "转写次数过多，请改用打字输入" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "缺少音频文件" });
    return;
  }
  transcribe(req.file.path)
    .then((text) => {
      res.json({ text });
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: `转写失败（${msg}），请改用打字输入` });
    })
    .finally(() => {
      fs.unlink(req.file!.path, () => {}); // 转写后即删，不留音频
    });
});
