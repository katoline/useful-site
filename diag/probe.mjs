// 一時的な調査用：GitHub の実行環境で、Chromium の偽マイクと AudioContext が動くかを見る
import { chromium } from "playwright";
const executablePath = process.env.CHROME || undefined;
const browser = await chromium.launch({
  executablePath,
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
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
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100));
    out.samples.push({ t: i, state: ctx.state, time: Number(ctx.currentTime.toFixed(2)), osc: Number(rms(an1).toFixed(3)), mic: Number(rms(an2).toFixed(4)) });
  }
  out.sampleRate = ctx.sampleRate;
  return out;
});
console.log(JSON.stringify(result, null, 1));
await browser.close();
