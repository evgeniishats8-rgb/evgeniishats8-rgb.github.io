(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const stillMode = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const { WORKS, CLIENTS } = window.SITE;

  gsap.registerPlugin(ScrollTrigger, Draggable);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* плавный скролл */
  let lenis = null;
  if (!stillMode) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const glide = (target) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else if (typeof target === "number") scrollTo(0, target);
    else $(target).scrollIntoView();
  };
  window.SITE.glide = glide;
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); glide(a.getAttribute("href")); }));

  /* шапка показывает текущий раздел */
  const navLinks = $$(".nav__links a");
  const spy = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["works", "blender", "pipeline", "services", "contact", "about"].forEach((id) => { const el = document.getElementById(id); if (el) spy.observe(el); });
  new IntersectionObserver(([e]) => { if (e.isIntersecting) navLinks.forEach((a) => a.classList.remove("is-active")); }, { rootMargin: "-45% 0px -50% 0px" }).observe($(".hero"));

  /* точечный портрет за карточкой */
  const dots = $(".id__dots");
  const ctx = dots.getContext("2d");
  const portrait = new Image();
  let portraitData = null;
  const pointer = { x: -999, y: -999 };
  // статичный слой рисуется один раз, от курсора обновляется только маленький участок
  let dotLayer = null, dotStep = 11, dotFit = 1, dotX = 0, dotY = 0, dotW = 0, dotH = 0, lastSpot = null;
  const dotDpr = Math.min(devicePixelRatio, 1.5);
  const lumAt = (x, y) => {
    const px = Math.floor((x - dotX) / dotFit), py = Math.floor((y - dotY) / dotFit);
    if (px < 0 || py < 0 || px >= portraitData.width || py >= portraitData.height) return -1;
    return portraitData.data[(py * portraitData.width + px) * 4] / 255;
  };
  const buildDots = () => {
    if (!portraitData) return;
    dotW = dots.clientWidth; dotH = dots.clientHeight;
    if (!dotW || !dotH) return;
    dots.width = dotW * dotDpr; dots.height = dotH * dotDpr;
    dotStep = dotW < 700 ? 9 : 11;
    dotFit = Math.max(dotW * 1.04 / portraitData.width, dotH * 0.34 / portraitData.height);
    dotX = (dotW - portraitData.width * dotFit) / 2; dotY = Math.min(dotH * 0.1, 60);
    dotLayer = document.createElement("canvas");
    dotLayer.width = dots.width; dotLayer.height = dots.height;
    const g = dotLayer.getContext("2d");
    g.setTransform(dotDpr, 0, 0, dotDpr, 0, 0);
    for (let y = dotStep / 2; y < dotH; y += dotStep) {
      for (let x = dotStep / 2; x < dotW; x += dotStep) {
        const lum = lumAt(x, y);
        if (lum < 0) continue;
        const r = lum * dotStep * 0.46 * clamp((dotH - y) / (dotH * 0.3));
        if (r < 0.35) continue;
        g.fillStyle = `rgba(233,231,225,${0.04 + lum * 0.16})`;
        g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, dots.width, dots.height);
    ctx.drawImage(dotLayer, 0, 0);
  };
  const spot = (x, y, radius) => [x - radius, y - radius, radius * 2, radius * 2];
  const restore = (r) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const [a, b, c, d] = r.map((v) => v * dotDpr);
    ctx.clearRect(a, b, c, d);
    ctx.drawImage(dotLayer, a, b, c, d, a, b, c, d);
  };
  const drawDots = () => {
    if (!dotLayer) return;
    if (lastSpot) restore(lastSpot);
    lastSpot = null;
    if (pointer.x < 0) return;
    const radius = 170;
    lastSpot = spot(pointer.x, pointer.y, radius + 8);
    ctx.setTransform(dotDpr, 0, 0, dotDpr, 0, 0);
    const x0 = Math.floor((pointer.x - radius) / dotStep), y0 = Math.floor((pointer.y - radius) / dotStep);
    for (let j = y0; j * dotStep < pointer.y + radius; j++) {
      for (let i = x0; i * dotStep < pointer.x + radius; i++) {
        const x = i * dotStep + dotStep / 2, y = j * dotStep + dotStep / 2;
        const near = clamp(1 - Math.hypot(x - pointer.x, y - pointer.y) / radius);
        if (near <= 0) continue;
        const lum = lumAt(x, y);
        const base = lum < 0 ? 0 : lum * dotStep * 0.46 * clamp((dotH - y) / (dotH * 0.3));
        ctx.fillStyle = `rgba(233,231,225,${0.04 + Math.max(lum, 0) * 0.16 + near * 0.4})`;
        ctx.beginPath(); ctx.arc(x, y, base + near * 1.8, 0, 6.283); ctx.fill();
      }
    }
  };
  portrait.onload = () => {
    const c = document.createElement("canvas");
    c.width = portrait.naturalWidth; c.height = portrait.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(portrait, 0, 0);
    portraitData = g.getImageData(0, 0, c.width, c.height);
    buildDots();
  };
  portrait.src = "assets/dots.png";
  let dotsQueued = false;
  const queueDots = () => { if (dotsQueued) return; dotsQueued = true; requestAnimationFrame(() => { dotsQueued = false; drawDots(); }); };
  $(".id").addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = dots.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    queueDots();
  });
  $(".id").addEventListener("pointerleave", () => { pointer.x = -999; queueDots(); });
  let dotsTimer = 0;
  addEventListener("resize", () => { clearTimeout(dotsTimer); dotsTimer = setTimeout(buildDots, 200); });

  /* карточка: линзовая печать. Угол зрения меняет личность */
  const card = $(".card");
  const body = $(".card__body");
  const photo = $(".card__photo");
  const roles = window.SITE.ROLES;
  const imgs = roles.map((s, i) => {
    const im = new Image();
    im.src = `assets/faces/d_${s.id}.png`;
    im.alt = "";
    im.draggable = false;
    photo.prepend(im);
    return im;
  });
  const roleTag = $(".card__role");
  const roleNum = $(".card__n");
  let roleIndex = -1;
  const setRole = (i) => {
    if (i === roleIndex || !roles[i]) return;
    roleIndex = i;
    imgs.forEach((im, k) => im.classList.toggle("is-on", k === i));
    const en = I18N.lang === "en";
    roleTag.textContent = en ? roles[i].role_en : roles[i].role;
    roleNum.textContent = `${i + 1} ${en ? "of" : "из"} ${roles.length}`;
  };
  setRole(0);
  let flipped = false;
  let moved = 0;
  const tilt = (e) => {
    const r = card.getBoundingClientRect();
    const nx = clamp((e.clientX - r.left) / r.width), ny = clamp((e.clientY - r.top) / r.height);
    body.style.setProperty("--ry", `${(nx - 0.5) * 26}deg`);
    body.style.setProperty("--rx", `${(0.5 - ny) * 16}deg`);
    card.style.setProperty("--hx", (nx - 0.5).toFixed(3));
    card.style.setProperty("--hy", (ny - 0.5).toFixed(3));
    setRole(Math.min(roles.length - 1, Math.floor(nx * roles.length)));
  };
  const rest = () => {
    card.classList.remove("is-live");
    body.style.setProperty("--ry", "0deg");
    body.style.setProperty("--rx", "0deg");
  };
  card.addEventListener("pointerenter", () => card.classList.add("is-live"));
  card.addEventListener("pointerdown", () => { moved = 0; card.classList.add("is-live"); });
  card.addEventListener("pointermove", (e) => { moved += Math.abs(e.movementX) + Math.abs(e.movementY); tilt(e); });
  card.addEventListener("pointerleave", rest);
  card.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") rest(); });
  const flip = () => {
    flipped = !flipped;
    body.style.setProperty("--flip", flipped ? "180deg" : "0deg");
    card.classList.toggle("is-flipped", flipped);
  };
  card.addEventListener("click", () => { if (moved < 14 || fine) flip(); });
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });

  /* холст с работами */
  const board = $(".board");
  const tiles = WORKS.map((w) => {
    const el = document.createElement("article");
    const ratio = w.w / w.h;
    el.className = `tile ${ratio > 1 ? "tile--wide" : "tile--tall"}`;
    el.dataset.kind = w.kind;
    el.style.setProperty("--ar", `${w.w} / ${w.h}`);
    const num = String(WORKS.indexOf(w) + 1).padStart(3, "0");
    el.innerHTML = `
      <header class="tile__bar"><span>#${num}</span><span class="tile__name">${w.title}</span><i class="port"></i></header>
      <div class="tile__frame"><video muted loop playsinline preload="none" aria-label="${w.title}"></video></div>
      <footer class="tile__meta"><span class="tile__size">${w.w}×${w.h}</span><span>${w.tag}</span></footer>`;
    const video = $("video", el);
    // на телефоне лёгкая версия: первые 5 секунд, сильнее сжатая (tools/tiles_mobile.sh)
    video.dataset.src = `assets/video/${fine ? "t" : "tm"}/${w.id}.mp4`;
    video.dataset.poster = `assets/poster/${w.id}.jpg`;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    board.append(el);
    return { el, video, data: w, ratio };
  });

  // на компьютере живой один ролик: под курсором или последний появившийся. Браузер снижает частоту кадров
  // всей страницы, как только видео играет больше одного, и плавный скролл становится рваным.
  // На телефоне скролл нативный, ему это не мешает, поэтому там играют два
  const maxPlaying = fine ? 1 : 2;
  const playing = [];
  const seen = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        if (!target.src && target.dataset.src) target.src = target.dataset.src;
        target.play().catch(() => {});
        if (!playing.includes(target)) playing.push(target);
        while (playing.length > maxPlaying) playing.shift().pause();
      } else {
        target.pause();
        const i = playing.indexOf(target);
        if (i >= 0) playing.splice(i, 1);
      }
    });
  }, { threshold: 0.35 });
  tiles.forEach((t) => seen.observe(t.video));
  // ролики грузятся за два с половиной экрана до появления, поэтому при скролле они уже готовы
  const prep = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting || target.getAttribute("src")) return;
      target.preload = "auto";
      target.src = target.dataset.src;
    });
  }, { rootMargin: "250% 0px" });
  tiles.forEach((t) => prep.observe(t.video));
  const promote = (video) => {
    if (playing.includes(video)) return;
    playing.splice(0).forEach((v) => v.pause());
    if (!video.src && video.dataset.src) video.src = video.dataset.src;
    playing.push(video);
    video.play().catch(() => {});
  };
  if (fine) tiles.forEach((t) => t.el.addEventListener("pointerenter", () => promote(t.video)));
  // постеры подгружаем заранее, но не всей пачкой при открытии
  const near = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.poster = target.dataset.poster;
      near.unobserve(target);
    });
  }, { rootMargin: "300% 0px" });
  tiles.forEach((t) => near.observe(t.video));
  // на телефоне выгружаются только ролики очень далеко от экрана, чтобы при возврате не грузить заново
  if (!fine) {
    const far = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting || !target.getAttribute("src")) return;
        target.pause();
        target.removeAttribute("src");
        target.load();
      });
    }, { rootMargin: "800% 0px" });
    tiles.forEach((t) => far.observe(t.video));
  }
  $$("video[data-auto]").forEach((v) => seen.observe(v));

  /* раскладка коллажем: колонки разной ширины, небольшой разброс */
  let kind = "all";
  const layoutBoard = (animate) => {
    tiles.forEach((t) => t.el.classList.toggle("is-out", kind !== "all" && t.data.kind !== kind));
    if (innerWidth <= 820) {
      board.style.height = "";
      tiles.forEach((t) => { t.el.style.width = ""; gsap.set(t.el, { clearProps: "x,y" }); });
      return;
    }
    const W = board.clientWidth;
    const shares = [0.32, 0.18, 0.32, 0.18];
    const gap = Math.max(14, W * 0.012);
    const usable = W - gap * 3;
    const cols = shares.map((s, i) => ({ x: shares.slice(0, i).reduce((a, b) => a + b * usable + gap, 0), w: s * usable, y: 0 }));
    tiles.filter((t) => !t.el.classList.contains("is-out")).forEach((t) => {
      const pool = t.ratio > 1 ? [cols[0], cols[2]] : [cols[1], cols[3]];
      const col = pool.reduce((a, b) => (b.y < a.y ? b : a));
      t.el.style.width = `${col.w}px`;
      if (animate) gsap.to(t.el, { x: col.x, y: col.y, duration: 0.8, ease: "power3.out" });
      else gsap.set(t.el, { x: col.x, y: col.y });
      col.y += t.el.offsetHeight + gap;
    });
    board.style.height = `${Math.max(...cols.map((c) => c.y))}px`;
    ScrollTrigger.refresh();
  };
  layoutBoard();

  let boardW = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth === boardW) return;
    boardW = innerWidth;
    layoutBoard();
  });

  // пока открыт просмотр работы, страница под ним не тратит ресурсы
  const holds = window.SITE.holds = [];
  const setHold = (on) => {
    holds.forEach((fn) => fn(on));
    playing.forEach((v) => (on ? v.pause() : v.play().catch(() => {})));
  };

  const lightbox = $(".lightbox");
  const lightVideo = $("video", lightbox);
  const lightCap = $(".lightbox__cap");
  const openLight = (src, poster, cap, backup) => {
    lightVideo.onerror = backup ? () => { lightVideo.onerror = null; lightVideo.src = backup; lightVideo.play().catch(() => {}); } : null;
    lightVideo.src = src;
    lightVideo.poster = poster || "";
    lightVideo.muted = false;
    lightVideo.loop = false;
    lightVideo.controls = true;
    lightCap.innerHTML = cap;
    if (!lightbox.open) { lightbox.showModal(); setHold(true); }
    lenis && lenis.stop();
    lightVideo.play().catch(() => {});
  };
  const closeLight = () => lightbox.close();
  let queue = [], place = -1;
  const step = (by) => {
    if (place < 0) return;
    place = (place + by + queue.length) % queue.length;
    showTile(queue[place]);
  };
  lightbox.addEventListener("close", () => { place = -1; lightbox.classList.remove("has-nav"); lightVideo.onerror = null; lightVideo.pause(); lightVideo.removeAttribute("src"); lightVideo.load(); lenis && lenis.start(); setHold(false); });
  $(".lightbox__close").addEventListener("click", closeLight);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLight(); });
  $$("[data-reel]").forEach((b) => b.addEventListener("click", () => openLight("assets/video/showreel.mp4", "assets/poster/me_daisy.jpg", I18N.t("reel.cap", "шоурил JDROBYSHEV, 1:30"))));

  const showTile = (t) => {
    const { id, title, title_en, tag, link } = t.data;
    const more = link ? `<a href="${link}" target="_blank" rel="noopener">${I18N.t("work.more", "в instagram →")}</a>` : "";
    const name = I18N.lang === "en" && title_en ? title_en : title;
    const number = `#${String(WORKS.indexOf(t.data) + 1).padStart(3, "0")}`;
    openLight(`assets/full/${id}.mp4`, `assets/poster/${id}.jpg`, `${number} ${name} · ${I18N.tag(tag)}${more}`, `assets/video/${id}.mp4`);
  };
  const openTile = (t) => {
    queue = tiles.filter((x) => !x.el.classList.contains("is-out"));
    if (!queue.includes(t)) queue = tiles;
    place = queue.indexOf(t);
    lightbox.classList.add("has-nav");
    showTile(t);
  };
  window.SITE.openWork = (id) => { const t = tiles.find((x) => x.data.id === id); if (t) openTile(t); };
  $(".lightbox__nav--prev").addEventListener("click", () => step(-1));
  $(".lightbox__nav--next").addEventListener("click", () => step(1));
  // колесо листает работы, а не сайт под ними. Хвост инерции тачпада за новый жест не считается
  let wheelLast = 0, wheelFlip = 0;
  lightbox.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY || e.deltaX;
    const fresh = e.timeStamp - wheelLast > 160;
    wheelLast = e.timeStamp;
    if (!delta || place < 0 || !(fresh || e.timeStamp - wheelFlip > 1100)) return;
    wheelFlip = e.timeStamp;
    step(Math.sign(delta));
  }, { passive: false });
  lightbox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
  });

  tiles.forEach((t) => {
    if (fine && !stillMode) {
      Draggable.create(t.el, {
        type: "x,y", bounds: board, zIndexBoost: true, minimumMovement: 6,
        onPress() { t.el.classList.add("is-drag"); lenis && lenis.stop(); },
        onRelease() { t.el.classList.remove("is-drag"); lenis && lenis.start(); },
        onDrag() { $(".tile__size", t.el).textContent = `x ${Math.round(this.x)} y ${Math.round(this.y)}`; },
        onClick() { openTile(t); },
      });
    } else {
      t.el.addEventListener("click", () => openTile(t));
    }
    t.el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTile(t); } });
  });

  $$(".works__filter button").forEach((b) => b.addEventListener("click", () => {
    $$(".works__filter button").forEach((x) => x.classList.toggle("is-on", x === b));
    kind = b.dataset.filter;
    layoutBoard(true);
    relabel();
  }));
  $(".works__arrange").addEventListener("click", () => layoutBoard(true));

  const relabel = () => {
    const shown = tiles.filter((t) => !t.el.classList.contains("is-out")).length;
    $(".works__count").textContent = `${I18N.t("works.count", "рендеров")}: ${shown === WORKS.length ? shown : `${shown}/${WORKS.length}`}`;
    tiles.forEach((t) => {
      const { title, title_en, tag } = t.data;
      $(".tile__name", t.el).textContent = I18N.lang === "en" && title_en ? title_en : title;
      $(".tile__meta span:last-child", t.el).textContent = I18N.tag(tag);
    });
  };
  I18N.onChange(relabel);

  /* клиенты */
  const row = $(".ticker__row");
  const paintClients = () => {
    const names = (I18N.lang === "en" ? window.SITE.CLIENTS_EN : CLIENTS).map((c) => `<span>${c}</span>`).join("");
    row.innerHTML = names + names + names + names;
  };
  I18N.onChange(paintClients);
  I18N.onChange(() => { const i = roleIndex; roleIndex = -1; setRole(i < 0 ? 0 : i); });

  /* услуги: клик открывает пример */
  $$(".services__list li").forEach((li) => {
    const open = () => window.SITE.openWork(li.dataset.preview);
    li.addEventListener("click", open);
    li.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });

  /* почта копируется одной кнопкой */
  const copy = $(".end__copy");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.SITE.mail);
      copy.textContent = I18N.t("end.copied", "скопировано");
      setTimeout(() => { copy.textContent = I18N.t("end.copy", "скопировать"); }, 1600);
    } catch (e) { location.href = `mailto:${window.SITE.mail}`; }
  });

  /* ноды конвейера можно потянуть, они мягко возвращаются на место */
  if (fine && !stillMode) {
    $$(".line__nodes li").forEach((li) => {
      Draggable.create(li, {
        type: "x,y", zIndexBoost: true, minimumMovement: 3, edgeResistance: 0.9,
        onDrag() { gsap.set(this.target, { x: gsap.utils.clamp(-70, 70, this.x), y: gsap.utils.clamp(-46, 46, this.y) }); },
        onRelease() { gsap.to(this.target, { x: 0, y: 0, duration: 0.9, ease: "power3.out" }); },
      });
    });
  }

  /* услуги: превью за курсором */
  const float = $(".services__float");
  const floatVideo = $("video", float);
  if (fine) {
    const box = $(".services");
    const fx = gsap.quickTo(float, "x", { duration: 0.5, ease: "power3" });
    const fy = gsap.quickTo(float, "y", { duration: 0.5, ease: "power3" });
    box.addEventListener("pointermove", (e) => {
      const r = box.getBoundingClientRect();
      fx(clamp(e.clientX - r.left + 26, 0, r.width - float.offsetWidth));
      fy(e.clientY - r.top - float.offsetHeight / 2);
    });
    $$(".services__list li").forEach((li) => {
      li.addEventListener("pointerenter", () => {
        const src = `assets/video/t/${li.dataset.preview}.mp4`;
        if (!floatVideo.src.endsWith(src)) floatVideo.src = src;
        floatVideo.play().catch(() => {});
        float.classList.add("is-on");
      });
      li.addEventListener("pointerleave", () => { float.classList.remove("is-on"); floatVideo.pause(); });
    });
  }

  /* появление заголовков без тряски */
  if (!stillMode) {
    $$(".id__title,.works h2,.bull h2,.end__big").forEach((el) => {
      gsap.from(el, { yPercent: 12, opacity: 0, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });
  }
  addEventListener("load", () => ScrollTrigger.refresh());
})();
