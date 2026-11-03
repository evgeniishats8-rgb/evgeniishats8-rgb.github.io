(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const stillMode = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const { WORKS, CLIENTS } = window.SITE;

  gsap.registerPlugin(ScrollTrigger, Draggable);

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
  const drawDots = () => {
    if (!portraitData) return;
    const dpr = Math.min(devicePixelRatio, 2);
    const W = dots.clientWidth, H = dots.clientHeight;
    if (dots.width !== W * dpr) { dots.width = W * dpr; dots.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const step = W < 700 ? 9 : 11;
    const { width: pw, height: ph, data } = portraitData;
    const fit = Math.max(W * 1.04 / pw, H * 0.34 / ph);
    const ox = (W - pw * fit) / 2, oy = Math.min(H * 0.1, 60);
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        const px = Math.floor((x - ox) / fit), py = Math.floor((y - oy) / fit);
        if (px < 0 || py < 0 || px >= pw || py >= ph) continue;
        const lum = data[(py * pw + px) * 4] / 255;
        const fade = clamp((H - y) / (H * 0.3));
        const near = clamp(1 - Math.hypot(x - pointer.x, y - pointer.y) / 170);
        const r = lum * step * 0.46 * fade + near * 1.8;
        if (r < 0.35) continue;
        ctx.fillStyle = `rgba(233,231,225,${0.04 + lum * 0.16 + near * 0.4})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
      }
    }
  };
  portrait.onload = () => {
    const c = document.createElement("canvas");
    c.width = portrait.naturalWidth; c.height = portrait.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(portrait, 0, 0);
    portraitData = g.getImageData(0, 0, c.width, c.height);
    drawDots();
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
  addEventListener("resize", queueDots);

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
  const flip = () => { flipped = !flipped; body.style.setProperty("--flip", flipped ? "180deg" : "0deg"); };
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
    video.dataset.src = `assets/video/${w.id}.mp4`;
    video.dataset.poster = `assets/poster/${w.id}.jpg`;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    board.append(el);
    return { el, video, data: w, ratio };
  });

  const seen = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        if (!target.src && target.dataset.src) target.src = target.dataset.src;
        target.play().catch(() => {});
      } else target.pause();
    });
  }, { rootMargin: "12% 0px" });
  tiles.forEach((t) => seen.observe(t.video));
  // постеры подгружаем заранее, но не всей пачкой при открытии
  const near = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      target.poster = target.dataset.poster;
      near.unobserve(target);
    });
  }, { rootMargin: "120% 0px" });
  tiles.forEach((t) => near.observe(t.video));
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
    if (!lightbox.open) lightbox.showModal();
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
  lightbox.addEventListener("close", () => { place = -1; lightbox.classList.remove("has-nav"); lightVideo.pause(); lightVideo.removeAttribute("src"); lightVideo.load(); lenis && lenis.start(); });
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
      await navigator.clipboard.writeText("evgeniishats8@gmail.com");
      copy.textContent = I18N.t("end.copied", "скопировано");
      setTimeout(() => { copy.textContent = I18N.t("end.copy", "скопировать"); }, 1600);
    } catch (e) { location.href = "mailto:evgeniishats8@gmail.com"; }
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
        const src = `assets/video/${li.dataset.preview}.mp4`;
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
