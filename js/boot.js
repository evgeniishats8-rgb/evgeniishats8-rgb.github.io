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

  I18N.apply();
})();
