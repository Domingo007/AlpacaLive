> **IMPORTANT LEGAL DISCLAIMER**
>
> AlpacaLive is a tool for analyzing data provided by the user.
> **It is NOT a medical device, does NOT make diagnoses, does NOT recommend medications or supplements.**
> Information displayed in the app is based on user data and published scientific literature.
> All health-related decisions should be made solely in consultation with your treating physician.
> The app creators bear no responsibility for health decisions made based on information from the app.
> Full disclaimer: [DISCLAIMER.md](DISCLAIMER.md) | [TERMS.md](TERMS.md)

# AlpacaLive — Holistic Oncology Support System

**A free, open-source web app (PWA) supporting cancer patients and their caregivers in analyzing health data during chemotherapy, immunotherapy, radiotherapy, targeted therapy, hormone therapy, and recovery from surgery.**

---

## What Makes AlpacaLive Different

| Feature | AlpacaLive | Other Oncology Apps |
| --- | --- | --- |
| Health journal | Conversation with an AI agent | Manual forms |
| Blood results | Photo → automatic analysis | Manual entry |
| Pattern-based summaries | Compares your data against your own baseline and previous cycles | None |
| Drug interactions | Dynamic CYP450 database | None |
| Imaging | RTG/CT/PET analysis with RECIST | None |
| Privacy | PII Sanitizer — personal data never leaves your phone | Varies |
| Code | Open source, AGPL-3.0 | Closed |

> **Note on "pattern-based summaries":** AlpacaLive does not predict treatment outcomes or diagnose conditions. It shows how your current data compares to your own previous cycles and to reference ranges from published literature. Any interpretation of these patterns is for the patient's treating physician.

## Quick Start

```
git clone https://github.com/Domingo007/AlpacaLive.git
cd AlpacaLive
npm install
npm run dev
```

Requirements: Node.js 18+, [Anthropic API key](https://console.anthropic.com/) (optional — the app works in notebook mode without a key)

### How to get an API key

AlpacaLive works in two modes:
1. **Free notebook mode** — no API key needed. Manual data entry, charts, alerts, calendar, supplement tracker with evidence levels.
2. **AI-powered mode** — requires an API key from one of:

**Anthropic Claude (recommended):**
1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Create an account (email verification)
3. Go to API Keys → Create Key
4. Copy the key and paste it in AlpacaLive Settings
5. Cost: approximately €5-15/month with typical use (a few conversations per day)

**OpenAI GPT:**
1. Go to [platform.openai.com](https://platform.openai.com/)
2. Create account → API Keys → Create
3. Cost: similar to Claude

**Google Gemini:**
1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Get API key (free tier available with limitations)
3. Note: Google may use free-tier API data for model training

The API key is stored locally on your device (IndexedDB) and never shared with AlpacaLive servers (there are none).

### Install on Your Phone

1. Open in your browser (Safari/Chrome)
2. **iPhone:** Share → "Add to Home Screen"
3. **Android:** Menu → "Add to Home Screen"
4. Enter your API key in settings

### Deploy Your Own Instance

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Domingo007/AlpacaLive)

## Architecture

```
AlpacaLive (100% local — no cloud)
├── PWA (Vite + React + TypeScript + Tailwind)
├── Data (IndexedDB via Dexie.js — on device)
├── AI Agent (Claude API — user's key)
│   ├── PII Sanitizer → filters personal data
│   ├── Medical Skill → comprehensive oncology knowledge
│   ├── Data Extractor → parses responses
│   └── Vision API → analyzes photos of results and imaging
└── No backend / no analytics / no ads
```

### Wearables Architecture

AlpacaLive supports two ingestion paths for wearable health data:

1. **Open Wearables** (primary, 7 cloud OAuth providers) — Whoop, Garmin,
   Oura, Polar, Suunto, Strava, Ultrahuman. Routes through the
   open-source unified API at [openwearables.io](https://openwearables.io)
   (MIT license, self-hostable via `docker compose up`). The user pastes
   their server URL + API key + a stable user ID into Settings; nothing
   is hard-coded. Apple Health, Samsung Health and Google Health Connect
   require a native mobile app and are NOT reachable from a PWA — they
   are surfaced in the UI as a "use mobile app" notice.

2. **Withings direct** (medical-grade signals) — ScanWatch 2 (ECG, HR,
   HRV, SpO₂), Body Comp / Body Scan (body composition, ESC for CIPN
   monitoring), BPM Connect (BP), Sleep Analyzer, BeamO. OAuth credentials
   (Client ID + Secret + redirect URI) are configured per-instance from
   [developer.withings.com](https://developer.withings.com). Tokens
   rotate on each refresh and are persisted into the local Dexie
   `deviceConnections` table.

When the same metric is reported by both paths, priority is:
**Withings direct → Open Wearables (Oura > Whoop > Ultrahuman > Garmin
> Polar > Suunto > Strava) → CSV import → manual DailyLog**. ESC,
visceral fat and segmental body composition are exposed only when
Withings provides them. AlpacaLive does NOT consume Open Wearables
Health Scores or Coaching Profiles — own `daily-profile.ts` and
`pattern-engine.ts` remain authoritative (regulatory: deliberately
under the MDR threshold).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | Vite + React 18 + TypeScript |
| Styles | Tailwind CSS |
| Database | IndexedDB via Dexie.js |
| AI | Anthropic Claude API (claude-sonnet) |
| Charts | Recharts |
| PDF Reports | jsPDF |
| PWA | vite-plugin-pwa + Workbox |
| Deploy | Vercel |

## How to Contribute

We're looking for **patients** (your experience with chemo is invaluable!), **developers**, **doctors**, and **translators**. Read [CONTRIBUTING.md](CONTRIBUTING.md).

## Medical Documentation

* [Medical Knowledge Base](docs/MEDICAL_KNOWLEDGE.md) — supplements, interactions, patterns
* [Compatible Wearables](docs/wearables.md) — ranking for cancer patients

## Privacy

All data is stored locally in IndexedDB on the user's device. The only external communication is queries to the Claude API — before sending, personal data is automatically replaced with placeholders (`[PATIENT]`, `[SSN]`, etc.). Details in [SECURITY.md](SECURITY.md).

## License

AGPL-3.0 — see [LICENSE](LICENSE)

The code is open. You can use, modify, and distribute it under the terms of AGPL-3.0.
If you modify the code and make it available as a service (e.g., SaaS) — you must release your changes under the same license.

Interested in a commercial license (without AGPL requirements)? Contact: [gravitydesigne@gmail.com](mailto:gravitydesigne@gmail.com)

## Contact

**Dominik Gaweł** · [Gravity Design](https://www.gravitydesign.pl/)
Email: [gravitydesigne@gmail.com](mailto:gravitydesigne@gmail.com)
GitHub: [github.com/Domingo007](https://github.com/Domingo007)
Website: [alpacalive.com](https://www.alpacalive.com/)
