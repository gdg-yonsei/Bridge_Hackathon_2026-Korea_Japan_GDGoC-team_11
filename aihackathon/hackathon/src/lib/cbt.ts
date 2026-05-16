/**
 * CBT Analysis
 *
 * This module calls Claude via your own backend proxy.
 * Set EXPO_PUBLIC_API_URL in a .env file to point at your server.
 *
 * If the env variable is not set, it falls back to local static insights
 * so the app runs fully without a backend during development.
 */

import { JournalEntry, MoodKey } from '../types';
import { updateEntry } from './storage';
import { MOODS } from '../constants/moods';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export async function analyzeEntry(entry: JournalEntry): Promise<void> {
  // Fallback if no backend configured
  if (!API_URL) {
    await updateEntry(entry.id, {
      aiInsight: MOODS[entry.mood].insight,
      aiDistortions: [],
    });
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/journal/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mood: entry.mood,
        tags: entry.tags,
        content: entry.content,
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    await updateEntry(entry.id, {
      aiInsight: data.insight ?? MOODS[entry.mood].insight,
      aiDistortions: data.distortions ?? [],
    });
  } catch (e) {
    console.warn('analyzeEntry failed, using fallback:', e);
    await updateEntry(entry.id, {
      aiInsight: MOODS[entry.mood].insight,
      aiDistortions: [],
    });
  }
}

/**
 * BACKEND REFERENCE (Express / Next.js API route)
 *
 * POST /api/journal/analyze
 * Body: { mood, tags, content }
 *
 * import Anthropic from '@anthropic-ai/sdk';
 * const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *
 * const response = await client.messages.create({
 *   model: 'claude-sonnet-4-20250514',
 *   max_tokens: 400,
 *   system: `You are a CBT-informed mental health AI supporting teenagers.
 * Respond ONLY with valid JSON, no markdown:
 * { "insight": "string", "distortions": ["string"], "reframe": "string" }`,
 *   messages: [{ role: 'user', content: `Mood: ${mood}\nTags: ${tags}\n\n${content}` }],
 * });
 * res.json(JSON.parse(response.content[0].text));
 */
