# maeum — AI Journal App (React Native Expo)

## 1-minute setup

```bash
# 1. Paste this entire folder into your workspace, then:
cd maeum

# 2. Install dependencies
npm install

# 3. Start
npx expo start
```

Scan the QR code with **Expo Go** (iOS / Android) — done.

---

## Folder structure

```
maeum/
├── App.tsx                          ← entry point + navigation
├── app.json
├── babel.config.js
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── types/index.ts
    ├── constants/moods.ts           ← mood data, colors, theme lists
    ├── lib/
    │   ├── storage.ts               ← AsyncStorage helpers
    │   └── cbt.ts                   ← AI analysis (calls your backend)
    ├── components/
    │   ├── MoodGrid.tsx
    │   └── JournalSheet.tsx         ← slide-up sheet (Reanimated 3)
    └── screens/
        ├── HomeScreen.tsx
        └── ReportScreen.tsx         ← Daily / Weekly / Monthly tabs
```

---

## Connecting AI analysis

The app runs fully offline with static CBT insights as fallback.
To enable real Claude-powered analysis:

1. Copy `.env.example` → `.env`
2. Set `EXPO_PUBLIC_API_URL=https://your-backend.com`
3. Add this route to your backend:

```ts
// POST /api/journal/analyze
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/journal/analyze', async (req, res) => {
  const { mood, tags, content } = req.body;
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: `You are a CBT-informed mental health AI for teenagers.
Respond ONLY with valid JSON (no markdown):
{ "insight": "string", "distortions": ["string"], "reframe": "string" }`,
    messages: [{
      role: 'user',
      content: `Mood: ${mood}\nTags: ${tags.join(', ')}\n\n${content}`,
    }],
  });
  res.json(JSON.parse(response.content[0].text));
});
```

---

## Notes

- **No API key in the app** — always proxy through your own server.
- Entries are stored locally with `AsyncStorage` — add Supabase sync when ready.
- Report data (Weekly / Monthly) is currently mock — wire up to `loadEntries()` when you have real data.
