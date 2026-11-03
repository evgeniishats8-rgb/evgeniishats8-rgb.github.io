/* Блок «Под капотом»: один кадр MULE-4 в трёх видах.
   В файле mule_passes.mp4 проходы лежат друг под другом, поэтому они всегда синхронны.
   Кости и кривые ног взяты из настоящей сцены Blender (assets/data/mule.json). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const PANEL_W = 1280, PANEL_H = 536;
  const PASS = { wire: 0, rig: 1, render: 2 };
  const HOLO = "#8fd6ff";
  const LABELS = ["hip_FL", "knee_FR", "ankle_RL", "crane_arm", "head_yaw"];

  const section = $(".bl");
  const view = $(".bl__view");
  const video = $("video", view);
  const canvas = $("canvas", view);
  const ctx = canvas.getContext("2d");
  const timeCanvas = $(".bl__time canvas");
  const tx = timeCanvas.getContext("2d");
  const frameEl = $(".bl__frame");
  const hint = $(".bl__split");
  const tabs = $$(".bl__bar button");
  tabs.forEach((b) => b.classList.remove("is-on"));

  let data = null;
  let focus = null;
  let W = 0, H = 0, TW = 0, TH = 0, dpr = 1;
  let visible = false, lastPointer = -9999;
  const band = { a: 0.36, b: 0.64, ta: 0.36, tb: 0.64 };

  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = view.clientWidth; H = view.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    TW = timeCanvas.clientWidth; TH = timeCanvas.clientHeight;
    timeCanvas.width = Math.round(TW * dpr); timeCanvas.height = Math.round(TH * dpr);
  };
  new ResizeObserver(size).observe(view);
  size();

  const loadData = () => window.SITE.getJson("assets/data/mule.json").then((d) => {
    data = d;
    const tris = (d.stats.tris / 1e6).toFixed(1);
    $(".bl__stats").innerHTML = [["objects", d.stats.objects], ["parts", d.stats.parts], ["bones", d.stats.bones], ["tris", `${tris} M`]]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    const legs = ["FL", "FR", "RL", "RR"].flatMap((l) => [`hip_${l}`, `knee_${l}`, `ankle_${l}`]);
    $(".bl__tree").innerHTML = [
      "<li>MULE_ARM</li>", "<li class=is-sub>ROOT</li>",
      ...legs.slice(0, 9).map((n) => `<li class=is-sub>${n}</li>`),
      "<li class=is-sub>crane_arm</li>", "<li class=is-sub>head_yaw</li>",
      "<li>MARS</li>", "<li>FOOTPRINTS</li>", "<li>S1_arrive</li>",
    ].join("");
  }).catch(() => {});

  const seen = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) {
      if (!video.getAttribute("src")) {
        video.src = "assets/video/mule_passes.mp4";
        video.preload = "auto";
        loadData();
      }
      video.play().catch(() => {});
    } else video.pause();
  }, { rootMargin: "20% 0px" });
  seen.observe(section);
  document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); else if (visible) video.play().catch(() => {}); });
  let held = false;
  window.SITE.holds.push((on) => { held = on; if (on) video.pause(); else if (visible) video.play().catch(() => {}); });

  const place = (x) => {
    if (focus) return;
    band.ta = clamp(x - 0.13); band.tb = clamp(x + 0.13);
  };
  view.addEventListener("pointermove", (e) => {
    const r = view.getBoundingClientRect();
    place((e.clientX - r.left) / r.width);
    lastPointer = performance.now();
  }, { passive: true });

  tabs.forEach((b) => b.addEventListener("click", () => {
    const pass = b.dataset.pass;
    focus = focus === pass ? null : pass;
    tabs.forEach((t) => t.classList.toggle("is-on", t.dataset.pass === focus));
    if (focus === "wire") { band.ta = 1; band.tb = 1; }
    if (focus === "rig") { band.ta = 0; band.tb = 1; }
    if (focus === "render") { band.ta = 0; band.tb = 0; }
    lastPointer = focus ? performance.now() : -9999;
  }));

  /* вписываем панель в окно по правилу cover */
  const fit = () => {
    const s = Math.max(W / PANEL_W, H / PANEL_H);
    return { s, ox: (W - PANEL_W * s) / 2, oy: (H - PANEL_H * s) / 2 };
  };
  const drawPass = (pass, x0, x1, f) => {
    if (x1 <= x0) return;
    const px = (x0 - f.ox) / f.s, py = -f.oy / f.s;
    ctx.drawImage(video, px, PASS[pass] * PANEL_H + py, (x1 - x0) / f.s, H / f.s, x0, 0, x1 - x0, H);
  };

  const drawBones = (frame, f, clipA, clipB) => {
    const row = data.frames[frame];
    if (!row) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(clipA, 0, clipB - clipA, H); ctx.clip();
    ctx.font = `10px Mono, monospace`;
    const px = (i) => f.ox + row[i][0] * PANEL_W * f.s, py = (i) => f.oy + row[i][1] * PANEL_H * f.s;
    data.links.forEach(([p, q]) => {
      const x0 = px(p), y0 = py(p), x1 = px(q), y1 = py(q);
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len, w = Math.min(6, len * 0.1);
      const mx = x0 + (x1 - x0) * 0.2, my = y0 + (y1 - y0) * 0.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(mx + nx * w, my + ny * w); ctx.lineTo(x1, y1); ctx.lineTo(mx - nx * w, my - ny * w);
      ctx.closePath();
      ctx.fillStyle = "rgba(143,214,255,.28)"; ctx.fill();
      ctx.strokeStyle = HOLO; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(x1, y1, 2.6, 0, 6.283); ctx.fillStyle = "#e9e7e1"; ctx.fill();
      if (LABELS.includes(data.bones[q])) {
        ctx.fillStyle = "#e9e7e1";
        ctx.fillText(data.bones[q], x1 + 6, y1 + 3);
      }
    });
    ctx.restore();
  };

  const drawTimeline = (frame) => {
    tx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tx.clearRect(0, 0, TW, TH);
    const total = data.frames.length;
    const xOf = (n) => (n / (total - 1)) * (TW - 20) + 10;
    tx.font = "9px Mono, monospace";
    tx.fillStyle = "#5b5b59"; tx.strokeStyle = "rgba(233,231,225,.1)"; tx.lineWidth = 1;
    for (let n = 0; n < total; n += 10) {
      tx.beginPath(); tx.moveTo(xOf(n) + 0.5, 0); tx.lineTo(xOf(n) + 0.5, TH); tx.stroke();
      if (TW > 500) tx.fillText(n + 1, xOf(n) + 3, 9);
    }
    const all = Object.values(data.feet).flat();
    const lo = Math.min(...all), hi = Math.max(...all);
    Object.values(data.feet).forEach((curve, k) => {
      tx.beginPath();
      curve.forEach((v, n) => {
        const y = TH - 5 - ((v - lo) / (hi - lo || 1)) * (TH - 16);
        if (n) tx.lineTo(xOf(n), y); else tx.moveTo(xOf(n), y);
      });
      tx.strokeStyle = k < 2 ? "rgba(233,231,225,.55)" : "rgba(143,214,255,.6)";
      tx.stroke();
    });
    tx.fillStyle = HOLO;
    tx.fillRect(Math.round(xOf(frame)), 0, 1, TH);
  };

  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || held || document.hidden || video.readyState < 2 || !W) return;
    if (!focus && now - lastPointer > 2600) place(0.5 + 0.34 * Math.sin(now / 2600));
    band.a += (band.ta - band.a) * 0.1;
    band.b += (band.tb - band.b) * 0.1;
    const a = band.a * W, b = band.b * W;
    const f = fit();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "medium";
    drawPass("wire", 0, a, f);
    drawPass("rig", a, b, f);
    drawPass("render", b, W, f);
    const frame = data ? Math.floor(video.currentTime * data.fps) % data.frames.length : 0;
    if (data) {
      drawBones(frame, f, a, b);
      drawTimeline(frame);
      frameEl.textContent = `frame ${String(frame + 1).padStart(3, "0")}/${String(data.frames.length).padStart(3, "0")} · S1_arrive`;
    }
    ctx.fillStyle = HOLO;
    if (a > 0.5 && a < W - 0.5) ctx.fillRect(Math.round(a), 0, 1, H);
    if (b > 0.5 && b < W - 0.5) ctx.fillRect(Math.round(b), 0, 1, H);
    hint.style.opacity = now - lastPointer < 2600 ? 0 : 1;
  };
  requestAnimationFrame(loop);
})();
