/**
 * 本地 mock 发布接口:接收 { html, url },存盘并托管预览。
 * 用法:pnpm mock:publish(默认 :9090)
 * 将 .env 的 PUBLISH_ENDPOINT 指向 http://localhost:9090/publish 即可演练真实发布链路。
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.MOCK_PUBLISH_PORT || 9090);
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../data/published-mock");

const app = express();
app.use(express.json({ limit: "2mb" }));

app.post("/publish", (req, res) => {
  const { html, url } = req.body ?? {};
  if (typeof html !== "string" || html.length < 100) {
    res.status(400).json({ error: "html 内容无效" });
    return;
  }
  // url flag 作为发布路径(模拟活动方的多目标发布)
  const slug = String(url || "main").replace(/[^a-z0-9-_]/gi, "");
  const file = path.join(dir, slug, `page-${Date.now()}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  const publicUrl = `http://localhost:${PORT}/p/${slug}/${path.basename(file)}`;
  console.log(`[mock-publish] ${slug} ← ${(html.length / 1024).toFixed(1)}KB → ${publicUrl}`);
  res.json({ url: publicUrl });
});

app.use("/p", express.static(dir));
app.listen(PORT, () => console.log(`[mock-publish] listening :${PORT}`));
