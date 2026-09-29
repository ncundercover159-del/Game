// Optional generated conversation for "Snak", using the player's own Anthropic API key.
// There is no backend: the key lives only in this browser (Settings) and requests go
// straight to api.anthropic.com. The SDK is imported lazily so the offline game never
// downloads it unless this mode is used.

import type Anthropic from '@anthropic-ai/sdk';
import { C } from '../content';
import type { Npc } from '../content/types';

export interface AiTurn {
  reply_da: string;
  reply_en: string;
  /** Feedback on the player's last message. */
  ok: boolean;
  corrected_da: string;
  explanation_en: string;
  /** Words in reply_da the learner probably doesn't know yet. */
  glossary: { da: string; en: string }[];
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply_da', 'reply_en', 'ok', 'corrected_da', 'explanation_en', 'glossary'],
  properties: {
    reply_da: { type: 'string', description: 'Your next line, in Danish only.' },
    reply_en: { type: 'string', description: 'English translation of reply_da.' },
    ok: { type: 'boolean', description: "True if the learner's last message was correct, natural Danish (or there was no learner message yet)." },
    corrected_da: { type: 'string', description: 'How a Dane would naturally say what the learner meant. Empty string if ok is true.' },
    explanation_en: { type: 'string', description: 'One or two short sentences in English explaining the correction. Empty if ok is true.' },
    glossary: {
      type: 'array',
      description: 'Words in reply_da that are NOT in the known-word list, with short English glosses.',
      items: {
        type: 'object', additionalProperties: false, required: ['da', 'en'],
        properties: { da: { type: 'string' }, en: { type: 'string' } },
      },
    },
  },
} as const;

export class AiChat {
  private client: Anthropic | null = null;
  private messages: Anthropic.Beta.BetaMessageParam[] = [];
  private system: string;

  constructor(private key: string, private model: string, npc: Npc, level: string, known: string[]) {
    // Stable per conversation, so it is cached after the first turn.
    this.system = [
      `You are ${npc.name} (${npc.role.en}) in a language-learning game set in Aarhus, Denmark.`,
      `Your way of speaking: ${npc.register}`,
      `You are chatting with a learner of Danish at CEFR level ${level}. Stay in character and keep the conversation going naturally about everyday life (the building, the neighbourhood, Aarhus, plans, food, weather).`,
      'Rules for reply_da:',
      '- Natural, current, spoken Danish as Danes really talk (fillers like nå, altså, jamen, ikke? are welcome). Never stiff textbook Danish. Never English.',
      `- Match the level: at A1 use 3–8 word sentences, present tense, one question per turn. Use mostly words from the known-word list below; introduce at most one or two new words per turn and list them in glossary.`,
      '- End most turns with a simple question so the learner has something to answer.',
      '- If the learner writes English or is stuck, answer briefly in simple Danish and model the phrase they need.',
      'Feedback: judge only the learner\'s latest message. Mark ok=false for grammar or word-order mistakes (V2, ikke placement, en/et, definite forms) or clearly unnatural phrasing; give the natural version in corrected_da and a short English explanation. Do not nitpick missing capital letters or punctuation.',
      `Known words (lemmas): ${known.join(', ')}`,
    ].join('\n');
  }

  private async sdk(): Promise<Anthropic> {
    if (!this.client) {
      const { default: AnthropicCtor } = await import('@anthropic-ai/sdk');
      this.client = new AnthropicCtor({ apiKey: this.key, dangerouslyAllowBrowser: true });
    }
    return this.client;
  }

  /** Send the learner's message (or null to let the NPC open) and get the NPC's turn. */
  async send(learner: string | null): Promise<AiTurn> {
    const client = await this.sdk();
    this.messages.push({
      role: 'user',
      content: learner === null ? '(The learner has just walked up to you. Greet them and start a conversation.)' : learner,
    });
    const response = await client.beta.messages.create({
      model: this.model,
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: this.system, cache_control: { type: 'ephemeral' } }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: this.messages,
    });
    if (response.stop_reason === 'refusal') {
      this.messages.pop();
      throw new Error('The model declined to continue this conversation.');
    }
    const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
    const turn = JSON.parse(text) as AiTurn;
    // append the full assistant content so the conversation stays append-only
    this.messages.push({ role: 'assistant', content: response.content });
    return turn;
  }
}

export function describeError(e: unknown): string {
  const err = e as { status?: number; message?: string };
  if (err?.status === 401) return 'The API key was rejected. Check it in Settings.';
  if (err?.status === 429) return 'Rate limited — wait a moment and try again.';
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You are offline. The built-in conversations still work.';
  return err?.message ?? String(e);
}

export const levelOf = (chapterIndex: number) => C.chapters[chapterIndex]?.cefr ?? 'A1';
