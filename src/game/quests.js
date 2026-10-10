// Quest log: availability, acceptance, objective tracking, turn-in and journal entries.
import { QUESTS, QUEST_ORDER } from '../data/quests.js';

export class QuestLog {
  constructor(game, data = {}) {
    this.game = game;
    this.state = data.state || {}; // id -> { status: 'active'|'ready'|'done', stage, counts: [] , outcome }
    this.journal = data.journal || []; // { day, hour, quest, text }
    this.tracked = data.tracked || null;
  }

  def(id) { return QUESTS[id]; }
  status(id) { return this.state[id]?.status || null; }
  isActive(id) { const s = this.status(id); return s === 'active' || s === 'ready'; }
  isDone(id) { return this.status(id) === 'done'; }
  stage(id) { return this.state[id]?.stage ?? -1; }

  available(id) {
    const q = QUESTS[id];
    if (this.state[id]) return false;
    const r = q.requires || {};
    if (r.quests && !r.quests.every((x) => this.isDone(x))) return false;
    return true;
  }
  levelOk(id) { return this.game.sheet.level >= (QUESTS[id].level || 1); }

  // Quests this NPC can offer, ready to turn in, or in progress for them.
  forNpc(npcId) {
    const offers = [], turnins = [], progress = [];
    for (const id of QUEST_ORDER) {
      const q = QUESTS[id];
      if (q.giver === npcId && this.available(id)) offers.push({ id, low: !this.levelOk(id) });
      if (q.turnIn === npcId && this.status(id) === 'ready') turnins.push(id);
      else if (q.turnIn === npcId && this.status(id) === 'active' && !this.hasTalkObjective(id, npcId)) progress.push(id);
    }
    return { offers, turnins, progress };
  }

  hasTalkObjective(id, npcId) {
    const st = this.state[id];
    const stage = QUESTS[id].stages[st.stage];
    return stage && stage.objectives.some((o) => o.type === 'talk' && o.npc === npcId);
  }

  markerFor(npcId) {
    const { offers, turnins, progress } = this.forNpc(npcId);
    if (turnins.length) return 'q';
    if (offers.some((o) => !o.low)) return '!';
    // A talk objective pointing at this NPC also shows a yellow '?'.
    for (const [id, st] of Object.entries(this.state)) {
      if (st.status !== 'active') continue;
      const stage = QUESTS[id].stages[st.stage];
      if (stage && stage.objectives.some((o) => o.type === 'talk' && o.npc === npcId)) return 'q';
    }
    if (progress.length) return 'qgray';
    if (offers.length) return '!gray';
    return null;
  }

  accept(id) {
    const q = QUESTS[id];
    if (!this.available(id)) return;
    this.state[id] = { status: 'active', stage: 0, counts: q.stages[0].objectives.map(() => 0) };
    if (q.onAccept) q.onAccept(this.game);
    this.addJournal(id, q.journal?.accept || q.stages[0].journal);
    if (!this.tracked) this.tracked = id;
    this.game.ui?.questAccepted(id);
    this.game.audio?.play('quest_accept');
    this.refreshCounts(id);
    this.game.questsChanged();
  }

  abandon(id) {
    delete this.state[id];
    if (this.tracked === id) this.tracked = null;
    this.game.questsChanged();
  }

  // Recount collect objectives from inventory, check stage completion.
  refreshCounts(id) {
    const st = this.state[id];
    if (!st || st.status === 'done') return;
    const q = QUESTS[id];
    const stage = q.stages[st.stage];
    stage.objectives.forEach((o, i) => {
      if (o.type === 'collect') st.counts[i] = Math.min(o.count, this.game.sheet.count(o.item));
      if (o.type === 'level') st.counts[i] = this.game.sheet.level >= o.level ? 1 : 0;
      if (o.type === 'flag') st.counts[i] = this.game.flags[o.flag] ? 1 : 0;
    });
    this.checkStage(id);
  }

  objectiveDone(o, n) {
    const need = o.count || 1;
    return n >= need;
  }

  checkStage(id) {
    const st = this.state[id];
    const q = QUESTS[id];
    const stage = q.stages[st.stage];
    const allDone = stage.objectives.every((o, i) => this.objectiveDone(o, st.counts[i]));
    if (!allDone) {
      if (st.status === 'ready') st.status = 'active';
      return;
    }
    if (st.stage < q.stages.length - 1) {
      st.stage++;
      st.counts = q.stages[st.stage].objectives.map(() => 0);
      if (q.stages[st.stage].journal) this.addJournal(id, q.stages[st.stage].journal);
      if (q.onStage) q.onStage(this.game, st.stage);
      this.game.ui?.questUpdated(id, null, true);
      this.game.audio?.play('quest_progress');
      this.refreshCounts(id);
      return;
    }
    if (st.status !== 'ready') {
      st.status = 'ready';
      // Quests whose last objective is talking to the turn-in NPC complete on the spot elsewhere.
      this.game.ui?.questUpdated(id, null, false, true);
      this.game.audio?.play('quest_ready');
    }
  }

  // Event from the game world.
  event(type, key, n = 1) {
    let changed = false;
    for (const [id, st] of Object.entries(this.state)) {
      if (st.status === 'done') continue;
      const q = QUESTS[id];
      const stage = q.stages[st.stage];
      stage.objectives.forEach((o, i) => {
        if (o.type !== type) return;
        let match = false;
        if (type === 'kill') match = o.tag === key;
        else if (type === 'talk') match = o.npc === key.npc && (!o.topic || o.topic === key.topic);
        else if (type === 'interact') match = o.id === key;
        if (!match) return;
        const need = o.count || 1;
        if (st.counts[i] >= need) return;
        st.counts[i] = Math.min(need, st.counts[i] + n);
        changed = true;
        if (type === 'kill') this.game.ui?.questUpdated(id, `${o.text}: ${st.counts[i]}/${need}`);
      });
      if (changed) this.checkStage(id);
    }
    if (type === 'item' || type === 'flag' || type === 'level') {
      for (const id of Object.keys(this.state)) this.refreshCounts(id);
      changed = true;
    }
    if (changed) this.game.questsChanged();
  }

  turnIn(id, choiceItem) {
    const st = this.state[id];
    const q = QUESTS[id];
    if (!st || st.status !== 'ready') return false;
    const r = q.rewards || {};
    // Make sure there's bag room for rewards.
    const items = [...(r.items || [])];
    if (choiceItem) items.push([choiceItem, 1]);
    for (const [it, n] of items) {
      if (!this.game.sheet.canAdd(it, n)) { this.game.error('Your bags are full.'); return false; }
    }
    // Take collected items.
    for (const o of q.stages[st.stage].objectives) {
      if (o.type === 'collect' && o.take) this.game.sheet.remove(o.item, o.count);
    }
    st.status = 'done';
    if (q.onComplete) q.onComplete(this.game);
    if (q.journal?.complete) this.addJournal(id, q.journal.complete);
    if (r.gold) this.game.addGold(r.gold);
    for (const [it, n] of items) this.game.giveItem(it, n);
    if (this.tracked === id) this.tracked = this.firstActive();
    this.game.ui?.questCompleted(id);
    this.game.audio?.play('quest_complete');
    if (r.xp) this.game.addXp(r.xp, 'quest');
    this.game.questsChanged();
    return true;
  }

  firstActive() {
    return QUEST_ORDER.find((id) => this.isActive(id)) || null;
  }

  addJournal(quest, text) {
    if (!text) return;
    this.journal.push({ day: this.game.day(), hour: this.game.hour, quest, text: this.game.fillText(text) });
    this.game.ui?.journalAdded();
  }

  // Objectives for display: [{ text, have, need, done }]
  objectives(id) {
    const st = this.state[id];
    if (!st) return [];
    const q = QUESTS[id];
    const stage = q.stages[st.stage];
    const out = stage.objectives.map((o, i) => {
      const need = o.count || 1;
      return { text: o.text, have: st.counts[i], need, done: st.counts[i] >= need, counted: o.type === 'kill' || o.type === 'collect' };
    });
    if (st.status === 'ready' && !stage.objectives.some((o) => o.type === 'talk' && o.npc === q.turnIn)) {
      out.push({ text: `Return to ${this.game.npcName(q.turnIn)}`, done: false, have: 0, need: 1, ret: true });
    }
    return out;
  }

  poi(id) {
    const st = this.state[id];
    if (!st) return null;
    const q = QUESTS[id];
    if (st.status === 'ready') {
      const npc = this.game.npcs.find((n) => n.id === q.turnIn);
      return npc ? { x: npc.pos.x, z: npc.pos.z, r: 4, npc: true } : null;
    }
    return q.stages[st.stage].poi || null;
  }

  serialize() { return { state: this.state, journal: this.journal, tracked: this.tracked }; }
}
