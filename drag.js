// 끌어서 날짜 옮기기. Pointer Events라 마우스·터치 모두 같은 코드로 동작한다.
//  - 마우스: 4px 이상 움직이면 시작
//  - 터치: 손잡이(⠿)는 바로, 나머지는 길게 눌러(350ms) 시작 — 그냥 쓸면 화면이 스크롤된다
//  - 칸 위에 놓으면 그 날짜로, 달력 밖에 놓거나 Esc를 누르면 취소. 놓은 뒤 "되돌리기"(Ctrl+Z) 가능
//  - 끄는 중 화면 위아래 끝에 가면 자동 스크롤, ‹ › 위에 잠시 머무르면 달이 넘어간다
//  - 손잡이를 누르면 날짜 선택, 손잡이에서 방향키(←→ 하루, ↑↓ 일주일) + Enter로도 옮길 수 있다
(() => {
  if (window.VIEW_ONLY) return;

  const grid = $("grid");
  const WD = "일월화수목금토";
  const fmt = (s) => `${md(s)}(${WD[new Date(s + "T00:00").getDay()]})`;
  const cellOf = (day) => grid.querySelector(`.cell[data-day="${day}"]`);
  const elOf = (key, day) => cellOf(day)?.querySelector(`[data-drag-id="${CSS.escape(key)}"]`);
  const STEP = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

  let pending = null; // 눌렀지만 아직 드래그로 판정되기 전
  let drag = null;
  let suppressClick = false;

  // 수업은 하루에 하나만
  const blocked = (info, day) => info.kind === "class" && classOn[day] && classOn[day].date !== info.base;

  // ---- 끄는 중 화면 표시 ----
  function paint() {
    document.querySelectorAll(".drop-target, .home, .lifted").forEach((n) => n.classList.remove("drop-target", "invalid", "home", "lifted"));
    if (!drag) return;
    const { info, day, pv } = drag;
    if (info.from !== info.base) cellOf(info.base)?.classList.add("home");
    elOf(info.key, info.from)?.classList.add("lifted");
    const t = day && cellOf(day);
    if (t) t.classList.add("drop-target");
    if (t && blocked(info, day)) t.classList.add("invalid");

    let to, sub = "";
    if (!day) to = "여기에 놓으면 취소";
    else if (blocked(info, day)) to = `${fmt(day)} · 이미 수업이 있어요`;
    else if (day === info.from) to = `${fmt(day)} · 그대로`;
    else {
      to = `→ ${fmt(day)}${day === info.base ? " · 기본 날짜" : ""}`;
      if (info.kind === "class") sub = `제출: 고전 1차 ${md(addDays(day, -12))} · 2차 ${md(addDays(day, -5))}`;
    }
    pv.classList.toggle("bad", !day || blocked(info, day));
    pv.querySelector(".dp-to").textContent = to;
    pv.querySelector(".dp-sub").textContent = sub;
    $("sr").textContent = to;
  }

  // p: 누른 포인터 정보 { touch, id } — 키보드면 null
  function start(el, x, y, p) {
    const kbd = !p;
    const info = el.drag;
    const pv = document.createElement("div");
    pv.className = `drag-preview ${info.kind}`;
    pv.innerHTML = `<div class="dp-title"></div><div class="dp-to"></div><div class="dp-sub"></div>`;
    pv.querySelector(".dp-title").textContent = info.title;
    document.body.append(pv);
    document.body.classList.add("dragging");
    drag = { info, pv, kbd, day: info.from, src: el.getBoundingClientRect() };
    paint();
    if (kbd) return;

    // 마우스는 잡은 지점을 유지하고, 터치는 손가락에 가리지 않게 위쪽에 띄운다
    const { src } = drag, w = pv.offsetWidth, h = pv.offsetHeight;
    drag.touch = p.touch;
    drag.id = p.id;
    drag.dx = drag.touch ? -w / 2 : -Math.min(Math.max(x - src.left, 8), w - 8);
    drag.dy = drag.touch ? -h - 32 : -Math.min(Math.max(y - src.top, 8), h - 8);
    if (drag.touch) navigator.vibrate?.(10);
    move(x, y);
    drag.raf = requestAnimationFrame(autoScroll);
  }

  function move(x, y) {
    drag.x = x;
    drag.y = y;
    drag.pv.style.transform = `translate(${x + drag.dx}px, ${y + drag.dy}px)`;
    const el = document.elementFromPoint(x, y);
    hoverNav(el?.closest("header button:not(:disabled)"));
    const day = el?.closest(".cell")?.dataset.day || null;
    if (day !== drag.day) { drag.day = day; paint(); }
  }

  function autoScroll() {
    const edge = 64, { y } = drag, h = innerHeight;
    const v = y < edge ? -(edge - y) / 3 : y > h - edge ? (y - (h - edge)) / 3 : 0;
    if (v) { scrollBy(0, v); move(drag.x, drag.y); }
    drag.raf = requestAnimationFrame(autoScroll);
  }

  // ‹ › 위에 머무르면 달 넘기기 (계속 머무르면 반복)
  function hoverNav(btn) {
    if (btn === drag.nav) return;
    clearTimeout(drag.navTimer);
    drag.nav?.classList.remove("nav-hover");
    drag.nav = btn;
    if (!btn) return;
    btn.classList.add("nav-hover");
    const flip = () => {
      if (!drag || drag.nav !== btn || btn.disabled) return;
      btn.click();
      paint();
      drag.navTimer = setTimeout(flip, 800);
    };
    drag.navTimer = setTimeout(flip, 500);
  }

  // 키보드: 표시 중인 달 밖으로 가면 달을 넘긴다
  function setDay(day) {
    const m = new Date(day.slice(0, 7) + "-01T00:00");
    if (!cellOf(day)) {
      if (m < first || m > last) return;
      cur = m;
      render();
    }
    drag.day = day;
    paint();
    const r = cellOf(day).getBoundingClientRect();
    drag.pv.style.transform = `translate(${Math.min(r.left, innerWidth - drag.pv.offsetWidth - 8)}px, ${r.bottom + 4}px)`;
    cellOf(day).scrollIntoView({ block: "nearest" });
  }

  function finish(drop) {
    const { info, day, pv, kbd } = drag;
    cancelAnimationFrame(drag.raf);
    clearTimeout(drag.navTimer);
    drag.nav?.classList.remove("nav-hover");
    drag = null;
    document.body.classList.remove("dragging");
    paint();

    if (drop && day && day !== info.from && !blocked(info, day)) {
      pv.remove();
      commit(info, day);
    } else {
      if (drop && day && blocked(info, day)) toast("그날은 이미 수업이 있어요");
      if (!cellOf(info.from)) cur = new Date(info.from.slice(0, 7) + "-01T00:00"); // 넘긴 달에서 원래 달로
      render(); // 끄는 동안 미뤄 둔 새로 고침 반영
      // 원래 자리로 돌아가는 애니메이션
      const back = elOf(info.key, info.from)?.getBoundingClientRect();
      const anim = back && !kbd
        ? pv.animate([{}, { transform: `translate(${back.left}px, ${back.top}px)`, opacity: 0.3 }], { duration: 180, easing: "ease-in" })
        : pv.animate([{}, { opacity: 0 }], { duration: 120 });
      anim.onfinish = () => pv.remove();
    }
    if (kbd) {
      elOf(info.key, drop && day && !blocked(info, day) ? day : info.from)?.querySelector(".grip")?.focus();
      // Enter/Space를 뗄 때 새로 포커스된 손잡이가 눌리지 않게
      suppressClick = true;
      addEventListener("keyup", () => setTimeout(() => { suppressClick = false; }), { once: true });
    }
  }

  // ---- 저장 · 되돌리기 ----
  function commit(info, to) {
    if (to === info.from) return;
    if (blocked(info, to)) return toast("그날은 이미 수업이 있어요");
    const prev = info.ids.map((id) => [id, moves[id]]);
    setMoves(info.ids.map((id) => [id, to === info.base ? null : to]));
    land(info.key, to);
    toast(`${info.title} → ${fmt(to)}${to === info.base ? " (기본 날짜)" : ""}`, () => {
      setMoves(prev);
      land(info.key, info.from);
    });
  }

  function land(key, day) {
    if (!cellOf(day)) { cur = new Date(day.slice(0, 7) + "-01T00:00"); render(); }
    const el = elOf(key, day);
    if (!el) return;
    el.classList.remove("landed");
    void el.offsetWidth;
    el.classList.add("landed");
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  document.body.append(toastEl);
  let toastTimer, undo = null;
  function toast(msg, onUndo) {
    clearTimeout(toastTimer);
    toastEl.replaceChildren(msg);
    undo = onUndo || null;
    if (undo) {
      const b = document.createElement("button");
      b.textContent = "되돌리기";
      b.onclick = () => { const u = undo; hideToast(); u(); };
      toastEl.append(b);
    }
    toastEl.classList.add("show");
    $("sr").textContent = msg;
    toastTimer = setTimeout(hideToast, undo ? 7000 : 3000);
  }
  function hideToast() { toastEl.classList.remove("show"); undo = null; }

  // ---- 날짜 선택 (손잡이를 눌렀을 때) ----
  const picker = document.createElement("input");
  picker.type = "date";
  picker.className = "picker";
  picker.tabIndex = -1;
  picker.setAttribute("aria-hidden", "true");
  document.body.append(picker);
  let pickInfo = null;
  picker.addEventListener("change", () => {
    const info = pickInfo;
    pickInfo = null;
    if (info) commit(info, picker.value || info.base); // 지우면 기본 날짜로
  });
  function pick(info, anchor) {
    const r = anchor.getBoundingClientRect();
    picker.style.left = `${r.left}px`;
    picker.style.top = `${r.bottom}px`;
    picker.value = info.from;
    pickInfo = info;
    try { picker.showPicker(); } catch {
      pickInfo = null;
      const input = prompt(`옮길 날짜를 입력하세요 (예: ${info.from}).\n비워 두면 기본 날짜(${info.base})로 돌아갑니다.`, info.from);
      if (input === null) return;
      const to = input.trim() || info.base;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || isNaN(new Date(to + "T00:00"))) return alert("YYYY-MM-DD 형식으로 입력하세요.");
      commit(info, to);
    }
  }

  // ---- 포인터 ----
  const cancelPending = () => { clearTimeout(pending?.timer); pending = null; };

  grid.addEventListener("pointerdown", (e) => {
    if (drag || pending || !e.isPrimary || e.button !== 0) return;
    const el = e.target.closest("[data-drag-id]");
    if (!el) return;
    const touch = e.pointerType !== "mouse";
    pending = { el, x: e.clientX, y: e.clientY, cx: e.clientX, cy: e.clientY, id: e.pointerId, touch };
    if (touch && !e.target.closest(".grip")) {
      pending.timer = setTimeout(() => { const p = pending; pending = null; start(p.el, p.cx, p.cy, p); }, 350);
    }
  });

  addEventListener("pointermove", (e) => {
    if (drag && !drag.kbd && e.pointerId === drag.id) return move(e.clientX, e.clientY);
    if (!pending || e.pointerId !== pending.id) return;
    pending.cx = e.clientX;
    pending.cy = e.clientY;
    const dist = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
    if (pending.timer) { if (dist > 8) cancelPending(); } // 길게 누르기 전에 움직이면 스크롤
    else if (dist > 4) { const p = pending; pending = null; start(p.el, e.clientX, e.clientY, p); }
  });

  addEventListener("pointerup", (e) => {
    if (drag && !drag.kbd && e.pointerId === drag.id) {
      // 드래그 끝에 따라오는 click(체크박스 토글, 날짜 선택)은 무시
      suppressClick = true;
      setTimeout(() => { suppressClick = false; });
      finish(true);
    }
    cancelPending();
  });

  addEventListener("pointercancel", (e) => {
    if (drag && !drag.kbd && e.pointerId === drag.id) finish(false);
    cancelPending();
  });

  addEventListener("click", (e) => {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
  }, true);

  // 드래그 중에는 화면이 스크롤되거나 길게 누르기 메뉴가 뜨지 않게
  document.addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false });
  addEventListener("contextmenu", (e) => { if (drag || pending?.timer) e.preventDefault(); });

  grid.addEventListener("click", (e) => {
    const grip = e.target.closest(".grip");
    if (grip) pick(grip.closest("[data-drag-id]").drag, grip);
  });

  // ---- 키보드 ----
  grid.addEventListener("keydown", (e) => {
    const grip = e.target.closest(".grip");
    if (!grip || drag || !(e.key in STEP)) return;
    e.preventDefault();
    const el = grip.closest("[data-drag-id]");
    start(el, 0, 0, null);
    setDay(addDays(el.drag.from, STEP[e.key]));
  });

  addEventListener("keydown", (e) => {
    if (!drag) {
      if (undo && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); toastEl.querySelector("button").click(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
    else if (drag.kbd && e.key in STEP) { e.preventDefault(); setDay(addDays(drag.day, STEP[e.key])); }
    else if (drag.kbd && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); finish(true); }
  });
})();
