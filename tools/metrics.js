// Proposal 4.1 metrics from exported logs (the game's "로그 내보내기" JSON, or rows pulled from the artifact store).
// Runs the game's own computeMetrics (between the ==METRICS== markers in index.html), so both always agree.
// Usage: node metrics.js ../index.html log1.json [log2.json ...]
// Each file: { players: [Player...], plays: [PlayLog...] }. Players are merged by player_id, attempts by play_id.
const fs = require("fs");
const html = fs.readFileSync(process.argv[2], "utf8");
const cut = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const STAGES = new Function(cut("const STAGES = [", "];") + "]; return STAGES;")();
const computeMetrics = new Function(cut("// ==METRICS==", "// ==/METRICS==") + "; return computeMetrics;")();

const players = new Map(), plays = new Map();
for (const file of process.argv.slice(3)) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const p of d.players || []) {
    const had = players.get(p.player_id);
    // keep the newest state of a player seen in several files
    if (!had || Date.parse(p.last_login_at) > Date.parse(had.last_login_at)) players.set(p.player_id, p);
  }
  for (const r of d.plays || []) plays.set(r.play_id, r);
}

const m = computeMetrics([...players.values()], [...plays.values()], id => STAGES[id - 1] && STAGES[id - 1][3]);
const pct = x => x ? `${Math.round(x.v * 100)}% (n=${x.n})` : "-";
const num = x => x ? `${x.v.toFixed(2)} (n=${x.n})` : "-";
const rows = [
  ["캐주얼, 초반 이탈", "초반 이탈률 (1~20)", pct(m.early), ""],
  ["", "D1 리텐션", pct(m.d1), ""],
  ["", "D7 리텐션", pct(m.d7), ""],
  ["새 기물과 이탈", "기물 첫 3 스테이지 이탈률", pct(m.pieceQuit), `직전 3 스테이지 ${pct(m.pieceQuitPrev)}`],
  ["", "  킹 / 룩 / 비숍 / 전체", m.pieceQuitBands.map(pct).join(" / "), ""],
  ["", "기물 이동 직후 막힘 (시도당)", num(m.pieceStuck), `구간 앞 10 ${num(m.pieceStuckFront)} → 뒤 10 ${num(m.pieceStuckBack)}`],
  ["허들, 쉬어가는 길", "허들 이탈률", pct(m.hurdleQuit), `직전 일반 ${pct(m.hurdlePrevQuit)}`],
  ["", "허들 힌트 사용률", pct(m.hurdleHint), `일반 ${pct(m.normalHint)}`],
  ["", "쉬어가는 길 클리어율", pct(m.restClear), `일반 ${pct(m.normalClear)}`],
];
console.log(`유저 ${players.size}명, 시도 ${[...plays.values()].filter(r => r.result).length}회`);
for (const r of rows) console.log(r.join("\t"));
