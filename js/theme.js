/* Тема ставится до первой отрисовки, чтобы страница не мигала. Выбор посетителя хранится в браузере. */
(() => {
  const root = document.documentElement;
  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  const paintMeta = (t) => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === "light" ? "#f2f1ec" : "#0a0a0b";
  };
  root.dataset.theme = saved === "light" ? "light" : "dark";
  paintMeta(root.dataset.theme);
  const subs = [];
  window.THEME = {
    get: () => root.dataset.theme,
    on: (fn) => subs.push(fn),
    css: (name) => getComputedStyle(root).getPropertyValue(name).trim(),
    set(t) {
      root.dataset.theme = t;
      try { localStorage.setItem("theme", t); } catch (e) {}
      paintMeta(t);
      subs.forEach((fn) => fn(t));
    },
  };
})();
