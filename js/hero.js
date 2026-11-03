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

  const net = navigator.connection;
  const light = innerWidth <= 820 || (net && (net.saveData || /(^|-)[23]g/.test(net.effectiveType || "")));
  // качество снижается само, если устройство не успевает
  const quality = { level: 0, slow: 0 };
  const videos = SCENES.map((s, i) => {
    const v = document.createElement("video");
    Object.assign(v, { muted: true, loop: true, playsInline: true, preload: i < 2 ? "auto" : "none" });
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.src = `assets/video/${light ? "m/" : ""}${s.id}.mp4`;
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
      `lora: ${s.lora} @ 1.00`,
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

  /* Preview: готовый кадр рисуется одним слоем видео. На смене сцены кадр рассыпается на частицы,
     они плавно текут и собираются в следующий ролик. Цвет частиц берётся прямо из двух роликов. */
  const quadVs = `#version 300 es
    in vec2 p; out vec2 vUv;
    void main() { vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
  const quadFs = `#version 300 es
    precision highp float;
    in vec2 vUv; out vec4 outColor;
    uniform sampler2D uV;
    uniform vec4 uCover;
    uniform float uAlpha;
    void main() { outColor = vec4(texture(uV, vUv * uCover.xy + uCover.zw).rgb, uAlpha); }`;
  const dotVs = `#version 300 es
    in vec2 aUv;
    uniform sampler2D uA, uB;
    uniform vec4 uCoverA, uCoverB;
    uniform float uS, uCross, uTime, uSize;
    out vec3 vColor;
    out float vAlpha;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec3 a = texture(uA, aUv * uCoverA.xy + uCoverA.zw).rgb;
      vec3 b = texture(uB, aUv * uCoverB.xy + uCoverB.zw).rgb;
      vec3 c = mix(a, b, uCross);
      float seed = hash(aUv);
      // частицы отрываются не разом, а волной
      float s = smoothstep(0., 1., clamp(uS * 1.5 - seed * .5, 0., 1.));
      float l = dot(c, vec3(.3, .59, .11));
      vec2 p = vec2(aUv.x * 2. - 1., 1. - aUv.y * 2.);
      vec2 flow = vec2(
        sin(p.y * 2.7 + seed * 6.28 + uTime * .55) + .55 * sin(p.y * 6.3 - uTime * .35 + seed * 3.),
        cos(p.x * 2.3 - seed * 6.28 + uTime * .5) + .55 * cos(p.x * 5.7 + uTime * .3 + seed * 3.)
      );
      vec2 q = p + flow * s * .62 + p * (l - .5) * s * .55;
      float depth = 1. + s * (seed - .5) * .85;
      gl_Position = vec4(q / depth, 0., 1.);
      gl_PointSize = uSize * mix(1., .5 + seed * .75, s) / depth;
      vColor = c;
      vAlpha = 1. - s * .3;
    }`;
  const dotFs = `#version 300 es
    precision mediump float;
    in vec3 vColor; in float vAlpha; out vec4 outColor;
    void main() {
      float r = length(gl_PointCoord - .5);
      if (r > .5) discard;
      outColor = vec4(vColor, vAlpha * smoothstep(.5, .36, r));
    }`;

  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh));
    return sh;
  };
  const makeProgram = (vs, fs, names) => {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    const u = { program };
    names.forEach((n) => { u[n] = gl.getUniformLocation(program, n); });
    return u;
  };
  const quad = makeProgram(quadVs, quadFs, ["uV", "uCover", "uAlpha"]);
  const dots = makeProgram(dotVs, dotFs, ["uA", "uB", "uCoverA", "uCoverB", "uS", "uCross", "uTime", "uSize"]);

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const quadLoc = gl.getAttribLocation(quad.program, "p");
  gl.enableVertexAttribArray(quadLoc);
  gl.vertexAttribPointer(quadLoc, 2, gl.FLOAT, false, 0, 0);

  const dotVao = gl.createVertexArray();
  const dotBuffer = gl.createBuffer();
  gl.bindVertexArray(dotVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
  const dotLoc = gl.getAttribLocation(dots.program, "aUv");
  gl.enableVertexAttribArray(dotLoc);
  gl.vertexAttribPointer(dotLoc, 2, gl.FLOAT, false, 0, 0);

  const slots = [0, 1].map((unit) => {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([9, 9, 11, 255]));
    return { unit, tex, scene: -1, time: -1, w: 0, h: 0 };
  });
  gl.useProgram(dots.program);
  gl.uniform1i(dots.uA, 0);
  gl.uniform1i(dots.uB, 1);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let W = 0, H = 0, dotCount = 0, dotSize = 4;
  const buildGrid = (dpr) => {
    const cell = (light ? 4.2 : 2.8) * (1 + quality.level * 0.5);
    const gx = Math.ceil(W / cell), gy = Math.ceil(H / cell);
    const grid = new Float32Array(gx * gy * 2);
    for (let y = 0, i = 0; y < gy; y++) {
      for (let x = 0; x < gx; x++) { grid[i++] = (x + 0.5) / gx; grid[i++] = (y + 0.5) / gy; }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dotBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
    dotCount = gx * gy;
    dotSize = cell * dpr * 1.6;
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const nextW = preview.clientWidth, nextH = preview.clientHeight;
    if (nextW === W && nextH === H) return;
    W = nextW; H = nextH;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildGrid(dpr);
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
  window.SITE.getJson("assets/data/tracks.json").then((d) => { tracks = d; }).catch(() => {});

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
  let lastNow = 0, shownVideo = null;
  let rerunAt = -9999;
  const IN = 0.42, OUT = 0.8;
  const state = { i: 0, beats: 0, inView: true };
  const setProgress = (p) => {
    const beats = p * SCENES.length;
    const i = Math.min(SCENES.length - 1, Math.floor(beats));
    const f = beats - i;
    state.i = i;
    state.beats = beats;
    videos.forEach((v, k) => {
      const wanted = k === i || (f > 0.74 && k === i + 1) || (f < 0.2 && k === i - 1);
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

  const dropQuality = () => {
    const dpr = quality.level ? 1 : Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildGrid(dpr);
  };
  addEventListener("scroll", () => hint.classList.toggle("is-off", scrollY > 40), { passive: true });

  /* кадр ролика в текстуру: только когда он реально сменился */
  const feed = (slot, index) => {
    const video = videos[index];
    gl.activeTexture(gl.TEXTURE0 + slot.unit);
    gl.bindTexture(gl.TEXTURE_2D, slot.tex);
    if (video.readyState >= 2) {
      if (video.currentTime === slot.time && index === slot.scene) return;
      if (video.videoWidth === slot.w && video.videoHeight === slot.h) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        slot.w = video.videoWidth; slot.h = video.videoHeight;
      }
      slot.time = video.currentTime; slot.scene = index;
    } else if (slot.scene !== index && posters[index].complete && posters[index].naturalWidth) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, posters[index]);
      slot.w = 0; slot.h = 0; slot.scene = index; slot.time = -1;
    }
  };
  const soft = (t) => t * t * (3 - 2 * t);

  const bornAt = performance.now();
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!state.inView || lost || document.hidden) { lastNow = 0; return; }
    if (lastNow) {
      const dt = now - lastNow;
      quality.slow = dt > 26 ? quality.slow + 1 : Math.max(0, quality.slow - 0.5);
      if (quality.slow > 90 && quality.level < 2) {
        quality.level += 1; quality.slow = 0; dropQuality();
      }
    }
    lastNow = now;
    const time = (now - bornAt) / 1000;
    const i = state.i;
    const f = state.beats - i;
    const isLast = i === SCENES.length - 1;
    const video = videos[i];
    const scene = SCENES[i];

    // сколько кадр рассыпан: 0 готовый кадр, 1 облако частиц
    let scatter = 0, a = i, b = i, cross = 0;
    if (i > 0 && f < IN) scatter = 1 - ease(f / IN);
    if (!isLast && f > OUT) scatter = ease((f - OUT) / (1 - OUT));
    if (!isLast && f > 0.84) { b = i + 1; cross = 0.5 * soft((f - 0.84) / 0.16); }
    if (i > 0 && f < 0.16) { a = i - 1; cross = 0.5 + 0.5 * soft(f / 0.16); }
    const intro = 1 - ease(clamp((time - 0.2) / 2.2));
    const again = 1 - ease(clamp((now - rerunAt) / 1900));
    scatter = Math.max(scatter, intro, again);
    let d = i === 0 ? 1 - intro : ease(clamp(f / IN));
    d = Math.min(d, 1 - again);

    feed(slots[0], a);
    if (b !== a) feed(slots[1], b);
    const coverA = coverOf(videos[a], SCENES[a].id);
    const coverB = b === a ? coverA : coverOf(videos[b], SCENES[b].id);
    const cover = coverOf(video, scene.id);

    gl.clearColor(0.035, 0.035, 0.043, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const video0 = cross < 0.5 ? 0 : 1;
    const solid = 1 - soft(clamp(scatter / 0.4));
    if (solid > 0) {
      gl.useProgram(quad.program);
      gl.bindVertexArray(quadVao);
      gl.uniform1i(quad.uV, video0);
      const c = video0 ? coverB : coverA;
      gl.uniform4f(quad.uCover, c.sx, c.sy, c.ox, c.oy);
      gl.uniform1f(quad.uAlpha, solid);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (scatter > 0.002) {
      gl.useProgram(dots.program);
      gl.bindVertexArray(dotVao);
      gl.uniform1i(dots.uB, b === a ? 0 : 1);
      gl.uniform4f(dots.uCoverA, coverA.sx, coverA.sy, coverA.ox, coverA.oy);
      gl.uniform4f(dots.uCoverB, coverB.sx, coverB.sy, coverB.ox, coverB.oy);
      gl.uniform1f(dots.uS, scatter);
      gl.uniform1f(dots.uCross, cross);
      gl.uniform1f(dots.uTime, time);
      gl.uniform1f(dots.uSize, dotSize);
      gl.drawArrays(gl.POINTS, 0, dotCount);
    }

    updateNumbers(i, d);
    live.video = video; live.id = scene.id; live.d = 1 - scatter; live.cover = cover;
    if (shownVideo !== video && video.videoWidth) {
      shownVideo = video;
      out.latent.textContent = `[1,16,${Math.round(video.videoHeight / 8)},${Math.round(video.videoWidth / 8)}]`;
      out.image.textContent = `${video.videoWidth}×${video.videoHeight}`;
    }

    // импульсы по проводам, пока идёт сэмплинг
    const running = scatter > 0.002;
    paths.forEach((p, k) => {
      p.pulse.style.opacity = running ? 1 : 0;
      if (running) p.pulse.style.strokeDashoffset = -((time * 150 + k * 40) % 153);
    });

    const track = tracks[scene.id];
    const box = track && scatter === 0 ? track.box[Math.floor(video.currentTime * track.fps) % track.box.length] : null;
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

  /* десять блоков живут постоянно и перетекают: поза в позу, человек в предмет, сцена в сцену */
  function startRig() {
    const c = $(".rig__canvas");
    const g = c.getContext("2d");
    const nameEl = $(".rig__name"), noteEl = $(".rig__note");
    const COUNT = 10, SPINE = 7;
    let rigs = null, W2 = 0, H2 = 0, dpr2 = 1, last = 0;
    const fit = { x: 0.5, y: 0.5, w: 0.3, h: 0.3 };
    // у каждого блока четыре угла, они всегда плывут к текущей цели
    const blocks = Array.from({ length: COUNT }, () => Array.from({ length: 4 }, () => [0, 0]));
    let placed = false;
    const size = () => {
      dpr2 = Math.min(devicePixelRatio || 1, 2);
      W2 = c.clientWidth; H2 = c.clientHeight;
      c.width = Math.round(W2 * dpr2); c.height = Math.round(H2 * dpr2);
    };
    new ResizeObserver(size).observe(c);
    size();
    window.SITE.getJson("assets/data/rigs.json").then((d) => { rigs = d; }).catch(() => {});

    const blend = (rig, t) => {
      const n = rig.pts.length;
      const a = Math.floor(t) % n, b = (a + 1) % n;
      const pa = rig.pts[a], pb = rig.pts[b];
      if (!pa) return null;
      if (!pb || rig.kinds[a] !== rig.kinds[b] || rig.cuts.includes(b)) return { pts: pa, kind: rig.kinds[a] };
      const f = t - Math.floor(t);
      return { pts: pa.map((v, i) => v + (pb[i] - v) * f), kind: rig.kinds[a] };
    };
    // пока идёт шум, блоки собираются в аккуратную стопку и ждут новую форму
    const stack = (time) => Array.from({ length: COUNT }, (_, i) => {
      const side = Math.min(W2, H2) * 0.17;
      const col = i % 5, row = Math.floor(i / 5);
      const x = W2 / 2 + (col - 2) * side * 1.22 + Math.sin(time * 0.9 + i) * 2;
      const y = H2 / 2 + (row - 0.5) * side * 1.22 + Math.cos(time * 0.7 + i) * 2;
      const r = side / 2;
      return [[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]];
    });
    const targets = (pose, vw, vh) => {
      let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (let i = 0; i < pose.pts.length; i += 2) {
        x0 = Math.min(x0, pose.pts[i]); x1 = Math.max(x1, pose.pts[i]);
        y0 = Math.min(y0, pose.pts[i + 1]); y1 = Math.max(y1, pose.pts[i + 1]);
      }
      fit.x += ((x0 + x1) / 2 - fit.x) * 0.08; fit.y += ((y0 + y1) / 2 - fit.y) * 0.08;
      fit.w += ((x1 - x0) - fit.w) * 0.08; fit.h += ((y1 - y0) - fit.h) * 0.08;
      const s = Math.min((W2 - 40) / (Math.max(fit.w, 0.05) * vw), (H2 - 40) / (Math.max(fit.h, 0.05) * vh));
      const ox = W2 / 2 - fit.x * vw * s - 3, oy = H2 / 2 - fit.y * vh * s + 2;
      const px = (i) => ox + pose.pts[i * 2] * vw * s, py = (i) => oy + pose.pts[i * 2 + 1] * vh * s;
      if (pose.kind === "h") {
        const bar = (p, q, w) => {
          const ax = px(p), ay = py(p), bx = px(q), by = py(q);
          const len = Math.hypot(bx - ax, by - ay) || 1;
          const nx = (-(by - ay) / len) * w / 2, ny = ((bx - ax) / len) * w / 2;
          return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
        };
        const shoulder = Math.max(5, Math.hypot(px(1) - px(2), py(1) - py(2)));
        const limb = Math.max(2.5, shoulder * 0.3);
        const hx = px(0), hy = py(0), r = shoulder * 0.34;
        return [
          bar(7, 9, limb), bar(8, 10, limb), bar(9, 11, limb * 0.8), bar(10, 12, limb * 0.8),
          [[px(1), py(1)], [px(2), py(2)], [px(8), py(8)], [px(7), py(7)]],
          [[hx - r, hy - r], [hx + r, hy - r], [hx + r, hy + r], [hx - r, hy + r]],
          bar(1, 3, limb), bar(2, 4, limb), bar(3, 5, limb * 0.8), bar(4, 6, limb * 0.8),
        ];
      }
      // предмет: те же десять блоков вдоль формы
      const rail = (start, t) => {
        const f = t * (SPINE - 1), i = Math.min(SPINE - 2, Math.floor(f)), k = f - i;
        return [px(start + i) + (px(start + i + 1) - px(start + i)) * k, py(start + i) + (py(start + i + 1) - py(start + i)) * k];
      };
      return Array.from({ length: COUNT }, (_, i) => {
        const a = (i + 0.08) / COUNT, b = (i + 0.92) / COUNT;
        return [rail(SPINE, a), rail(SPINE, b), rail(SPINE * 2, b), rail(SPINE * 2, a)];
      });
    };
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (!W2 || !stageVisible || document.hidden || !live.video) { last = now; return; }
      if (quality.level > 1 && now - (loop.at || 0) < 33) return;
      loop.at = now;
      const dt = Math.min(60, now - last || 16); last = now;
      const time = now / 1000;
      const rig = rigs && rigs[live.id];
      const pose = rig && live.d >= 0.35 ? blend(rig, live.video.currentTime * rig.fps) : null;
      const vw = live.video.videoWidth || 1920, vh = live.video.videoHeight || 824;
      const goal = pose ? targets(pose, vw, vh) : stack(time);
      if (!placed) { goal.forEach((b, i) => b.forEach((p, k) => { blocks[i][k][0] = p[0]; blocks[i][k][1] = p[1]; })); placed = true; }
      // плавное течение к цели: на смене плана блоки не прыгают, а перестраиваются
      const follow = 1 - Math.exp(-dt / 150);
      blocks.forEach((b, i) => b.forEach((p, k) => {
        p[0] += (goal[i][k][0] - p[0]) * follow;
        p[1] += (goal[i][k][1] - p[1]) * follow;
      }));
      nameEl.textContent = pose ? (pose.kind === "h" ? "HUMAN_BLOCK" : "OBJECT_BLOCK") : "ASSEMBLING";
      noteEl.textContent = `boxes ${COUNT} · cameras 0`;
      const turn = now / 1700;
      const dx = Math.sin(turn) * 8, dy = -5 - Math.cos(turn) * 1.5;
      g.setTransform(dpr2, 0, 0, dpr2, 0, 0);
      g.clearRect(0, 0, W2, H2);
      g.lineWidth = 1;
      const path = (q) => { g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
      blocks.forEach((face) => {
        const back = face.map(([x, y]) => [x + dx, y + dy]);
        path(back); g.strokeStyle = "rgba(143,214,255,.3)"; g.stroke();
        face.forEach((p, i) => {
          const n = (i + 1) % 4;
          path([p, face[n], back[n], back[i]]);
          g.fillStyle = "rgba(143,214,255,.07)"; g.fill();
          g.strokeStyle = "rgba(143,214,255,.45)"; g.stroke();
        });
        path(face); g.fillStyle = "rgba(15,16,19,.86)"; g.fill();
        g.fillStyle = "rgba(143,214,255,.13)"; g.fill();
        g.strokeStyle = "#8fd6ff"; g.stroke();
      });
    };
    requestAnimationFrame(loop);
  }

  /* частицы: тот же ролик как облако точек. Глубина из яркости, объект отделён от фона */
  function startHolo() {
    const c = $(".holo");
    const g = !reduced && c.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!g) return;
    const GRID_X = light ? 130 : 200, GRID_Y = light ? 56 : 86;
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
    small.width = 130; small.height = 56;
    const sx = small.getContext("2d", { willReadFrequently: true });
    let sampled = 0;
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
      const every = quality.level === 0 ? 66 : quality.level === 1 ? 110 : 220;
      if (video.currentTime !== last && now - (loop.at || 0) > every) {
        last = video.currentTime; loop.at = now;
        sx.drawImage(video, 0, 0, small.width, small.height);
        if (now - sampled > 400) {
          sampled = now;
          const data = sx.getImageData(0, 0, small.width, small.height).data;
          const edge = [];
          for (let x = 0; x < small.width; x += 4) {
            [0, small.height - 1].forEach((y) => {
              const i = (y * small.width + x) * 4;
              edge.push((data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255);
            });
          }
          edge.sort((p, q) => p - q);
          bg += (edge[edge.length >> 1] - bg) * 0.4;
        }
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
      if (now - (loop.text || 0) > 200) { loop.text = now; depthEl.textContent = spin.toFixed(2); }
    };
    requestAnimationFrame(loop);
  }
})();
