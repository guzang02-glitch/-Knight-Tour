// 100-stage rebalance on the chess generator.
// Boards: 1–10 4×4, 11–40 5×5, 41–80 6×6, 81–100 7×7.
// Pieces: 1–20 knight, 21–40 +K, 41–60 +R, 61–80 +B, 81–100 all.
// Curve: normal stages follow a straight line in log10(cases); x0 and x5 = hurdle (above the line), x3 and x8 = rest road (below).
// Usage: node leveldesign-100.js ../index.html 90 > stages-100.json 2> design-log-100.txt
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const block = html.slice(html.indexOf("// ==LEVELGEN=="), html.indexOf("// ==/LEVELGEN=="));
const { genLevel, neighbors, treeSize } = new Function(block + "; return { genLevel, neighbors, treeSize };")();

const K = +(process.argv[3] || 60);
const CAP = 20000;
const N = no => no <= 10 ? 4 : no <= 40 ? 5 : no <= 80 ? 6 : 7;
const TYPE = no => [0, 5].includes(no % 10) ? "H" : [3, 8].includes(no % 10) ? "L" : "N";
const LO = 0.78, HI = 3.55;                       // line: stage 1 → stage 99
const line = no => LO + (HI - LO) * (no - 1) / 98;
const HURDLE = 0.4, LONG = -0.3;

function gimmicks(no) {
  if (no <= 20) return { kinds: "", g: 0 };
  const ch = Math.floor((no - 21) / 20), k = (no - 21) % 20;   // 0..3, 0..19
  const base = ["K", "R", "B", "KRB"][ch], mix = ["K", "RK", "BRK", "KRB"][ch];
  const g = ch === 3 ? 2 + Math.floor(k / 7) : 1 + Math.floor(k / 7);
  return { kinds: k >= 3 ? mix : base, g };
}
const LEN_RANGE = { 4: [6, 13], 5: [9, 22], 6: [11, 28], 7: [13, 34] };

const lg = Math.log10, pools = new Map();
function pool(no, len) {
  const key = no + ":" + len;
  if (!pools.has(key)) pools.set(key, makePool(no, len));
  return pools.get(key);
}
function makePool(no, len) {
  const n = N(no), { kinds, g } = gimmicks(no), out = [], seen = new Set();
  for (let a = 0; a < K * 20 && out.length < K; a++) {
    const seed = 1000 + no * 7919 + len * 613 + a * 104729;
    let L;
    try { L = genLevel([n, len, seed, TYPE(no), kinds, g]); } catch (e) { continue; }
    const key = L.solution.join(",");
    if (seen.has(key)) continue; seen.add(key);
    L.nb = neighbors(L);
    let m;
    try { m = treeSize(L, CAP); } catch (e) { continue; }
    if (m.sols !== 1) continue;
    out.push({ seed, len, T: m.T });
  }
  return out;
}

const pick = [];
let prevNormal = 0;
for (let no = 1; no <= 100; no++) {
  const n = N(no), type = TYPE(no), [lo, hi] = LEN_RANGE[n];
  const newBoard = no === 1 || N(no - 1) !== n;
  let tgt = line(no) + (type === "H" ? HURDLE : type === "L" ? LONG : 0);
  const prev = pick[no - 2];
  const prevLen = prev && !newBoard ? prev.len : lo;
  const from = newBoard ? lo : Math.max(lo, prevLen - 3), to = newBoard ? hi : Math.min(hi, prevLen + (type === "L" ? 6 : 4));
  let best = null;
  for (const strict of [true, false]) {
    if (best) break;
    for (let len = from; len <= to; len++) for (const c of pool(no, len)) {
      if (strict && type === "N" && c.T <= prevNormal) continue;          // normal stages keep climbing
      if (strict && type === "H" && c.T <= prev.T * 1.5) continue;       // hurdle clearly above the stage before
      if (strict && type === "L" && (c.T >= prev.T || len <= prev.len)) continue; // long road: longer but easier
      const err = Math.abs(lg(c.T) - tgt);
      if (!best || err < best.err) best = { ...c, err };
    }
  }
  if (!best) throw new Error("no candidate for stage " + no);
  const { kinds, g } = gimmicks(no);
  pick.push({ no, n, len: best.len, seed: best.seed, type, kinds, g, T: best.T, target: Math.round(10 ** tgt) });
  if (type === "N") prevNormal = Math.max(prevNormal, best.T);
  console.error(`${no}\t${n}x${n}\tLEN ${best.len}\t${type}\t${kinds || "-"}x${g}\tcases ${best.T}\t(target ${Math.round(10 ** tgt)})`);
}
console.log(JSON.stringify(pick));
