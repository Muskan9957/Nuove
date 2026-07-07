# Nuove — Google Play Store listing pack

Everything you paste into **Play Console → Main store listing / App content**.
Copy each block as-is. Character limits are Google's; all of these fit.

---

## 1. App name  *(max 30 characters)*

```
Nuove: AI Reels & Shorts
```
*(24 characters)*

---

## 2. Short description  *(max 80 characters)*

```
AI scripts, captions & real trending topics + a teleprompter for creators.
```
*(74 characters)*

---

## 3. Full description  *(max 4000 characters)*

```
Nuove is your AI co-pilot for making viral Instagram Reels and YouTube Shorts — built for Indian creators.

Stop staring at a blank screen. Nuove writes your script, finds what's actually trending today, and even scrolls the words for you while you record — all in one app.

★ WHAT YOU CAN DO WITH NUOVE ★

🎬 AI Script Generator
Type a topic, pick a tone and language (English, Hindi or Hinglish), and get a ready-to-film script with a scroll-stopping hook, body and call-to-action in seconds.

🔥 Real Trending Topics
See what's genuinely trending right now for your niche and region — pulled from real sources, not made up. Never run out of ideas again.

🎥 Built-in Teleprompter + Recorder
Record straight inside the app while your script scrolls over the camera. No second phone, no memorising lines. Adjust speed, size and cinematic filters as you shoot.

✍️ Caption Generator
Turn any idea into scroll-stopping captions with the right hooks and hashtags.

🧠 Creator Advisor
Your personal AI coach for growth — ask anything about hooks, ideas, formats or strategy and get creator-specific advice.

💯 Hook Score
Get every hook rated for scroll-stopping power before you post, with tips to make it stronger.

📊 Performance Analyzer
Log your videos and learn what's working so you can do more of it.

★ WHY CREATORS LOVE NUOVE ★

• Made for India — Hindi, Hinglish and English, with culturally relevant trends and music
• Everything in one place — idea → script → record → caption
• Fast — scripts and captions in seconds
• Beginner-friendly — no editing skills needed

Whether you're just starting out or posting every day, Nuove helps you create more, faster, and grow.

Download Nuove and make your next Reel or Short today.
```

---

## 4. Category & tags

- **App category:** Video Players & Editors  *(alt: Productivity)*
- **Tags (pick in console):** Video, Content creation, Productivity
- **Store search terms are auto-derived** from your title + description above (Play has no separate keyword field), so the words "Reels, Shorts, script, caption, trending, teleprompter, creator" are already woven in.

---

## 5. Graphics (files in this folder)

| Asset | Size | File |
|---|---|---|
| App icon (hi-res) | 512 × 512 PNG | `icon-512.png` |
| Feature graphic | 1024 × 500 PNG | `feature-graphic.png` |
| Phone screenshots | min 2 (up to 8), 1080 × 1920 | *capture on device/emulator* |

---

## 6. Data safety form  *(App content → Data safety)*

Answer the questionnaire like this (confirm each against your own setup):

**Does your app collect or share user data?** → **Yes**

**Data collected:**
| Data type | Collected? | Shared? | Purpose |
|---|---|---|---|
| Name | Yes | No | Account management |
| Email address | Yes | No | Account management |
| User content (scripts, captions, videos you create) | Yes | No* | App functionality |
| App activity / interactions | Yes | No | Analytics, app functionality |
| Crash logs & diagnostics | Yes | No | App performance (Sentry) |
| Device or other IDs | Yes | No | Fraud prevention / abuse (fingerprint) |

\* Text you generate is processed by Google's Gemini AI to produce results. Declare AI processing; it is a service provider, not "sharing/selling."

**Is all data encrypted in transit?** → **Yes** (HTTPS)
**Can users request data deletion?** → **Yes** — the app has in-app account deletion (Profile → Delete account).
**Privacy policy URL:** `https://nuove.in/privacy`

---

## 7. Content rating  *(App content → Content rating)*

Fill the IARC questionnaire. For Nuove the honest answers are all **No** (no violence, sexual content, gambling, drugs, profanity, user-to-user unmoderated messaging). Expected result: **Everyone / PEGI 3 / Rated for 3+**.
Category to select at the start: **Utility, Productivity, Communication, or Other**.

---

## 8. Other "App content" declarations

- **Target audience & content:** 18+ (or 13+) — a business tool, not aimed at children.
- **Ads:** **No** (no ads in the app at launch — we add them later).
- **Government app:** No.
- **Financial features:** No in-app purchases at launch (free-first). *(Subscriptions come in a later update via Google Play Billing.)*
- **Privacy policy:** https://nuove.in/privacy  •  **Terms:** https://nuove.in/terms

---

## 9. Release details

- **Package name:** `in.nuove.app`
- **Upload file:** `Nuove-playstore.aab` (in your Downloads\Nuove-Android folder) — signed, versionCode 1, versionName 1.0
- Start with **Internal testing** → then **Production**.
