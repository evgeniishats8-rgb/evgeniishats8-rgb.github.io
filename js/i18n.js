/* Русский и английский. Тексты короткие, поэтому хватает словаря по ключам. */
(() => {
  const EN = {
    "nav.works": "work", "nav.services": "services", "nav.reel": "reel", "nav.contact": "contact",
    "hero.title": "No cameras were harmed", "hero.who": "evgenii shats, ai creator",
    "hero.hint": "auto queue, scroll for works",
    "hero.neg": "camera, tripod, film crew, location fee",
    "id.title": "Eight years behind a camera.<br>Not anymore.", "id.sub": "films and visuals for brands",
    "card.found": "Found it? Write.", "card.hint.fine": "move the cursor, click", "card.hint.touch": "drag a finger, tap",
    "works.title": "Work", "works.count": "renders", "works.all": "all", "works.brand": "brands", "works.me": "with me", "works.art": "personal",
    "works.reel": "showreel with sound",
    "bull.title": "AI is a wild bull", "bull.big": "The carpet is reality. The lasso is the prompt.", "bull.small": "By attempt fifty it goes where you want.",
    "bl.title": "Under the hood", "bl.wire": "wireframe", "bl.rig": "rig", "bl.render": "render", "bl.drag": "move the cursor",
    "line.title": "Pipeline", "line.1": "Idea", "line.2": "Style", "line.3": "Frames", "line.4": "Video", "line.6": "Edit", "line.7": "Sound", "line.8": "QC", "line.vfx": "AI VFX",
    "svc.1": "Ads", "svc.2": "Characters", "svc.3": "Product", "svc.4": "Stage and screens", "svc.5": "Reels", "svc.6": "AI VFX",
    "svc.2d": "digital actors, mascots", "svc.5d": "series for social", "svc.6d": "effects, compositing, shot fixes",
    "end.title": "Next seed is yours", "end.place": "haifa, tel aviv<br>working worldwide",
    "card.head": "AI CREATOR ID", "card.call": "call sign", "card.base": "base", "card.ids": "identities", "card.cams": "cameras",
    "card.surname": "SHATS", "card.name": "EVGENII", "card.city": "HAIFA · TEL AVIV", "card.sign": "Shats",
    "svc.1d": "LABA, IKAR, ER-Telecom", "svc.3d": "Zepro, Detsky Mir",
    "nav.process": "process", "hero.reset": "reset layout", "hero.queue": "Queue next", "hero.rerun": "Re-run", "hero.sound": "play with sound",
    "works.arrange": "arrange", "end.copy": "copy", "end.cv": "cv, pdf (ru)", "card.cv": "cv, pdf (ru)", "nav.cv": "cv", "end.copied": "copied", "end.top": "back to top",
    "end.legal": "© 2026 Evgenii Shats. All rights reserved. No copying or reuse of the works without permission.",
    "reel.cap": "JDROBYSHEV showreel, 1:30", "work.more": "watch on instagram →", "close": "close",
  };
  const TAGS = { "реклама": "ad", "концепт": "concept", "ивент": "event", "личное": "personal", "со мной": "with me", "имидж": "brand film" };

  let saved = null;
  try { saved = localStorage.getItem("lang"); } catch (e) { /* без хранилища просто язык браузера */ }
  const start = saved || "en";

  const originals = new Map();
  const listeners = [];
  const I18N = {
    lang: start,
    t(key, fallback) { return I18N.lang === "en" ? EN[key] ?? fallback : fallback; },
    tag(ru) { return I18N.lang === "en" ? TAGS[ru] ?? ru : ru; },
    face(text) { return text; },
    onChange(fn) { listeners.push(fn); },
    apply() {
      document.documentElement.lang = I18N.lang;
      document.querySelectorAll("[data-i18n]").forEach((el) => {
        if (!originals.has(el)) originals.set(el, el.innerHTML);
        el.innerHTML = I18N.t(el.dataset.i18n, originals.get(el));
      });
      const button = document.querySelector("[data-lang]");
      if (button) button.textContent = I18N.lang === "en" ? "ru" : "en";
      listeners.forEach((fn) => fn());
    },
    toggle() {
      I18N.lang = I18N.lang === "en" ? "ru" : "en";
      try { localStorage.setItem("lang", I18N.lang); } catch (e) { /* выбор живёт до перезагрузки */ }
      I18N.apply();
    },
  };
  window.I18N = I18N;
  document.addEventListener("click", (e) => { if (e.target.closest("[data-lang]")) I18N.toggle(); });
})();
