/* ============================================================
   ЧАТ ИГРОВОЙ КОМНАТЫ — общий для «Пути Пробуждения» и Лилы
   Текст, фото, голосовые (с прослушиванием перед отправкой),
   удаление своих сообщений в течение 5 минут, выгрузка в PDF
   ============================================================ */
const RoomChat = (() => {
  const DELETE_MIN = 5;
  const PREFIX = "https://kfsyeejdwrcmwqacmigb.supabase.co/storage/v1/object/public/awk-voice/";
  let cfg = null, el = null, messages = [], canWrite = false;
  let rec = null, recStream = null, recTimer = null, draft = null; // draft: {kind:'voice'|'photo', blob, url, type}
  let sending = false;

  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const timeStr = iso => new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dateTimeStr = iso => new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rid = () => Math.random().toString(36).slice(2, 10);
  function key() {
    const k = "awk_key_" + cfg.room;
    try { let v = localStorage.getItem(k); if (!v) { v = rid() + rid() + rid(); localStorage.setItem(k, v); } return v; }
    catch (e) { return (cfg._key = cfg._key || rid() + rid()); }
  }
  function toast(t) { (cfg && cfg.toast) ? cfg.toast(t) : alert(t); }
  function q(sel) { return el.querySelector(sel); }

  const CSS = `
  .rc { display: flex; flex-direction: column; height: 480px; }
  .rc-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
  .rc-head h3 { margin: 0; }
  .rc-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
  .rc-msg { background: rgba(255,255,255,.05); border-radius: 12px; padding: 8px 10px; max-width: 92%; align-self: flex-start; }
  .rc-msg.mine { background: rgba(244,165,130,.14); align-self: flex-end; }
  .rc-who { font-size: 12px; color: var(--coral); font-weight: 700; }
  .rc-when { font-size: 11px; color: var(--muted); margin-left: 6px; font-weight: 400; }
  .rc-body { white-space: pre-wrap; word-wrap: break-word; margin-top: 2px; font-size: 14px; }
  .rc-msg audio, .rc-draft audio { width: 240px; max-width: 100%; margin-top: 4px; height: 36px; }
  .rc-msg img { display: block; max-width: 220px; max-height: 220px; border-radius: 10px; margin-top: 4px; cursor: zoom-in; }
  .rc-del { background: none; border: none; color: var(--muted); font-size: 12px; cursor: pointer; padding: 2px 0 0; text-decoration: underline; }
  .rc-deleted { font-size: 13px; color: var(--muted); font-style: italic; }
  .rc-input { display: flex; gap: 6px; margin-top: 10px; align-items: flex-end; }
  .rc-input textarea { resize: none; height: 44px; flex: 1; min-width: 0; }
  .rc-btn { width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0; padding: 0; font-size: 18px; }
  .rc-btn.rec { background: #E0474C; color: #fff; border-color: #E0474C; animation: rcpulse 1s infinite; }
  @keyframes rcpulse { 50% { box-shadow: 0 0 0 8px rgba(224,71,76,.25); } }
  .rc-status { font-size: 12px; color: var(--bad); min-height: 16px; margin-top: 4px; }
  .rc-draft { margin-top: 10px; padding: 10px; border: 1px dashed var(--line); border-radius: 12px; }
  .rc-draft img { max-width: 160px; max-height: 160px; border-radius: 8px; display: block; }
  .rc-draft-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
  .rc-note { color: var(--muted); font-size: 14px; }
  @media (max-width: 1000px) { .rc { height: 440px; } }`;

  function init(c) {
    cfg = c;
    if (!document.getElementById("rcStyle")) { const s = document.createElement("style"); s.id = "rcStyle"; s.textContent = CSS; document.head.appendChild(s); }
    el = document.createElement("div");
    el.className = "panel rc";
    el.innerHTML = `
      <div class="rc-head"><h3>Чат игры</h3>${c.canExport ? `<button class="btn btn-ghost btn-small" data-act="export">⬇ Скачать чат</button>` : ""}</div>
      <div class="rc-list"></div>
      <div class="rc-write"></div>`;
    el.addEventListener("click", onClick);
    renderWrite();
    return el;
  }

  function setCanWrite(v) { if (v === canWrite) return; canWrite = v; renderWrite(); }

  function renderWrite() {
    const w = q(".rc-write");
    if (!canWrite) { w.innerHTML = `<p class="rc-note">Впишите имя выше, чтобы писать в чат</p>`; return; }
    w.innerHTML = `
      <div class="rc-draft-box"></div>
      <div class="rc-input">
        <button class="btn btn-ghost rc-btn" data-act="photo" title="Отправить фото">📷</button>
        <textarea class="input rc-text" maxlength="2000" placeholder="Сообщение…"></textarea>
        <button class="btn rc-btn rc-mic" data-act="mic" title="Записать голосовое">🎤</button>
        <button class="btn rc-btn" data-act="send" title="Отправить">➤</button>
      </div>
      <div class="rc-status"></div>
      <input type="file" accept="image/*" class="rc-file" hidden>`;
    q(".rc-text").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } });
    q(".rc-file").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) pickPhoto(f); });
    renderDraft();
  }

  function status(t) { const s = q(".rc-status"); if (s) s.textContent = t || ""; }

  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = b.dataset.act;
    if (a === "send") sendText();
    else if (a === "mic") toggleRec();
    else if (a === "photo") q(".rc-file").click();
    else if (a === "draft-send") sendDraft();
    else if (a === "draft-del") clearDraft();
    else if (a === "del") delMsg(+b.dataset.id);
    else if (a === "export") exportPdf(cfg.title || "Чат игры", messages);
    else if (a === "img") window.open(b.dataset.src, "_blank");
  }

  /* ---------- список ---------- */
  async function load() {
    const { data, error } = await cfg.sb.rpc("awk_messages_list", { p_room: cfg.room, p_after: 0, p_key: key() });
    if (error || !data) return;
    const changed = JSON.stringify(data) !== JSON.stringify(messages);
    messages = data;
    if (changed) renderList();
  }

  function canDelete(m) { return m.mine && !m.deleted && (Date.now() - new Date(m.created_at).getTime()) < DELETE_MIN * 60000; }

  function renderList() {
    const list = q(".rc-list"); if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    list.innerHTML = messages.length ? messages.map(m => `
      <div class="rc-msg${m.mine ? " mine" : ""}">
        <div class="rc-who">${esc(m.author)}<span class="rc-when">${timeStr(m.created_at)}</span></div>
        ${m.deleted ? `<div class="rc-deleted">Сообщение удалено</div>` : `
          ${m.body ? `<div class="rc-body">${esc(m.body)}</div>` : ""}
          ${m.image_url ? `<img src="${esc(m.image_url)}" alt="Фото" loading="lazy" data-act="img" data-src="${esc(m.image_url)}">` : ""}
          ${m.audio_url ? `<audio controls preload="none" src="${esc(m.audio_url)}"></audio>` : ""}
          ${canDelete(m) ? `<button class="rc-del" data-act="del" data-id="${m.id}">Удалить</button>` : ""}`}
      </div>`).join("") : `<p class="rc-note" style="margin:0;">Сообщений пока нет. Пишите, отправляйте фото 📷 и голосовые 🎤</p>`;
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
  // кнопка «Удалить» исчезает через 5 минут
  setInterval(() => { if (el && messages.some(m => m.mine && !m.deleted)) renderList(); }, 30000);

  async function delMsg(id) {
    if (!confirm("Удалить сообщение?")) return;
    const { data, error } = await cfg.sb.rpc("awk_delete_message", { p_id: id, p_key: key() });
    if (error || !data) { toast("Удалить можно только своё сообщение в течение 5 минут"); return; }
    cfg.notify && cfg.notify(); await load();
  }

  /* ---------- отправка ---------- */
  async function post(body, audio, image) {
    const { error } = await cfg.sb.rpc("awk_send", { p_room: cfg.room, p_author: cfg.getName(), p_body: body, p_audio: audio, p_image: image, p_key: key() });
    if (error) { toast("Не удалось отправить"); return false; }
    cfg.notify && cfg.notify(); await load();
    const list = q(".rc-list"); if (list) list.scrollTop = list.scrollHeight;
    return true;
  }

  async function sendText() {
    const t = q(".rc-text"); if (!t) return;
    const body = t.value.trim(); if (!body) return;
    t.value = "";
    if (!(await post(body, null, null))) t.value = body;
  }

  async function upload(blob, type, ext) {
    const path = `${cfg.room}/${Date.now()}-${rid()}.${ext}`;
    const up = await cfg.sb.storage.from("awk-voice").upload(path, blob, { contentType: type });
    if (up.error) return null;
    return cfg.sb.storage.from("awk-voice").getPublicUrl(path).data.publicUrl;
  }

  /* ---------- черновик: голосовое или фото ---------- */
  function renderDraft() {
    const box = q(".rc-draft-box"); if (!box) return;
    if (!draft) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="rc-draft">
      <div style="font-size:13px;color:var(--muted);">${draft.kind === "voice" ? "🎤 Голосовое сообщение — прослушайте перед отправкой" : "📷 Фото"}</div>
      ${draft.kind === "voice" ? `<audio controls src="${draft.url}"></audio>` : `<img src="${draft.url}" alt="">`}
      <div class="rc-draft-actions">
        <button class="btn btn-small" data-act="draft-send">➤ Отправить</button>
        <button class="btn btn-ghost btn-small" data-act="draft-del">🗑 Удалить</button>
      </div></div>`;
  }
  function clearDraft() { if (draft && draft.url) URL.revokeObjectURL(draft.url); draft = null; renderDraft(); }

  async function sendDraft() {
    if (!draft || sending) return;
    sending = true; status("Отправка…");
    const d = draft;
    const ext = d.kind === "photo" ? "jpg" : d.type.includes("mp4") ? "m4a" : d.type.includes("ogg") ? "ogg" : "webm";
    const url = await upload(d.blob, d.type, ext);
    if (!url) { status(""); sending = false; toast(d.kind === "photo" ? "Не удалось загрузить фото" : "Не удалось загрузить голосовое"); return; }
    const ok = await post(null, d.kind === "voice" ? url : null, d.kind === "photo" ? url : null);
    sending = false; status("");
    if (ok && draft === d) clearDraft();
  }

  async function pickPhoto(file) {
    if (!/^image\//.test(file.type)) { toast("Выберите фотографию"); return; }
    status("Подготовка фото…");
    try {
      const blob = await compressImage(file, 1600, 0.85);
      clearDraft(); draft = { kind: "photo", blob, type: "image/jpeg", url: URL.createObjectURL(blob) }; renderDraft();
    } catch (e) { toast("Не удалось открыть фото"); }
    status("");
  }
  function compressImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(b => b ? resolve(b) : reject(), "image/jpeg", quality);
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(); };
      img.src = u;
    });
  }

  async function toggleRec() {
    if (rec) { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast("Этот браузер не поддерживает запись голоса"); return; }
    try { recStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { toast("Разрешите доступ к микрофону"); return; }
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    const mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    const r = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined);
    const chunks = [], started = Date.now();
    r.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recTimer = setInterval(() => {
      const sec = Math.floor((Date.now() - started) / 1000);
      status(`● Запись ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} — нажмите ⏹, чтобы закончить`);
      if (sec >= 300) r.stop();
    }, 250);
    r.onstop = () => {
      clearInterval(recTimer); recStream.getTracks().forEach(t => t.stop()); rec = null;
      const mic = q(".rc-mic"); if (mic) { mic.classList.remove("rec"); mic.textContent = "🎤"; }
      status("");
      let type = (r.mimeType || mime || "audio/webm").split(";")[0];
      if (type === "audio/x-m4a") type = "audio/mp4";
      const blob = new Blob(chunks, { type });
      if (Date.now() - started < 700 || !blob.size) return;
      clearDraft(); draft = { kind: "voice", blob, type, url: URL.createObjectURL(blob) }; renderDraft();
    };
    r.start(); rec = r;
    const mic = q(".rc-mic"); if (mic) { mic.classList.add("rec"); mic.textContent = "⏹"; }
  }

  /* ---------- выгрузка в PDF ---------- */
  function exportPdf(title, msgs, subtitle) {
    const w = window.open("", "_blank");
    if (!w) { toast("Разрешите всплывающие окна, чтобы скачать чат"); return; }
    const rows = (msgs || []).filter(m => !m.deleted).map(m => `
      <div class="m"><div class="h"><b>${esc(m.author)}</b> <span>${dateTimeStr(m.created_at)}</span></div>
        ${m.body ? `<div class="b">${esc(m.body)}</div>` : ""}
        ${m.image_url ? `<img src="${esc(m.image_url)}">` : ""}
        ${m.audio_url ? `<div class="v">🎤 Голосовое сообщение: <a href="${esc(m.audio_url)}">${esc(m.audio_url.replace(PREFIX, ""))}</a></div>` : ""}
      </div>`).join("") || "<p>Сообщений нет</p>";
    w.document.write(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${esc(title)}</title>
      <style>
        @page { size: A4; margin: 14mm; }
        body { font-family: Arial, sans-serif; color: #222; font-size: 12pt; line-height: 1.45; }
        h1 { font-family: Georgia, serif; color: #1B2B5A; font-weight: 400; margin: 0 0 4px; }
        .sub { color: #666; margin-bottom: 16px; }
        .m { border-left: 3px solid #E8826A; padding: 2px 0 2px 10px; margin: 0 0 10px; break-inside: avoid; }
        .h span { color: #888; font-size: 10pt; margin-left: 6px; }
        .b { white-space: pre-wrap; }
        img { max-width: 60%; max-height: 260px; border-radius: 6px; margin-top: 4px; }
        .v { font-size: 10pt; color: #555; word-break: break-all; }
        .foot { margin-top: 20px; font-size: 9pt; color: #999; }
      </style></head><body>
      <h1>${esc(title)}</h1><div class="sub">${esc(subtitle || "Переписка игроков")} · выгружено ${dateTimeStr(new Date().toISOString())}</div>
      ${rows}<div class="foot">PSYCHOLOGY Platform</div>
      <script>window.onload=function(){var imgs=[].slice.call(document.images);Promise.all(imgs.map(function(i){return i.complete?1:new Promise(function(r){i.onload=i.onerror=r;})})).then(function(){setTimeout(function(){window.print();},300);});};<\/script>
      </body></html>`);
    w.document.close();
  }

  return { init, load, setCanWrite, exportPdf, get el() { return el; }, get recording() { return !!rec; } };
})();
