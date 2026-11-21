import puppeteer from "puppeteer-core";
import fs from "node:fs";
const secs = JSON.parse(fs.readFileSync("../sections.json", "utf8"));
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36");
await p.setViewport({ width: 1400, height: 1000 });
const found = new Map();
p.on("response", async r => {
  if (!/BoardSectionPinsResource|BoardFeedResource/.test(r.url())) return;
  try { const j = await r.json(); for (const d of j.resource_response?.data || []) if (d.id && d.images) found.set(d.id, d); } catch {}
});
const results = [];
for (const s of secs) {
  found.clear();
  await p.goto(`https://ca.pinterest.com/mbaskhairoun/our-wedding/${s.slug}/`, { waitUntil: "networkidle2", timeout: 60000 });
  for (let i = 0; i < 5 && found.size < s.pins; i++) { await p.evaluate(() => window.scrollBy(0, 1500)); await new Promise(r => setTimeout(r, 1200)); }
  console.log(s.slug, "expected", s.pins, "captured", found.size, "| login wall:", await p.evaluate(() => !!document.querySelector('[data-test-id="login-modal"], [data-test-id="signup-modal"], form[name="loginForm"]')));
  for (const d of found.values()) results.push({ section: s.title, sectionSlug: s.slug, sectionId: s.id, id: d.id, title: (d.grid_title || d.title || "").trim(), description: (d.description || "").trim(), img: d.images?.orig?.url, width: d.images?.orig?.width, height: d.images?.orig?.height, link: d.link || null, color: d.dominant_color || null, createdAt: d.created_at || null, pinUrl: "https://www.pinterest.com/pin/" + d.id + "/" });
}
console.log(JSON.stringify({count: results.length}, null, 1));
fs.writeFileSync("../pins.json", JSON.stringify(results, null, 1)); await b.close();
