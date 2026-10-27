/* ============================================================
   ЛИЛА — игра: поле, фишки, кубик, карточки, пособие
   Зависит от lila-data.js и общих функций index.html
   (contentEl, escapeHtml, showWelcome, setActiveSection, fmtDate)
   ============================================================ */

const LILA_STORE_KEY = "psychology_lila_game_v1";
const LILA_CHIP_COLORS = ["#F4A582", "#7FC8E8", "#8fe3b0", "#F2D16B", "#C49BF0", "#F07A8A"];
const LILA_ROW_COLORS = ["#E05555", "#F08A3C", "#F2D16B", "#5DCB8A", "#5BA8E8", "#6C6FE0", "#A77BE8", "#F4D6A0"];
const LILA_CHAKRA_CELLS = [5, 14, 23, 32, 41, 50, 59, 68];

let lilaGame = null;
let lilaBusy = false;
let lilaDiceSpin = 0;

/* ---------- Хранение партии на этом устройстве ---------- */
function lilaSave() { try { localStorage.setItem(LILA_STORE_KEY, JSON.stringify(lilaGame)); } catch (e) {} }
function lilaLoad() { try { const s = localStorage.getItem(LILA_STORE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function lilaClear() { try { localStorage.removeItem(LILA_STORE_KEY); } catch (e) {} }
function lilaSleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ---------- Геометрия поля ---------- */
function lilaRowOf(n) { return Math.floor((n - 1) / 9); }            // 0 — нижний ряд
function lilaColOf(n) { const r = lilaRowOf(n), i = (n - 1) % 9; return r % 2 === 0 ? i : 8 - i; }
function lilaXY(n) { return { x: lilaColOf(n) * 100 + 50, y: (7 - lilaRowOf(n)) * 100 + 50 }; }
function lilaJump(n) { return LILA_ARROWS[n] || LILA_SNAKES[n] || null; }
function lilaCellTitle(n) { const c = LILA_CELLS[n]; return c ? c.name : ""; }

/* ============================================================
   СТРАНИЦА ИГРЫ В РАЗДЕЛЕ «ТРАНСФОРМАЦИОННЫЕ ИГРЫ»
   ============================================================ */
function openLila() {
  showWelcome(false);
  const saved = lilaLoad();
  const canResume = saved && saved.players && saved.players.some(p => !p.done) && !saved.over;
  contentEl().innerHTML = `
    <div class="dashboard-wrap">
      <button class="btn btn-ghost btn-small" style="margin-bottom:16px;" onclick="showSection('games')">← Все игры</button>
      <div class="lila-hero">
        <div class="lila-hero-icon">🪷</div>
        <div>
          <h2>Лила — игра самопознания</h2>
          <p>Древняя игра из 72 клеток — карта состояний сознания. Вы приходите с запросом, бросаете кубик и проходите путь от «Рождения» до «Космического сознания». Каждая клетка, на которую вы попадаете, помогает увидеть ответ</p>
        </div>
      </div>
      <div class="cards" style="margin-top:20px;">
        <div class="card" onclick="openLilaManual()" role="button" tabindex="0">
          <div class="card-icon">📖</div>
          <h3>Методическое пособие</h3>
          <p>Правила, как проводить игру, уровни поля и описание всех 72 клеток</p>
        </div>
        <div class="card" onclick="lilaSetup()" role="button" tabindex="0">
          <div class="card-icon">🎲</div>
          <h3>Игра на одном экране</h3>
          <p>Ведущий ведёт игру у себя: впишите имена и запросы игроков</p>
        </div>
        <div class="card" onclick="awkCreateRoom('lila')" role="button" tabindex="0">
          <div class="card-icon">🌐</div>
          <h3>Онлайн-игра</h3>
          <p>Игровая комната по ссылке: игроки сами бросают кубик, общий чат с фото и голосовыми</p>
        </div>
        ${canResume ? `<div class="card" onclick="lilaResume()" role="button" tabindex="0">
          <div class="card-icon">▶️</div>
          <h3>Продолжить игру</h3>
          <p>${escapeHtml(saved.players.map(p => p.name).join(", "))}</p>
        </div>` : ""}
      </div>
      ${awkRoomsBlock("lila")}
    </div>`;
  awkLoadRooms("lila");
}

/* ============================================================
   НАСТРОЙКА ПАРТИИ
   ============================================================ */
function lilaSetup() {
  const saved = lilaLoad();
  if (saved && saved.players && !saved.over && saved.players.some(p => !p.done)) {
    customConfirm("Начать новую игру? Незавершённая партия будет удалена.").then(ok => { if (ok) { lilaClear(); lilaSetupForm(1); } });
    return;
  }
  lilaSetupForm(1);
}

function lilaSetupForm(count) {
  showWelcome(false);
  const prev = Array.from(document.querySelectorAll(".lila-setup-player")).map(el => ({
    name: el.querySelector(".lp-name")?.value || "", query: el.querySelector(".lp-query")?.value || ""
  }));
  contentEl().innerHTML = `
    <div class="dashboard-wrap">
      <button class="btn btn-ghost btn-small" style="margin-bottom:16px;" onclick="openLila()">← Назад</button>
      <div class="dashboard-head"><div><h2>🎲 Новая игра Лила</h2><p>Добавьте игроков. У каждого будет своя фишка своего цвета</p></div></div>
      <div class="table-card" style="margin-bottom:18px;">
        <div class="table-title">Как сформулировать запрос</div>
        <p class="section-note" style="margin-bottom:6px;">Запрос — это вопрос о себе, на который вы ищете ответ. Он должен касаться вас, а не других людей, и того, на что вы можете повлиять. Хорошо начинать с «Как мне…», «Что мне важно понять о…», «Что мешает мне…»</p>
        <p class="section-note" style="margin:0;">Например: «Как мне найти дело, которое будет приносить радость и доход?», «Что мне важно понять о моих отношениях с мамой?», «Что мешает мне начать своё дело?»</p>
      </div>
      <div class="table-card">
        <label class="form-row" style="max-width:240px;"><span>Количество игроков</span>
          <select class="input" onchange="lilaSetupForm(Number(this.value))">
            ${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${n === count ? "selected" : ""}>${n}</option>`).join("")}
          </select></label>
        ${Array.from({ length: count }, (_, i) => `
          <div class="lila-setup-player">
            <div class="lila-chip" style="background:${LILA_CHIP_COLORS[i]};">${i + 1}</div>
            <div style="flex:1;min-width:0;">
              <input class="input lp-name" maxlength="30" placeholder="Имя игрока ${i + 1}" value="${escapeHtml(prev[i]?.name || "")}" style="margin-bottom:8px;">
              <textarea class="input lp-query" rows="2" maxlength="300" placeholder="Запрос игрока">${escapeHtml(prev[i]?.query || "")}</textarea>
            </div>
          </div>`).join("")}
        <button class="btn" style="margin-top:8px;" onclick="lilaStart()">Начать игру</button>
        <div id="lilaSetupMsg" class="msg"></div>
      </div>
    </div>`;
}

function lilaStart() {
  const rows = Array.from(document.querySelectorAll(".lila-setup-player"));
  const players = rows.map((el, i) => ({
    id: i, color: LILA_CHIP_COLORS[i],
    name: (el.querySelector(".lp-name").value || "").trim(),
    query: (el.querySelector(".lp-query").value || "").trim(),
    pos: 68, born: false, done: false, path: []
  }));
  if (players.some(p => !p.name)) { setMsgEl("lilaSetupMsg", "Впишите имя каждого игрока", false); return; }
  lilaGame = { players, turn: 0, rolls: [], log: [], over: false, startedAt: new Date().toISOString() };
  lilaLog("Игра началась. Все фишки стоят на клетке 68 «Космическое сознание». Чтобы родиться в игре, нужна шестёрка");
  lilaSave();
  lilaRenderGame();
}

function lilaResume() { lilaGame = lilaLoad(); if (!lilaGame) { openLila(); return; } lilaRenderGame(); }

function lilaLog(text) {
  lilaGame.log.unshift({ t: new Date().toISOString(), text });
  lilaGame.log = lilaGame.log.slice(0, 60);
}

/* ============================================================
   ИГРОВОЙ ЭКРАН
   ============================================================ */
function lilaBoardHtml() {
  let cells = "";
  for (let r = 7; r >= 0; r--) {
    for (let c = 0; c < 9; c++) {
      const n = r * 9 + (r % 2 === 0 ? c + 1 : 9 - c);
      const color = LILA_ROW_COLORS[r];
      const chakra = LILA_CHAKRA_CELLS.includes(n);
      const mark = LILA_ARROWS[n] ? "↑" : (LILA_SNAKES[n] ? "↓" : "");
      cells += `<button class="lila-cell${chakra ? " chakra" : ""}" style="--rc:${color};" onclick="lilaCellInfo(${n})" aria-label="Клетка ${n}: ${escapeHtml(lilaCellTitle(n))}">
        <span class="lila-num">${n}</span>${mark ? `<span class="lila-mark ${LILA_ARROWS[n] ? "up" : "down"}">${mark}</span>` : ""}
        ${chakra ? `<span class="lila-lotus" style="background:${color};"></span>` : ""}
        <span class="lila-name">${escapeHtml(lilaCellTitle(n))}</span>
      </button>`;
    }
  }
  return `<div class="lila-board" id="lilaBoard">
      <div class="lila-grid">${cells}</div>
      <svg class="lila-overlay" viewBox="0 0 900 800" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id="lilaArrowHead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#F2D16B"/></marker></defs>
        ${Object.keys(LILA_SNAKES).map(h => lilaSnakePath(Number(h), LILA_SNAKES[h])).join("")}
        ${Object.keys(LILA_ARROWS).map(b => lilaArrowPath(Number(b), LILA_ARROWS[b])).join("")}
      </svg>
      <div class="lila-tokens" id="lilaTokens"></div>
    </div>`;
}

function lilaArrowPath(from, to) {
  const a = lilaXY(from), b = lilaXY(to);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const x1 = a.x + ux * 18, y1 = a.y + uy * 18, x2 = b.x - ux * 22, y2 = b.y - uy * 22;
  const px = -uy * 9, py = ux * 9;
  return `<g opacity="0.9">
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#F2D16B" stroke-width="4.5" stroke-linecap="round" marker-end="url(#lilaArrowHead)"/>
    <line x1="${x1}" y1="${y1}" x2="${x1 - ux * 12 + px}" y2="${y1 - uy * 12 + py}" stroke="#F2D16B" stroke-width="3" stroke-linecap="round"/>
    <line x1="${x1}" y1="${y1}" x2="${x1 - ux * 12 - px}" y2="${y1 - uy * 12 - py}" stroke="#F2D16B" stroke-width="3" stroke-linecap="round"/>
  </g>`;
}

function lilaSnakePath(head, tail) {
  const a = lilaXY(head), b = lilaXY(tail);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const waves = Math.max(1.5, len / 140), amp = Math.min(22, 8 + len / 40);
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, fade = Math.sin(Math.PI * Math.min(1, t * 1.15));
    const off = Math.sin(t * waves * 2 * Math.PI) * amp * fade;
    pts.push(`${(a.x + dx * t + nx * off).toFixed(1)},${(a.y + dy * t + ny * off).toFixed(1)}`);
  }
  const d = "M" + pts.join(" L");
  return `<g opacity="0.85">
    <path d="${d}" fill="none" stroke="#3a1d2e" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#E8826A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#FCE3D6" stroke-width="1.6" stroke-dasharray="3 9" stroke-linecap="round"/>
    <ellipse cx="${a.x}" cy="${a.y}" rx="11" ry="9" fill="#E8826A" stroke="#3a1d2e" stroke-width="2.5" transform="rotate(${Math.atan2(dy, dx) * 180 / Math.PI} ${a.x} ${a.y})"/>
    <circle cx="${a.x - 3}" cy="${a.y - 2}" r="1.8" fill="#0A1430"/><circle cx="${a.x + 3}" cy="${a.y - 2}" r="1.8" fill="#0A1430"/>
  </g>`;
}

function lilaDiceHtml() {
  const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const face = (n) => `<div class="dice-face f${n}">${Array.from({ length: 9 }, (_, i) => `<span class="${pips[n].includes(i) ? "pip" : ""}"></span>`).join("")}</div>`;
  return `<div class="dice-scene"><div class="dice" id="lilaDice">${[1, 2, 3, 4, 5, 6].map(face).join("")}</div></div>`;
}

function lilaRenderGame() {
  showWelcome(false);
  contentEl().innerHTML = `
    <div class="lila-game">
      <div class="lila-topbar no-print">
        <button class="btn btn-ghost btn-small" onclick="openLila()">← К игре Лила</button>
        <div class="tracker-actions">
          <button class="btn btn-ghost btn-small" onclick="lilaShowRules()">Правила</button>
          <button class="btn btn-ghost btn-small" onclick="lilaShowSummary()">Путь игроков</button>
          <button class="btn btn-ghost btn-small" onclick="lilaFinishGame()">Завершить игру</button>
        </div>
      </div>
      <div class="lila-layout">
        <div>${lilaBoardHtml()}</div>
        <aside class="lila-side">
          <div class="lila-turn" id="lilaTurn"></div>
          <div class="lila-dice-wrap">
            ${lilaDiceHtml()}
            <button class="btn lila-roll" id="lilaRollBtn" onclick="lilaRoll()">Бросить кубик</button>
          </div>
          <div class="lila-msg" id="lilaMsg"></div>
          <div class="table-title" style="font-size:17px;margin:16px 0 8px;">Игроки</div>
          <div id="lilaPlayers"></div>
          <div class="table-title" style="font-size:17px;margin:16px 0 8px;">Ход игры</div>
          <div class="lila-log" id="lilaLogBox"></div>
        </aside>
      </div>
    </div>`;
  lilaRefresh();
  window.scrollTo(0, 0);
}

function lilaCurrent() { return lilaGame.players[lilaGame.turn]; }

function lilaRefresh() {
  if (!lilaGame) return;
  lilaPlaceTokens();
  const p = lilaCurrent();
  const turn = document.getElementById("lilaTurn");
  if (turn) turn.innerHTML = lilaGame.over
    ? `<div class="lila-turn-name">Игра завершена</div>`
    : `<div class="lila-chip big" style="background:${p.color};">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
       <div><div style="color:var(--muted);font-size:13px;">Сейчас ходит</div><div class="lila-turn-name">${escapeHtml(p.name)}</div>
       ${lilaGame.rolls.length ? `<div style="color:var(--coral);font-size:13px;">Выпало: ${lilaGame.rolls.join(" + ")} — бросайте ещё</div>` : ""}</div>`;
  const btn = document.getElementById("lilaRollBtn");
  if (btn) btn.disabled = lilaBusy || lilaGame.over;
  const list = document.getElementById("lilaPlayers");
  if (list) list.innerHTML = lilaGame.players.map((pl, i) => `
    <div class="lila-player${i === lilaGame.turn && !lilaGame.over ? " active" : ""}">
      <div class="lila-chip" style="background:${pl.color};">${escapeHtml(pl.name.charAt(0).toUpperCase())}</div>
      <div style="min-width:0;flex:1;">
        <div style="color:var(--cream);font-size:15px;">${escapeHtml(pl.name)}${pl.done ? " 🎉" : ""}</div>
        <div style="color:var(--muted);font-size:12px;">${!pl.born ? "ожидает рождения — нужна шестёрка" : (pl.done ? "достиг(ла) Космического сознания" : "клетка " + pl.pos + " · " + escapeHtml(lilaCellTitle(pl.pos)))}</div>
        ${pl.query ? `<div class="lila-query">«${escapeHtml(pl.query)}»</div>` : ""}
      </div>
    </div>`).join("");
  const log = document.getElementById("lilaLogBox");
  if (log) log.innerHTML = lilaGame.log.slice(0, 12).map(l => `<div>${escapeHtml(l.text)}</div>`).join("");
}

function lilaSetMsg(text) { const el = document.getElementById("lilaMsg"); if (el) el.textContent = text; }

function lilaPlaceTokens() {
  const box = document.getElementById("lilaTokens");
  if (!box) return;
  const offsets = [[0, 0], [-13, -10], [13, -10], [-13, 10], [13, 10], [0, 16]];
  const byCell = {};
  lilaGame.players.forEach(p => { (byCell[p.pos] = byCell[p.pos] || []).push(p); });
  lilaGame.players.forEach(p => {
    let el = document.getElementById("lilaTok" + p.id);
    if (!el) {
      el = document.createElement("div");
      el.id = "lilaTok" + p.id;
      el.className = "lila-token";
      el.style.background = p.color;
      el.title = p.name;
      el.textContent = p.name.charAt(0).toUpperCase();
      box.appendChild(el);
    }
    const group = byCell[p.pos], k = group.indexOf(p), xy = lilaXY(p.pos);
    const [ox, oy] = group.length > 1 ? offsets[k % offsets.length] : [0, 0];
    el.style.left = (xy.x / 9) + "%";
    el.style.top = (xy.y / 8) + "%";
    el.style.setProperty("--ox", ox + "px");
    el.style.setProperty("--oy", oy + "px");
    el.classList.toggle("current", p === lilaCurrent() && !lilaGame.over);
    el.classList.toggle("waiting", !p.born);
  });
}

/* ---------- Кубик ---------- */
function lilaRandomDie() {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % 6) + 1; }
  catch (e) { return Math.floor(Math.random() * 6) + 1; }
}
async function lilaAnimateDice(v) {
  const rot = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] }[v];
  lilaDiceSpin += 2;
  const dice = document.getElementById("lilaDice");
  if (dice) dice.style.transform = `rotateX(${lilaDiceSpin * 360 + rot[0]}deg) rotateY(${lilaDiceSpin * 360 + rot[1]}deg)`;
  await lilaSleep(1050);
}

/* ---------- Движение фишки ---------- */
async function lilaStepTo(p, target) {
  const tok = document.getElementById("lilaTok" + p.id);
  if (tok) tok.classList.remove("jumping");
  while (p.pos < target) { p.pos++; lilaPlaceTokens(); await lilaSleep(190); }
}
async function lilaFlyTo(p, target) {
  const tok = document.getElementById("lilaTok" + p.id);
  if (tok) tok.classList.add("jumping");
  p.pos = target; lilaPlaceTokens();
  await lilaSleep(1000);
  if (tok) tok.classList.remove("jumping");
}

/* ---------- Ход ---------- */
async function lilaRoll() {
  if (lilaBusy || !lilaGame || lilaGame.over) return;
  lilaBusy = true; lilaRefresh();
  const p = lilaCurrent();
  const v = lilaRandomDie();
  await lilaAnimateDice(v);

  try {
    if (!p.born) {
      if (v !== 6) {
        lilaLog(`${p.name}: выпало ${v}. Для входа в игру нужна шестёрка`);
        lilaSetMsg(`Выпало ${v}. Для рождения в игре нужна шестёрка`);
        lilaNextTurn();
        return;
      }
      p.born = true;
      lilaLog(`${p.name}: выпала шестёрка — рождение в игре`);
      lilaSetMsg("Шестёрка! Вы родились в игре");
      p.pos = 1; lilaPlaceTokens(); await lilaSleep(500);
      p.path.push({ n: 1, kind: "birth", note: "" });
      await lilaShowCell(p, 1, { entry: p.path[p.path.length - 1], info: "Вы вошли в игру. Сейчас фишка перейдёт на клетку 6 «Заблуждение»" });
      await lilaStepTo(p, 6);
      p.path.push({ n: 6, kind: "land", note: "" });
      await lilaShowCell(p, 6, { entry: p.path[p.path.length - 1] });
      lilaGame.rolls = [];
      lilaSetMsg(`${p.name}, шестёрка даёт ещё один бросок — бросайте кубик`);
      return;
    }

    lilaGame.rolls.push(v);
    if (v === 6) {
      const n = lilaGame.rolls.length;
      const eff = (n >= 3 ? n - 3 : n) * 6;
      const t = p.pos + eff;
      if (eff > 0 && t <= 72 && (t === 68 || lilaJump(t) === 68)) {
        lilaGame.rolls = [];
        lilaLog(`${p.name}: шестёрка ведёт прямо в Космическое сознание`);
        await lilaStepTo(p, t);
        await lilaLand(p, t);
        lilaNextTurn();
        return;
      }
      if (n === 3) {
        lilaLog(`${p.name}: три шестёрки подряд — они сгорают`);
        lilaSetMsg("Три шестёрки подряд сгорают. Бросайте ещё раз");
      } else {
        lilaSetMsg(`Шестёрка! Бросайте ещё раз (выпало: ${lilaGame.rolls.join(" + ")})`);
      }
      return;
    }

    const sixes = lilaGame.rolls.length - 1;
    const eff = (sixes >= 3 ? sixes - 3 : sixes) * 6 + v;
    const rollsText = lilaGame.rolls.join(" + ");
    lilaGame.rolls = [];
    const target = p.pos + eff;
    if (target > 72) {
      lilaLog(`${p.name}: выпало ${rollsText}, нужно не больше ${72 - p.pos} — ход пропускается`);
      lilaSetMsg(`Нужно выбросить не больше ${72 - p.pos}. Ход пропускается`);
      lilaNextTurn();
      return;
    }
    lilaLog(`${p.name}: выпало ${rollsText} → клетка ${target}`);
    lilaSetMsg(`Выпало ${rollsText}. Ход на ${eff} ${eff === 1 ? "клетку" : (eff < 5 ? "клетки" : "клеток")}`);
    await lilaStepTo(p, target);
    await lilaLand(p, target);
    lilaNextTurn();
  } finally {
    lilaBusy = false;
    lilaSave();
    lilaRefresh();
  }
}

async function lilaLand(p, n) {
  const entry = { n, kind: "land", note: "" };
  p.path.push(entry);
  if (n === 68) { await lilaFinishPlayer(p); return; }
  const to = lilaJump(n);
  await lilaShowCell(p, n, { entry, jumpTo: to });
  if (to) {
    const isArrow = !!LILA_ARROWS[n];
    lilaLog(`${p.name}: ${isArrow ? "стрела поднимает" : "змея спускает"} с клетки ${n} на ${to}`);
    await lilaFlyTo(p, to);
    const e2 = { n: to, kind: isArrow ? "arrow" : "snake", from: n, note: "" };
    p.path.push(e2);
    if (to === 68) { await lilaFinishPlayer(p); return; }
    await lilaShowCell(p, to, { entry: e2, cameFrom: n });
  }
}

function lilaNextTurn() {
  const ps = lilaGame.players;
  if (ps.every(p => p.done)) { lilaGame.over = true; lilaLog("Все игроки завершили путь"); setTimeout(lilaShowSummary, 300); return; }
  let i = lilaGame.turn;
  do { i = (i + 1) % ps.length; } while (ps[i].done);
  lilaGame.turn = i;
}

async function lilaFinishPlayer(p) {
  p.done = true;
  lilaLog(`${p.name} достиг(ла) Космического сознания 🎉`);
  lilaSave(); lilaRefresh();
  const back = await lilaShowCell(p, 68, { entry: p.path[p.path.length - 1], finish: true });
  if (back === "earth") {
    p.done = false;
    lilaLog(`${p.name} возвращается на клетку 51 «Земля», чтобы пройти путь ещё раз`);
    await lilaFlyTo(p, 51);
    p.path.push({ n: 51, kind: "return", note: "" });
  }
}

/* ---------- Карточка клетки ---------- */
function lilaCellCardHtml(n, opts) {
  opts = opts || {};
  const c = LILA_CELLS[n], row = LILA_ROWS[lilaRowOf(n)], color = LILA_ROW_COLORS[lilaRowOf(n)];
  const to = opts.jumpTo !== undefined ? opts.jumpTo : lilaJump(n);
  const jumpBlock = to ? `<div class="lila-jump ${LILA_ARROWS[n] ? "up" : "down"}">
      <b>${LILA_ARROWS[n] ? "↑ Стрела поднимает на клетку " : "↓ Змея спускает на клетку "}${to} «${escapeHtml(lilaCellTitle(to))}»</b>
      <div>${escapeHtml(LILA_JUMP_TEXT[n] || "")}</div></div>` : "";
  const cameBlock = opts.cameFrom ? `<div class="lila-jump ${LILA_ARROWS[opts.cameFrom] ? "up" : "down"}">
      <b>${LILA_ARROWS[opts.cameFrom] ? "Вы поднялись по стреле с клетки " : "Вы спустились по змее с клетки "}${opts.cameFrom} «${escapeHtml(lilaCellTitle(opts.cameFrom))}»</b>
      <div>${escapeHtml(LILA_JUMP_TEXT[opts.cameFrom] || "")}</div></div>` : "";
  return `
    <div class="lila-card-head">
      <div class="lila-card-num" style="border-color:${color};color:${color};">${n}</div>
      <div><div class="lila-card-row">${row.n} ряд · ${escapeHtml(row.title)}</div>
        <div class="lila-card-name">${escapeHtml(c.name)}</div>
        <div class="lila-card-alt">${escapeHtml(c.alt)}</div></div>
    </div>
    ${opts.info ? `<div class="lila-info">${escapeHtml(opts.info)}</div>` : ""}
    ${cameBlock}
    <div class="lila-card-short">${escapeHtml(c.short)}</div>
    <div class="lila-card-text">${escapeHtml(c.text)}</div>
    ${jumpBlock}
    <div class="lila-card-sub">Вопросы для исследования</div>
    <ul class="lila-card-q">${c.q.map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
    <div class="lila-card-sub">Практика</div>
    <div class="lila-card-text">${escapeHtml(c.practice)}</div>`;
}

function lilaModal(innerHtml) {
  document.getElementById("lilaModal")?.remove();
  const ov = document.createElement("div");
  ov.id = "lilaModal";
  ov.className = "lila-modal-overlay";
  ov.innerHTML = `<div class="lila-modal">${innerHtml}</div>`;
  document.body.appendChild(ov);
  return ov;
}

function lilaShowCell(p, n, opts) {
  opts = opts || {};
  return new Promise(resolve => {
    const ov = lilaModal(`
      <div class="lila-modal-player"><span class="lila-chip" style="background:${p.color};">${escapeHtml(p.name.charAt(0).toUpperCase())}</span> ${escapeHtml(p.name)}</div>
      ${opts.finish ? `<div class="lila-finish">🎉 ${escapeHtml(p.name)} достиг(ла) Космического сознания</div>` : ""}
      ${lilaCellCardHtml(n, opts)}
      ${opts.finish && p.query ? `<div class="lila-card-sub">Запрос</div><div class="lila-card-text">«${escapeHtml(p.query)}»</div>` : ""}
      <div class="lila-card-sub">${opts.finish ? "Ответ на запрос и первые шаги" : "Мысли и инсайты игрока"}</div>
      <textarea id="lilaNote" class="input" rows="3" maxlength="1000" placeholder="${opts.finish ? "Запишите ответ, который пришёл, и три первых шага" : "Запишите, что откликнулось (необязательно)"}">${escapeHtml(opts.entry?.note || "")}</textarea>
      <div class="lila-modal-actions">
        ${opts.finish ? `<button class="btn btn-ghost" id="lilaEarthBtn">Ответ ещё не ясен — вернуть на «Землю» (51)</button>` : ""}
        <button class="btn" id="lilaOkBtn">${opts.finish ? "Завершить путь" : "Продолжить"}</button>
      </div>`);
    const done = (result) => {
      if (opts.entry) opts.entry.note = (document.getElementById("lilaNote")?.value || "").trim();
      ov.remove(); lilaSave(); resolve(result);
    };
    ov.querySelector("#lilaOkBtn").onclick = () => done("ok");
    const earth = ov.querySelector("#lilaEarthBtn");
    if (earth) earth.onclick = () => done("earth");
  });
}

function lilaCellInfo(n) {
  if (lilaBusy) return;
  const ov = lilaModal(`${lilaCellCardHtml(n)}<div class="lila-modal-actions"><button class="btn" id="lilaOkBtn">Закрыть</button></div>`);
  ov.querySelector("#lilaOkBtn").onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

function lilaShowRules() {
  const ov = lilaModal(`<h3 class="lila-card-name" style="margin:0 0 10px;">Правила игры</h3><ol class="lila-rules">${LILA_RULES.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ol>
    <div class="lila-modal-actions"><button class="btn" id="lilaOkBtn">Понятно</button></div>`);
  ov.querySelector("#lilaOkBtn").onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

async function lilaFinishGame() {
  if (!(await customConfirm("Завершить игру и перейти к итогам?"))) return;
  lilaGame.over = true; lilaSave(); lilaRefresh(); lilaShowSummary();
}

/* ---------- Итоги: путь каждого игрока ---------- */
function lilaShowSummary() {
  if (!lilaGame) return;
  showWelcome(false);
  const kindLabel = { birth: "рождение", arrow: "по стреле", snake: "по змее", return: "возврат на Землю", land: "" };
  contentEl().innerHTML = `
    <div class="dashboard-wrap">
      <div class="print-title">Лила — путь игроков · ${fmtDate(lilaGame.startedAt)}</div>
      <div class="tracker-toolbar no-print">
        <button class="btn btn-ghost btn-small" onclick="${lilaGame.over ? "openLila()" : "lilaRenderGame()"}">${lilaGame.over ? "← К игре Лила" : "← Вернуться к полю"}</button>
        <div class="tracker-actions">
          <button class="btn btn-ghost btn-small" onclick="lilaDownloadSummary()">⬇ Скачать PDF</button>
          ${lilaGame.over ? `<button class="btn btn-small" onclick="lilaClear();lilaSetupForm(1)">Новая игра</button>` : ""}
        </div>
      </div>
      <div class="dashboard-head no-print"><div><h2>🪷 Путь игроков</h2><p>Игра от ${fmtDate(lilaGame.startedAt)}</p></div></div>
      ${lilaGame.players.map(p => `
        <div class="table-card" style="margin-bottom:16px;break-inside:avoid;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <div class="lila-chip big" style="background:${p.color};">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>
            <div><div class="table-title" style="margin:0;">${escapeHtml(p.name)}${p.done ? " 🎉" : ""}</div>
            <div style="color:var(--muted);font-size:13px;">${p.done ? "Достиг(ла) Космического сознания" : (p.born ? "Сейчас на клетке " + p.pos + " «" + escapeHtml(lilaCellTitle(p.pos)) + "»" : "Ещё не вошёл(ла) в игру")} · ходов по полю: ${p.path.length}</div></div>
          </div>
          ${p.query ? `<div class="lila-card-sub">Запрос</div><div class="lila-card-text">«${escapeHtml(p.query)}»</div>` : ""}
          <div class="lila-card-sub">Путь</div>
          <div class="lila-path">${p.path.map(e => `<span class="lila-path-step ${e.kind}">${e.n} ${escapeHtml(lilaCellTitle(e.n))}${kindLabel[e.kind] ? ` <i>(${kindLabel[e.kind]})</i>` : ""}</span>`).join("") || `<span style="color:var(--muted);">Пока пусто</span>`}</div>
          ${p.path.some(e => e.note) ? `<div class="lila-card-sub">Записи</div>
            ${p.path.filter(e => e.note).map(e => `<div class="grat-day"><b>${e.n}. ${escapeHtml(lilaCellTitle(e.n))}</b><div style="margin-top:4px;white-space:pre-wrap;">${escapeHtml(e.note)}</div></div>`).join("")}` : ""}
        </div>`).join("")}
    </div>`;
  window.scrollTo(0, 0);
}

function lilaDownloadSummary() {
  const old = document.title;
  document.title = "Лила — путь игроков " + fmtDate(lilaGame.startedAt);
  window.print();
  setTimeout(() => { document.title = old; }, 1000);
}

/* ============================================================
   МЕТОДИЧЕСКОЕ ПОСОБИЕ
   ============================================================ */
const LILA_RULES = [
  "Все фишки ставятся на клетку 68 «Космическое сознание» — отсюда игра начинается и сюда же возвращается",
  "Игроки по очереди бросают кубик. Чтобы войти в игру, нужна шестёрка: игрок проходит клетку 1 «Рождение» и сразу встаёт на клетку 6 «Заблуждение»",
  "Шестёрка всегда даёт право бросить кубик ещё раз. Очки шестёрок и следующего броска складываются, и фишка проходит общее число клеток, не останавливаясь на промежуточных",
  "Три шестёрки подряд сгорают: засчитывается только следующий бросок. Если шестёрок выпало больше трёх, сгорают только первые три",
  "Если шестёрка сразу приводит в Космическое сознание (например, с клетки 62 или через стрелу с клетки 54), путь игрока завершается без дополнительного броска",
  "Попав на начало стрелы, игрок поднимается по ней; попав на голову змеи, спускается к её хвосту. Он знакомится и с клеткой, куда попал, и с клеткой, куда его перенесла стрела или змея",
  "Перешагнув клетку 68, игрок продолжает путь по последнему ряду. Если выпало больше, чем осталось до клетки 72, ход пропускается",
  "С клетки 72 змея возвращает игрока на клетку 51 «Земля»",
  "Путь игрока завершается, когда фишка встаёт точно на клетку 68 «Космическое сознание»",
  "Если игрок быстро дошёл до клетки 68, но ещё не понял ответ на свой запрос, ведущий может вернуть его на клетку 51 «Земля», чтобы пройти путь ещё раз"
];

function lilaManualHtml() {
  const jumpRows = (obj, label) => Object.keys(obj).map(Number).sort((a, b) => a - b).map(f => `
    <tr><td style="white-space:nowrap;">${f} → ${obj[f]}</td><td>${escapeHtml(lilaCellTitle(f))} → ${escapeHtml(lilaCellTitle(obj[f]))}</td><td>${escapeHtml(LILA_JUMP_TEXT[f])}</td></tr>`).join("");
  const cellBlock = (n) => {
    const c = LILA_CELLS[n], to = lilaJump(n);
    return `<div class="man-cell">
      <h4>${n}. ${escapeHtml(c.name)} <span>(${escapeHtml(c.alt)})</span></h4>
      <p class="man-short">${escapeHtml(c.short)}</p>
      <p>${escapeHtml(c.text)}</p>
      ${to ? `<p class="man-jump">${LILA_ARROWS[n] ? "↑ Стрела" : "↓ Змея"}: ${n} → ${to} «${escapeHtml(lilaCellTitle(to))}». ${escapeHtml(LILA_JUMP_TEXT[n])}</p>` : ""}
      <p class="man-sub">Вопросы для исследования</p>
      <ul>${c.q.map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
      <p class="man-sub">Практика</p>
      <p>${escapeHtml(c.practice)}</p>
    </div>`;
  };
  return `
  <div class="manual">
    <div class="man-cover">
      <div class="man-emblem">${butterflySvg(70)}</div>
      <div class="man-brand">PSYCHOLOGY Platform</div>
      <h1>Методическое пособие<br>«Лила — игра самопознания»</h1>
      <p>Правила, проведение игры, уровни поля и описание 72 клеток</p>
    </div>

    <h2>1. Что такое Лила</h2>
    <p>Лила — древняя индийская игра самопознания. Её изначальное название — Джняна-чаупада, «игра знания». Слово «лила» переводится как «игра»: в индийской традиции весь мир понимается как божественная игра, в которой каждый человек одновременно и игрок, и часть целого.</p>
    <p>Поле из 72 клеток — карта состояний сознания: от рождения и базовых желаний до ясности, мудрости и космического сознания. Бросая кубик, игрок проходит по этим состояниям, поднимается по стрелам и опускается по змеям. Каждая клетка, на которую он попадает, — повод задуматься: что это состояние значит в моей жизни прямо сейчас?</p>
    <p>В современной практике Лилу проводят как трансформационную игру. Человек приходит с запросом — вопросом, на который ищет ответ, — и путь по полю становится зеркалом, в котором этот ответ проявляется. В Лиле нет плохих клеток: змеи — не наказание, а подсказки, куда стоит посмотреть, а стрелы — качества, которые поднимают.</p>

    <h2>2. Устройство поля</h2>
    <ul>
      <li>Поле состоит из 8 горизонтальных рядов (снизу вверх) и 9 вертикальных — всего 72 клетки. Восемь — число проявленного мира: пять стихий (земля, вода, огонь, воздух, эфир) и три силы — ум, интеллект и эго. Девять — число завершённости, и 7 + 2 = 9</li>
      <li>Фишка движется «змейкой»: по первому ряду слева направо, по второму справа налево и так далее</li>
      <li>Каждый ряд соответствует одной из чакр и одному уровню развития человека. В центральном столбце находятся главные планы — центры рядов: 5, 14, 23, 32, 41, 50, 59, 68</li>
      <li>На поле 10 стрел — это качества, которые поднимают (дхарма), и 10 змей — состояния, которые возвращают вниз (адхарма)</li>
      <li>Клетка 68 «Космическое сознание» — начало и конец игры</li>
    </ul>

    <h2>3. Уровни поля</h2>
    ${LILA_ROWS.map(r => `<div class="man-row"><h3>${r.n} ряд. ${escapeHtml(r.title)}</h3><p>${escapeHtml(r.about)}</p>
      <p class="man-list">${Array.from({ length: 9 }, (_, i) => r.n * 9 - 8 + i).map(n => `${n}. ${escapeHtml(lilaCellTitle(n))}`).join(" · ")}</p></div>`).join("")}

    <h2>4. Правила игры</h2>
    <ol>${LILA_RULES.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ol>

    <h2>5. Как проводить игру</h2>
    <h3>Подготовка</h3>
    <ul>
      <li>Выберите спокойное время: игра длится от 1,5 до 4 часов. В ней может участвовать от 1 до 6 игроков, вживую или онлайн — ведущий показывает поле на экране</li>
      <li>Попросите каждого игрока взять тетрадь: по ходу игры важно записывать мысли</li>
    </ul>
    <h3>Запрос</h3>
    <ul>
      <li>Запрос — вопрос о себе, на который игрок ищет ответ. Он должен касаться самого игрока и того, на что он может повлиять, а не поступков других людей</li>
      <li>Хорошо начинать со слов «Как мне…», «Что мне важно понять о…», «Что мешает мне…». Не стоит задавать вопросы, на которые отвечают «да» или «нет»</li>
      <li>Одна игра — один запрос. Запишите его перед началом</li>
      <li>Примеры: «Как мне найти дело, которое будет приносить радость и доход?», «Что мне важно понять о моих отношениях с мамой?», «Что мешает мне начать своё дело?»</li>
    </ul>
    <h3>Ход игры</h3>
    <ul>
      <li>На каждой клетке ведущий читает её описание и задаёт вопросы для исследования. Игрок отвечает вслух или письменно — всегда в связи со своим запросом</li>
      <li>Важно смотреть, откуда игрок пришёл на клетку: соседние клетки и переходы между ними тоже несут смысл</li>
      <li>Стрела показывает качество, которое поможет решить запрос; змея — место, куда стоит посмотреть внимательнее</li>
      <li>Ведущий не трактует за игрока и не навязывает своё мнение: он задаёт вопросы и помогает игроку услышать себя. Если игрок понял клетку по-своему — значит, ему нужно именно это</li>
      <li>Некоторые клетки удобно проживать через практику: на клетках 31 и 65 — медитация, на клетке 56 — пропевание звука «Ом», на клетке 66 — слова благодарности, на клетке 51 — вернуться к запросу и записать ответ</li>
    </ul>
    <h3>Завершение</h3>
    <ul>
      <li>На клетке 68 игрок формулирует ответ на свой запрос и записывает первые шаги</li>
      <li>Если ответ ещё не ясен, ведущий может вернуть игрока на клетку 51 «Земля», чтобы пройти путь ещё раз</li>
      <li>Трансформация происходит, когда понятое в игре применяется в жизни. Удобно закрепить шаги в разделе «Трекер привычек» — например, в челлендже на 21 день</li>
    </ul>
    <h3>Игра на платформе</h3>
    <ol>
      <li>Откройте «Трансформационные игры» → «Лила» → «Игра на одном экране». Для игры по ссылке выберите «Онлайн-игра»: игроки заходят в комнату, сами бросают кубик и общаются в чате (сообщения, фото, голосовые)</li>
      <li>Выберите количество игроков, впишите имена и запросы. У каждого игрока будет фишка своего цвета</li>
      <li>Нажимайте «Бросить кубик»: фишка сама проходит по полю, поднимается по стрелам и спускается по змеям</li>
      <li>На каждой клетке открывается карточка с описанием, вопросами и практикой. В карточке можно записать мысли игрока</li>
      <li>Нажмите на любую клетку поля, чтобы прочитать её описание</li>
      <li>Кнопка «Путь игроков» показывает пройденные клетки и записи; в конце игры итоги можно скачать в PDF</li>
    </ol>
    <p class="man-note">Игра — инструмент самопознания. Она не заменяет помощь психолога или врача</p>

    <h2>6. Клетки поля</h2>
    ${LILA_ROWS.map(r => `<h3 class="man-row-title">${r.n} ряд. ${escapeHtml(r.title)}</h3>${Array.from({ length: 9 }, (_, i) => cellBlock(r.n * 9 - 8 + i)).join("")}`).join("")}

    <h2>7. Стрелы и змеи</h2>
    <h3>Стрелы</h3>
    <table class="man-table"><thead><tr><th>Клетки</th><th>Путь</th><th>Смысл</th></tr></thead><tbody>${jumpRows(LILA_ARROWS)}</tbody></table>
    <h3>Змеи</h3>
    <table class="man-table"><thead><tr><th>Клетки</th><th>Путь</th><th>Смысл</th></tr></thead><tbody>${jumpRows(LILA_SNAKES)}</tbody></table>
  </div>`;
}

function openLilaManual() {
  showWelcome(false);
  contentEl().innerHTML = `
    <div class="dashboard-wrap">
      <div class="tracker-toolbar no-print">
        <button class="btn btn-ghost btn-small" onclick="openLila()">← К игре Лила</button>
        <div class="tracker-actions"><button class="btn btn-ghost btn-small" onclick="lilaDownloadManual()">⬇ Скачать PDF</button></div>
      </div>
      <div class="table-card">${lilaManualHtml()}</div>
    </div>`;
  window.scrollTo(0, 0);
}

function lilaDownloadManual() {
  const old = document.title;
  document.title = "Методическое пособие «Лила — игра самопознания»";
  window.print();
  setTimeout(() => { document.title = old; }, 1000);
}
