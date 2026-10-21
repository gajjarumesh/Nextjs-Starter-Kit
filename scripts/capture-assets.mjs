// Captures the sales-page assets from a running server (DEMO_MODE=true, seeded DB):
//   public/screenshots/<screen>-<light|dark>.jpg  and  public/media/launchkit-tour.{mp4,vtt}
// The video is built from Chrome screencast frames and encoded with the system ffmpeg (H.264).
// Usage: BASE_URL=http://localhost:3000 node scripts/capture-assets.mjs [--video] [--shots]
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const args = new Set(process.argv.slice(2));
const doShots = args.has("--shots") || args.size === 0;
const doVideo = args.has("--video") || args.size === 0;
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const ip = () =>
  `10.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}.${(Math.random() * 250) | 0}`;
const HIDE_DEMO_CHROME = `[aria-label="Demo"],[aria-label="Guided tour"],button:has(> .lucide-compass){display:none!important}`;

async function startDemo(page, role = "OWNER") {
  await page.goto(`${BASE}/demo`);
  if (role !== "OWNER") await page.getByRole("radio", { name: new RegExp(role, "i") }).click();
  await page.getByRole("button", { name: /Start the demo/ }).click();
  await page.waitForURL(/acme-demo-[a-z0-9]+\/dashboard/);
  return new URL(page.url()).pathname.split("/")[1];
}

if (doShots) {
  mkdirSync("public/screenshots", { recursive: true });
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
      extraHTTPHeaders: { "x-forwarded-for": ip() },
    });
    const page = await ctx.newPage();
    const slug = await startDemo(page);
    const shoot = async (path, name, before) => {
      await page.goto(`${BASE}/${slug}${path}`, { waitUntil: "networkidle" });
      await page.addStyleTag({ content: HIDE_DEMO_CHROME });
      if (before) await before();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `public/screenshots/${name}-${theme}.jpg`,
        type: "jpeg",
        quality: 82,
      });
    };
    await shoot("/dashboard", "dashboard");
    await shoot("/members", "members");
    await shoot("/settings/billing", "billing");
    await shoot("/ai", "ai", async () => {
      await page.getByLabel("Message").fill("Give me 3 ideas to reduce churn");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await page.waitForTimeout(4000);
      await page.addStyleTag({ content: HIDE_DEMO_CHROME });
    });
    await shoot("/settings/audit-log", "audit");
    await ctx.close();

    // Super-admin console (seeded super admin; never part of the public demo).
    const admin = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: theme,
      extraHTTPHeaders: { "x-forwarded-for": ip() },
    });
    const ap = await admin.newPage();
    await ap.goto(`${BASE}/sign-in`);
    await ap.getByLabel("Email").fill("superadmin@demo.test");
    await ap.getByLabel("Password").fill("password123");
    await ap.getByRole("button", { name: "Sign in" }).click();
    await ap.waitForURL(/onboarding|admin|dashboard/);
    await ap.goto(`${BASE}/admin/organizations`, { waitUntil: "networkidle" });
    await ap.screenshot({
      path: `public/screenshots/admin-${theme}.jpg`,
      type: "jpeg",
      quality: 82,
    });
    await admin.close();
  }
  console.log("screenshots:", readdirSync("public/screenshots").join(", "));
}

if (doVideo) {
  const dir = "scripts/.video-tmp";
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    extraHTTPHeaders: { "x-forwarded-for": ip() },
  });
  const page = await ctx.newPage();
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({
      data: f.data,
      at: f.metadata.timestamp ? f.metadata.timestamp * 1000 : Date.now(),
    });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 85,
    maxWidth: 1280,
    maxHeight: 720,
  });
  const t0 = Date.now();
  const cues = [];
  let current = null;

  // Burned-in caption so the video works without sound; the same text goes into the VTT track.
  async function caption(text) {
    const now = (Date.now() - t0) / 1000;
    if (current) cues.push({ ...current, end: now });
    current = { start: now, text };
    await page.evaluate((t) => {
      let el = document.getElementById("lk-caption");
      if (!el) {
        el = document.createElement("div");
        el.id = "lk-caption";
        el.style.cssText =
          "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;max-width:880px;padding:10px 18px;border-radius:12px;background:rgba(15,15,25,.88);color:#fff;font:600 19px/1.35 system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.35);pointer-events:none";
        document.body.appendChild(el);
      }
      el.textContent = t;
    }, text);
  }
  const keepCaption = async () => current && (await caption(current.text)) && cues.pop();
  const pause = (ms) => page.waitForTimeout(ms);
  const tour = () => page.getByRole("complementary", { name: "Guided tour" });
  const next = async () => {
    await tour()
      .getByRole("button", { name: /Next|Finish/ })
      .click();
    await page.waitForLoadState("networkidle");
  };

  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await caption("LaunchKit: Next.js SaaS source code. Pay once, own it.");
  await pause(3500);
  await page.goto(`${BASE}/demo`, { waitUntil: "networkidle" });
  await caption("The live demo: pick a role. No sign-up, no email.");
  await pause(4000);
  await page.getByRole("button", { name: /Start the demo/ }).click();
  await page.waitForURL(/acme-demo-[a-z0-9]+\/dashboard/);
  await page.waitForLoadState("networkidle");

  await caption("1/7 Dashboard: a real multi-tenant app with plan, AI usage and recent activity.");
  await pause(7000);
  await next();
  await caption(
    "2/7 Metered AI: a streaming chat. Every message is counted against the plan quota.",
  );
  await page.getByLabel("Message").fill("Draft a friendly welcome email for new customers");
  await pause(1200);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await pause(9000);
  await next();
  await caption("3/7 Invitations and roles. In the demo, emails are captured instead of sent.");
  await pause(2000);
  await page.getByRole("button", { name: "Invite member" }).click();
  await page.getByLabel("Email").pressSequentially("teammate@example.com", { delay: 40 });
  await pause(800);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await pause(4500);
  await keepCaption();
  await next();
  await caption("4/7 Switch to Viewer: the Invite button disappears, and the server refuses too.");
  await pause(2500);
  await tour().getByRole("button", { name: "Switch to Viewer" }).click();
  await pause(6500);
  await keepCaption();
  await next();
  await caption("5/7 Tenant isolation: try to open another customer's organization.");
  await pause(2500);
  await tour().getByRole("button", { name: "Try to open Globex Demo" }).click();
  await pause(1500);
  await caption("5/7 It returns 404. Outsiders cannot even confirm the organization exists.");
  await pause(6000);
  await next();
  await caption("6/7 Billing needs the Owner role, so switch back.");
  await pause(2500);
  await tour().getByRole("button", { name: "Switch back to Owner" }).click();
  await pause(3000);
  await caption("6/7 Stripe and Razorpay behind one interface. Test mode only.");
  await keepCaption();
  await pause(6500);
  await next();
  await caption("7/7 Audit log, filtered to today: every action from the tour is recorded.");
  await pause(7500);
  await next();
  await caption("That's the tour. Buy LaunchKit once and own the code.");
  await pause(5000);
  if (current) cues.push({ ...current, end: (Date.now() - t0) / 1000 });

  const end = Date.now();
  await cdp.send("Page.stopScreencast");
  await ctx.close();

  // Each frame lasts until the next one (the screencast only emits on change).
  const list = [];
  frames.forEach((f, i) => {
    const file = `${dir}/f${String(i).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(f.data, "base64"));
    const until = frames[i + 1]?.at ?? end;
    list.push(
      `file '${file.replace(`${dir}/`, "")}'`,
      `duration ${Math.max(0.01, (until - f.at) / 1000).toFixed(3)}`,
    );
  });
  list.push(`file 'f${String(frames.length - 1).padStart(5, "0")}.jpg'`);
  writeFileSync(`${dir}/list.txt`, list.join("\n"));
  mkdirSync("public/media", { recursive: true });
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    `${dir}/list.txt`,
    "-vf",
    "fps=25,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "27",
    "-movflags",
    "+faststart",
    "public/media/launchkit-tour.mp4",
  ]);
  rmSync(dir, { recursive: true, force: true });
  // Caption times are measured from t0; the first frame may arrive slightly later.
  const offset = Math.max(0, (frames[0]?.at ?? t0) - t0) / 1000;
  for (const c of cues) {
    c.start = Math.max(0, c.start - offset);
    c.end = Math.max(0, c.end - offset);
  }
  const ts = (s) => {
    const ms = Math.max(0, Math.round(s * 1000));
    const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
    const m = String(Math.floor(ms / 60_000) % 60).padStart(2, "0");
    const sec = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
    return `${h}:${m}:${sec}.${String(ms % 1000).padStart(3, "0")}`;
  };
  const kept = cues.filter((c) => c.end - c.start >= 0.25);
  writeFileSync(
    "public/media/launchkit-tour.vtt",
    "WEBVTT\n\n" +
      kept.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"),
  );
  console.log(`video: ${((Date.now() - t0) / 1000).toFixed(0)}s, ${kept.length} captions`);
}
await browser.close();
