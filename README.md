# Pop Culture Japanese

Zero-cost, local-first Japanese learning MVP focused on pop culture modules, SRS review, gamification, and admin tooling.

## Run locally

```bash
npm run dev
```

Then open `http://127.0.0.1:4173`.

## What ships in this first slice

- Learn, Practice, Review, Progress, and Admin screens
- SQLite persistence through a local Node API
- Static lesson content for anime, food, and samurai/history
- Furigana, romaji, and translation toggles
- Browser TTS for lesson playback
- Local Whisper-backed speech transcription when `whisper` and a model are available
- Bulk dataset bundle import for JMdict / KANJIDIC-shaped JSON
- Simple SRS review interactions
- XP, credits, achievements, daily tasks, and cosmetics
- Local admin login, site settings, and audit logs
