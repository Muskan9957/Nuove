const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title = "Nuove – Developer KT";
pres.author = "Nuove Product Team";

// ── palette ──────────────────────────────────────────
const BG      = "0D1B2A";   // deep navy
const BG2     = "111E2E";   // slightly lighter card bg
const CYAN    = "00D4FF";   // brand gradient stop 1
const PINK    = "FF2D8B";   // brand gradient stop 2
const GOLD    = "FFB800";   // brand gradient stop 3
const WHITE   = "FFFFFF";
const LIGHT   = "B0C4D8";   // muted body text
const CARD    = "162030";   // card surface
const RULE    = "1E3248";   // subtle divider

// ── helpers ──────────────────────────────────────────
function bg(slide) {
  slide.background = { color: BG };
}

function gradBar(slide) {
  // Three-segment gradient bar at top (simulated)
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 3.34, h: 0.06, fill: { color: CYAN }, line: { color: CYAN } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 3.34, y: 0, w: 3.33, h: 0.06, fill: { color: PINK }, line: { color: PINK } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 6.67, y: 0, w: 3.33, h: 0.06, fill: { color: GOLD }, line: { color: GOLD } });
}

function footer(slide, txt = "nuove.in") {
  slide.addText(txt, {
    x: 0, y: 5.35, w: 10, h: 0.28,
    fontSize: 9, color: "3A5570", align: "center",
    fontFace: "Arial", margin: 0
  });
}

function slideTitle(slide, title, y = 0.25) {
  slide.addText(title, {
    x: 0.5, y, w: 9, h: 0.55,
    fontSize: 28, bold: true, color: WHITE, fontFace: "Arial Black",
    margin: 0
  });
}

function dot(slide, x, y, color = CYAN) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: 0.10, h: 0.10, fill: { color }, line: { color } });
}

function card(slide, x, y, w, h, color = CARD) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x, y, w, h,
    fill: { color },
    line: { color: RULE, width: 1 },
    shadow: { type: "outer", blur: 8, offset: 2, angle: 135, color: "000000", opacity: 0.25 }
  });
}

function accentBox(slide, x, y, w, h, color = CYAN) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color }, line: { color } });
}

function stepArrow(slide, x, y) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y: y + 0.09, w: 0.3, h: 0.04, fill: { color: CYAN }, line: { color: CYAN } });
  slide.addText("→", { x, y, w: 0.3, h: 0.24, fontSize: 13, color: CYAN, align: "center", margin: 0, fontFace: "Arial" });
}

// ════════════════════════════════════════════════════
// SLIDE 1 — TITLE
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);

  // Big gradient-coloured background shape behind logo area
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: BG }, line: { color: BG } });

  // Diagonal accent blocks top-right
  s.addShape(pres.shapes.RECTANGLE, { x: 7.5, y: 0, w: 2.5, h: 2, fill: { color: "0A1520" }, line: { color: "0A1520" } });
  s.addShape(pres.shapes.RECTANGLE, { x: 8.5, y: 0, w: 1.5, h: 5.625, fill: { color: "091219" }, line: { color: "091219" } });

  // Cyan glow block
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 3.8, w: 10, h: 0.04, fill: { color: CYAN }, line: { color: CYAN }, transparency: 80 });

  // Gradient bar top
  gradBar(s);

  // "N" mono-lettermark large faded background
  s.addText("N", {
    x: 7.2, y: 0.3, w: 2.5, h: 3.5,
    fontSize: 280, bold: true, color: "0F2035",
    fontFace: "Arial Black", align: "center", margin: 0
  });

  // Main title
  s.addText("Welcome to Nuove", {
    x: 0.55, y: 1.0, w: 7.2, h: 1.0,
    fontSize: 46, bold: true, color: WHITE,
    fontFace: "Arial Black", margin: 0
  });

  // Cyan underline accent word
  s.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 2.0, w: 2.1, h: 0.055, fill: { color: CYAN }, line: { color: CYAN } });

  // Subtitle
  s.addText("Developer Onboarding & Knowledge Transfer", {
    x: 0.55, y: 2.15, w: 7.2, h: 0.55,
    fontSize: 20, color: LIGHT, fontFace: "Arial", margin: 0
  });

  // Tagline
  s.addText("AI-powered content creation for Indian creators", {
    x: 0.55, y: 2.78, w: 7.2, h: 0.42,
    fontSize: 14, color: "4A7A9B", fontFace: "Arial", italic: true, margin: 0
  });

  // Three brand pills
  const pills = [
    { label: "React + Vite", color: CYAN },
    { label: "Node.js", color: PINK },
    { label: "nuove.in", color: GOLD },
  ];
  pills.forEach((p, i) => {
    const px = 0.55 + i * 2.0;
    s.addShape(pres.shapes.RECTANGLE, { x: px, y: 3.55, w: 1.7, h: 0.38, fill: { color: p.color }, line: { color: p.color }, rectRadius: 0.04 });
    s.addText(p.label, { x: px, y: 3.55, w: 1.7, h: 0.38, fontSize: 11, bold: true, color: BG, fontFace: "Arial", align: "center", margin: 0 });
  });

  footer(s, "nuove.in  •  Developer KT  •  Confidential");
}

// ════════════════════════════════════════════════════
// SLIDE 2 — WHAT IS NUOVE?
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);

  slideTitle(s, "What Are We Building?");

  // Left column — description
  card(s, 0.4, 0.95, 5.4, 3.95);

  s.addText("Nuove", {
    x: 0.65, y: 1.1, w: 4.9, h: 0.45,
    fontSize: 22, bold: true, color: CYAN, fontFace: "Arial Black", margin: 0
  });

  const bullets = [
    "AI app for Indian Instagram Reels & YouTube Shorts creators",
    "Generates scripts, provides teleprompter + recorder, crossposts captions",
    "Target users: Indian content creators aged 18–35",
    "Live at: nuove.in",
    "Platforms: Web + iOS App Store + Google Play Store (coming soon)",
  ];

  bullets.forEach((b, i) => {
    dot(s, 0.7, 1.67 + i * 0.56, CYAN);
    s.addText(b, {
      x: 0.9, y: 1.61 + i * 0.56, w: 4.6, h: 0.46,
      fontSize: 12.5, color: WHITE, fontFace: "Arial",
      margin: 0, valign: "middle"
    });
  });

  // Right column — 3 stat cards
  const stats = [
    { val: "116", label: "User Stories\nin the PRD", color: CYAN },
    { val: "8", label: "Weeks to\nApp Store", color: PINK },
    { val: "2", label: "Platforms\niOS + Android", color: GOLD },
  ];
  stats.forEach((st, i) => {
    const sy = 1.0 + i * 1.35;
    card(s, 6.1, sy, 3.5, 1.2, "1A2E42");
    s.addShape(pres.shapes.RECTANGLE, { x: 6.1, sy, w: 0.08, h: 1.2, fill: { color: st.color }, line: { color: st.color } });
    s.addText(st.val, {
      x: 6.35, y: sy + 0.08, w: 1.2, h: 0.65,
      fontSize: 38, bold: true, color: st.color, fontFace: "Arial Black", margin: 0
    });
    s.addText(st.label, {
      x: 7.55, y: sy + 0.2, w: 1.9, h: 0.7,
      fontSize: 11, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle"
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 3 — TECH STACK
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Our Tech Stack");

  const stack = [
    { layer: "Frontend", tech: "React + Vite", host: "Vercel → nuove.in", color: CYAN },
    { layer: "Backend",  tech: "Node.js + Express", host: "Railway",        color: "7C6AFF" },
    { layer: "Database", tech: "PostgreSQL",   host: "Railway Add-on",      color: PINK },
    { layer: "AI",       tech: "Anthropic Claude API", host: "Anthropic",   color: GOLD },
    { layer: "Payments", tech: "Razorpay",     host: "India Payments",      color: "00C9A7" },
    { layer: "Email",    tech: "Resend.com",   host: "noreply@nuove.in",    color: "FF7A59" },
    { layer: "Errors",   tech: "Sentry",       host: "Error Tracking",      color: "F55353" },
  ];

  stack.forEach((item, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i < 4 ? i : i - 4;
    const cx = col === 0 ? 0.4 : 5.2;
    const cy = 1.05 + row * 1.12;

    card(s, cx, cy, 4.6, 0.96);
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: 0.07, h: 0.96, fill: { color: item.color }, line: { color: item.color } });

    s.addText(item.layer.toUpperCase(), {
      x: cx + 0.2, y: cy + 0.07, w: 1.5, h: 0.3,
      fontSize: 9, color: item.color, bold: true, fontFace: "Arial",
      charSpacing: 2, margin: 0
    });
    s.addText(item.tech, {
      x: cx + 0.2, y: cy + 0.33, w: 2.8, h: 0.35,
      fontSize: 15, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0
    });
    s.addText(item.host, {
      x: cx + 0.2, y: cy + 0.64, w: 4.2, h: 0.25,
      fontSize: 10, color: LIGHT, fontFace: "Arial", margin: 0
    });
  });

  // Connector arrow between columns
  s.addText("←  All requests flow through  →", {
    x: 0.4, y: 5.05, w: 9.2, h: 0.3,
    fontSize: 10, color: "3A5570", italic: true, align: "center", fontFace: "Arial", margin: 0
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 4 — CODEBASE STRUCTURE
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "How The Code Is Organised");

  // Left — Frontend
  card(s, 0.35, 0.95, 4.55, 4.3);
  accentBox(s, 0.35, 0.95, 4.55, 0.38, "0E2840");
  s.addText("FRONTEND  /ai-reel-coach-frontend/src/", {
    x: 0.5, y: 0.97, w: 4.25, h: 0.34,
    fontSize: 10, bold: true, color: CYAN, fontFace: "Arial", margin: 0, valign: "middle"
  });

  const fe = [
    { path: "pages/", desc: "One file per screen (Generate, Record, Crosspost…)", color: CYAN },
    { path: "components/", desc: "Reusable UI: Logo, Layout, Nav", color: CYAN },
    { path: "store.jsx", desc: "Global auth state (user token, plan)", color: CYAN },
    { path: "api.js", desc: "ALL backend API calls live here", color: GOLD },
    { path: "i18n.jsx", desc: "All text & translations", color: LIGHT },
    { path: "index.css", desc: "Global styles & CSS variables", color: LIGHT },
  ];

  fe.forEach((f, i) => {
    s.addText(f.path, {
      x: 0.55, y: 1.45 + i * 0.52, w: 1.6, h: 0.38,
      fontSize: 11, bold: true, color: f.color, fontFace: "Consolas", margin: 0, valign: "middle"
    });
    s.addText(f.desc, {
      x: 2.2, y: 1.45 + i * 0.52, w: 2.55, h: 0.38,
      fontSize: 10.5, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle"
    });
    if (i < fe.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, { x: 0.55, y: 1.82 + i * 0.52, w: 4.1, h: 0.01, fill: { color: RULE }, line: { color: RULE } });
    }
  });

  // Right — Backend
  card(s, 5.1, 0.95, 4.55, 4.3);
  accentBox(s, 5.1, 0.95, 4.55, 0.38, "0E2840");
  s.addText("BACKEND  /src/", {
    x: 5.25, y: 0.97, w: 4.25, h: 0.34,
    fontSize: 10, bold: true, color: PINK, fontFace: "Arial", margin: 0, valign: "middle"
  });

  const be = [
    { path: "routes/", desc: "URL endpoints: /auth, /generate, /scripts…", color: PINK },
    { path: "controllers/", desc: "Business logic for each route", color: PINK },
    { path: "services/", desc: "AI calls, emails, Razorpay payments", color: GOLD },
    { path: "config/", desc: "Passport (Google OAuth), DB connection", color: LIGHT },
    { path: "app.js", desc: "Server entry point, CORS, middleware", color: LIGHT },
  ];

  be.forEach((f, i) => {
    s.addText(f.path, {
      x: 5.3, y: 1.45 + i * 0.63, w: 1.6, h: 0.45,
      fontSize: 11, bold: true, color: f.color, fontFace: "Consolas", margin: 0, valign: "middle"
    });
    s.addText(f.desc, {
      x: 6.95, y: 1.45 + i * 0.63, w: 2.55, h: 0.45,
      fontSize: 10.5, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle"
    });
    if (i < be.length - 1) {
      s.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: 1.88 + i * 0.63, w: 4.1, h: 0.01, fill: { color: RULE }, line: { color: RULE } });
    }
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 5 — FEATURE FLOW
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Tracing a Feature: Script Generator");

  const steps = [
    { n: "1", text: "User types topic in Generate.jsx", sub: "Frontend — React page component" },
    { n: "2", text: "api.js sends POST /api/generate", sub: "All backend calls go through api.js" },
    { n: "3", text: "routes/generate.js receives request", sub: "Backend — Express router" },
    { n: "4", text: "generateController.js handles logic", sub: "Validates, calls AI service" },
    { n: "5", text: "aiService.js calls Anthropic API", sub: "AI generates the script" },
    { n: "6", text: "Response streams back to frontend", sub: "Generate.jsx renders word by word" },
  ];

  steps.forEach((st, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const sx = col === 0 ? 0.35 : 5.15;
    const sy = 1.1 + row * 1.45;

    // Number badge
    const numColor = i === 0 ? CYAN : i === 4 ? GOLD : i === 5 ? PINK : "2A4A6A";
    s.addShape(pres.shapes.OVAL, { x: sx, y: sy, w: 0.52, h: 0.52, fill: { color: numColor }, line: { color: numColor } });
    s.addText(st.n, { x: sx, y: sy, w: 0.52, h: 0.52, fontSize: 16, bold: true, color: BG, fontFace: "Arial Black", align: "center", margin: 0 });

    // Step text
    s.addText(st.text, {
      x: sx + 0.65, y: sy, w: 4.0, h: 0.32,
      fontSize: 13, bold: true, color: WHITE, fontFace: "Arial", margin: 0
    });
    s.addText(st.sub, {
      x: sx + 0.65, y: sy + 0.3, w: 4.0, h: 0.22,
      fontSize: 10, color: LIGHT, fontFace: "Arial", italic: true, margin: 0
    });

    // Connector line between steps
    if (row < 2) {
      s.addShape(pres.shapes.RECTANGLE, {
        x: sx + 0.22, y: sy + 0.55, w: 0.08, h: 0.88,
        fill: { color: RULE }, line: { color: RULE }
      });
    }
  });

  // Bottom note
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 5.05, w: 9.3, h: 0.32, fill: { color: "0A1E30" }, line: { color: CYAN } });
  s.addText("Trace this yourself for 2 more features before starting work  →  Record, Crosspost", {
    x: 0.5, y: 5.06, w: 9.0, h: 0.30,
    fontSize: 10, color: CYAN, fontFace: "Arial", italic: true, margin: 0, valign: "middle"
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 6 — GIT WORKFLOW
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Git Workflow — Follow This Every Time");

  // BIG rule banner
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 0.88, w: 9.3, h: 0.62, fill: { color: PINK }, line: { color: PINK } });
  s.addText("NEVER push directly to main", {
    x: 0.35, y: 0.88, w: 9.3, h: 0.62,
    fontSize: 22, bold: true, color: WHITE, fontFace: "Arial Black",
    align: "center", margin: 0, valign: "middle"
  });

  const steps = [
    { cmd: "git checkout -b feature/your-feature-name", desc: "Always start a new branch" },
    { cmd: "make your changes...", desc: "Edit code in VS Code" },
    { cmd: "git add . && git commit -m 'what you did'", desc: "Stage and commit" },
    { cmd: "git push origin feature/your-feature-name", desc: "Push your branch to GitHub" },
    { cmd: "Create Pull Request on GitHub", desc: "Go to GitHub → your repo → New PR" },
    { cmd: "Wait for review & approval", desc: "Senior reviews your code" },
    { cmd: "Merged to main → auto-deploys", desc: "Vercel + Railway rebuild automatically" },
  ];

  steps.forEach((st, i) => {
    const sy = 1.65 + i * 0.52;
    const isCode = !st.cmd.includes("Wait") && !st.cmd.includes("Create") && !st.cmd.includes("Merged");
    const bgC = i % 2 === 0 ? "101D2C" : "0D1926";

    s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: sy, w: 9.3, h: 0.46, fill: { color: bgC }, line: { color: RULE } });

    // Step number
    s.addShape(pres.shapes.OVAL, { x: 0.42, y: sy + 0.09, w: 0.28, h: 0.28, fill: { color: CYAN }, line: { color: CYAN } });
    s.addText(String(i + 1), { x: 0.42, y: sy + 0.09, w: 0.28, h: 0.28, fontSize: 9, bold: true, color: BG, align: "center", margin: 0 });

    s.addText(st.cmd, {
      x: 0.82, y: sy + 0.05, w: 5.8, h: 0.36,
      fontSize: 11.5, bold: isCode, color: isCode ? CYAN : WHITE,
      fontFace: isCode ? "Consolas" : "Arial", margin: 0, valign: "middle"
    });
    s.addText(st.desc, {
      x: 6.7, y: sy + 0.07, w: 2.8, h: 0.32,
      fontSize: 10, color: LIGHT, fontFace: "Arial", italic: true, margin: 0, valign: "middle"
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 7 — ENV VARIABLES
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Environment Variables — Very Important");

  // Three rule cards top row
  const rules = [
    { title: ".env file", body: "Secret keys.\nNEVER commit\nto GitHub. Ever.", color: PINK, icon: "🔐" },
    { title: ".env.example", body: "Safe template,\nno real values.\nThis IS in GitHub.", color: CYAN, icon: "📄" },
    { title: "Production", body: "Set variables in\nRailway and\nVercel dashboards.", color: GOLD, icon: "🚀" },
  ];

  rules.forEach((r, i) => {
    const rx = 0.35 + i * 3.15;
    card(s, rx, 0.95, 3.0, 1.75, CARD);
    s.addShape(pres.shapes.RECTANGLE, { x: rx, y: 0.95, w: 3.0, h: 0.08, fill: { color: r.color }, line: { color: r.color } });
    s.addText(r.icon, { x: rx + 0.1, y: 1.1, w: 0.5, h: 0.5, fontSize: 22, margin: 0 });
    s.addText(r.title, {
      x: rx + 0.6, y: 1.1, w: 2.3, h: 0.38,
      fontSize: 14, bold: true, color: r.color, fontFace: "Arial Black", margin: 0
    });
    s.addText(r.body, {
      x: rx + 0.15, y: 1.52, w: 2.75, h: 0.95,
      fontSize: 11, color: WHITE, fontFace: "Arial", margin: 0, valign: "top"
    });
  });

  // Key variables list
  s.addText("KEY VARIABLES YOUR .env MUST HAVE:", {
    x: 0.35, y: 2.88, w: 9.3, h: 0.32,
    fontSize: 11, bold: true, color: CYAN, fontFace: "Arial", charSpacing: 2, margin: 0
  });

  const vars = [
    { name: "DATABASE_URL", desc: "PostgreSQL connection string (from Railway)" },
    { name: "JWT_SECRET", desc: "Random secret string for signing tokens" },
    { name: "ANTHROPIC_API_KEY", desc: "Claude AI key — NEVER expose to frontend" },
    { name: "RAZORPAY_KEY_ID / SECRET", desc: "Payment gateway credentials" },
    { name: "RESEND_API_KEY", desc: "Email service key" },
    { name: "FRONTEND_URL", desc: "https://nuove.in  (or localhost:5173 locally)" },
  ];

  vars.forEach((v, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const vx = col === 0 ? 0.35 : 5.15;
    const vy = 3.28 + row * 0.62;
    s.addShape(pres.shapes.RECTANGLE, { x: vx, y: vy, w: 4.6, h: 0.52, fill: { color: "101D2C" }, line: { color: RULE } });
    s.addText(v.name, {
      x: vx + 0.12, y: vy + 0.04, w: 2.2, h: 0.45,
      fontSize: 10.5, bold: true, color: GOLD, fontFace: "Consolas", margin: 0, valign: "middle"
    });
    s.addText(v.desc, {
      x: vx + 2.4, y: vy + 0.04, w: 2.1, h: 0.45,
      fontSize: 9.5, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle"
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 8 — AUTH FLOW
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "How Login Works (JWT Auth)");

  const nodes = [
    { label: "User logs in", sub: "Email + password", color: CYAN, x: 0.3 },
    { label: "Backend checks\ncredentials", sub: "authController.js", color: "7C6AFF", x: 2.0 },
    { label: "Creates JWT\ntoken", sub: "15 min expiry", color: PINK, x: 3.7 },
    { label: "Sends token\nto frontend", sub: "HTTP response", color: GOLD, x: 5.4 },
    { label: "Frontend stores\ntoken", sub: "store.jsx", color: CYAN, x: 7.1 },
  ];

  nodes.forEach((n, i) => {
    card(s, n.x, 1.2, 1.55, 1.35, "1A2E42");
    s.addShape(pres.shapes.RECTANGLE, { x: n.x, y: 1.2, w: 1.55, h: 0.07, fill: { color: n.color }, line: { color: n.color } });
    s.addText(n.label, {
      x: n.x + 0.08, y: 1.35, w: 1.4, h: 0.65,
      fontSize: 11, bold: true, color: WHITE, fontFace: "Arial", margin: 0, align: "center"
    });
    s.addText(n.sub, {
      x: n.x + 0.08, y: 2.0, w: 1.4, h: 0.4,
      fontSize: 9, color: LIGHT, fontFace: "Arial", italic: true, margin: 0, align: "center"
    });
    if (i < nodes.length - 1) {
      s.addText("→", {
        x: n.x + 1.58, y: 1.65, w: 0.38, h: 0.5,
        fontSize: 20, color: n.color, align: "center", margin: 0, fontFace: "Arial"
      });
    }
  });

  // Second row
  const nodes2 = [
    { label: "Token sent with\nevery request", sub: "api.js header", color: CYAN, x: 0.3 },
    { label: "Backend reads\ntoken", sub: "middleware/auth.js", color: "7C6AFF", x: 2.0 },
    { label: "Knows who\nthe user is", sub: "req.user available", color: PINK, x: 3.7 },
    { label: "Token expires\nin 15 min", sub: "Security feature", color: GOLD, x: 5.4 },
    { label: "Refresh token\nrenews silently", sub: "30 day lifetime", color: "00C9A7", x: 7.1 },
  ];

  nodes2.forEach((n, i) => {
    card(s, n.x, 2.95, 1.55, 1.35, "1A2E42");
    s.addShape(pres.shapes.RECTANGLE, { x: n.x, y: 2.95, w: 1.55, h: 0.07, fill: { color: n.color }, line: { color: n.color } });
    s.addText(n.label, {
      x: n.x + 0.08, y: 3.1, w: 1.4, h: 0.65,
      fontSize: 11, bold: true, color: WHITE, fontFace: "Arial", margin: 0, align: "center"
    });
    s.addText(n.sub, {
      x: n.x + 0.08, y: 3.75, w: 1.4, h: 0.4,
      fontSize: 9, color: LIGHT, fontFace: "Arial", italic: true, margin: 0, align: "center"
    });
    if (i < nodes2.length - 1) {
      s.addText("→", {
        x: n.x + 1.58, y: 3.4, w: 0.38, h: 0.5,
        fontSize: 20, color: n.color, align: "center", margin: 0, fontFace: "Arial"
      });
    }
  });

  s.addText("See store.jsx for token storage  •  See api.js to see how it's attached to requests", {
    x: 0.35, y: 5.06, w: 9.3, h: 0.3,
    fontSize: 10, color: "3A5570", italic: true, align: "center", fontFace: "Arial", margin: 0
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 9 — DEPLOYMENT FLOW
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "How Deployment Works");

  const steps = [
    { icon: "💻", label: "Push to\nyour branch", color: CYAN },
    { icon: "🔀", label: "Create\nPull Request", color: "7C6AFF" },
    { icon: "👀", label: "Senior\nreviews code", color: PINK },
    { icon: "✅", label: "Approved &\nmerged to main", color: GOLD },
    { icon: "⚡", label: "Vercel builds\nfrontend (2 min)", color: CYAN },
    { icon: "🚂", label: "Railway builds\nbackend (2 min)", color: "00C9A7" },
    { icon: "🌐", label: "Live on\nnuove.in", color: GOLD },
  ];

  steps.forEach((st, i) => {
    const sx = 0.28 + i * 1.36;
    card(s, sx, 1.1, 1.22, 1.55, "1A2E42");
    s.addShape(pres.shapes.RECTANGLE, { x: sx, y: 1.1, w: 1.22, h: 0.06, fill: { color: st.color }, line: { color: st.color } });
    s.addText(st.icon, {
      x: sx, y: 1.2, w: 1.22, h: 0.55,
      fontSize: 26, align: "center", margin: 0
    });
    s.addText(st.label, {
      x: sx + 0.05, y: 1.77, w: 1.12, h: 0.68,
      fontSize: 10.5, bold: true, color: WHITE, fontFace: "Arial", align: "center", margin: 0
    });
    if (i < steps.length - 1) {
      s.addText("→", {
        x: sx + 1.24, y: 1.55, w: 0.1, h: 0.4,
        fontSize: 16, color: LIGHT, align: "center", margin: 0, fontFace: "Arial"
      });
    }
  });

  // Warning box
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 2.9, w: 9.3, h: 0.7, fill: { color: "1F0A0A" }, line: { color: PINK, width: 2 } });
  s.addText("⚠️  If you break main, it breaks for REAL users on nuove.in  ⚠️", {
    x: 0.5, y: 2.9, w: 9.0, h: 0.7,
    fontSize: 16, bold: true, color: PINK, fontFace: "Arial Black",
    align: "center", margin: 0, valign: "middle"
  });

  // Process note
  s.addText("This is why we ALWAYS use branches and Pull Requests — never push directly to main", {
    x: 0.35, y: 3.75, w: 9.3, h: 0.4,
    fontSize: 12, color: LIGHT, fontFace: "Arial", align: "center", margin: 0, italic: true
  });

  // Two platform cards
  const platforms = [
    { name: "Vercel", desc: "Hosts the frontend React app\nAuto-deploys on every main push\nnuove.in custom domain connected", color: CYAN },
    { name: "Railway", desc: "Hosts the Node.js backend\nPostgreSQL database lives here\nSet all env vars in Railway dashboard", color: "00C9A7" },
  ];
  platforms.forEach((p, i) => {
    const px = 0.35 + i * 4.85;
    card(s, px, 4.25, 4.6, 1.05, CARD);
    s.addShape(pres.shapes.RECTANGLE, { x: px, y: 4.25, w: 0.07, h: 1.05, fill: { color: p.color }, line: { color: p.color } });
    s.addText(p.name, {
      x: px + 0.2, y: 4.3, w: 4.2, h: 0.32,
      fontSize: 14, bold: true, color: p.color, fontFace: "Arial Black", margin: 0
    });
    s.addText(p.desc, {
      x: px + 0.2, y: 4.62, w: 4.2, h: 0.6,
      fontSize: 10, color: LIGHT, fontFace: "Arial", margin: 0
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 10 — TOOLS & ACCESS
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Tools You Need Access To");

  const tools = [
    { icon: "💻", name: "GitHub",     purpose: "Code repository (2 repos)", action: "Get invited as collaborator",   color: WHITE },
    { icon: "▲",  name: "Vercel",     purpose: "Frontend hosting → nuove.in", action: "Get invited to team",          color: CYAN },
    { icon: "🚂", name: "Railway",    purpose: "Backend + PostgreSQL DB",    action: "Get invited to project",        color: "00C9A7" },
    { icon: "💳", name: "Razorpay",   purpose: "Payment processing",          action: "View-only team member",         color: GOLD },
    { icon: "📧", name: "Resend.com", purpose: "Transactional emails",        action: "Get API key for dev",           color: PINK },
    { icon: "🔍", name: "Sentry",     purpose: "Error tracking & monitoring", action: "Get invited to org",            color: "F55353" },
    { icon: "🌐", name: "Porkbun",    purpose: "Domain: nuove.in",            action: "Get login or DNS view access",  color: "7C6AFF" },
    { icon: "📮", name: "Postman",    purpose: "API testing (local + prod)",   action: "Download free at postman.com",  color: "FF7A59" },
  ];

  tools.forEach((t, i) => {
    const col = i < 4 ? 0 : 1;
    const row = i < 4 ? i : i - 4;
    const tx = col === 0 ? 0.35 : 5.15;
    const ty = 1.05 + row * 1.1;

    card(s, tx, ty, 4.6, 0.95);
    s.addText(t.icon, { x: tx + 0.1, y: ty + 0.15, w: 0.5, h: 0.55, fontSize: 22, margin: 0 });
    s.addText(t.name, {
      x: tx + 0.7, y: ty + 0.07, w: 1.8, h: 0.38,
      fontSize: 14, bold: true, color: t.color, fontFace: "Arial Black", margin: 0
    });
    s.addText(t.purpose, {
      x: tx + 0.7, y: ty + 0.46, w: 2.5, h: 0.36,
      fontSize: 10, color: LIGHT, fontFace: "Arial", margin: 0
    });
    s.addText(t.action, {
      x: tx + 3.2, y: ty + 0.18, w: 1.3, h: 0.55,
      fontSize: 9, color: CYAN, fontFace: "Arial", italic: true, margin: 0, align: "right", valign: "middle"
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 11 — TASK LIST
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Your Work Lives Here");

  // Primary doc card
  card(s, 0.35, 1.0, 9.3, 1.45, "0E2840");
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.0, w: 0.1, h: 1.45, fill: { color: CYAN }, line: { color: CYAN } });
  s.addText("PRIMARY", {
    x: 0.6, y: 1.05, w: 1.2, h: 0.28,
    fontSize: 9, bold: true, color: CYAN, fontFace: "Arial", charSpacing: 3, margin: 0
  });
  s.addText("Nuove_PRD_UserStories.xlsx", {
    x: 0.6, y: 1.3, w: 5.5, h: 0.4,
    fontSize: 18, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0
  });
  s.addText("116 user stories with detailed acceptance criteria. Your bible.", {
    x: 0.6, y: 1.7, w: 7.0, h: 0.28,
    fontSize: 11, color: LIGHT, fontFace: "Arial", italic: true, margin: 0
  });
  s.addShape(pres.shapes.OVAL, { x: 8.3, y: 1.18, w: 1.1, h: 1.1, fill: { color: CYAN }, line: { color: CYAN } });
  s.addText("116\nstories", {
    x: 8.3, y: 1.18, w: 1.1, h: 1.1,
    fontSize: 13, bold: true, color: BG, fontFace: "Arial Black", align: "center", margin: 0, valign: "middle"
  });

  // Secondary doc card
  card(s, 0.35, 2.6, 9.3, 0.9, CARD);
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 2.6, w: 0.1, h: 0.9, fill: { color: GOLD }, line: { color: GOLD } });
  s.addText("SECONDARY  →  Nuove_Production_Readiness_Tracker.xlsx  — infrastructure checklist (115 tasks)", {
    x: 0.6, y: 2.6, w: 8.9, h: 0.9,
    fontSize: 12, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle"
  });

  // Workflow pills
  const workflow = [
    { step: "Pick a P1 task", color: PINK },
    { step: "Create branch", color: CYAN },
    { step: "Build it", color: GOLD },
    { step: "Test on mobile", color: "00C9A7" },
    { step: "Create PR", color: CYAN },
    { step: "Mark Done ✓", color: "7C6AFF" },
  ];
  s.addText("WORKFLOW FOR EVERY TASK:", {
    x: 0.35, y: 3.65, w: 5.0, h: 0.3,
    fontSize: 10, bold: true, color: CYAN, fontFace: "Arial", charSpacing: 2, margin: 0
  });
  workflow.forEach((w, i) => {
    const wx = 0.35 + i * 1.56;
    s.addShape(pres.shapes.RECTANGLE, { x: wx, y: 4.05, w: 1.45, h: 0.45, fill: { color: w.color }, line: { color: w.color } });
    s.addText(w.step, {
      x: wx, y: 4.05, w: 1.45, h: 0.45,
      fontSize: 10, bold: true, color: BG, fontFace: "Arial", align: "center", margin: 0, valign: "middle"
    });
    if (i < workflow.length - 1) {
      s.addText("→", { x: wx + 1.47, y: 4.1, w: 0.08, h: 0.35, fontSize: 11, color: LIGHT, align: "center", margin: 0 });
    }
  });

  s.addText("Sprint plan (8 weeks) is in Sheet 3 of the PRD Excel", {
    x: 0.35, y: 4.65, w: 9.3, h: 0.3,
    fontSize: 11, color: LIGHT, fontFace: "Arial", italic: true, margin: 0
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 12 — FIRST TASK
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "Start Here — Your First Task");

  // Task card
  card(s, 0.35, 1.0, 9.3, 2.05, "0A1E30");
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.0, w: 9.3, h: 0.08, fill: { color: CYAN }, line: { color: CYAN } });
  s.addText("TASK: Add Empty State to Script History Page", {
    x: 0.55, y: 1.14, w: 8.9, h: 0.45,
    fontSize: 18, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0
  });
  s.addText("File to edit:", {
    x: 0.55, y: 1.62, w: 1.4, h: 0.3,
    fontSize: 11, color: LIGHT, fontFace: "Arial", margin: 0
  });
  s.addText("ai-reel-coach-frontend/src/pages/Scripts.jsx", {
    x: 2.0, y: 1.62, w: 5.5, h: 0.3,
    fontSize: 11, bold: true, color: CYAN, fontFace: "Consolas", margin: 0
  });

  const todos = [
    "When user has no saved scripts, show a friendly message instead of a blank screen",
    "Message: \"No scripts yet. Write your first one!\"",
    "Add a button: 'Generate Script' → navigates to /generate",
    "Match existing app design: dark theme, brand gradient colours, same card style",
  ];
  todos.forEach((t, i) => {
    dot(s, 0.55, 2.05 + i * 0.0, CYAN);
    s.addText(t, {
      x: 0.75, y: 2.0 + i * 0.3, w: 8.8, h: 0.28,
      fontSize: 11, color: WHITE, fontFace: "Arial", margin: 0
    });
  });

  // Why this task
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 3.22, w: 9.3, h: 0.35, fill: { color: "0E2840" }, line: { color: RULE } });
  s.addText("WHY THIS TASK?", {
    x: 0.5, y: 3.24, w: 2.0, h: 0.3,
    fontSize: 10, bold: true, color: GOLD, fontFace: "Arial", charSpacing: 2, margin: 0, valign: "middle"
  });
  s.addText("Find files independently  •  Understand data flow  •  Make UI change  •  Use git correctly  •  Create your first PR", {
    x: 2.5, y: 3.24, w: 7.0, h: 0.3,
    fontSize: 10, color: LIGHT, fontFace: "Arial", margin: 0, valign: "middle"
  });

  // Steps
  s.addText("HOW TO COMPLETE IT:", {
    x: 0.35, y: 3.72, w: 3.0, h: 0.28,
    fontSize: 10, bold: true, color: CYAN, fontFace: "Arial", charSpacing: 2, margin: 0
  });

  const howto = [
    { n: "1", t: "Open Scripts.jsx — find where the script list is rendered" },
    { n: "2", t: "Add a condition: if (scripts.length === 0) show your empty state" },
    { n: "3", t: "Style it to match the dark theme (use CSS variables from index.css)" },
    { n: "4", t: "Test in browser — works? Test on mobile too" },
    { n: "5", t: "git checkout -b feature/empty-state-scripts → commit → push → PR" },
  ];

  howto.forEach((h, i) => {
    s.addShape(pres.shapes.OVAL, { x: 0.35, y: 4.07 + i * 0.29, w: 0.22, h: 0.22, fill: { color: CYAN }, line: { color: CYAN } });
    s.addText(h.n, { x: 0.35, y: 4.07 + i * 0.29, w: 0.22, h: 0.22, fontSize: 8, bold: true, color: BG, align: "center", margin: 0 });
    s.addText(h.t, {
      x: 0.68, y: 4.07 + i * 0.29, w: 9.0, h: 0.25,
      fontSize: 10.5, color: WHITE, fontFace: "Arial", margin: 0, valign: "middle"
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 13 — 5 RULES
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);
  slideTitle(s, "5 Rules. No Exceptions.");

  const rules = [
    { icon: "🔐", rule: "Never commit .env or API keys to GitHub", detail: "Doing this exposes secrets publicly. Rotate ALL keys if it happens.", color: PINK },
    { icon: "🌿", rule: "Never push directly to main", detail: "Always use a branch + Pull Request. Main = production.", color: CYAN },
    { icon: "📱", rule: "Always test on mobile before marking done", detail: "Most users are on mobile. Desktop-only testing is not done.", color: GOLD },
    { icon: "⏰", rule: "If stuck for 2+ hours — ask, don't guess", detail: "Guessing leads to bad code and wasted time. Ask early.", color: "00C9A7" },
    { icon: "✅", rule: "Every task needs a PR — no direct pushes", detail: "PRs let seniors catch bugs before they hit live users.", color: "7C6AFF" },
  ];

  rules.forEach((r, i) => {
    const ry = 1.08 + i * 0.88;
    card(s, 0.35, ry, 9.3, 0.8, i % 2 === 0 ? "101D2C" : "0D1926");
    s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: ry, w: 0.08, h: 0.8, fill: { color: r.color }, line: { color: r.color } });
    s.addText(r.icon, { x: 0.55, y: ry + 0.12, w: 0.5, h: 0.55, fontSize: 24, margin: 0 });
    s.addText(r.rule, {
      x: 1.18, y: ry + 0.1, w: 6.1, h: 0.38,
      fontSize: 14, bold: true, color: WHITE, fontFace: "Arial Black", margin: 0
    });
    s.addText(r.detail, {
      x: 1.18, y: ry + 0.46, w: 6.5, h: 0.28,
      fontSize: 10.5, color: LIGHT, fontFace: "Arial", italic: true, margin: 0
    });
    s.addShape(pres.shapes.OVAL, { x: 8.0, y: ry + 0.22, w: 0.36, h: 0.36, fill: { color: r.color }, line: { color: r.color } });
    s.addText(String(i + 1), {
      x: 8.0, y: ry + 0.22, w: 0.36, h: 0.36,
      fontSize: 14, bold: true, color: BG, fontFace: "Arial Black", align: "center", margin: 0
    });
  });

  footer(s);
}

// ════════════════════════════════════════════════════
// SLIDE 14 — GETTING HELP
// ════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  bg(s);
  gradBar(s);

  // Full-slide accent
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0.06, w: 10, h: 5.565, fill: { color: BG }, line: { color: BG } });

  slideTitle(s, "Getting Help");

  const contacts = [
    { icon: "🌐", label: "App is live at", value: "nuove.in", color: CYAN },
    { icon: "💻", label: "GitHub repos", value: "Moses-Brucelee/aiap-c9-g36  •  Muskan9957/viralcoach", color: "7C6AFF" },
    { icon: "📋", label: "PRD (task list)", value: "Nuove_PRD_UserStories.xlsx — check here first", color: GOLD },
    { icon: "🚂", label: "Backend hosting", value: "Railway dashboard — check logs, env vars", color: "00C9A7" },
    { icon: "▲",  label: "Frontend hosting", value: "Vercel dashboard — check deployment status", color: WHITE },
    { icon: "⏰", label: "Stuck on code?", value: "Try for 2 hours, then ask. Never guess for 8 hours.", color: PINK },
  ];

  contacts.forEach((c, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    const cx = col === 0 ? 0.35 : 5.15;
    const cy = 1.1 + row * 1.2;

    card(s, cx, cy, 4.6, 1.0, CARD);
    s.addText(c.icon, { x: cx + 0.12, y: cy + 0.2, w: 0.5, h: 0.6, fontSize: 22, margin: 0 });
    s.addText(c.label, {
      x: cx + 0.72, y: cy + 0.1, w: 3.7, h: 0.28,
      fontSize: 10, color: LIGHT, fontFace: "Arial", margin: 0
    });
    s.addText(c.value, {
      x: cx + 0.72, y: cy + 0.38, w: 3.7, h: 0.48,
      fontSize: 11.5, bold: true, color: c.color, fontFace: "Arial", margin: 0
    });
  });

  // Closing quote
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 4.73, w: 9.3, h: 0.62, fill: { color: "0A1E30" }, line: { color: CYAN } });
  s.addText("Read the PRD.  Trace the code.  Ask questions.  Ship great work.", {
    x: 0.5, y: 4.73, w: 9.1, h: 0.62,
    fontSize: 17, bold: true, color: CYAN, fontFace: "Arial Black",
    align: "center", margin: 0, valign: "middle"
  });

  footer(s, "nuove.in  •  Developer Onboarding  •  Confidential");
}

// ── Save ──
pres.writeFile({ fileName: "Nuove_Developer_KT.pptx" }).then(() => {
  console.log("DONE: Nuove_Developer_KT.pptx");
});
