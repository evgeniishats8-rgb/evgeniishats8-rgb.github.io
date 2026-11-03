/* Главная: рабочий граф генерации. Скролл крутит шаги сэмплера,
   кадр проявляется из шума в Preview, голограмма живёт в ноде LoRA. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => t * t * (3 - 2 * t);
  const { SCENES } = window.SITE;
  const STEPS = 50;

  let stageVisible = true;
  const live = { video: null, id: "", d: 0, cover: null };
  const stage = $(".hero__stage");
  const preview = $(".preview");
  const canvas = $(".preview__canvas");
  const srcBox = $(".hero__src");
  const facebox = $(".facebox");
  const faceTag = $(".facebox__tag");
  const out = {
    prompt: $(".prompt__text"), file: $(".preview__file"), seed: $(".v-seed"), steps: $(".v-steps"),
    denoise: $(".v-denoise"), speed: $(".v-speed"), latent: $(".v-latent"), image: $(".v-image"),
    log: $(".log"), count: $(".log__count"),
  };
  const hint = $(".preview__hint");
  const grid = $(".grid50");
  grid.innerHTML = "<i></i>".repeat(STEPS);
  const cells = [...grid.children];

  const videos = SCENES.map((s, i) => {
    const v = document.createElement("video");
    Object.assign(v, { muted: true, loop: true, playsInline: true, preload: i < 2 ? "auto" : "none" });
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.src = `assets/video/${s.id}.mp4`;
    srcBox.append(v);
    return v;
  });

  /* провода между нодами */
  const svg = $(".wires");
  const LINKS = [["lora", "sampler"], ["prompt", "sampler"], ["sampler-out", "vae"], ["vae-out", "log"], ["vae-out", "preview", true]];
  const paths = LINKS.map(() => {
    const base = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pulse = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pulse.setAttribute("class", "pulse");
    svg.append(base, pulse);
    return { base, pulse, length: 1 };
  });
  const portAt = (name) => {
    const r = $(`[data-port="${name}"]`).getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { x: r.left + r.width / 2 - s.left, y: r.top + r.height / 2 - s.top };
  };
  const layoutWires = () => {
    if (innerWidth <= 820) return;
    LINKS.forEach(([a, b, up], i) => {
      const p = portAt(a), q = portAt(b);
      const k = Math.max(40, Math.abs(q.x - p.x) * 0.5);
      const d = up
        ? `M${p.x} ${p.y} C${p.x + 40} ${p.y} ${q.x} ${q.y + 80} ${q.x} ${q.y}`
        : `M${p.x} ${p.y} C${p.x + k} ${p.y} ${q.x - k} ${q.y} ${q.x} ${q.y}`;
      paths[i].base.setAttribute("d", d);
      paths[i].pulse.setAttribute("d", d);
      paths[i].length = paths[i].base.getTotalLength();
    });
  };
  addEventListener("resize", layoutWires);
  document.fonts.ready.then(layoutWires);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const gl = !reduced && canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });

  /* промт как JSON: печатается по символу, подсветка считается на каждом шаге */
  const typeTimer = { id: 0 };
  const paint = (text) => text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/("[a-z_]+")(:)/g, "<i>$1</i>$2")
    .replace(/(: |\[| )(\d+(?:\.\d+)?)/g, "$1<em>$2</em>");
  const promptJson = (s) => JSON.stringify({
    subject: s.subject, scene: s.scene, camera: s.camera, seed: Number(s.seed), negative: ["camera", "film crew"],
  }, null, 1).replace('[\n  "camera",\n  "film crew"\n ]', '["camera", "film crew"]');
  const typePrompt = (text) => {
    cancelAnimationFrame(typeTimer.id);
    const started = performance.now();
    const step = (now) => {
      const n = Math.min(text.length, Math.floor((now - started) / 9));
      out.prompt.innerHTML = paint(text.slice(0, n));
      if (n < text.length) typeTimer.id = requestAnimationFrame(step);
    };
    typeTimer.id = requestAnimationFrame(step);
  };

  /* числа ноды и консоль считаются из одного значения шага */
  let lastStep = -1, lastScene = -1;
  const fmt = (t) => `00:${String(Math.floor(t)).padStart(2, "0")}`;
  const writeLog = (i, step, speed) => {
    const s = SCENES[i];
    const filled = "█".repeat(Math.round(step / STEPS * 12)).padEnd(12, "░");
    const lines = [
      "got prompt",
      `seed=${s.seed} cfg=7.0 steps=${STEPS}`,
      "lora: jdrobyshev_v7 @ 1.00",
      `${String(Math.round(step / STEPS * 100)).padStart(3, " ")}%|${filled}| ${step}/${STEPS} [${fmt(step / speed)}, ${speed.toFixed(2)}it/s]`,
    ];
    if (step === STEPS) lines.push(`vae ok, saved ${s.id}_00001.mp4`);
    out.log.textContent = lines.join("\n");
  };
  I18N.onChange(() => {
    if (lastScene < 0) return;
    const s = SCENES[lastScene];
    faceTag.textContent = I18N.face(s.tag);
  });
  const updateNumbers = (i, d) => {
    const step = Math.round(d * STEPS);
    if (i === lastScene && step === lastStep) return;
    const s = SCENES[i];
    const speed = 2.1 + (Number(s.seed) % 7) / 10;
    if (i !== lastScene) {
      typePrompt(promptJson(s));
      out.seed.textContent = s.seed;
      out.file.textContent = `${s.id}_00001.mp4`;
      $(".v-lora").textContent = `${s.lora}.safetensors`;
      faceTag.textContent = I18N.face(s.tag);
      out.count.textContent = `queue ${i + 1}/${SCENES.length}`;
    }
    lastScene = i; lastStep = step;
    out.steps.textContent = `${String(step).padStart(2, "0")}/${STEPS}`;
    out.denoise.textContent = (1 - d).toFixed(2);
    out.speed.textContent = `${speed.toFixed(2)} it/s`;
    cells.forEach((c, k) => {
      c.classList.toggle("is-on", k < step - 1);
      c.classList.toggle("is-now", k === step - 1 && step < STEPS);
    });
    writeLog(i, step, speed);
  };

  layoutWires();
  startRig();
  startDrag();

  if (!gl) {
    live.video = videos[0]; live.id = SCENES[0].id; live.d = 1;
    document.documentElement.classList.add("no-gl");
    videos[0].style.cssText = "width:100%;height:100%;object-fit:cover";
    preview.append(videos[0]);
    videos[0].play().catch(() => {});
    updateNumbers(0, 1);
    startHolo();
    return;
  }

  const vert = `#version 300 es
    in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
  const frag = `#version 300 es
    precision highp float;
    out vec4 outColor;
    uniform sampler2D uV;
    uniform vec2 uRes;
    uniform vec4 uCover;
    uniform float uD, uTime;

    float hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * .1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    void main() {
      vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
      vec2 suv = vec2(fc.x / uRes.x, fc.y / uRes.y);
      float d = uD;
      // латент: крупные блоки растворяются в кадр
      float block = floor(mix(uRes.x / 48., 1., pow(d, .55)));
      vec2 g = floor(fc / max(block, 1.));
      vec2 c = block <= 1. ? fc : (g + .5) * block;
      vec2 uv = vec2(c.x / uRes.x, c.y / uRes.y) * uCover.xy + uCover.zw;
      vec3 color = texture(uV, uv).rgb;
      float t = floor(uTime * 16.);
      vec3 noise = vec3(hash(g + t), hash(g + t + 11.3), hash(g + t + 27.7));
      vec3 fine = vec3(hash(fc + t));
      float amount = pow(1. - d, 1.6);
      vec3 latent = mix(noise, fine, .35);
      float gray = dot(color, vec3(.3, .59, .11));
      color = mix(vec3(gray), color, smoothstep(.45, .95, d));
      color = mix(color, latent, amount);
      if (d >= 1.) color = texture(uV, suv * uCover.xy + uCover.zw).rgb;
      outColor = vec4(color, 1.);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  ["uV", "uRes", "uCover", "uD", "uTime"].forEach((n) => { u[n] = gl.getUniformLocation(program, n); });

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([9, 9, 11, 255]));
  gl.uniform1i(u.uV, 0);

  let W = 0, H = 0;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const nextW = preview.clientWidth, nextH = preview.clientHeight;
    if (nextW === W && nextH === H) return;
    W = nextW; H = nextH;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    layoutWires();
  };
  new ResizeObserver(resize).observe(preview);
  resize();

  // сбой видеокарты: показываем обычное видео вместо шейдера
  const fallback = () => {
    document.documentElement.classList.add("no-gl");
    const v = videos[state.i];
    v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover";
    preview.append(v);
    v.play().catch(() => {});
  };
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; fallback(); });

  // постер на случай, если браузер не дал запустить видео
  const posters = SCENES.map((s) => { const im = new Image(); im.src = `assets/poster/${s.id}.jpg`; return im; });
  const resume = () => { if (state.inView) videos[state.i].play().catch(() => {}); };
  ["pointerdown", "touchstart", "keydown"].forEach((n) => addEventListener(n, resume, { passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) videos.forEach((v) => v.pause());
    else resume();
  });

  let tracks = {};
  fetch("assets/data/tracks.json").then((r) => r.json()).then((d) => { tracks = d; }).catch(() => {});

  const coverOf = (video, id) => {
    const vw = video.videoWidth || 1920, vh = video.videoHeight || 824;
    const s = Math.max(W / vw, H / vh);
    const sx = W / (vw * s), sy = H / (vh * s);
    const track = tracks[id];
    let focus = 0.5;
    if (track && track.focus.length) focus = track.focus[Math.floor(video.currentTime * track.fps / 3) % track.focus.length] ?? 0.5;
    const pos = sx < 1 ? clamp((focus - sx / 2) / (1 - sx)) : 0.5;
    return { sx, sy, ox: pos * (1 - sx), oy: 0.5 * (1 - sy) };
  };

  let lost = false;
  let uploadedTime = -1, uploadedScene = -1;
  let rerunAt = -9999;
  const state = { i: 0, d: 0, inView: true };
  const setProgress = (p) => {
    const beats = p * SCENES.length;
    const i = Math.min(SCENES.length - 1, Math.floor(beats));
    state.i = i;
    state.d = i === 0 ? 1 : ease(clamp((beats - i) / 0.5));
    videos.forEach((v, k) => {
      const wanted = k === i;
      if (k === i + 1 && v.preload !== "auto") v.preload = "auto";
      if (wanted) { v.preload = "auto"; if (v.paused && state.inView) v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    });
  };

  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom bottom",
    onUpdate: (st) => setProgress(st.progress),
    onToggle: (st) => {
      state.inView = st.isActive;
      stageVisible = st.isActive;
      if (!st.isActive) videos.forEach((v) => v.pause());
      else setProgress(st.progress);
    },
  });

  const bornAt = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!state.inView || lost || document.hidden) return;
    const time = (now - bornAt) / 1000;
    const video = videos[state.i];
    const scene = SCENES[state.i];
    // первая сцена проявляется сама при открытии
    let d = state.i === 0 ? Math.min(state.d, ease(clamp((time - 0.2) / 2.2))) : state.d;
    d = Math.min(d, ease(clamp((now - rerunAt) / 1900)));
    if (video.readyState >= 2) {
      if (video.currentTime !== uploadedTime || state.i !== uploadedScene) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        uploadedTime = video.currentTime; uploadedScene = state.i;
      }
    } else if (uploadedScene !== state.i && posters[state.i].complete && posters[state.i].naturalWidth) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, posters[state.i]);
    }
    const cover = coverOf(video, scene.id);
    gl.uniform4f(u.uCover, cover.sx, cover.sy, cover.ox, cover.oy);
    gl.uniform1f(u.uD, d);
    gl.uniform1f(u.uTime, time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    updateNumbers(state.i, d);
    hint.classList.toggle("is-off", scrollY > 40);
    live.video = video; live.id = scene.id; live.d = d; live.cover = cover;
    out.latent.textContent = `[1,16,${Math.round(video.videoHeight / 8) || 103},${Math.round(video.videoWidth / 8) || 240}]`;
    out.image.textContent = `${video.videoWidth || 1920}×${video.videoHeight || 824}`;

    // импульсы по проводам, пока идёт сэмплинг
    const running = d > 0.002 && d < 0.998;
    paths.forEach((p, k) => {
      p.pulse.style.opacity = running ? 1 : 0;
      if (running) p.pulse.style.strokeDashoffset = -((time * 150 + k * 40) % 153);
    });

    const track = tracks[scene.id];
    const box = track && d >= 1 ? track.box[Math.floor(video.currentTime * track.fps) % track.box.length] : null;
    const w = box ? box[2] * W / cover.sx * 1.28 : 0, h = box ? box[3] * H / cover.sy * 1.28 : 0;
    if (!box || h > H * 0.62) { facebox.style.opacity = 0; return; }
    const x = ((box[0] + box[2] / 2 - cover.ox) / cover.sx) * W - w / 2;
    const y = ((box[1] + box[3] / 2 - cover.oy) / cover.sy) * H - h / 2;
    facebox.style.opacity = 1;
    facebox.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    facebox.style.width = `${w.toFixed(1)}px`;
    facebox.style.height = `${h.toFixed(1)}px`;
  };

  /* кнопки графа */
  const beatY = (beats) => {
    const hero = $(".hero");
    return hero.offsetTop + (hero.offsetHeight - innerHeight) * (beats / SCENES.length);
  };
  $(".btn--queue").addEventListener("click", () => {
    if (state.i >= SCENES.length - 1) window.SITE.glide("#about");
    else window.SITE.glide(beatY(state.i + 1.6));
  });
  $(".btn--rerun").addEventListener("click", () => { rerunAt = performance.now(); });
  const openPreview = () => window.SITE.openWork(SCENES[state.i].id);
  preview.addEventListener("click", openPreview);
  preview.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPreview(); } });

  setProgress(0);
  updateNumbers(0, 0);
  videos[0].play().catch(() => {});
  requestAnimationFrame(frame);
  startHolo();

  /* ноды таскаются за шапку, провода идут за ними */
  function startDrag() {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const reset = $(".node__reset");
    const nodes = [...stage.querySelectorAll(".node")];
    let top = 2;
    nodes.forEach((node) => {
      const bar = $(".node__bar", node);
      let sx = 0, sy = 0, bx = 0, by = 0, box = null;
      bar.addEventListener("pointerdown", (e) => {
        if (e.button || e.target.closest("button") || innerWidth <= 820) return;
        const r = node.getBoundingClientRect(), s = stage.getBoundingClientRect();
        bx = gsap.getProperty(node, "x"); by = gsap.getProperty(node, "y");
        sx = e.clientX; sy = e.clientY;
        box = { x0: bx + s.left - r.left + 4, x1: bx + s.right - r.right - 4, y0: by + 34 + s.top - r.top, y1: by + s.bottom - r.bottom - 4 };
        node.style.zIndex = ++top;
        node.classList.add("is-drag");
        bar.setPointerCapture(e.pointerId);
      });
      bar.addEventListener("pointermove", (e) => {
        if (!box) return;
        gsap.set(node, { x: clamp(bx + e.clientX - sx, box.x0, box.x1), y: clamp(by + e.clientY - sy, box.y0, box.y1) });
        layoutWires();
        reset.hidden = false;
      });
      const end = () => { box = null; node.classList.remove("is-drag"); };
      bar.addEventListener("pointerup", end);
      bar.addEventListener("pointercancel", end);
    });
    reset.addEventListener("click", () => {
      gsap.to(nodes, { x: 0, y: 0, duration: 0.8, ease: "power3.out", onUpdate: layoutWires });
      reset.hidden = true;
    });
  }

  /* схематичная модель того, что сейчас в Preview: блоки по позе человека или по форме предмета */
  function startRig() {
    const c = $(".rig__canvas");
    const g = c.getContext("2d");
    const nameEl = $(".rig__name"), noteEl = $(".rig__note");
    const SPINE = 7;
    let rigs = null, W2 = 0, H2 = 0, dpr2 = 1;
    const fit = { x: 0.5, y: 0.5, w: 0.3, h: 0.3, ready: false };
    const size = () => {
      dpr2 = Math.min(devicePixelRatio || 1, 2);
      W2 = c.clientWidth; H2 = c.clientHeight;
      c.width = Math.round(W2 * dpr2); c.height = Math.round(H2 * dpr2);
    };
    new ResizeObserver(size).observe(c);
    size();
    fetch("assets/data/rigs.json").then((r) => r.json()).then((d) => { rigs = d; }).catch(() => {});
    const blend = (rig, t) => {
      const n = rig.pts.length;
      const a = Math.floor(t) % n, b = (a + 1) % n;
      const pa = rig.pts[a], pb = rig.pts[b];
      if (!pa) return null;
      if (!pb || rig.kinds[a] !== rig.kinds[b] || rig.cuts.includes(b)) return { pts: pa, kind: rig.kinds[a] };
      const f = t - Math.floor(t);
      return { pts: pa.map((v, i) => v + (pb[i] - v) * f), kind: rig.kinds[a] };
    };
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (!rigs || !W2 || !stageVisible || document.hidden || !live.video) return;
      const rig = rigs[live.id];
      g.setTransform(dpr2, 0, 0, dpr2, 0, 0);
      g.clearRect(0, 0, W2, H2);
      if (!rig) return;
      const pose = live.d < 0.35 ? null : blend(rig, live.video.currentTime * rig.fps);
      nameEl.textContent = pose ? (pose.kind === "h" ? "HUMAN_BLOCK" : "OBJECT_BLOCK") : "";
      if (!pose) { noteEl.textContent = ""; return; }
      const vw = live.video.videoWidth || 1920, vh = live.video.videoHeight || 824;
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (let i = 0; i < pose.pts.length; i += 2) {
        x0 = Math.min(x0, pose.pts[i]); x1 = Math.max(x1, pose.pts[i]);
        y0 = Math.min(y0, pose.pts[i + 1]); y1 = Math.max(y1, pose.pts[i + 1]);
      }
      // рамка модели меняется плавно, иначе блоки дёргаются вместе с позой
      const k = fit.ready ? 0.12 : 1;
      fit.x += ((x0 + x1) / 2 - fit.x) * k; fit.y += ((y0 + y1) / 2 - fit.y) * k;
      fit.w += ((x1 - x0) - fit.w) * k; fit.h += ((y1 - y0) - fit.h) * k;
      fit.ready = true;
      const s = Math.min((W2 - 40) / (Math.max(fit.w, 0.05) * vw), (H2 - 40) / (Math.max(fit.h, 0.05) * vh));
      const ox = W2 / 2 - fit.x * vw * s - 3, oy = H2 / 2 - fit.y * vh * s + 2;
      const px = (i) => ox + pose.pts[i * 2] * vw * s, py = (i) => oy + pose.pts[i * 2 + 1] * vh * s;
      // кубик из четырёх углов и глубины: глубина плавно ходит, поэтому блоки выглядят объёмными
      const turn = now / 1700;
      const depth = { x: Math.sin(turn) * 8, y: -5 - Math.cos(turn) * 1.5 };
      const cube = (c) => {
        const back = c.map(([x, y]) => [x + depth.x, y + depth.y]);
        const path = (q) => { g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
        path(back); g.strokeStyle = "rgba(143,214,255,.3)"; g.stroke();
        c.forEach((p, i) => {
          const n = (i + 1) % 4;
          path([p, c[n], back[n], back[i]]);
          g.fillStyle = "rgba(143,214,255,.07)"; g.fill();
          g.strokeStyle = "rgba(143,214,255,.45)"; g.stroke();
        });
        path(c); g.fillStyle = "rgba(15,16,19,.86)"; g.fill();
        g.fillStyle = "rgba(143,214,255,.13)"; g.fill();
        g.strokeStyle = "#8fd6ff"; g.stroke();
      };
      const bar = (p, q, w) => {
        const x0 = px(p), y0 = py(p), x1 = px(q), y1 = py(q);
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const nx = (-(y1 - y0) / len) * w / 2, ny = ((x1 - x0) / len) * w / 2;
        return [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
      };
      const boxes = [];
      if (pose.kind === "h") {
        const shoulder = Math.max(5, Math.hypot(px(1) - px(2), py(1) - py(2)));
        const limb = Math.max(2.5, shoulder * 0.3);
        boxes.push(bar(7, 9, limb), bar(8, 10, limb), bar(9, 11, limb * 0.8), bar(10, 12, limb * 0.8));
        boxes.push([[px(1), py(1)], [px(2), py(2)], [px(8), py(8)], [px(7), py(7)]]);
        const hx = px(0), hy = py(0), r = shoulder * 0.34;
        boxes.push([[hx - r, hy - r], [hx + r, hy - r], [hx + r, hy + r], [hx - r, hy + r]]);
        boxes.push(bar(1, 3, limb), bar(2, 4, limb), bar(3, 5, limb * 0.8), bar(4, 6, limb * 0.8));
      } else {
        for (let i = 0; i < SPINE - 1; i++) {
          const gap = 0.08;
          const mix = (a, b, t) => [px(a) + (px(b) - px(a)) * t, py(a) + (py(b) - py(a)) * t];
          boxes.push([mix(SPINE + i, SPINE + i + 1, gap), mix(SPINE + i + 1, SPINE + i, gap), mix(SPINE * 2 + i + 1, SPINE * 2 + i, gap), mix(SPINE * 2 + i, SPINE * 2 + i + 1, gap)]);
        }
      }
      noteEl.textContent = `boxes ${boxes.length} · cameras 0`;
      g.globalAlpha = Math.min(1, (live.d - 0.35) * 3);
      g.lineWidth = 1;
      boxes.forEach(cube);
      g.globalAlpha = 1;
    };
    requestAnimationFrame(loop);
  }

  /* частицы: тот же ролик как облако точек. Глубина из яркости, объект отделён от фона */
  function startHolo() {
    const c = $(".holo");
    const g = !reduced && c.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!g) return;
    const GRID_X = 260, GRID_Y = 112;
    const vs = `#version 300 es
      in vec2 aUv;
      uniform sampler2D uT;
      uniform float uTime, uAspect, uDpr, uSpin, uD, uBg, uRatio, uFocus;
      out float vA;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 c = texture(uT, aUv).rgb;
        float l = dot(c, vec3(.3, .59, .11));
        float diff = abs(l - uBg);
        float seen = smoothstep(.07, .3, diff);
        float scatter = pow(1. - uD, 1.5);
        vec3 p = vec3((aUv.x - uFocus) * 2. * 1.75, (.5 - aUv.y) * 2. * 1.75 / uRatio, (diff - .22) * .9);
        p += (vec3(hash(aUv), hash(aUv + 3.1), hash(aUv + 7.7)) - .5) * scatter * 1.7;
        float ca = cos(uSpin), sa = sin(uSpin);
        p = vec3(p.x * ca + p.z * sa, p.y, -p.x * sa + p.z * ca);
        float band = smoothstep(.04, 0., abs(fract(aUv.y * .9 - uTime * .12) - .5));
        float depth = 1. / (2.5 - p.z);
        vA = (.1 + seen * (.55 + l * .5)) * mix(1., .55, scatter) + band * seen * .7;
        gl_Position = vec4(p.x * depth * 2.2 / uAspect, p.y * depth * 2.2, 0., 1.);
        gl_PointSize = (1.2 + seen * .5) * uDpr;
      }`;
    const fs = `#version 300 es
      precision mediump float;
      in float vA; out vec4 o;
      void main() { o = vec4(.56, .84, 1., vA); }`;
    const make = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return s; };
    const prog = g.createProgram();
    g.attachShader(prog, make(g.VERTEX_SHADER, vs));
    g.attachShader(prog, make(g.FRAGMENT_SHADER, fs));
    g.linkProgram(prog);
    g.useProgram(prog);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE);
    const grid = new Float32Array(GRID_X * GRID_Y * 2);
    for (let y = 0, i = 0; y < GRID_Y; y++) for (let x = 0; x < GRID_X; x++) { grid[i++] = (x + 0.5) / GRID_X; grid[i++] = (y + 0.5) / GRID_Y; }
    g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
    g.bufferData(g.ARRAY_BUFFER, grid, g.STATIC_DRAW);
    const aUv = g.getAttribLocation(prog, "aUv");
    g.enableVertexAttribArray(aUv);
    g.vertexAttribPointer(aUv, 2, g.FLOAT, false, 0, 0);
    const u2 = {};
    ["uT", "uTime", "uAspect", "uDpr", "uSpin", "uD", "uBg", "uRatio", "uFocus"].forEach((n) => { u2[n] = g.getUniformLocation(prog, n); });
    const tex2 = g.createTexture();
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, tex2);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.uniform1i(u2.uT, 0);
    $(".v-points").textContent = (GRID_X * GRID_Y).toLocaleString("en").replace(",", " ");
    // маленькая копия кадра: и текстура для точек, и оценка фона по краям
    const small = document.createElement("canvas");
    small.width = GRID_X; small.height = GRID_Y;
    const sx = small.getContext("2d", { willReadFrequently: true });
    const tilt = { x: 0, tx: 0 };
    stage.addEventListener("pointermove", (e) => {
      const r = stage.getBoundingClientRect();
      tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.7;
    }, { passive: true });
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(c.clientWidth * dpr));
      c.height = Math.max(1, Math.round(c.clientHeight * dpr));
      g.viewport(0, 0, c.width, c.height);
      g.uniform1f(u2.uAspect, c.width / c.height);
      g.uniform1f(u2.uDpr, dpr);
    };
    new ResizeObserver(size).observe(c);
    size();
    const depthEl = $(".v-az");
    const started = performance.now();
    let last = -1, bg = 0.5;
    const loop = (now) => {
      requestAnimationFrame(loop);
      const video = live.video;
      if (!video || !stageVisible || document.hidden || video.readyState < 2) return;
      if (video.currentTime !== last && now - (loop.at || 0) > 50) {
        last = video.currentTime; loop.at = now;
        sx.drawImage(video, 0, 0, GRID_X, GRID_Y);
        const data = sx.getImageData(0, 0, GRID_X, GRID_Y).data;
        const edge = [];
        for (let x = 0; x < GRID_X; x += 6) {
          [0, GRID_Y - 1].forEach((y) => {
            const i = (y * GRID_X + x) * 4;
            edge.push((data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255);
          });
        }
        edge.sort((p, q) => p - q);
        bg += (edge[edge.length >> 1] - bg) * 0.3;
        g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, small);
      }
      tilt.x += (tilt.tx - tilt.x) * 0.06;
      const time = (now - started) / 1000;
      const spin = Math.sin(time * 0.35) * 0.42 + tilt.x;
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform1f(u2.uTime, time);
      g.uniform1f(u2.uSpin, spin);
      g.uniform1f(u2.uD, live.d);
      g.uniform1f(u2.uBg, bg);
      g.uniform1f(u2.uFocus, live.cover ? live.cover.ox + live.cover.sx / 2 : 0.5);
      g.uniform1f(u2.uRatio, (video.videoWidth || 1920) / (video.videoHeight || 824));
      g.drawArrays(g.POINTS, 0, GRID_X * GRID_Y);
      depthEl.textContent = spin.toFixed(2);
    };
    requestAnimationFrame(loop);
  }
})();
