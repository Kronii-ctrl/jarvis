# J.A.R.V.I.S.

A browser-based voice assistant that mimics Tony Stark's JARVIS, powered by **Google Gemini**.
Pure static site — no build step, no backend — so it deploys straight to **GitHub Pages**.

![status](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-29d3ff) ![ai](https://img.shields.io/badge/AI-Google%20Gemini-ffb648)

## Features

- **Conversational AI** via the Gemini REST API (streaming responses, typed out live)
- **Voice in** — speech recognition (Web Speech API)
- **Voice out** — text-to-speech, prefers a British English voice for the JARVIS feel
- **Arc-reactor UI** — animated reactor that reacts to listening / thinking states
- **Editable personality** — tweak the system instruction in settings
- **Your key stays yours** — the Gemini API key is stored only in your browser's `localStorage`; it is never committed or uploaded anywhere except directly to Google's API

## Quick start (local)

1. Get a free Gemini API key: https://aistudio.google.com/app/apikey
2. Open `index.html` in Chrome or Edge (voice input needs a Chromium browser).
3. Click ⚙ → paste your key → **Save**.
4. Press the mic 🎙 and speak, or just type.

> Voice input requires the page to be served over `https://` or `localhost`.
> When hosted on GitHub Pages (https) it works out of the box.

## Deploy to GitHub Pages

This repo is already wired to publish from the `main` branch root. Once pushed:

1. The repo's **Settings → Pages** source is set to `main` / `/ (root)`.
2. Your site goes live at `https://<username>.github.io/<repo>/`.

To push updates:

```bash
git add -A
git commit -m "Update JARVIS"
git push
```

GitHub Pages redeploys automatically on every push to `main`.

## Configuration

All settings live behind the ⚙ icon and persist in `localStorage`:

| Setting | Notes |
|---|---|
| **API key** | Your Google Gemini key |
| **Model** | `gemini-2.5-flash` (default), `gemini-2.0-flash`, `gemini-2.5-pro`, `gemini-1.5-flash` |
| **Speak replies** | Toggle text-to-speech |
| **JARVIS voice** | Pick any installed system voice |
| **Personality** | The system instruction sent to Gemini |

## Notes on the API key & static hosting

Because GitHub Pages serves static files only, there is no server to keep a secret. This app
deliberately uses **your own** key, entered at runtime and stored locally — so nothing sensitive
ever lands in the repository. If you later want a shared, key-hidden deployment, put a tiny
serverless proxy (Cloudflare Workers / Vercel) in front of Gemini and point the app at it.

## Tech

Plain HTML, CSS, and vanilla JavaScript. No dependencies, no bundler. Fonts via Google Fonts.

---

Built for personal use. "Sometimes you gotta run before you can walk."
