/* Мини-бриф: услуга → вопросы под неё → сроки и бюджет → готовый текст в Telegram или на почту.
   Сервера нет: бриф собирается в браузере, клиент отправляет его сам из своего Telegram или почты. */
(() => {
  const TG = "jdrobyshev";
  const L = (ru, en) => ({ ru, en });
  const t = (v) => (I18N.lang === "en" ? v.en : v.ru);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // вопросы под каждую услугу: не больше трёх, ответы кнопками, чтобы бриф проходился за минуту
  const TASKS = [
    { id: "ad", name: L("Реклама", "Ad"), qs: [
      { id: "where", q: L("Где выйдет", "Where it runs"), a: [L("соцсети", "social"), L("онлайн-видео", "online video"), L("ТВ", "TV"), L("экраны на событии", "event screens"), L("пока не знаю", "not sure yet")] },
      { id: "length", q: L("Длина", "Length"), a: [L("6–15 с", "6–15 s"), L("30 с", "30 s"), L("60 с", "60 s"), L("длиннее", "longer"), L("серия роликов", "a series")] },
      { id: "script", q: L("Сценарий", "Script"), a: [L("готов", "ready"), L("есть идея", "just an idea"), L("нужен с нуля", "need one from scratch")] },
    ] },
    { id: "character", name: L("Персонаж", "Character"), qs: [
      { id: "who", q: L("Кто это", "Who is it"), a: [L("маскот бренда", "brand mascot"), L("цифровой актёр", "digital actor"), L("двойник человека", "a real person's double"), L("животное или существо", "animal or creature")] },
      { id: "need", q: L("Что нужно", "What you need"), multi: true, a: [L("картинки", "stills"), L("видео", "video"), L("говорит, липсинк", "talks, lip-sync"), L("3D и риг", "3D and rig")] },
      { id: "refs", q: L("Референсы", "References"), a: [L("есть", "have them"), L("нет, придумаем", "no, let's invent")] },
    ] },
    { id: "product", name: L("Продукт", "Product"), qs: [
      { id: "source", q: L("Что есть на руках", "What you have"), a: [L("3D-модель", "3D model"), L("фото продукта", "product photos"), L("сам продукт", "the product itself"), L("пока ничего", "nothing yet")] },
      { id: "format", q: L("Формат", "Format"), multi: true, a: [L("рекламный ролик", "ad film"), L("пэкшот", "packshot"), L("для маркетплейса", "marketplace content"), L("картинки", "stills")] },
    ] },
    { id: "stage", name: L("Сцена и экраны", "Stage and screens"), qs: [
      { id: "screen", q: L("Экран", "Screen"), a: [L("LED-стена", "LED wall"), L("проекция", "projection"), L("несколько экранов", "several screens"), L("пока не знаю", "not sure yet")] },
      { id: "content", q: L("Что показываем", "What we show"), multi: true, a: [L("фоновые лупы", "background loops"), L("заставки между выходами", "intros between acts"), L("шоу под таймкод", "timecoded show")] },
      { id: "res", q: L("Разрешение экрана", "Screen resolution"), input: L("например, 3072×1344", "e.g. 3072×1344") },
    ] },
    { id: "reels", name: L("Рилсы", "Reels"), qs: [
      { id: "count", q: L("Сколько", "How many"), a: [L("один", "one"), L("3–5", "3–5"), L("10 и больше", "10 or more"), L("каждый месяц", "every month")] },
      { id: "face", q: L("Кто в кадре", "Who's on screen"), a: [L("я сам", "me"), L("персонаж", "a character"), L("продукт", "the product"), L("без людей", "no people")] },
      { id: "ratio", q: L("Кадр", "Aspect"), a: [L("9:16", "9:16"), L("1:1", "1:1"), L("16:9", "16:9"), L("все сразу", "all of them")] },
    ] },
    { id: "clip", name: L("Клип", "Music video"), qs: [
      { id: "track", q: L("Трек", "Track"), a: [L("готов", "ready"), L("ещё пишется", "in progress")] },
      { id: "artist", q: L("Артист в кадре", "Artist on screen"), a: [L("да, по его фото", "yes, from photos"), L("нет, только мир клипа", "no, just the world")] },
      { id: "cut", q: L("Длина", "Length"), a: [L("весь трек", "full track"), L("тизер", "teaser")] },
    ] },
    { id: "vfx", name: L("ИИ VFX", "AI VFX"), qs: [
      { id: "footage", q: L("Исходник", "Footage"), a: [L("уже снят", "already shot"), L("будет снят", "will be shot"), L("съёмки нет", "no footage")] },
      { id: "job", q: L("Задача", "Job"), multi: true, a: [L("заменить фон", "replace background"), L("добавить эффекты", "add effects"), L("починить кадр", "fix a shot"), L("лицо, возраст", "face, age"), L("другое", "other")] },
      { id: "shots", q: L("Сколько планов", "Shots"), a: [L("1–5", "1–5"), L("5–20", "5–20"), L("больше 20", "20+")] },
    ] },
    { id: "other", name: L("Другое", "Something else"), qs: [] },
  ];
  const COMMON = [
    { id: "when", q: L("Срок", "Deadline"), a: [L("на этой неделе", "this week"), L("2–3 недели", "2–3 weeks"), L("месяц и больше", "a month or more"), L("не горит", "no rush")] },
    { id: "budget", q: L("Бюджет", "Budget"), a: [L("до 100 тыс ₽", "under $1k"), L("100–300 тыс ₽", "$1–3k"), L("от 300 тыс ₽", "$3k+"), L("пока не знаю", "not sure yet")] },
  ];
  const STEPS = [L("задача", "task"), L("детали", "details"), L("сроки", "timing"), L("бриф", "brief")];
  const TEXT = {
    bar: L("Бриф", "Brief"),
    close: L("закрыть", "close"),
    t0: L("Что делаем?", "What are we making?"),
    t1: L("Пара деталей", "A few details"),
    t2: L("Сроки и бюджет", "Timing and budget"),
    t3: L("Бриф готов", "Brief is ready"),
    hi: L("Просто написать:", "Just say hi:"),
    pick: L("можно несколько", "pick any"),
    name: L("Имя или компания", "Name or company"),
    note: L("Детали", "Details"),
    noteHint: L("ссылки, референсы, идея. Голосовое тоже можно, уже в чате", "links, references, the idea. A voice note works too, once in the chat"),
    back: L("← назад", "← back"),
    next: L("дальше →", "next →"),
    build: L("собрать бриф →", "build the brief →"),
    tg: L("отправить в Telegram →", "send to Telegram →"),
    mail: L("на почту", "by email"),
    copy: L("скопировать", "copy"),
    copied: L("скопировано", "copied"),
    how: L("Откроется чат со мной, бриф уже вписан. Останется нажать «отправить».", "A chat with me opens with the brief already typed in. Just hit send."),
    head: L("Бриф с сайта JDROBYSHEV", "Brief from the JDROBYSHEV site"),
    task: L("Задача", "Task"),
    subject: L("Бриф", "Brief"),
  };

  const box = document.querySelector(".brief");
  if (!box) return;
  const body = box.querySelector(".brief__body");
  const st = { step: 0, task: null, ans: {}, name: "", note: "" };
  const task = () => TASKS.find((x) => x.id === st.task);
  const questions = () => (task() ? task().qs : []);

  // ответ как текст на текущем языке
  const answer = (q) => {
    const v = st.ans[q.id];
    if (q.input) return (v || "").trim();
    if (!v || !v.length) return "";
    return v.map((i) => t(q.a[i])).join(", ");
  };

  const message = () => {
    const rows = [t(TEXT.head), "", `${t(TEXT.task)}: ${t(task().name)}`];
    [...questions(), ...COMMON].forEach((q) => { const a = answer(q); if (a) rows.push(`${t(q.q)}: ${a}`); });
    if (st.name.trim()) rows.push(`${t(TEXT.name)}: ${st.name.trim()}`);
    if (st.note.trim()) rows.push("", st.note.trim());
    return rows.join("\n");
  };

  // тот же бриф как промт в ноде: ключи по-английски, как в JSON на главной
  const json = () => {
    const pairs = [["task", task().id]];
    [...questions(), ...COMMON].forEach((q) => { const a = answer(q); if (a) pairs.push([q.id, a]); });
    if (st.name.trim()) pairs.push(["from", st.name.trim()]);
    if (st.note.trim()) pairs.push(["details", st.note.trim().replace(/\s+/g, " ")]);
    pairs.push(["negative", "camera, tripod, film crew"]);
    return `{\n${pairs.map(([k, v]) => `  <i>"${k}"</i>: <b>"${esc(v)}"</b>`).join(",\n")}\n}`;
  };

  const chips = (q) => {
    const on = st.ans[q.id] || [];
    return q.a.map((a, i) => `<button type="button" class="brief__chip${on.includes(i) ? " is-on" : ""}" data-pick="${q.id}:${i}" aria-pressed="${on.includes(i)}">${esc(t(a))}</button>`).join("");
  };
  const field = (q) => {
    if (q.input) return `<label class="brief__q"><span>${esc(t(q.q))}</span><input class="brief__input" data-field="${q.id}" maxlength="60" placeholder="${esc(t(q.input))}" value="${esc(st.ans[q.id] || "")}"></label>`;
    return `<fieldset class="brief__q"><legend>${esc(t(q.q))}${q.multi ? ` <em>${esc(t(TEXT.pick))}</em>` : ""}</legend><div class="brief__chips">${chips(q)}</div></fieldset>`;
  };

  const views = [
    () => `<h2 class="brief__title" id="brief-title">${esc(t(TEXT.t0))}</h2>
      <div class="brief__chips brief__chips--tasks">${TASKS.map((x) => `<button type="button" class="brief__chip${st.task === x.id ? " is-on" : ""}" data-task="${x.id}" aria-pressed="${st.task === x.id}">${esc(t(x.name))}</button>`).join("")}</div>`,
    () => `<h2 class="brief__title" id="brief-title">${esc(t(task().name))} · ${esc(t(TEXT.t1).toLowerCase())}</h2>${questions().map(field).join("")}`,
    () => `<h2 class="brief__title" id="brief-title">${esc(t(TEXT.t2))}</h2>${COMMON.map(field).join("")}
      <label class="brief__q"><span>${esc(t(TEXT.name))}</span><input class="brief__input" data-field="name" maxlength="80" autocomplete="organization" value="${esc(st.name)}"></label>
      <label class="brief__q"><span>${esc(t(TEXT.note))}</span><textarea class="brief__input" data-field="note" rows="3" maxlength="600" placeholder="${esc(t(TEXT.noteHint))}">${esc(st.note)}</textarea></label>`,
    () => {
      const text = message();
      const mail = `mailto:${window.SITE.mail}?subject=${encodeURIComponent(`${t(TEXT.subject)}: ${t(task().name)}`)}&body=${encodeURIComponent(text)}`;
      return `<h2 class="brief__title" id="brief-title">${esc(t(TEXT.t3))}</h2>
        <pre class="brief__json">${json()}</pre>
        <div class="brief__send">
          <a class="brief__go" href="https://t.me/${TG}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">${esc(t(TEXT.tg))}</a>
          <a class="brief__alt" href="${mail}">${esc(t(TEXT.mail))}</a>
          <button type="button" class="brief__alt" data-copy>${esc(t(TEXT.copy))}</button>
        </div>
        <p class="brief__how">${esc(t(TEXT.how))}</p>`;
    },
  ];

  const foot = () => {
    // на первом шаге вместо «назад» прямые контакты: кому бриф не нужен, пишет сразу
    const back = st.step > 0
      ? `<button type="button" class="brief__nav" data-go="-1">${esc(t(TEXT.back))}</button>`
      : `<p class="brief__hi">${esc(t(TEXT.hi))} <a href="https://t.me/${TG}" target="_blank" rel="noopener">telegram</a> · <a href="mailto:${window.SITE.mail}">email</a></p>`;
    let next = "";
    if (st.step === 0 && st.task) next = `<button type="button" class="brief__nav brief__nav--next" data-go="1">${esc(t(TEXT.next))}</button>`;
    if (st.step === 1) next = `<button type="button" class="brief__nav brief__nav--next" data-go="1">${esc(t(TEXT.next))}</button>`;
    if (st.step === 2) next = `<button type="button" class="brief__nav brief__nav--next" data-go="1">${esc(t(TEXT.build))}</button>`;
    return `${back}${next}`;
  };

  const paint = (focus) => {
    box.querySelector(".brief__name").textContent = t(TEXT.bar);
    box.querySelector(".brief__close").textContent = t(TEXT.close);
    // у «другого» вопросов нет, и шаг «детали» в цепочке не показывается
    const shown = STEPS.map((s, i) => [s, i]).filter(([, i]) => i !== 1 || !task() || questions().length);
    box.querySelector(".brief__steps").innerHTML = shown.map(([s, i]) => `<span class="${i === st.step ? "is-now" : i < st.step ? "is-done" : ""}">${esc(t(s))}</span>`).join("<i>→</i>");
    body.innerHTML = views[st.step]();
    box.querySelector(".brief__foot").innerHTML = foot();
    body.classList.remove("is-in");
    void body.offsetWidth;
    body.classList.add("is-in");
    body.scrollTop = 0;
    // клавиатура переходит на первый выбор, но поле ввода не трогаем, чтобы на телефоне не выскакивала клавиатура
    if (focus) { const first = body.querySelector("button, a"); if (first) first.focus({ preventScroll: true }); }
  };

  const go = (by) => {
    let next = st.step + by;
    if (next === 1 && !questions().length) next += by;
    st.step = Math.max(0, Math.min(3, next));
    paint(true);
  };

  // выбранная услуга подсвечивается сразу, до перехода
  const markTask = (el) => el.parentElement.querySelectorAll("[data-task]").forEach((b) => { const on = b === el; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });

  box.addEventListener("click", async (e) => {
    if (e.target === box) { box.close(); return; }
    const el = e.target.closest("[data-task],[data-pick],[data-go],[data-copy],.brief__close");
    if (!el) return;
    if (el.classList.contains("brief__close")) { box.close(); return; }
    if (el.dataset.task) {
      if (st.task !== el.dataset.task) st.ans = {};
      st.task = el.dataset.task;
      markTask(el);
      setTimeout(() => go(1), 160);
    } else if (el.dataset.pick) {
      const [id, i] = el.dataset.pick.split(":");
      const q = [...questions(), ...COMMON].find((x) => x.id === id);
      const on = st.ans[id] || [];
      const n = Number(i);
      st.ans[id] = on.includes(n) ? on.filter((x) => x !== n) : q.multi ? [...on, n] : [n];
      el.parentElement.querySelectorAll("[data-pick]").forEach((b, k) => {
        const pressed = st.ans[id].includes(k);
        b.classList.toggle("is-on", pressed);
        b.setAttribute("aria-pressed", pressed);
      });
    } else if (el.dataset.go) {
      go(Number(el.dataset.go));
    } else if (el.dataset.copy !== undefined) {
      try { await navigator.clipboard.writeText(message()); el.textContent = t(TEXT.copied); setTimeout(() => { el.textContent = t(TEXT.copy); }, 1600); } catch (err) { /* без буфера остаются ссылки */ }
    }
  });

  box.addEventListener("input", (e) => {
    const f = e.target.dataset.field;
    if (!f) return;
    if (f === "name") st.name = e.target.value;
    else if (f === "note") st.note = e.target.value;
    else st.ans[f] = e.target.value;
  });

  const open = () => {
    if (box.open) return;
    paint(false);
    box.showModal();
    window.SITE.modal && window.SITE.modal(true);
  };
  box.addEventListener("close", () => { window.SITE.modal && window.SITE.modal(false); });
  document.addEventListener("click", (e) => { if (e.target.closest("[data-brief]")) { e.preventDefault(); open(); } });
  I18N.onChange(() => { if (box.open) paint(false); });
})();
