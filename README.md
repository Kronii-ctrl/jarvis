# Bangkok Rail — interactive network guide

An interactive, static website for **Bangkok's urban rail network**: the BTS
Skytrain, the MRT (Blue, Purple, Yellow, Pink), the Airport Rail Link and the
SRT Red Lines — with every station, all interchanges, operating hours, train
frequencies and indicative fares.

Pure HTML/CSS/JS — no build step, no backend — so it deploys straight to
**GitHub Pages**.

![stack](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-4da3ff) ![data](https://img.shields.io/badge/lines-10-5cb531)

## What's covered

| Line | Operator | Type |
|---|---|---|
| BTS Sukhumvit (light green) | BTS | Elevated heavy rail |
| BTS Silom (dark green) | BTS | Elevated heavy rail |
| Gold Line | BTS / Krungthep Thanakom | People mover |
| MRT Blue Line | BEM | Underground + elevated (loop) |
| MRT Purple Line | BEM | Elevated heavy rail |
| MRT Yellow Line | EBM | Straddle monorail |
| MRT Pink Line | NBM | Straddle monorail |
| Airport Rail Link | SRTET | Airport / commuter |
| SRT Dark Red Line | SRTET | Commuter rail |
| SRT Light Red Line | SRTET | Commuter rail |

## Features

- **Network view** — colour-coded line diagrams with every station, its official
  code (e.g. `E4`, `BL22`, `A8`) and interchange tags. Filter lines on/off.
- **Interchanges** — auto-generated list of every station where you can change
  lines, showing the codes on each line.
- **Fare & time planner** — pick a line and two stations to get an estimated
  fare, the number of stops and an in-train time estimate, plus the interchanges
  you'll pass.
- **Lines & hours** — per-line cards with operator, type, operating hours,
  frequency, fare range and a link to the official site.
- **Station search** — jump straight to any station's line.

## Run locally

It's a static site — just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to GitHub Pages

1. Push to the repo.
2. **Settings → Pages** → Source: `Deploy from a branch` → pick your branch and
   `/ (root)`.
3. The site goes live at `https://<username>.github.io/<repo>/`.

A `.nojekyll` file is included so GitHub Pages serves the files as-is.

## Editing the data

All network data lives in [`data.js`](data.js) as a single `NETWORK` object —
one entry per line, each with its ordered station list and fare/hours metadata.
Interchanges are declared per station via the `x: [...]` array (a list of the
other line ids that meet there) and the Interchanges tab is generated from them,
so you only edit data in one place.

## Accuracy

Station orders and codes follow the operators' public maps. **Operating hours,
train frequencies and fares are indicative figures for planning** and the fare
estimator interpolates across each line — always confirm with the official
operator before you travel. Data last reviewed June 2026.

## Tech

Plain HTML, CSS and vanilla JavaScript. No dependencies, no bundler. Fonts via
Google Fonts (Kanit + IBM Plex Mono).
