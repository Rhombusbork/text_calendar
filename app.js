const STORE = "hra20-checks";
const TEAMS = ["1조", "2조", "3조"];

let checks = {};
try { checks = JSON.parse(localStorage.getItem(STORE)) || {}; } catch {}
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(checks)); } catch {} };

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s, n) => { const d = new Date(s + "T00:00"); d.setDate(d.getDate() + n); return ymd(d); };

// 제출일(월요일) → 제출 그룹 목록
const due = {};
const push = (day, g) => (due[day] ||= []).push(g);
for (const c of CLASSES) {
  for (const [round, offset] of [["1차", -12], ["2차", -5]]) {
    for (const b of c.classics) {
      const items = b.people
        ? b.people.map(([name, role]) => ({ label: `${name}(${role})`, key: `${c.date}|${round}|${b.title}|${name}` }))
        : [{ label: "제출", key: `${c.date}|${round}|${b.title}` }];
      push(addDays(c.date, offset), { kind: "classic", title: `고전 ${round} · ${b.title}`, items });
    }
  }
  for (const [kind, name, title] of [["book", "경영서", c.book], ["biz", "기업실무", c.biz]]) {
    if (!title) continue;
    push(addDays(c.date, -5), {
      kind, title: `${name} · ${title}`,
      items: TEAMS.map((t) => ({ label: t, key: `${c.date}|${name}|${t}` })),
    });
  }
}
const classOn = Object.fromEntries(CLASSES.map((c) => [c.date, c]));

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

    if (classOn[day]) cell.insertAdjacentHTML("beforeend", `<div class="class">수업</div>`);

    for (const g of due[day] || []) {
      const box = document.createElement("div");
      box.className = `group ${g.kind}`;
      const done = !window.VIEW_ONLY && g.items.every((i) => checks[i.key]);
      if (done) box.classList.add("done");
      box.innerHTML = `<div class="gt">${g.title}</div>`;
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
          save();
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
