/* ============================================================
   ПУТЬ ПРОБУЖДЕНИЯ — страница игры на платформе:
   методическое пособие и игровые комнаты ведущего
   Зависит от awakening-data.js и общих функций index.html
   ============================================================ */

function awkRoomLink(id) {
  const base = location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "");
  return base + "awakening-room.html?room=" + id;
}

async function openAwakening() {
  showWelcome(false);
  contentEl().innerHTML = `
    <div class="dashboard-wrap">
      <button class="btn btn-ghost btn-small" style="margin-bottom:16px;" onclick="showSection('games')">← Все игры</button>
      <div class="lila-hero">
        <div class="lila-hero-icon">🌸</div>
        <div>
          <h2>Путь Пробуждения</h2>
          <p>Онлайн-игра осознания: 7 уровней-чакр и 14 сфер жизни. Игроки приходят с запросом, бросают кубик и поднимаются от Муладхары к Лотосу пробуждения. Играть можно вместе онлайн: у каждого своя фишка, общий чат с голосовыми сообщениями и ссылка на видеозвонок</p>
        </div>
      </div>
      <div class="cards" style="margin-top:20px;">
        <div class="card" onclick="openAwakeningManual()" role="button" tabindex="0">
          <div class="card-icon">📖</div>
          <h3>Методическое пособие</h3>
          <p>Правила, чакры, сферы, проведение игры и все 98 карточек</p>
        </div>
        <div class="card" onclick="awkCreateRoom()" role="button" tabindex="0">
          <div class="card-icon">🎲</div>
          <h3>Запустить игру</h3>
          <p>Создайте игровую комнату и отправьте игрокам ссылку-приглашение</p>
        </div>
      </div>
      <div class="table-card" style="margin-top:20px;">
        <h3 style="margin:0 0 10px;color:var(--coral);font-family:'PT Serif',serif;font-weight:500;">Мои игровые комнаты</h3>
        <div id="awkRooms" class="empty-table">Загрузка…</div>
      </div>
    </div>`;
  awkLoadRooms();
}

async function awkLoadRooms() {
  const el = document.getElementById("awkRooms"); if (!el) return;
  const { data, error } = await supabaseClient.from("awk_rooms").select("id,title,state,created_at").order("created_at", { ascending: false }).limit(50);
  if (error) { el.textContent = "Не удалось загрузить комнаты"; return; }
  if (!data.length) { el.textContent = "Комнат пока нет. Нажмите «Запустить игру», чтобы создать первую"; return; }
  el.className = "";
  const statusText = { lobby: "ожидание игроков", playing: "идёт игра", over: "завершена" };
  el.innerHTML = data.map(r => {
    const s = r.state || {}, players = (s.players || []).map(p => p.name).join(", ");
    return `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line-soft);">
      <div style="flex:1;min-width:200px;">
        <div style="color:var(--cream);">${escapeHtml(r.title)} · ${fmtDate(r.created_at.slice(0, 10))}</div>
        <div style="color:var(--muted);font-size:13px;">${statusText[s.status || "lobby"]}${players ? " · " + escapeHtml(players) : ""}</div>
      </div>
      <button class="btn btn-small" onclick="window.open('${awkRoomLink(r.id)}','_blank')">Открыть</button>
      <button class="btn btn-ghost btn-small" onclick="awkCopyLink('${r.id}')">🔗 Ссылка</button>
      <button class="btn btn-ghost btn-small" onclick="awkDeleteRoom('${r.id}')">Удалить</button>
    </div>`;
  }).join("");
}

async function awkCreateRoom() {
  const { data, error } = await supabaseClient.from("awk_rooms").insert({ title: "Путь Пробуждения", state: { status: "lobby", players: [], log: [], turn: 0, seq: 0 } }).select("id").single();
  if (error) { customAlert ? customAlert("Не удалось создать комнату: " + error.message) : alert(error.message); return; }
  window.open(awkRoomLink(data.id), "_blank");
  awkLoadRooms();
}

function awkCopyLink(id) {
  const link = awkRoomLink(id);
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(
    () => customAlert ? customAlert("Ссылка скопирована. Отправьте её игрокам") : alert("Ссылка скопирована"),
    () => prompt("Скопируйте ссылку:", link));
}

function awkDeleteRoom(id) {
  customConfirm("Удалить комнату вместе с перепиской?").then(async ok => {
    if (!ok) return;
    await supabaseClient.from("awk_rooms").delete().eq("id", id);
    awkLoadRooms();
  });
}

/* ============================================================
   МЕТОДИЧЕСКОЕ ПОСОБИЕ
   ============================================================ */
function awakeningManualHtml() {
  const sphereSpecial = { shield: " · даёт щит", fear: " · теневая клетка", rise: " · ресурсная клетка: подъём на чакру выше" };
  return `
  <div class="manual">
    <div class="man-cover">
      <div class="man-emblem">${butterflySvg(70)}</div>
      <div class="man-brand">PSYCHOLOGY Platform</div>
      <h1>Методическое пособие<br>«Путь Пробуждения»</h1>
      <p>Правила, чакры и сферы жизни, проведение онлайн-игры и описание 98 карточек</p>
    </div>

    <h2>1. Что такое «Путь Пробуждения»</h2>
    <p>«Путь Пробуждения» — трансформационная игра осознания. Её основа — система семи чакр: семи уровней, через которые человек проходит в своём развитии — от опоры и безопасности до смысла и единства с миром.</p>
    <p>Каждый уровень проявляется во всех сферах жизни: в отношениях, деньгах, работе, роде, страхах и ресурсах. Поэтому поле игры — круг, где семь колец-чакр пересекаются с четырнадцатью сферами. Попадая на клетку, игрок смотрит на свой запрос через конкретную сферу на конкретном уровне: например, «Финансы на уровне Манипуры» — это деньги как результат силы и уверенности в своей ценности.</p>
    <p>Игрок приходит с запросом и проходит путь от внешнего кольца — Муладхары — к центру, Лотосу пробуждения. Каждая карточка — зеркало: она показывает, как запрос проявляется в жизни, задаёт вопрос и предлагает практику. Клетки «Страх» помогают встретиться с тем, что мешает, а ресурсные клетки поднимают выше.</p>
    <p>Игра подходит для работы с любым запросом: отношения, деньги, призвание, самооценка, выбор, родовые темы. Её можно проводить для себя, для клиентов индивидуально и в группе до 8 человек — вживую или онлайн.</p>

    <h2>2. Устройство поля</h2>
    <ul>
      <li>Поле — круг из 7 колец. Внешнее кольцо — Муладхара (1 чакра), внутреннее — Сахасрара (7 чакра). Цвет кольца — цвет чакры</li>
      <li>Круг разделён на 14 секторов-сфер. Сферы одинаковы на всех уровнях: меняется глубина, с которой игрок на них смотрит</li>
      <li>Клетка — пересечение чакры и сферы. Всего на поле 98 клеток и 98 карточек</li>
      <li>В центре круга — Лотос пробуждения, финиш игры</li>
      <li>Особые клетки: «Защита» даёт щит, «Страх» — теневая клетка, «Сила духа» и «Движение вперёд» — ресурсные клетки, которые поднимают на следующую чакру</li>
    </ul>

    <h2>3. Семь чакр — семь уровней пути</h2>
    ${AWK_CHAKRAS.map(c => `<div class="man-row"><h3 style="color:${c.color};">${c.n}. ${escapeHtml(c.name)} — ${escapeHtml(c.theme)}</h3>
      <p>${escapeHtml(c.about)}</p>
      <p class="man-list"><b>Дары уровня:</b> ${escapeHtml(c.gift)}. <b>Тень уровня:</b> ${escapeHtml(c.shadow)}</p></div>`).join("")}

    <h2>4. Четырнадцать сфер жизни</h2>
    ${AWK_SPHERES.map(s => `<div class="man-row"><h3>${s.icon} ${escapeHtml(s.name)}${s.special ? `<span style="color:var(--muted);font-size:15px;">${sphereSpecial[s.special]}</span>` : ""}</h3><p>${escapeHtml(s.about)}</p></div>`).join("")}

    <h2>5. Правила игры</h2>
    <ol>${AWK_RULES.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ol>

    <h2>6. Как проводить игру</h2>
    <h3>Подготовка</h3>
    <ul>
      <li>Игра длится от 2 до 4 часов, в зависимости от числа игроков. Участвовать могут от 1 до 8 человек</li>
      <li>Попросите игроков подготовить тетрадь и ручку: важные мысли лучше записывать</li>
      <li>Перед началом расскажите правила и коротко — о семи чакрах: это поможет игрокам понимать, на каком уровне они находятся</li>
    </ul>
    <h3>Запрос</h3>
    <ul>
      <li>Запрос — вопрос о себе, на который игрок ищет ответ. Он касается самого игрока и того, на что он может повлиять</li>
      <li>Хорошие начала: «Как мне…», «Что мне важно понять о…», «Что мешает мне…», «Какой мой следующий шаг в…». Избегайте вопросов с ответом «да» или «нет»</li>
      <li>Одна игра — один запрос. Примеры: «Как мне увеличить доход, делая то, что люблю?», «Что мне важно понять в отношениях с мужем?», «Что мешает мне начать своё дело?»</li>
    </ul>
    <h3>Ход игры</h3>
    <ul>
      <li>На каждой клетке ведущий читает карточку: смысл, вопрос и практику. Игрок отвечает на вопрос, связывая его со своим запросом</li>
      <li>Обращайте внимание на уровень: одна и та же сфера на Муладхаре говорит о выживании и опоре, а на Аджне — о ясности и видении. Спрашивайте: «Как это связано с вашим запросом именно сейчас?»</li>
      <li>Практики можно делать прямо в игре — они короткие и занимают 1–3 минуты. Если времени мало, практику можно записать как задание после игры</li>
      <li>Ведущий не трактует за игрока и не даёт оценок. Его задача — задавать вопросы и помогать игроку услышать себя</li>
    </ul>
    <h3>Работа с клеткой «Страх»</h3>
    <ul>
      <li>Страх — не наказание, а подсказка: он показывает, что мешает решению запроса</li>
      <li>Попросите игрока назвать страх, почувствовать, где он живёт в теле, и ответить на вопрос карточки</li>
      <li>Если игрок честно посмотрел на страх и нашёл в нём смысл или ресурс — он остаётся на своей чакре. Если игрок пока не готов — он спускается на чакру ниже: значит, на предыдущем уровне есть что-то важное для него</li>
      <li>Решение принимает сам игрок или ведущий. Щит, полученный на клетке «Защита», один раз защищает от спуска</li>
    </ul>
    <h3>Ресурсные клетки</h3>
    <ul>
      <li>«Сила духа» и «Движение вперёд» поднимают игрока на следующую чакру. Спросите игрока, какой ресурс он забирает с собой на новый уровень</li>
      <li>Полный круг по кольцу тоже поднимает игрока выше: он прошёл все сферы этого уровня</li>
    </ul>
    <h3>Завершение</h3>
    <ul>
      <li>В Лотосе пробуждения игрок отвечает на вопросы для итога, формулирует ответ на запрос и записывает три шага на ближайшие 7 дней</li>
      <li>Если игра заканчивается раньше, чем игроки дошли до Лотоса, проведите итог для каждого: какие карточки были самыми важными и что он понял</li>
      <li>Закрепить шаги удобно в разделе «Трекер привычек», например в челлендже на 21 день</li>
    </ul>
    <h3>Вопросы для итога</h3>
    <ul>${AWK_LOTUS.q.map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>

    <h2>7. Игра на платформе</h2>
    <ol>
      <li>Откройте «Трансформационные игры» → «Путь Пробуждения» → «Запустить игру». Откроется игровая комната</li>
      <li>Нажмите «Пригласить игроков» и отправьте ссылку игрокам в мессенджер. Игрокам не нужна регистрация: они открывают ссылку, вписывают имя и запрос и нажимают «Присоединиться»</li>
      <li>Если игрок не может зайти сам, ведущий добавляет его вручную: «Добавить игрока вручную»</li>
      <li>Для видеосвязи создайте звонок в Zoom или Google Meet и нажмите «Добавить ссылку на звонок» — у всех игроков появится кнопка «Войти в звонок»</li>
      <li>В комнате есть общий чат: можно писать сообщения и отправлять голосовые (кнопка 🎤 — нажать, чтобы начать запись, и нажать ещё раз, чтобы отправить). Если видео плохое, общайтесь через чат</li>
      <li>Когда все в сборе, нажмите «Начать игру». Игроки ходят по очереди: бросает кубик тот, чей ход. Ведущий может бросить кубик за любого игрока</li>
      <li>Карточка клетки открывается у всех участников одновременно. На клетке «Страх» игрок или ведущий выбирает: «Страх проработан — остаюсь» или «Спуститься на чакру ниже»</li>
      <li>Нажмите на любую клетку поля, чтобы прочитать её карточку. «Путь игроков» показывает все пройденные клетки, итоги можно скачать в PDF</li>
      <li>Все комнаты сохраняются в разделе «Мои игровые комнаты»: туда можно вернуться, продолжить игру или удалить комнату</li>
    </ol>
    <p class="man-note">Игра — инструмент самопознания. Она не заменяет помощь психолога или врача</p>

    <h2>8. Карточки</h2>
    ${AWK_CHAKRAS.map(c => `<h3 class="man-row-title" style="color:${c.color};">${c.n}. ${escapeHtml(c.name)} — ${escapeHtml(c.theme)}</h3>
      ${AWK_SPHERES.map(s => { const k = AWK_CARDS[s.id][c.n - 1]; return `<div class="man-cell" style="border-left-color:${c.color};">
        <h4>${s.icon} ${escapeHtml(s.name)}</h4>
        <p>${escapeHtml(k[0])}</p>
        <p class="man-sub">Вопрос к запросу</p><p>${escapeHtml(k[1])}</p>
        <p class="man-sub">Практика</p><p>${escapeHtml(k[2])}</p>
      </div>`; }).join("")}`).join("")}

    <h3 class="man-row-title">🪷 ${escapeHtml(AWK_LOTUS.name)}</h3>
    <div class="man-cell"><p>${escapeHtml(AWK_LOTUS.text)}</p>
      <p class="man-sub">Вопросы для итога</p><ul>${AWK_LOTUS.q.map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ul>
      <p class="man-sub">Практика</p><p>${escapeHtml(AWK_LOTUS.practice)}</p></div>
  </div>`;
}

function openAwakeningManual() {
  showWelcome(false);
  contentEl().innerHTML = `
    <div class="dashboard-wrap">
      <div class="tracker-toolbar no-print">
        <button class="btn btn-ghost btn-small" onclick="openAwakening()">← К игре «Путь Пробуждения»</button>
        <div class="tracker-actions"><button class="btn btn-ghost btn-small" onclick="awkDownloadManual()">⬇ Скачать PDF</button></div>
      </div>
      <div class="table-card">${awakeningManualHtml()}</div>
    </div>`;
  window.scrollTo(0, 0);
}

function awkDownloadManual() {
  const old = document.title;
  document.title = "Методическое пособие «Путь Пробуждения»";
  window.print();
  setTimeout(() => { document.title = old; }, 1000);
}
