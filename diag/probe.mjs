// 一時的な調査用：GitHub の実行環境で、Chromium の偽マイクと AudioContext が動くかを見る
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
const sr = 48000, data = Buffer.alloc(sr * 2);
for (let i = 0; i < sr; i++) data.writeInt16LE(Math.round(0.25 * 32767 * Math.sin((2 * Math.PI * 440 * i) / sr)), i * 2);
const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2, 28);
h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
writeFileSync("/tmp/tone.wav", Buffer.concat([h, data]));
const extra = process.env.WAV ? ["--use-file-for-fake-audio-capture=/tmp/tone.wav"] : [];
const executablePath = process.env.CHROME || undefined;
const browser = await chromium.launch({
  executablePath,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", ...extra],
});
const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();
page.on("console", (m) => console.log("console:", m.text()));
await page.goto("https://example.com/");
const result = await page.evaluate(async () => {
  const out = {};
  const ctx = new AudioContext();
  out.initialState = ctx.state;
  ctx.resume();
  const osc = ctx.createOscillator();
  const an1 = ctx.createAnalyser();
  osc.connect(an1);
  osc.start();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  out.track = stream.getAudioTracks().map((t) => ({ label: t.label, state: t.readyState, muted: t.muted }));
  const an2 = ctx.createAnalyser();
  ctx.createMediaStreamSource(stream).connect(an2);
  const buf = new Float32Array(2048);
  const rms = (an) => { an.getFloatTimeDomainData(buf); return Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length); };
  out.samples = [];
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 100));
    out.samples.push({ t: i, state: ctx.state, time: Number(ctx.currentTime.toFixed(2)), osc: Number(rms(an1).toFixed(3)), mic: Number(rms(an2).toFixed(4)) });
  }
  out.sampleRate = ctx.sampleRate;
  return out;
});
console.log("state", result.initialState, "rate", result.sampleRate, JSON.stringify(result.track));
console.log("mic", JSON.stringify(result.samples.map((x) => x.mic)));
console.log("osc", JSON.stringify(result.samples.map((x) => x.osc)));
await browser.close();
