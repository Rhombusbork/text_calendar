const STORE = "hra20-checks";
const TEAMS = ["1조", "2조", "3조"];

// 공유 저장소(Google Apps Script 웹 앱 URL). 비어 있으면 이 브라우저에만 저장한다.
const API = "https://script.google.com/macros/s/AKfycby9oyl_hayFbKHbmMA8Ewv_491G8Ke-6MDLIdXLs9vKRQ_A2kvh33mw6C59Xv5l4LpEBw/exec";

let checks = {};
let moves = {}; // 원래 수업일 → 바뀐 수업일
try { checks = JSON.parse(localStorage.getItem(STORE)) || {}; } catch {}
const saveLocal = () => { try { localStorage.setItem(STORE, JSON.stringify(checks)); } catch {} };
// text/plain이면 CORS 사전 요청 없이 보낼 수 있다
const post = (body) => API && fetch(API, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) })
  .catch(() => alert("저장 실패: 인터넷 연결을 확인하세요."));
const save = (key, on) => { saveLocal(); post({ key, on }); };
async function load() {
  if (!API) return;
  try {
    const data = await (await fetch(API)).json();
    if ("checks" in data) { checks = data.checks; moves = data.moves || {}; }
    else checks = data; // 날짜 변경 기능 이전 Apps Script 응답

    saveLocal();
    build();
    if (!document.body.classList.contains("dragging")) render(); // 끄는 중이면 놓을 때 다시 그린다
  } catch {}
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return ymd(d); };

// 제출일(월요일) → 제출 그룹 목록. 체크 키는 원래 수업일 기준이라 날짜를 바꿔도 체크가 유지된다.
let due = {}, classOn = {};
function build() {
  due = {}; classOn = {};
  // 제출일은 수업일 기준으로 계산하되, 따로 바꾼 날짜(moves[id])가 있으면 그것을 쓴다
  // 사람(항목)별로 바꾼 날짜(moves[item.key])가 가장 우선이고, 날짜가 같은 항목끼리 묶어서 보여준다.
  const group = (id, auto, g) => {
    const byDay = {};
    for (const it of g.items) (byDay[moves[it.key] || moves[id] || auto] ||= []).push(it);
    for (const [day, items] of Object.entries(byDay)) {
      (due[day] ||= []).push({ ...g, items, id, auto, base: moves[id] || auto, moved: day !== auto });
    }
  };
  for (const c of CLASSES) {
    const day = moves[c.date] || c.date;
    classOn[day] = c;
    for (const [round, offset] of [["1차", -12], ["2차", -5]]) {
      for (const b of c.classics) {
        const items = b.people
          ? b.people.map(([name, role]) => ({ label: `${name}(${role})`, key: `${c.date}|${round}|${b.title}|${name}` }))
          : [{ label: "제출", key: `${c.date}|${round}|${b.title}` }];
        group(`${c.date}|${round}|${b.title}`, addDays(day, offset), { kind: "classic", title: `고전 ${round} · ${b.title}`, items });
      }
    }
    for (const [kind, name, title] of [["book", "경영서", c.book], ["biz", "기업실무", c.biz]]) {
      if (!title) continue;
      group(`${c.date}|${name}`, addDays(day, -5), {
        kind, title: `${name} · ${title}`,
        items: TEAMS.map((t) => ({ label: t, key: `${c.date}|${name}|${t}` })),
      });
    }
  }
}
build();

// changes: [[id, 바뀐 날짜 | null(기본 날짜로)]]. id는 원래 수업일 / 제출 묶음 id / 항목 키.
function setMoves(changes) {
  for (const [id, to] of changes) {
    if (to) moves[id] = to; else delete moves[id];
    post({ move: id, to: to || "" });
  }
  build();
  render();
}
const md = (s) => s.slice(5).replace("-", "/");

const today = ymd(new Date());
const first = new Date(CLASSES[0].date.slice(0, 7) + "-01T00:00");
first.setMonth(first.getMonth() - 1); // 첫 수업 전달(8월)부터 제출 시작
const last = new Date(CLASSES.at(-1).date.slice(0, 7) + "-01T00:00");
let cur = new Date(today.slice(0, 7) + "-01T00:00");
if (cur < first) cur = new Date(first);
if (cur > last) cur = new Date(last);

const $ = (id) => document.getElementById(id);

// 끌어서 옮길 수 있는 요소에 정보를 달아 둔다. 실제 드래그는 drag.js가 처리한다.
// info: { key, kind, title, from(지금 날짜), base(기본 날짜), ids(바꿀 moves 키들) }
const GRIP = `<svg viewBox="0 0 16 16" aria-hidden="true"><g fill="currentColor">${[4, 8, 12].map((y) =>
  `<circle cx="6" cy="${y}" r="1.4"/><circle cx="10" cy="${y}" r="1.4"/>`).join("")}</g></svg>`;
// gripIn: 손잡이(누르면 날짜 선택, 방향키로 이동)를 넣을 요소
function draggable(el, info, gripIn) {
  el.dataset.dragId = info.key;
  el.drag = info;
  if (!gripIn) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "grip";
  b.innerHTML = GRIP;
  b.title = "끌어서 날짜 옮기기 · 누르면 날짜 선택";
  b.setAttribute("aria-label", `${info.title} 날짜 옮기기. 방향키로 이동, Enter로 확정`);
  gripIn.prepend(b);
}

function render() {
  $("title").textContent = `${cur.getFullYear()}년 ${cur.getMonth() + 1}월`;
  $("prev").disabled = cur <= first;
  $("next").disabled = cur >= last;

  const grid = $("grid");
  grid.querySelectorAll(".cell").forEach((n) => n.remove());

  const start = new Date(cur);
  start.setDate(1 - ((start.getDay() + 6) % 7)); // 월요일 시작
  const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);

  for (const d = new Date(start); d <= end || d.getDay() !== 1; d.setDate(d.getDate() + 1)) {
    const day = ymd(d);
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.day = day;
    if (d.getMonth() !== cur.getMonth()) cell.classList.add("out");
    if (day === today) cell.classList.add("today");
    cell.innerHTML = `<div class="num">${d.getDate()}</div>`;

    const c = classOn[day];
    if (c) {
      const lines = [`고전: ${c.classics.map((b) => b.title).join(", ")}`];
      if (c.book) lines.push(`경영서: ${c.book}`);
      if (c.biz) lines.push(`기업실무: ${c.biz}`);
      if (moves[c.date]) lines.push(`(원래 ${md(c.date)})`);
      const cl = document.createElement("div");
      cl.className = "class";
      cl.innerHTML = lines.map((l) => `<div>${l}</div>`).join("");
      if (!window.VIEW_ONLY) draggable(cl, { key: c.date, kind: "class", title: `수업 · ${c.classics.map((b) => b.title).join(", ")}`, from: day, base: c.date, ids: [c.date] }, cl);
      cell.append(cl);
    }

    for (const g of due[day] || []) {
      const box = document.createElement("div");
      box.className = `group ${g.kind}`;
      const done = !window.VIEW_ONLY && g.items.every((i) => checks[i.key]);
      if (done) box.classList.add("done");
      box.innerHTML = `<div class="gt">${g.title}${g.moved ? ` <span class="orig">(원래 ${md(g.auto)})</span>` : ""}</div>`;
      if (!window.VIEW_ONLY) {
        // 묶음 날짜에 있는 상자는 묶음째로, 따로 옮겨 둔 항목끼리 모인 상자는 그 항목들만 옮긴다
        const main = day === g.base;
        draggable(box, main
          ? { key: g.id, kind: g.kind, title: g.title, from: day, base: g.auto, ids: [g.id] }
          : { key: g.id, kind: g.kind, title: `${g.title} (${g.items.map((i) => i.label).join(", ")})`, from: day, base: g.base, ids: g.items.map((i) => i.key) },
        box.firstChild);
      }
      if (window.VIEW_ONLY) {
        if (g.kind === "classic") box.insertAdjacentHTML("beforeend", `<div class="who">${g.items.map((i) => i.label).join(" · ")}</div>`);
        cell.append(box);
        continue;
      }
      for (const it of g.items) {
        const lab = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!checks[it.key];
        cb.onchange = () => {
          if (cb.checked) checks[it.key] = 1; else delete checks[it.key];
          save(it.key, cb.checked);
          box.classList.toggle("done", g.items.every((i) => checks[i.key]));
        };
        lab.append(cb, it.label);
        if (g.items.length > 1) draggable(lab, { key: it.key, kind: g.kind, title: `${it.label} · ${g.title}`, from: day, base: g.base, ids: [it.key] });
        box.append(lab, " ");
      }
      cell.append(box);
    }
    grid.append(cell);
  }
}

$("prev").onclick = () => { cur.setMonth(cur.getMonth() - 1); render(); };
$("next").onclick = () => { cur.setMonth(cur.getMonth() + 1); render(); };
render();
load();
setInterval(load, 60000); // 다른 사람이 체크한 내용 1분마다 반영
