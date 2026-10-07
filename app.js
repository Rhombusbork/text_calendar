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
    render();
  } catch {}
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return ymd(d); };

// 제출일(월요일) → 제출 그룹 목록. 체크 키는 원래 수업일 기준이라 날짜를 바꿔도 체크가 유지된다.
let due = {}, classOn = {};
function build() {
  due = {}; classOn = {};
  // 제출일은 수업일 기준으로 계산하되, 따로 바꾼 날짜(moves[id])가 있으면 그것을 쓴다
  const group = (id, auto, g) => {
    const day = moves[id] || auto;
    (due[day] ||= []).push({ ...g, id, auto, moved: !!moves[id] });
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

// id: 수업이면 원래 수업일, 제출이면 제출 그룹 id. base: 바꾸기 전 기본 날짜.
function moveDate(id, base, what) {
  const now = moves[id] || base;
  const input = prompt(`${what} 날짜를 입력하세요 (예: ${now}).\n비워 두면 기본 날짜(${base})로 돌아갑니다.`, now);
  if (input === null) return;
  const to = input.trim() || base;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || isNaN(new Date(to + "T00:00"))) return alert("YYYY-MM-DD 형식으로 입력하세요.");
  if (to === base) delete moves[id]; else moves[id] = to;
  post({ move: id, to: to === base ? "" : to });
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
    if (d.getMonth() !== cur.getMonth()) cell.classList.add("out");
    if (day === today) cell.classList.add("today");
    cell.innerHTML = `<div class="num">${d.getDate()}</div>`;

    const c = classOn[day];
    if (c) {
      const lines = [`고전: ${c.classics.map((b) => b.title).join(", ")}`];
      if (c.book) lines.push(`경영서: ${c.book}`);
      if (c.biz) lines.push(`기업실무: ${c.biz}`);
      if (moves[c.date]) lines.push(`(원래 ${md(c.date)})`);
      cell.insertAdjacentHTML("beforeend", `<div class="class">${lines.map((l) => `<div>${l}</div>`).join("")}</div>`);
      if (!window.VIEW_ONLY) {
        const btn = document.createElement("button");
        btn.className = "move";
        btn.textContent = "날짜 변경";
        btn.onclick = () => moveDate(c.date, c.date, "새 수업");
        cell.append(btn);
      }
    }

    for (const g of due[day] || []) {
      const box = document.createElement("div");
      box.className = `group ${g.kind}`;
      const done = !window.VIEW_ONLY && g.items.every((i) => checks[i.key]);
      if (done) box.classList.add("done");
      box.innerHTML = `<div class="gt">${g.title}${g.moved ? ` <span class="orig">(원래 ${md(g.auto)})</span>` : ""}</div>`;
      if (!window.VIEW_ONLY) {
        const btn = document.createElement("button");
        btn.className = "move";
        btn.textContent = "날짜";
        btn.title = "이 제출 날짜만 변경";
        btn.onclick = () => moveDate(g.id, g.auto, `'${g.title}' 제출`);
        box.firstChild.append(" ", btn);
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
        box.append(lab);
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
