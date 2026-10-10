// Dialogue engine: greetings, known topics, conditional answers and [[links]].
import { GREETINGS, TOPICS, START_TOPICS } from '../data/dialog.js';

export class DialogEngine {
  constructor(game, known) {
    this.game = game;
    this.known = new Set(known && known.length ? known : START_TOPICS);
  }

  learn(topic) {
    if (!TOPICS[topic]) return false;
    if (this.known.has(topic)) return false;
    this.known.add(topic);
    return true;
  }

  pick(variants) {
    if (!variants) return null;
    if (typeof variants === 'string') return { text: variants };
    if (!Array.isArray(variants)) return variants;
    for (const v of variants) {
      if (typeof v === 'string') return { text: v };
      if (!v.if || v.if(this.game)) return v;
    }
    return null;
  }

  greeting(npcId) {
    const v = this.pick(GREETINGS[npcId]);
    return v ? v.text : 'Yes?';
  }

  hasAnswer(npcId, topic) {
    const t = TOPICS[topic];
    if (!t) return false;
    if (t.by && t.by[npcId]) return true;
    return !!t.default && !t.only;
  }

  topicsFor(npcId) {
    return [...this.known].filter((t) => this.hasAnswer(npcId, t)).sort((a, b) => a.localeCompare(b));
  }

  answer(npcId, topic) {
    const t = TOPICS[topic];
    if (!t) return { text: '...' };
    const v = this.pick(t.by && t.by[npcId]) || { text: t.default };
    return v;
  }

  // Split text into plain runs and topic links; learns linked topics as a side effect when asked.
  parse(text, learn = true) {
    const out = [];
    const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      const topic = m[1];
      const shown = m[2] || m[1];
      if (TOPICS[topic]) {
        out.push({ text: shown, topic });
        if (learn) this.learn(topic);
      } else out.push({ text: shown });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }

  serialize() { return [...this.known]; }
}
