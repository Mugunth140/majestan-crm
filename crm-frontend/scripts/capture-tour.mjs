// Re-captures the product-tour screenshots in public/onboarding from the local CRM.
//
//   cd <dir with admin.tok and names.json> && node <repo>/crm-frontend/scripts/capture-tour.mjs [name-prefix]
//   then: for f in tour/*.png; do magick "$f" -quality 80 -define webp:method=6 public/onboarding/$(basename "$f" .png).webp; done
//
// admin.tok: an admin JWT signed with the backend container's JWT_SECRET.
// names.json: a JSON array of real lead names in the local database. API responses are
// rewritten so names, phone numbers and emails become made-up ones: these images are public.
// Zoom regions in components/onboarding/tour-data.ts are in 1440×900 page pixels; recheck them after a recapture.
import { createRequire } from "module";
import { readFileSync } from "fs";
const require = createRequire("/run/media/zendex/Dev/work/Majestan/site/majestan-frontend/package.json");
const { chromium } = require("playwright-core");
const only = process.argv[2];
const token = readFileSync("admin.tok", "utf8").trim();
const user = JSON.stringify({ id: 1, name: "Admin User", email: "admin@local", role: "Admin", department_id: null });

// Made-up people, so no real customer ends up in a public image.
const FAKE = ["Arjun Mehta", "Kavya Raman", "Rahul Nair", "Divya Iyer", "Karthik Subramanian", "Sneha Pillai", "Vikram Rao", "Ananya Krishnan",
  "Rohan Das", "Meera Venkatesh", "Aditya Sharma", "Lakshmi Narayanan", "Nikhil Menon", "Pooja Reddy", "Suresh Babu", "Harini Gopal",
  "Varun Shetty", "Ishaan Kapoor", "Nandini Rao", "Prakash Murthy", "Deepa Srinivasan", "Ajay Kumar", "Revathi Mohan", "Siddharth Jain"];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const fakeName = (s) => FAKE[hash(s) % FAKE.length];
const fakePhone = (s) => "98" + String(40000000 + (hash(s) % 9999999)).padStart(8, "0");
const PHONE_KEY = /mobile|phone|whatsapp|contact_no|contact_number|alternate/i;
const PERSON_KEY = /^(name|lead_name|owner_name|customer_name|contact_name|client_name|full_name|buyer_name|seller_name|caller_name)$/i;
const STAFF = new Set(["Admin User", "Tele Staff", "Sales Staff", "Sync Test", "Perm Test"]);
const REAL = JSON.parse(readFileSync("names.json", "utf8")).filter((n) => n.length > 3 && ![...STAFF].some((u) => u.includes(n))).sort((a, b) => b.length - a.length);
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const realRe = new RegExp(`\\b(${REAL.map(esc).join("|")})\\b`, "g");
const digits = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g;

function scrub(v, parentHasPhone = false) {
  if (Array.isArray(v)) return v.map((x) => scrub(x));
  if (v && typeof v === "object") {
    const hasPhone = Object.keys(v).some((k) => PHONE_KEY.test(k));
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === "string" && PHONE_KEY.test(k) && /\d{6,}/.test(x)) out[k] = fakePhone(x);
      else if (typeof x === "string" && /email/i.test(k) && x.includes("@")) out[k] = STAFF.has(v.name) ? x : fakeName(x).toLowerCase().replace(" ", ".") + "@example.com";
      else if (typeof x === "string" && PERSON_KEY.test(k) && (k !== "name" || hasPhone) && !STAFF.has(x)) out[k] = fakeName(x);
      else out[k] = scrub(x, hasPhone);
    }
    return out;
  }
  if (typeof v === "string") return v.replace(digits, (m) => fakePhone(m)).replace(realRe, (m) => (STAFF.has(m) ? m : fakeName(m)));
  return v;
}

const SHOTS = [
  { name: "dashboard", path: "/" },
  { name: "dashboard-light", path: "/", scheme: "light" },
  { name: "leads-list", path: "/leads", view: "list" },
  { name: "leads-kanban", path: "/leads", view: "kanban" },
  { name: "leads-group", path: "/leads", view: "group" },
  { name: "lead-record", path: "/leads/12" },
  { name: "lead-activity", path: "/leads/12", tab: "Activity" },
  { name: "lead-conversation", path: "/leads/12", tab: "Conversation" },
  { name: "assets", path: "/asset-inventory" },
  { name: "asset-record", path: "/asset-inventory/5" },
  { name: "lead-edit", path: "/leads/12", edit: "Mumbai" },
  { name: "scheduler", path: "/scheduler" },
  { name: "notifications", path: "/leads", click: "#notifications-btn" },
  { name: "search", path: "/", keys: "Control+k" },
  { name: "update", path: "/", update: true },
];

const browser = await chromium.launch({ executablePath: `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell` });
const leaks = {};
for (const s of SHOTS) {
  if (only && !s.name.startsWith(only)) continue;
  const scheme = s.scheme ?? "dark";
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: scheme });
  await ctx.addCookies([{ name: "crm_token", value: token, url: "http://localhost:4000" }]);
  await ctx.addInitScript(([t, u, sc, view]) => {
    localStorage.setItem("crm_token", t); localStorage.setItem("crm_user", u); localStorage.setItem("theme", sc);
    if (view) sessionStorage.setItem("crm_view:1:leads:view", JSON.stringify(view));
  }, [token, user, scheme, s.view ?? null]);
  await ctx.route(/\/app-version/, (r) => s.update ? r.fulfill({ json: { buildId: "sim", version: "2.2.0", releases: [] } }) : r.fulfill({ status: 404, body: "" }));
  await ctx.route(/\/api\/v1\//, async (r) => {
    try {
      const res = await r.fetch();
      const ct = res.headers()["content-type"] ?? "";
      if (!ct.includes("json")) return r.fulfill({ response: res });
      const body = scrub(await res.json());
      return r.fulfill({ response: res, json: body });
    } catch { return r.continue(); }
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:4000${s.path}`, { waitUntil: "load" });
  await page.waitForTimeout(s.update ? 7000 : 5000);
  if (s.tab) { await page.getByRole("tab", { name: new RegExp(`^${s.tab}`) }).first().click(); await page.waitForTimeout(1500); }
  if (s.openFirst) { await page.locator("main table tbody tr, main [role=row] a, main a[href^='/asset-inventory/']").first().click(); await page.waitForTimeout(4000); }
  if (s.edit === true) { const f = page.locator("main button, main [role=button]").filter({ hasText: /Lakhs|Cr|Acres/ }).first(); await f.click().catch((e) => console.log("edit", e.message.slice(0, 80))); await page.waitForTimeout(1000); }
  else if (s.edit) { await page.getByText(s.edit, { exact: true }).first().click().catch((e) => console.log("edit", e.message.slice(0, 80))); await page.waitForTimeout(1000); }
  if (s.click) { await page.click(s.click); await page.waitForTimeout(1500); }
  if (s.keys) { await page.keyboard.press(s.keys); await page.waitForTimeout(1200); }
  await page.mouse.move(1430, 890);
  await page.waitForTimeout(400);
  const left = await page.evaluate(() => (document.body.innerText.match(/(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/g) ?? []).filter((n) => !n.replace(/\D/g, "").startsWith("98")));
  if (left.length) leaks[s.name] = left.slice(0, 5);
  await page.screenshot({ path: `tour/${s.name}.png` });
  console.log(s.name, page.url());
  await ctx.close();
}
console.log("leaks", JSON.stringify(leaks));
await browser.close();
