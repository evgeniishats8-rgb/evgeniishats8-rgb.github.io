/* Защита страницы и запуск языка. Загружается последним. */
(() => {
  // сайт не показывается внутри чужих страниц
  if (window.top !== window.self) {
    try { window.top.location = window.location.href; } catch (e) { document.documentElement.hidden = true; }
  }

  // почта собирается только в браузере, поэтому в коде страницы её не найдут спам-боты
  const mail = `${["evgenii", "shats8"].join("")}@${["gmail", "com"].join(".")}`;
  window.SITE.mail = mail;
  document.querySelectorAll("[data-mail]").forEach((a) => {
    a.href = `mailto:${mail}`;
    a.textContent = mail;
  });

  // работы не сохраняются обычным правым кликом и перетаскиванием
  document.addEventListener("contextmenu", (e) => {
    if (e.target.closest("video, canvas, .card, .tile, .preview")) e.preventDefault();
  });
  document.addEventListener("dragstart", (e) => {
    if (e.target.closest("video, img, canvas")) e.preventDefault();
  });

  // ролик, оборвавшийся при смене сети, загружается заново
  const retries = new WeakMap();
  document.addEventListener("error", (e) => {
    const video = e.target;
    if (video.tagName !== "VIDEO" || !video.getAttribute("src")) return;
    const count = retries.get(video) || 0;
    if (count >= 3 || video.onerror) return;
    retries.set(video, count + 1);
    const wasPlaying = !video.paused;
    setTimeout(() => {
      video.load();
      if (wasPlaying || video.closest(".hero__src, .bl__view")) video.play().catch(() => {});
    }, 1200 * (count + 1));
  }, true);

  I18N.apply();
})();
