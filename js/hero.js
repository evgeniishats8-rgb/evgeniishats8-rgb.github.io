/* Главная: рабочий граф генерации. Очередь идёт сама: кадр в Preview распадается на однотонные
   частицы, они собирают следующий шот, и он наливается цветом. Голограмма живёт в ноде LoRA. */
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
      // нода может быть скрыта на этой ширине, тогда и провода к ней нет
      if (![a, b].every((name) => $(`[data-port="${name}"]`).offsetParent)) {
        paths[i].base.removeAttribute("d");
        paths[i].pulse.removeAttribute("d");
        paths[i].length = 0;
        return;
      }
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

  /* кадр стоит HOLD, затем идёт переход на FLOW: кадр распадается на однотонные частицы, к CLOUD это облако,
     к FORMED они собрали следующий шот, дальше он наливается цветом */
  const HOLD = 4000, FLOW = 3400, CLOUD = 0.38, FORMED = 0.76, PATIENCE = 3000;
  const state = { i: 0, restAt: 0, inView: true, held: false, active: true };
  const flow = { on: false, from: 0, to: 0, at: 0, warm: false };
  const nextOf = (i) => (i + 1) % SCENES.length;
  const syncVideos = () => {
    const next = nextOf(state.i);
    videos[next].preload = "auto";
    videos.forEach((v, k) => {
      const wanted = k === state.i || (flow.on && (k === flow.from || k === flow.to)) || (flow.warm && k === next);
      if (wanted && state.active) { v.preload = "auto"; if (v.paused) v.play().catch(() => {}); }
      else if (!v.paused) v.pause();
    });
  };
  const startFlow = (to, at = performance.now()) => {
    Object.assign(flow, { on: true, from: state.i, to, at, warm: false });
    syncVideos();
  };
  const wake = () => {
    const was = state.active;
    state.active = state.inView && !state.held && !document.hidden;
    stageVisible = state.active;
    if (state.active && !was) state.restAt = performance.now();
    syncVideos();
  };
  new IntersectionObserver(([e]) => { state.inView = e.isIntersecting; wake(); }).observe($(".hero"));
  document.addEventListener("visibilitychange", wake);
  window.SITE.holds.push((on) => { state.held = on; wake(); });
  ["pointerdown", "touchstart", "keydown"].forEach((n) => addEventListener(n, syncVideos, { passive: true }));

  const showSize = (video) => {
    out.latent.textContent = `[1,16,${Math.round(video.videoHeight / 8)},${Math.round(video.videoWidth / 8)}]`;
    out.image.textContent = `${video.videoWidth}×${video.videoHeight}`;
  };

  // без видеокарты ролик показывается обычным видео, а кнопки просто переключают его
  let plain = false;
  const showPlain = (i) => {
    videos[state.i].style.cssText = "";
    srcBox.append(videos[state.i]);
    state.i = i;
    const v = videos[i];
    v.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover";
    preview.append(v);
    live.video = v; live.id = SCENES[i].id; live.d = 1;
    updateNumbers(i, 1);
    if (v.videoWidth) showSize(v);
    else v.addEventListener("loadedmetadata", () => showSize(v), { once: true });
    syncVideos();
  };

  /* кнопки графа */
  $(".btn--queue").addEventListener("click", () => {
    if (plain) showPlain(nextOf(state.i));
    else if (!flow.on) state.restAt = performance.now() - HOLD;
  });
  $(".btn--rerun").addEventListener("click", () => {
    if (plain) videos[state.i].currentTime = 0;
    else if (!flow.on) startFlow(state.i);
  });
  const openPreview = () => window.SITE.openWork(SCENES[state.i].id);
  preview.addEventListener("click", openPreview);
  preview.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPreview(); } });

  layoutWires();
  startRig();
  startDrag();

  if (!gl) {
    plain = true;
    document.documentElement.classList.add("no-gl");
    showPlain(0);
    startHolo();
    return;
  }

  /* Preview: готовый кадр рисуется одним слоем видео. На смене сцены он распадается на частицы, они плавно
     текут и собираются в следующий ролик. Частицы однотонные, форму им даёт яркость двух роликов. */
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
    uniform float uS, uCross, uTime, uSize, uTint;
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
      // цвет ролика есть только в начале распада и в конце сборки
      vColor = mix(vec3(.56, .84, 1.) * (.14 + l * 1.15), c, clamp(uTint * 1.5 - seed * .5, 0., 1.));
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
  const dots = makeProgram(dotVs, dotFs, ["uA", "uB", "uCoverA", "uCoverB", "uS", "uCross", "uTime", "uSize", "uTint"]);

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
    dotSize = cell * dpr * 1.15;
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
    plain = true;
    showPlain(state.i);
  };
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; fallback(); });

  // постер на случай, если браузер не дал запустить видео
  const posters = SCENES.map((s) => { const im = new Image(); im.src = `assets/poster/${s.id}.jpg`; return im; });
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

  const dropQuality = () => {
    const dpr = quality.level ? 1 : Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildGrid(dpr);
  };

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
  const tickQueue = (now) => {
    if (flow.on) return;
    const wait = now - state.restAt;
    if (wait < HOLD - 1500) return;
    // следующий ролик запускается заранее, чтобы частицы сразу взяли форму из него
    if (!flow.warm) { flow.warm = true; syncVideos(); }
    if (wait < HOLD) return;
    if (videos[nextOf(state.i)].readyState < 2 && wait < HOLD + PATIENCE) return;
    startFlow(nextOf(state.i), now);
  };
  const frame = (now) => {
    requestAnimationFrame(frame);
    if (!state.active || lost) { lastNow = 0; return; }
    if (lastNow) {
      const dt = now - lastNow;
      quality.slow = dt > 40 ? quality.slow + 3 : dt > 26 ? quality.slow + 1 : Math.max(0, quality.slow - 0.5);
      if (quality.slow > 60 && quality.level < 2) {
        quality.level += 1; quality.slow = 0; dropQuality();
      }
    }
    lastNow = now;
    tickQueue(now);
    const time = (now - bornAt) / 1000;

    // сколько кадр рассыпан: 0 готовый кадр, 1 облако частиц
    let scatter = 0, d = 1, cross = 0, tint = 1, solid = 1;
    if (flow.on) {
      const u = Math.max(0, (now - flow.at) / FLOW);
      if (u >= CLOUD) state.i = flow.to;
      if (u >= 1) { flow.on = false; state.restAt = now; syncVideos(); }
      else {
        cross = soft(clamp((u - 0.2) / 0.3));
        if (u < CLOUD) {
          scatter = ease(u / CLOUD);
          tint = 1 - soft(clamp(u / 0.16));
          solid = 1 - soft(clamp(u / 0.08));
        } else {
          d = ease(clamp((u - CLOUD) / (FORMED - CLOUD)));
          scatter = 1 - d;
          tint = soft(clamp((u - FORMED) / (1 - FORMED)));
          solid = soft(clamp((u - 0.88) / 0.12));
        }
      }
    }
    const a = flow.on ? flow.from : state.i, b = flow.on ? flow.to : state.i;
    const video = videos[state.i];
    const scene = SCENES[state.i];

    feed(slots[0], a);
    if (b !== a) feed(slots[1], b);
    const coverA = coverOf(videos[a], SCENES[a].id);
    const coverB = b === a ? coverA : coverOf(videos[b], SCENES[b].id);
    const cover = coverOf(video, scene.id);

    gl.clearColor(0.035, 0.035, 0.043, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (solid > 0) {
      const slot = flow.on && b !== a && state.i === b ? 1 : 0;
      const c = slot ? coverB : coverA;
      gl.useProgram(quad.program);
      gl.bindVertexArray(quadVao);
      gl.uniform1i(quad.uV, slot);
      gl.uniform4f(quad.uCover, c.sx, c.sy, c.ox, c.oy);
      gl.uniform1f(quad.uAlpha, solid);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (flow.on) {
      gl.useProgram(dots.program);
      gl.bindVertexArray(dotVao);
      gl.uniform1i(dots.uB, b === a ? 0 : 1);
      gl.uniform4f(dots.uCoverA, coverA.sx, coverA.sy, coverA.ox, coverA.oy);
      gl.uniform4f(dots.uCoverB, coverB.sx, coverB.sy, coverB.ox, coverB.oy);
      gl.uniform1f(dots.uS, scatter);
      gl.uniform1f(dots.uCross, cross);
      gl.uniform1f(dots.uTime, time);
      gl.uniform1f(dots.uSize, dotSize);
      gl.uniform1f(dots.uTint, tint);
      gl.drawArrays(gl.POINTS, 0, dotCount);
    }

    updateNumbers(state.i, d);
    live.video = video; live.id = scene.id; live.d = 1 - scatter; live.cover = cover;
    if (shownVideo !== video && video.videoWidth) {
      shownVideo = video;
      showSize(video);
    }

    // импульсы по проводам, пока идёт сэмплинг
    const running = flow.on;
    paths.forEach((p, k) => {
      p.pulse.style.opacity = running ? 1 : 0;
      if (running) p.pulse.style.strokeDashoffset = -((time * 150 + k * 40) % 153);
    });

    const track = tracks[scene.id];
    const box = track && !flow.on ? track.box[Math.floor(video.currentTime * track.fps) % track.box.length] : null;
    const w = box ? box[2] * W / cover.sx * 1.28 : 0, h = box ? box[3] * H / cover.sy * 1.28 : 0;
    if (!box || h > H * 0.62) { facebox.style.opacity = 0; return; }
    const x = ((box[0] + box[2] / 2 - cover.ox) / cover.sx) * W - w / 2;
    const y = ((box[1] + box[3] / 2 - cover.oy) / cover.sy) * H - h / 2;
    facebox.style.opacity = 1;
    facebox.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    facebox.style.width = `${w.toFixed(1)}px`;
    facebox.style.height = `${h.toFixed(1)}px`;
  };

  updateNumbers(0, 0);
  startFlow(0, bornAt - FLOW * CLOUD);
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
    let width = innerWidth;
    addEventListener("resize", () => {
      if (innerWidth === width) return;
      width = innerWidth;
      gsap.set(nodes, { x: 0, y: 0 });
      reset.hidden = true;
      layoutWires();
    });
  }

  /* мягкое тело: двенадцать шаров сливаются в одну массу и медленно перетекают вслед за объектом */
  function startRig() {
    const c = $(".rig__canvas");
    const nameEl = $(".rig__name"), noteEl = $(".rig__note");
    const COUNT = 12, SPINE = 7;
    const g = c.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true });
    const flat = g ? null : c.getContext("2d");
    let rigs = null, W2 = 0, H2 = 0, dpr2 = 1, last = 0, placed = false, shape = null, fit = 0, label = "";
    // x, y, радиус и их скорости: в координатах кадра
    const balls = Array.from({ length: COUNT }, () => [0, 0, 0, 0, 0, 0]);
    const shown = new Float32Array(COUNT * 3);
    const u = {};
    if (g) {
      const vs = `#version 300 es
        in vec2 p;
        void main() { gl_Position = vec4(p, 0., 1.); }`;
      const fs = `#version 300 es
        precision highp float;
        uniform vec3 uB[${COUNT}];
        uniform float uK, uT, uRing, uTime, uH;
        out vec4 o;
        void main() {
          vec2 q = vec2(gl_FragCoord.x, uH - gl_FragCoord.y);
          float sum = 0.;
          vec2 dir = vec2(0.);
          for (int i = 0; i < ${COUNT}; i++) {
            vec2 v = q - uB[i].xy;
            float l = length(v) + .001;
            float w = exp(-min((l - uB[i].z) / uK, 60.));
            sum += w;
            dir += w * v / l;
          }
          dir /= sum;
          float d = -uK * log(sum);
          float body = smoothstep(1., -1., d);
          if (body <= 0.) discard;
          float t = clamp(-d / uT, 0., 1.);
          vec3 n = normalize(vec3(dir * (1. - t), sqrt(1. - (1. - t) * (1. - t)) + .001));
          float rim = pow(1. - n.z, 1.7);
          float lit = max(dot(n, normalize(vec3(-.45, -.55, .7))), 0.);
          float rings = smoothstep(.1, 0., abs(fract(d / uRing + uTime * .07) - .5));
          vec3 holo = vec3(.56, .84, 1.);
          vec3 col = vec3(.059, .063, .075) + holo * (.04 + lit * .15 + rim * .62 + rings * .13) + vec3(.8) * pow(lit, 26.) * .45;
          o = vec4(col * body, body);
        }`;
      const make = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); return s; };
      const prog = g.createProgram();
      g.attachShader(prog, make(g.VERTEX_SHADER, vs));
      g.attachShader(prog, make(g.FRAGMENT_SHADER, fs));
      g.linkProgram(prog);
      g.useProgram(prog);
      g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer());
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
      const at = g.getAttribLocation(prog, "p");
      g.enableVertexAttribArray(at);
      g.vertexAttribPointer(at, 2, g.FLOAT, false, 0, 0);
      ["uB", "uK", "uT", "uRing", "uTime", "uH"].forEach((n) => { u[n] = g.getUniformLocation(prog, n); });
    }
    const size = () => {
      dpr2 = Math.min(devicePixelRatio || 1, 1.5);
      W2 = c.clientWidth; H2 = c.clientHeight;
      c.width = Math.round(W2 * dpr2); c.height = Math.round(H2 * dpr2);
      if (g) g.viewport(0, 0, c.width, c.height);
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
    // между сценами это один округлый сгусток
    const blob = (ratio) => Array.from({ length: COUNT }, (_, i) => {
      const a = i / COUNT * 6.283;
      return [ratio / 2 + Math.cos(a) * 0.1, 0.5 + Math.sin(a) * 0.1, 0.1];
    });
    const targets = (pose, ratio) => {
      const px = (i) => pose.pts[i * 2] * ratio, py = (i) => pose.pts[i * 2 + 1];
      if (pose.kind === "h") {
        const along = (p, q, t) => [px(p) + (px(q) - px(p)) * t, py(p) + (py(q) - py(p)) * t];
        const nx = (px(1) + px(2)) / 2, ny = (py(1) + py(2)) / 2;
        const hx = (px(7) + px(8)) / 2, hy = (py(7) + py(8)) / 2;
        const trunk = (t) => [nx + (hx - nx) * t, ny + (hy - ny) * t];
        const w = Math.max(0.03, Math.hypot(px(1) - px(2), py(1) - py(2)), Math.hypot(hx - nx, hy - ny) * 0.55);
        return [
          [px(0), py(0), w * 0.36], [...trunk(0.12), w * 0.5], [...trunk(0.5), w * 0.46], [...trunk(0.9), w * 0.46],
          [...along(1, 3, 0.55), w * 0.2], [...along(2, 4, 0.55), w * 0.2],
          [...along(3, 5, 0.7), w * 0.17], [...along(4, 6, 0.7), w * 0.17],
          [...along(7, 9, 0.55), w * 0.26], [...along(8, 10, 0.55), w * 0.26],
          [...along(9, 11, 0.7), w * 0.2], [...along(10, 12, 0.7), w * 0.2],
        ];
      }
      // предмет: шары идут вдоль формы, радиус равен её полуширине
      const rail = (start, t) => {
        const f = t * (SPINE - 1), i = Math.min(SPINE - 2, Math.floor(f)), k = f - i;
        return [px(start + i) + (px(start + i + 1) - px(start + i)) * k, py(start + i) + (py(start + i + 1) - py(start + i)) * k];
      };
      return Array.from({ length: COUNT }, (_, i) => {
        const t = (i + 0.5) / COUNT;
        const [ax, ay] = rail(SPINE, t), [bx, by] = rail(SPINE * 2, t);
        return [(ax + bx) / 2, (ay + by) / 2, Math.max(0.03, Math.hypot(bx - ax, by - ay) / 2)];
      });
    };
    const loop = (now) => {
      requestAnimationFrame(loop);
      if (!W2 || !stageVisible || !live.video) { last = now; return; }
      if (quality.level > 1 && now - (loop.at || 0) < 33) return;
      loop.at = now;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      const rig = rigs && rigs[live.id];
      const pose = rig && live.d >= 0.35 ? blend(rig, live.video.currentTime * rig.fps) : null;
      const ratio = (live.video.videoWidth || 1920) / (live.video.videoHeight || 824);
      if (pose) shape = targets(pose, ratio);
      else if (!shape || live.d < 0.35) shape = blob(ratio);
      if (!placed) {
        balls.forEach((b, i) => { b[0] = shape[i][0]; b[1] = shape[i][1]; b[2] = shape[i][2]; });
        placed = true;
      }
      // тугая пружина без отскока: склейки в ролике не дёргают массу, она перетекает за секунду
      balls.forEach((b, i) => {
        const w = 2.3 + (i % 4) * 0.2;
        for (let k = 0; k < 3; k++) {
          b[k + 3] += ((shape[i][k] - b[k]) * w * w - 2 * w * b[k + 3]) * dt;
          b[k] += b[k + 3] * dt;
        }
      });
      const time = now / 1000;
      const sway = reduced ? 0 : 1;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, mean = 0, big = 0;
      balls.forEach((b, i) => {
        const r = Math.max(0.005, b[2]) * (1 + sway * 0.1 * Math.sin(time * 0.9 + i * 1.9));
        const x = b[0] + sway * Math.sin(time * 0.7 + i * 2.4) * r * 0.22;
        const y = b[1] + sway * Math.cos(time * 0.6 + i * 1.3) * r * 0.22;
        shown[i * 3] = x; shown[i * 3 + 1] = y; shown[i * 3 + 2] = r;
        x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r);
        mean += r / COUNT; big = Math.max(big, r);
      });
      // слияние шаров добавляет к контуру не больше k·ln(12), поэтому масса всегда целиком в ноде
      const k = mean * 0.36, grow = k * 2.5, pad = 8;
      const exact = Math.min((W2 - pad * 2) / (x1 - x0 + grow * 2), (H2 - pad * 2) / (y1 - y0 + grow * 2));
      fit = fit ? fit + (exact - fit) * (1 - Math.exp(-dt * 2.5)) : exact;
      const view = Math.min(fit, exact);
      const ox = W2 / 2 - ((x0 + x1) / 2) * view, oy = H2 / 2 - ((y0 + y1) / 2) * view;
      const name = pose ? (pose.kind === "h" ? "HUMAN_FORM" : "OBJECT_FORM") : "MORPHING";
      if (name !== label) { label = name; nameEl.textContent = name; noteEl.textContent = `metaballs ${COUNT} · cameras 0`; }
      if (!g) {
        flat.setTransform(dpr2, 0, 0, dpr2, 0, 0);
        flat.clearRect(0, 0, W2, H2);
        flat.fillStyle = "rgba(143,214,255,.16)";
        for (let i = 0; i < COUNT; i++) {
          flat.beginPath();
          flat.arc(ox + shown[i * 3] * view, oy + shown[i * 3 + 1] * view, shown[i * 3 + 2] * view, 0, 6.283);
          flat.fill();
        }
        return;
      }
      for (let i = 0; i < COUNT; i++) {
        shown[i * 3] = (ox + shown[i * 3] * view) * dpr2;
        shown[i * 3 + 1] = (oy + shown[i * 3 + 1] * view) * dpr2;
        shown[i * 3 + 2] *= view * dpr2;
      }
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform3fv(u.uB, shown);
      g.uniform1f(u.uK, k * view * dpr2);
      g.uniform1f(u.uT, big * view * dpr2);
      g.uniform1f(u.uRing, 7 * dpr2);
      g.uniform1f(u.uTime, sway * time);
      g.uniform1f(u.uH, c.height);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(loop);
  }

  /* частицы: тот же ролик как облако точек. Глубина из яркости, объект отделён от фона */
  function startHolo() {
    const c = $(".holo");
    const g = !reduced && c.getContext("webgl2", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!g) { $(".v-points").textContent = "off"; return; }
    const GRID_X = light ? 130 : 200, GRID_Y = light ? 56 : 86;
    const vs = `#version 300 es
      in vec2 aUv;
      uniform sampler2D uT;
      uniform float uTime, uAspect, uDpr, uSpin, uD, uRatio, uFocus, uLod;
      out float vA;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float luma(vec2 uv, float lod) { return dot(textureLod(uT, uv, lod).rgb, vec3(.3, .59, .11)); }
      void main() {
        float l = luma(aUv, uLod);
        // фон считается по краям кадра прямо в шейдере: копировать кадр в память дорого
        float bg = (luma(vec2(.25, .03), 7.) + luma(vec2(.75, .03), 7.) + luma(vec2(.25, .97), 7.) + luma(vec2(.75, .97), 7.)) * .25;
        float diff = abs(l - bg);
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
    ["uT", "uTime", "uAspect", "uDpr", "uSpin", "uD", "uRatio", "uFocus", "uLod"].forEach((n) => { u2[n] = g.getUniformLocation(prog, n); });
    const tex2 = g.createTexture();
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, tex2);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.uniform1i(u2.uT, 0);
    $(".v-points").textContent = (GRID_X * GRID_Y).toLocaleString("en").replace(",", " ");
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
    let last = -1, texW = 0, texH = 0;
    const loop = (now) => {
      requestAnimationFrame(loop);
      const video = live.video;
      if (!video || !stageVisible || document.hidden || video.readyState < 2) return;
      const every = quality.level === 0 ? 66 : quality.level === 1 ? 110 : 220;
      if (video.currentTime !== last && now - (loop.at || 0) > every) {
        last = video.currentTime; loop.at = now;
        if (video.videoWidth === texW && video.videoHeight === texH) {
          g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, g.RGBA, g.UNSIGNED_BYTE, video);
        } else {
          g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, video);
          texW = video.videoWidth; texH = video.videoHeight;
          g.uniform1f(u2.uLod, Math.max(0, Math.log2(texW / GRID_X)));
        }
        g.generateMipmap(g.TEXTURE_2D);
      }
      tilt.x += (tilt.tx - tilt.x) * 0.06;
      const time = (now - started) / 1000;
      const spin = Math.sin(time * 0.35) * 0.42 + tilt.x;
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
      g.uniform1f(u2.uTime, time);
      g.uniform1f(u2.uSpin, spin);
      g.uniform1f(u2.uD, live.d);
      g.uniform1f(u2.uFocus, live.cover ? live.cover.ox + live.cover.sx / 2 : 0.5);
      g.uniform1f(u2.uRatio, (video.videoWidth || 1920) / (video.videoHeight || 824));
      g.drawArrays(g.POINTS, 0, GRID_X * GRID_Y);
      if (now - (loop.text || 0) > 200) { loop.text = now; depthEl.textContent = spin.toFixed(2); }
    };
    requestAnimationFrame(loop);
  }
})();
