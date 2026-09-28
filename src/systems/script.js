// Event scripts: a small line-based language for cutscenes, heart events and quests.
//
//   # comment                          @label            (a jump target)
//   say heibei happy "Welcome!"        say "Narration."  (speaker and expression are optional)
//   choice "Yes" @yes "No" @no         goto @label       end
//   give item n    take item n @else   money n   pay n @else (spend mon if you have it)           bond npc n       virtue name n
//   setFlag name [value]               ifFlag name @label    ifFlag !name @label
//   wait seconds   moveNpc npc tx ty [dir]    placeNpc npc tx ty [dir]   face npc dir   emote npc kind
//   cameraPan tx ty seconds | cameraPan player seconds       fade out|in seconds
//   placePlayer tx ty [dir]   learn dish   sfx name   duel rival @won @lost (an iai stand-off)
//
// The runner is host-agnostic: blocking verbs ask the host for a handle whose `done` becomes true
// (and, for choices, whose `value` is the picked index). See game/cutscene.js for the real host.

/** Split a line into words and "quoted strings". */
export function tokenize(line) {
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] !== undefined ? { s: m[1].replace(/\\"/g, '"') } : m[2]);
  return out;
}

const NUM = (v, line) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Script line ${line}: expected a number, got "${v}"`);
  return n;
};
const LABEL = (v, line) => {
  if (typeof v !== 'string' || v[0] !== '@') throw new Error(`Script line ${line}: expected @label, got "${v?.s ?? v}"`);
  return v.slice(1);
};
const STR = (v, line) => {
  if (!v || v.s === undefined) throw new Error(`Script line ${line}: expected "text"`);
  return v.s;
};

/** Parse script text into { ops, labels }. Throws with a line number on any mistake. */
export function parseScript(text) {
  const ops = [];
  const labels = {};
  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const src = raw.trim();
    if (!src || src[0] === '#') return;
    if (src[0] === '@') { labels[src.slice(1)] = ops.length; return; }
    const [verb, ...a] = tokenize(src);
    switch (verb) {
      case 'say': {
        const text = a.find((x) => x.s !== undefined);
        const words = a.filter((x) => typeof x === 'string');
        ops.push({ op: 'say', who: words[0] || null, face: words[1] || 'neutral', text: STR(text, line) });
        break;
      }
      case 'choice': {
        const options = [];
        for (let k = 0; k < a.length; k += 2) options.push({ text: STR(a[k], line), to: LABEL(a[k + 1], line) });
        if (!options.length) throw new Error(`Script line ${line}: empty choice`);
        ops.push({ op: 'choice', options });
        break;
      }
      case 'goto': ops.push({ op: 'goto', to: LABEL(a[0], line) }); break;
      case 'end': ops.push({ op: 'end' }); break;
      case 'give': ops.push({ op: 'give', item: a[0], n: a[1] ? NUM(a[1], line) : 1 }); break;
      case 'take': ops.push({ op: 'take', item: a[0], n: NUM(a[1], line), else: a[2] ? LABEL(a[2], line) : null }); break;
      case 'money': ops.push({ op: 'money', n: NUM(a[0], line) }); break;
      case 'pay': ops.push({ op: 'pay', n: NUM(a[0], line), else: a[1] ? LABEL(a[1], line) : null }); break;
      case 'bond': ops.push({ op: 'bond', npc: a[0], n: NUM(a[1], line) }); break;
      case 'virtue': ops.push({ op: 'virtue', name: a[0], n: NUM(a[1], line) }); break;
      case 'setFlag': ops.push({ op: 'setFlag', name: a[0], value: a[1] === undefined ? true : a[1] }); break;
      case 'ifFlag': {
        const neg = a[0][0] === '!';
        ops.push({ op: 'ifFlag', name: neg ? a[0].slice(1) : a[0], neg, to: LABEL(a[1], line) });
        break;
      }
      case 'wait': ops.push({ op: 'wait', t: NUM(a[0], line) }); break;
      case 'moveNpc': ops.push({ op: 'moveNpc', npc: a[0], tx: NUM(a[1], line), ty: NUM(a[2], line), dir: a[3] || null }); break;
      case 'placeNpc': ops.push({ op: 'placeNpc', npc: a[0], tx: NUM(a[1], line), ty: NUM(a[2], line), dir: a[3] || null }); break;
      case 'face': ops.push({ op: 'face', npc: a[0], dir: a[1] }); break;
      case 'emote': ops.push({ op: 'emote', npc: a[0], kind: a[1] }); break;
      case 'cameraPan':
        ops.push(a[0] === 'player' ? { op: 'pan', player: true, t: NUM(a[1], line) } : { op: 'pan', tx: NUM(a[0], line), ty: NUM(a[1], line), t: NUM(a[2], line) });
        break;
      case 'fade': ops.push({ op: 'fade', dir: a[0], t: NUM(a[1], line) }); break;
      case 'placePlayer': ops.push({ op: 'placePlayer', tx: NUM(a[0], line), ty: NUM(a[1], line), dir: a[2] || null }); break;
      case 'learn': ops.push({ op: 'learn', dish: a[0] }); break;
      case 'sfx': ops.push({ op: 'sfx', name: a[0] }); break;
      case 'duel': ops.push({ op: 'choice', duel: a[0], options: [{ to: LABEL(a[1], line) }, { to: LABEL(a[2], line) }] }); break;
      default: throw new Error(`Script line ${line}: unknown verb "${verb}"`);
    }
  });
  for (const o of ops) for (const to of [o.to, o.else, ...(o.options || []).map((x) => x.to)]) {
    if (to && labels[to] === undefined) throw new Error(`Script: unknown label @${to}`);
  }
  return { ops, labels };
}

/**
 * Runs a parsed script against a host. Call update(dt) every frame until `finished`.
 * Host: say(who, face, text) / choice(texts) / moveNpc(npc, tx, ty, dir) / pan(target, t) /
 * fade(dir, t) and duel(rival) return a handle { done, value }; give, take (returns bool), money,
 * bond, virtue, placeNpc, placePlayer, learn, sfx, face, emote, flag(name) and setFlag(name, value)
 * act immediately.
 */
export class ScriptRunner {
  constructor(host, program) {
    this.host = host;
    this.ops = program.ops;
    this.labels = program.labels;
    this.pc = 0;
    this.wait = null;     // handle or { t } timer being waited on
    this.pick = null;     // choice op awaiting its handle
    this.finished = false;
  }

  update(dt) {
    for (let guard = 0; guard < 1000 && !this.finished; guard++) {
      if (this.wait) {
        if (this.wait.t !== undefined) {
          this.wait.t -= dt;
          dt = 0;
          if (this.wait.t > 0) return;
        } else if (!this.wait.done) return;
        if (this.pick) { this.pc = this.labels[this.pick.options[this.wait.value].to]; this.pick = null; }
        this.wait = null;
      }
      if (this.pc >= this.ops.length) { this.finished = true; return; }
      this.exec(this.ops[this.pc++]);
    }
  }

  exec(o) {
    const h = this.host;
    switch (o.op) {
      case 'say': this.wait = h.say(o.who, o.face, o.text); break;
      case 'choice': this.pick = o; this.wait = o.duel ? h.duel(o.duel) : h.choice(o.options.map((x) => x.text)); break;
      case 'goto': this.pc = this.labels[o.to]; break;
      case 'end': this.finished = true; break;
      case 'give': h.give(o.item, o.n); break;
      case 'take': if (!h.take(o.item, o.n) && o.else) this.pc = this.labels[o.else]; break;
      case 'money': h.money(o.n); break;
      case 'pay': if (!h.pay(o.n) && o.else) this.pc = this.labels[o.else]; break;
      case 'bond': h.bond(o.npc, o.n); break;
      case 'virtue': h.virtue(o.name, o.n); break;
      case 'setFlag': h.setFlag(o.name, o.value); break;
      case 'ifFlag': if (!!h.flag(o.name) !== o.neg) this.pc = this.labels[o.to]; break;
      case 'wait': this.wait = { t: o.t }; break;
      case 'moveNpc': this.wait = h.moveNpc(o.npc, o.tx, o.ty, o.dir); break;
      case 'placeNpc': h.placeNpc(o.npc, o.tx, o.ty, o.dir); break;
      case 'face': h.face(o.npc, o.dir); break;
      case 'emote': h.emote(o.npc, o.kind); break;
      case 'pan': this.wait = h.pan(o.player ? 'player' : { tx: o.tx, ty: o.ty }, o.t); break;
      case 'fade': this.wait = h.fade(o.dir, o.t); break;
      case 'placePlayer': h.placePlayer(o.tx, o.ty, o.dir); break;
      case 'learn': h.learn(o.dish); break;
      case 'sfx': h.sfx(o.name); break;
      default: throw new Error(`bad op ${o.op}`);
    }
  }
}
