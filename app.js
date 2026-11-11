/* Rahul G Bailur: interactions
   Liquid caustic background (WebGL), real glass refraction (SVG displacement, Chromium),
   draggable lens, liquid dock, CareFlow tabs, failover model, demo wake-up ping,
   departures board, timeline progress and a command palette. No dependencies. */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const $ = (sel, el = doc) => el.querySelector(sel);
  const $$ = (sel, el = doc) => Array.from(el.querySelectorAll(sel));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const lightQuery = matchMedia('(prefers-color-scheme: light)');
  const calm = () => motionQuery.matches;

  const EMAIL = 'rahulgbailur8405@gmail.com';
  const DEMO = 'https://careflow-uam3.onrender.com';
  const GOLDLOAN_DEMO = 'https://goldloan-assistant.onrender.com';
  const GITHUB = 'https://github.com/RahulBailur';
  const LINKEDIN = 'https://www.linkedin.com/in/rahul-g-bailur-266488218';

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } },
  };

  /* ---------------- theme ---------------- */

  const themeHooks = [];
  const theme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');

  function syncThemeUI() {
    const other = theme() === 'dark' ? 'light' : 'dark';
    $$('[data-theme-toggle]').forEach((b) => b.setAttribute('aria-label', `Switch to ${other} theme`));
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme() === 'dark' ? '#03121a' : '#e4f0f1');
  }
  function setTheme(next, remember) {
    root.dataset.theme = next;
    if (remember) store.set('theme', next);
    syncThemeUI();
    themeHooks.forEach((fn) => fn(next));
  }
  function toggleTheme() { setTheme(theme() === 'dark' ? 'light' : 'dark', true); }

  $$('[data-theme-toggle]').forEach((b) => b.addEventListener('click', toggleTheme));
  lightQuery.addEventListener('change', (e) => {
    if (!store.get('theme')) setTheme(e.matches ? 'light' : 'dark', false);
  });
  syncThemeUI();

  /* ---------------- toast + clipboard ---------------- */

  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      doc.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = doc.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  doc.addEventListener('click', async (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
    if (!btn) return;
    const ok = await copyText(btn.dataset.copy);
    toast(ok ? (btn.dataset.toast || 'Copied') : 'Copy failed. Select the text and copy it instead.');
  });

  /* ---------------- liquid background (WebGL caustics) ---------------- */

  const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uScroll;
uniform float uLight;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)), dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
void main() {
  float s = min(uRes.x, uRes.y);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / s;

  // the pointer presses into the water like a fingertip
  vec2 m = (uPointer - 0.5 * uRes) / s;
  vec2 dm = p - m;
  float press = exp(-dot(dm, dm) * 7.0);
  p -= dm * press * 0.22;

  // slower than the page: depth
  p.y -= uScroll / s * 0.22;
  float t = uTime * 0.045;

  vec2 q = vec2(fbm(p * 1.25 + vec2(0.0, t)), fbm(p * 1.25 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p * 1.25 + 2.3 * q + vec2(1.7, 9.2) + 0.7 * t),
                fbm(p * 1.25 + 2.3 * q + vec2(8.3, 2.8) - 0.6 * t));
  float f = fbm(p * 1.1 + 2.1 * r);
  float n = fbm(p * 2.4 + 1.8 * r + vec2(0.6 * t, -0.4 * t));
  float ridge = pow(max(1.0 - abs(n) * 3.4, 0.0), 5.0);

  float k1 = smoothstep(-0.3, 0.55, f);
  float k2 = smoothstep(0.1, 0.9, length(q));
  float k3 = smoothstep(-0.15, 0.6, r.y);

  vec3 abyss = vec3(0.012, 0.07, 0.10);
  vec3 deep = vec3(0.02, 0.17, 0.22);
  vec3 lagoon = vec3(0.30, 0.89, 0.83);
  vec3 iris = vec3(0.52, 0.47, 1.0);

  vec3 dark = mix(abyss, deep, k1);
  dark = mix(dark, iris * 0.30, k2 * 0.6);
  dark = mix(dark, lagoon * 0.40, k3 * k1 * 0.55);
  dark += lagoon * ridge * (0.10 + 0.22 * k1);
  dark += vec3(0.6, 1.0, 0.95) * press * 0.035;
  dark *= mix(0.62, 1.0, smoothstep(1.15, 0.25, length(uv - vec2(0.5, 0.55)) * 1.35));

  vec3 light = vec3(0.89, 0.945, 0.95);
  light = mix(light, vec3(0.78, 0.92, 0.92), k1 * 0.9);
  light = mix(light, vec3(0.85, 0.84, 1.0), k2 * 0.65);
  light = mix(light, vec3(0.62, 0.90, 0.87), k3 * k1 * 0.5);
  light += vec3(1.0) * ridge * 0.28;
  light += vec3(1.0) * press * 0.05;

  vec3 col = mix(dark, light, uLight);
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

  const liquid = (() => {
    const api = { pointer() {}, kick() {} };
    const canvas = $('#liquid');
    if (!canvas) return api;
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
    if (!gl) return api;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}');
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return api;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return api;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aLoc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(aLoc);
    gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
    const u = (name) => gl.getUniformLocation(prog, name);
    const uRes = u('uRes'), uTime = u('uTime'), uPointer = u('uPointer'), uScroll = u('uScroll'), uLight = u('uLight');

    const SCALE = 0.5; // a soft field: half resolution is invisible and four times cheaper
    const start = performance.now();
    const ptr = { x: 0.7, y: 0.35, tx: 0.7, ty: 0.35 };
    let width = 0, height = 0, raf = 0, last = 0, lost = false, shown = false;
    let light = theme() === 'light' ? 1 : 0, lightTarget = light;

    function resize() {
      const w = Math.max(1, Math.round(innerWidth * SCALE));
      const h = Math.max(1, Math.round(innerHeight * SCALE));
      if (w !== width || h !== height) {
        width = canvas.width = w;
        height = canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    function render(now) {
      const still = calm();
      ptr.x += (ptr.tx - ptr.x) * (still ? 1 : 0.05);
      ptr.y += (ptr.ty - ptr.y) * (still ? 1 : 0.05);
      light += (lightTarget - light) * (still ? 1 : 0.07);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, 40 + (still ? 0 : (now - start) / 1000));
      gl.uniform2f(uPointer, ptr.x * width, (1 - ptr.y) * height);
      gl.uniform1f(uScroll, scrollY * SCALE);
      gl.uniform1f(uLight, light);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!shown) { shown = true; canvas.classList.add('ready'); }
    }
    function frame(now) {
      raf = 0;
      if (doc.hidden || lost) return;
      if (calm()) { render(now); return; }
      raf = requestAnimationFrame(frame);
      if (now - last >= 31) { last = now; render(now); } // ~30 fps is plenty for slow water
    }
    function kick() { if (!raf && !doc.hidden && !lost) raf = requestAnimationFrame(frame); }

    resize();
    addEventListener('resize', () => { resize(); kick(); }, { passive: true });
    addEventListener('scroll', () => { if (calm()) kick(); }, { passive: true });
    doc.addEventListener('visibilitychange', kick);
    motionQuery.addEventListener('change', kick);
    themeHooks.push((t) => { lightTarget = t === 'light' ? 1 : 0; kick(); });
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      lost = true;
      canvas.classList.remove('ready');
    });
    kick();

    api.pointer = (x, y) => { ptr.tx = x; ptr.ty = y; if (calm()) kick(); };
    api.kick = kick;
    return api;
  })();

  /* ---------------- liquid glass refraction (Chromium) ----------------
     backdrop-filter: url(#svg-filter) lets an element bend what is behind it. A displacement
     map is drawn per element: pixels near the curved rim sample from further inside, which is
     how light behaves at the thick edge of real glass. Other browsers keep the frosted look. */

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const fxDefs = $('#fx-defs');
  const canRefract = (() => {
    const ua = navigator.userAgent;
    return /Chrome\/\d+/.test(ua) && !/Firefox\//.test(ua) && !!(window.CSS && CSS.supports && CSS.supports('backdrop-filter', 'url(#a)'));
  })();
  if (canRefract) root.classList.add('refract');

  function drawMap(w, h, fill) {
    const c = doc.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    fill(img.data);
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  // Rounded rectangle: displacement points inward along the rim normal, fading out over the bezel.
  function bezelMap(w, h, radius, bezel) {
    const hw = w / 2, hh = h / 2, r = Math.min(radius, hw, hh);
    return drawMap(w, h, (d) => {
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const px = x + 0.5 - hw, py = y + 0.5 - hh;
          const ax = Math.abs(px), ay = Math.abs(py);
          const qx = ax - (hw - r), qy = ay - (hh - r);
          let dist, nx = 0, ny = 0;
          if (qx > 0 && qy > 0) {
            const l = Math.hypot(qx, qy) || 1;
            dist = r - l; nx = qx / l; ny = qy / l;
          } else if (qx > qy) {
            dist = hw - ax; nx = 1;
          } else {
            dist = hh - ay; ny = 1;
          }
          if (px < 0) nx = -nx;
          if (py < 0) ny = -ny;
          const t = dist > 0 ? clamp(1 - dist / bezel, 0, 1) : 0;
          const m = t * t;
          const i = (y * w + x) * 4;
          d[i] = 128 - nx * m * 127;
          d[i + 1] = 128 - ny * m * 127;
          d[i + 2] = 128;
          d[i + 3] = 255;
        }
      }
    });
  }

  // Circular lens: even magnification in the middle, a strong bend at the rim.
  function lensMap(size) {
    const R = size / 2;
    return drawMap(size, size, (d) => {
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const dx = (x + 0.5 - R) / R, dy = (y + 0.5 - R) / R;
          const rr = Math.hypot(dx, dy);
          let ox = 0, oy = 0;
          if (rr < 1) {
            const f = 0.24 + 0.2 * rr ** 4;
            ox = dx * f;
            oy = dy * f;
          }
          const i = (y * size + x) * 4;
          d[i] = 128 - ox * 255;
          d[i + 1] = 128 - oy * 255;
          d[i + 2] = 128;
          d[i + 3] = 255;
        }
      }
    });
  }

  function writeFilter(id, w, h, href, scales) {
    let f = doc.getElementById(id);
    if (!f) {
      f = doc.createElementNS(SVG_NS, 'filter');
      f.id = id;
      fxDefs.appendChild(f);
    }
    f.setAttribute('x', '0');
    f.setAttribute('y', '0');
    f.setAttribute('width', '100%');
    f.setAttribute('height', '100%');
    f.setAttribute('color-interpolation-filters', 'sRGB');
    const map = `<feImage href="${href}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>`;
    const displace = (scale, result) =>
      `<feDisplacementMap in="SourceGraphic" in2="map" scale="${scale.toFixed(2)}" xChannelSelector="R" yChannelSelector="G"${result ? ` result="${result}"` : ''}/>`;
    if (scales.length === 1) {
      f.innerHTML = map + displace(scales[0]);
      return;
    }
    // three passes with slightly different strength per channel: chromatic dispersion at the rim
    const keep = (input, row, out) => `<feColorMatrix in="${input}" type="matrix" values="${row}" result="${out}"/>`;
    f.innerHTML = map +
      displace(scales[0], 'dr') + keep('dr', '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r') +
      displace(scales[1], 'dg') + keep('dg', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g') +
      displace(scales[2], 'db') + keep('db', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b') +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>';
  }

  let fxCount = 0;
  function refract(el, opts = {}) {
    if (!canRefract || !el || !fxDefs) return;
    const id = `fx-${fxCount += 1}`;
    let key = '';
    const build = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (w < 2 || h < 2) return;
      const next = `${w}x${h}`;
      if (next === key) return;
      key = next;
      if (opts.lens) {
        const s = w / 2;
        writeFilter(id, w, h, lensMap(w), [s, s * 1.045, s * 1.09]);
      } else {
        const radius = opts.radius != null ? opts.radius : h / 2;
        const bezel = opts.bezel || Math.min(h * 0.45, 28);
        writeFilter(id, w, h, bezelMap(w, h, radius, bezel), [bezel * (opts.strength || 1.4)]);
      }
      el.style.backdropFilter = `${opts.before || ''} url(#${id}) ${opts.after || ''}`.trim();
    };
    build();
    if ('ResizeObserver' in window) {
      let timer = 0;
      new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(build, 120); }).observe(el);
    }
  }

  refract($('#dock'), { before: 'blur(3px)', after: 'saturate(185%) brightness(1.04)' });
  refract($('.brand'), { before: 'blur(3px)', after: 'saturate(185%)' });
  refract($('.theme-btn'), { before: 'blur(3px)', after: 'saturate(185%)' });
  refract($('.status'), { before: 'blur(3px)', after: 'saturate(170%)' });
  $$('.hero .btn.glass').forEach((b) => refract(b, { before: 'blur(3px)', after: 'saturate(170%)' }));

  /* ---------------- pointer: glass highlights + water ---------------- */

  let ptrEvent = null, ptrRaf = 0;
  function applyPointer() {
    ptrRaf = 0;
    const ev = ptrEvent;
    if (!ev) return;
    liquid.pointer(ev.clientX / innerWidth, ev.clientY / innerHeight);
    const g = ev.target instanceof Element ? ev.target.closest('.glass') : null;
    if (g) {
      const r = g.getBoundingClientRect();
      g.style.setProperty('--mx', `${Math.round(ev.clientX - r.left)}px`);
      g.style.setProperty('--my', `${Math.round(ev.clientY - r.top)}px`);
    }
  }
  doc.addEventListener('pointermove', (e) => {
    ptrEvent = e;
    if (!ptrRaf) ptrRaf = requestAnimationFrame(applyPointer);
  }, { passive: true });

  /* ---------------- dock: scrollspy + liquid indicator ---------------- */

  const dockLinks = $$('.dock-links a');
  const indicator = $('.dock-indicator');
  const spySections = dockLinks.map((a) => doc.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  let activeLink = null;
  let indicatorTimer = 0;

  function placeIndicator(link, morph) {
    if (!indicator) return;
    clearTimeout(indicatorTimer);
    if (!link) { indicator.classList.remove('on', 'stretch'); return; }
    const x = link.offsetLeft, w = link.offsetWidth;
    const px = parseFloat(indicator.dataset.x), pw = parseFloat(indicator.dataset.w);
    indicator.dataset.x = x;
    indicator.dataset.w = w;
    const set = (nx, nw) => {
      indicator.style.setProperty('--ix', `${nx}px`);
      indicator.style.setProperty('--iw', `${nw}px`);
    };
    if (!morph || calm() || !indicator.classList.contains('on') || Number.isNaN(px)) {
      indicator.classList.add('no-anim');
      set(x, w);
      void indicator.offsetWidth;
      indicator.classList.remove('no-anim');
      indicator.classList.add('on');
      return;
    }
    // Reach across to the new tab first, then let the trailing edge follow: a droplet, not a box.
    const left = Math.min(px, x), right = Math.max(px + pw, x + w);
    indicator.classList.add('stretch');
    set(left, right - left);
    indicatorTimer = setTimeout(() => {
      indicator.classList.remove('stretch');
      set(x, w);
    }, 170);
  }

  function updateSpy() {
    const line = innerHeight * 0.42;
    let current = null;
    spySections.forEach((s) => { if (s.getBoundingClientRect().top <= line) current = s; });
    if (current && innerHeight + scrollY >= root.scrollHeight - 2) current = spySections[spySections.length - 1];
    const link = current ? dockLinks.find((a) => a.getAttribute('href') === `#${current.id}`) : null;
    if (link === activeLink) return;
    dockLinks.forEach((a) => (a === link ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
    placeIndicator(link, !!activeLink);
    activeLink = link;
  }

  /* ---------------- timeline progress ---------------- */

  const timeline = $('#timeline');
  const tlItems = timeline ? $$('.tl-item', timeline) : [];
  function updateTimeline() {
    if (!timeline) return;
    const line = innerHeight * 0.62;
    const r = timeline.getBoundingClientRect();
    timeline.style.setProperty('--p', clamp((line - r.top) / r.height, 0, 1).toFixed(4));
    tlItems.forEach((it) => it.classList.toggle('lit', it.getBoundingClientRect().top + 34 < line));
  }

  let scrollRaf = 0;
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateSpy();
      updateTimeline();
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { onScroll(); placeIndicator(activeLink, false); }, { passive: true });
  updateSpy();
  updateTimeline();

  /* ---------------- hero lens ---------------- */

  (function lens() {
    const el = $('#lens'), hero = $('.hero'), name = $('.hero-name');
    if (!el || !hero || !name) return;
    refract(el, { lens: true, after: 'saturate(150%) brightness(1.08)' });

    const s = { x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, ox: 0, oy: 0, rx: 0, ry: 0, drag: false, placed: false, ready: false };
    const born = performance.now();
    let raf = 0, inView = true, homePos = null;

    // Rest on the end of the first line of the name, so the glass bends real type.
    function home() {
      const size = el.offsetWidth;
      const hr = hero.getBoundingClientRect();
      const line = $('.line', name) || name;
      const range = doc.createRange();
      range.selectNodeContents(line);
      const tr = range.getBoundingClientRect();
      const maxX = hero.clientWidth - size - 8;
      // Phones: rest beside the name so it stays readable. Wider screens: magnify the G.
      const narrow = innerWidth < 760;
      const x = narrow ? tr.right - hr.left + 6 : tr.right - hr.left - size * 0.62;
      return {
        x: clamp(x, 8, maxX),
        y: tr.top - hr.top + tr.height / 2 - size / 2 + (narrow ? size * 0.12 : 0),
      };
    }
    function bounds() {
      const size = el.offsetWidth;
      return { minX: -size * 0.3, maxX: hero.clientWidth - size * 0.7, minY: 70, maxY: hero.clientHeight - size * 0.8 };
    }
    function tick(now) {
      raf = 0;
      if (!inView) return;
      if (now - born < 2200) homePos = null; // the name is still condensing; keep re-measuring
      let tx, ty;
      if (s.drag) {
        tx = s.px - s.ox;
        ty = s.py - s.oy;
      } else {
        const base = s.placed ? { x: s.rx, y: s.ry } : (homePos || (homePos = home()));
        const drift = calm() ? 0 : el.offsetWidth / 236;
        tx = base.x + Math.sin(now / 2300) * 16 * drift;
        ty = base.y + Math.cos(now / 3100) * 11 * drift;
      }
      if (!s.ready) { s.x = tx; s.y = ty - (calm() ? 0 : 46); s.ready = true; }
      const k = s.drag ? 0.3 : 0.05, damping = s.drag ? 0.62 : 0.84;
      s.vx = (s.vx + (tx - s.x) * k) * damping;
      s.vy = (s.vy + (ty - s.y) * k) * damping;
      s.x += s.vx;
      s.y += s.vy;
      const speed = Math.hypot(s.vx, s.vy);
      const stretch = calm() ? 0 : Math.min(speed / 70, 0.28);
      const ang = Math.atan2(s.vy, s.vx);
      el.style.transform = `translate3d(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px, 0) rotate(${ang.toFixed(4)}rad) scale(${(1 + stretch).toFixed(4)}, ${(1 - stretch * 0.55).toFixed(4)}) rotate(${(-ang).toFixed(4)}rad)`;
      if (!calm() || s.drag || speed > 0.05) raf = requestAnimationFrame(tick);
    }
    const run = () => { if (!raf) raf = requestAnimationFrame(tick); };

    function heroPoint(e) {
      const hr = hero.getBoundingClientRect();
      s.px = e.clientX - hr.left;
      s.py = e.clientY - hr.top;
    }
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      heroPoint(e);
      s.drag = true;
      s.ox = s.px - s.x;
      s.oy = s.py - s.y;
      el.classList.add('held', 'touched');
      run();
    });
    el.addEventListener('pointermove', (e) => { if (s.drag) { heroPoint(e); run(); } });
    const release = () => {
      if (!s.drag) return;
      s.drag = false;
      s.placed = true;
      const b = bounds();
      s.rx = clamp(s.x, b.minX, b.maxX);
      s.ry = clamp(s.y, b.minY, b.maxY);
      el.classList.remove('held');
      run();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);

    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) run();
    }).observe(hero);
    addEventListener('resize', () => {
      homePos = null;
      if (s.placed) {
        const b = bounds();
        s.rx = clamp(s.rx, b.minX, b.maxX);
        s.ry = clamp(s.ry, b.minY, b.maxY);
      }
      run();
    }, { passive: true });
    motionQuery.addEventListener('change', run);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { homePos = null; run(); });
    run();
  })();

  /* ---------------- CareFlow tabs ---------------- */

  (function tabs() {
    const list = $('.tabs');
    if (!list) return;
    const all = $$('[role="tab"]', list);
    const ind = $('.tab-indicator', list);
    const lat = $('#lat');
    const current = () => all.find((t) => t.getAttribute('aria-selected') === 'true') || all[0];
    function place(tab, instant) {
      if (!ind) return;
      if (instant) ind.classList.add('no-anim');
      ind.style.setProperty('--tx', `${tab.offsetLeft}px`);
      ind.style.setProperty('--tw', `${tab.offsetWidth}px`);
      if (instant) { void ind.offsetWidth; ind.classList.remove('no-anim'); }
    }
    function select(tab, focus) {
      all.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = doc.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      place(tab);
      if (focus) tab.focus();
      if (lat) {
        lat.classList.remove('in');
        if (tab.id === 't-latency') requestAnimationFrame(() => requestAnimationFrame(() => lat.classList.add('in')));
      }
    }
    all.forEach((t) => t.addEventListener('click', () => select(t)));
    list.addEventListener('keydown', (e) => {
      const i = all.indexOf(doc.activeElement);
      if (i < 0) return;
      let n = -1;
      if (e.key === 'ArrowRight') n = (i + 1) % all.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + all.length) % all.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = all.length - 1;
      if (n >= 0) { e.preventDefault(); select(all[n], true); }
    });
    place(current(), true);
    addEventListener('resize', () => place(current(), true), { passive: true });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => place(current(), true));
  })();

  /* ---------------- failover model ---------------- */

  (function failover() {
    const box = $('#fo');
    if (!box) return;
    const node = (k) => $(`.fo-node[data-node="${k}"]`, box);
    const input = (k) => $(`input[data-fo="${k}"]`, box);
    const out = $('[data-fo-result]', box);
    const order = ['cache', 'gemini', 'ollama', 'rules'];
    const names = { cache: 'the Redis cache', gemini: 'Gemini', ollama: 'Ollama', rules: 'the rule-based fallback' };

    function update() {
      const cached = input('cache').checked;
      const up = { gemini: input('gemini').checked, ollama: input('ollama').checked };
      let server;
      const state = {};
      if (cached) {
        server = 'cache';
        state.cache = ['serving', 'Hit, replying'];
        state.gemini = ['idle', 'Not needed'];
        state.ollama = ['idle', 'Not needed'];
        state.rules = ['idle', 'Not needed'];
      } else {
        state.cache = ['passed', 'Miss'];
        server = up.gemini ? 'gemini' : up.ollama ? 'ollama' : 'rules';
        ['gemini', 'ollama'].forEach((k) => {
          if (k === server) state[k] = ['serving', 'Replying'];
          else if (!up[k]) state[k] = ['open', 'Down, circuit open'];
          else state[k] = ['idle', 'Standby'];
        });
        state.rules = server === 'rules' ? ['serving', 'Replying'] : ['idle', 'Standby'];
      }
      const reach = order.indexOf(server);
      order.forEach((k, i) => {
        const n = node(k);
        n.dataset.state = state[k][0];
        $('.fo-state', n).textContent = state[k][1];
        n.classList.toggle('on-path', i <= reach);
      });
      out.textContent = names[server];
    }
    $$('input[data-fo]', box).forEach((i) => i.addEventListener('change', update));
    update();
  })();

  /* ---------------- live demos: wake the free servers early ---------------- */

  (function demoStatus() {
    if (!('fetch' in window) || !('IntersectionObserver' in window)) return;
    $$('[data-demo]').forEach((feature) => {
      const dot = $('.srv-dot', feature), label = $('.srv-label', feature), url = feature.dataset.demo;
      if (!dot || !label || !url) return;
      const set = (state, text) => { dot.dataset.state = state; label.textContent = text; };
      function ping() {
        set('checking', 'Checking the demo');
        const slow = setTimeout(() => set('waking', 'Waking the demo, about a minute'), 2500);
        const ctrl = 'AbortController' in window ? new AbortController() : null;
        // A cold start on the free tier can take a few minutes
        const giveUp = setTimeout(() => { if (ctrl) ctrl.abort(); }, 180000);
        fetch(`${url}/api/health`, { mode: 'no-cors', cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
          .then(() => set('awake', 'Demo is awake'))
          .catch(() => set('down', 'Demo not responding'))
          .finally(() => { clearTimeout(slow); clearTimeout(giveUp); });
      }
      const io = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) { io.disconnect(); ping(); }
      }, { rootMargin: '0px 0px 900px 0px' });
      io.observe(feature);
    });
  })();

  /* ---------------- departures board ---------------- */

  (function board() {
    const el = $('#board');
    if (!el) return;
    const widths = [6, 3, 5, 9];
    const rows = [
      { cells: ['AX 204', 'DEL', '09:15'], states: ['BOARDING', 'DEPARTED', 'ON TIME'] },
      { cells: ['BL 118', 'BOM', '09:40'], states: ['ON TIME', 'BOARDING', 'LAST CALL'] },
      { cells: ['QV 330', 'CCU', '10:05'], states: ['DELAYED', 'GATE 4', 'BOARDING'] },
    ];
    const flap = (text, n, dim) => {
      const f = doc.createElement('span');
      f.className = dim ? 'flap dim' : 'flap';
      for (let i = 0; i < n; i += 1) {
        const c = doc.createElement('span');
        c.className = 'ch';
        c.textContent = text[i] && text[i] !== ' ' ? text[i] : ' ';
        f.appendChild(c);
      }
      return f;
    };
    const live = rows.map((r) => {
      r.cells.forEach((t, i) => el.appendChild(flap(t, widths[i], true)));
      const status = flap(r.states[0], widths[3], false);
      el.appendChild(status);
      return { status, states: r.states, i: 0 };
    });
    function flipTo(target, text) {
      $$('.ch', target).forEach((c, i) => {
        const ch = text[i] && text[i] !== ' ' ? text[i] : ' ';
        if (c.textContent === ch) return;
        setTimeout(() => {
          c.classList.remove('flip');
          void c.offsetWidth;
          c.classList.add('flip');
          setTimeout(() => { c.textContent = ch; }, 150);
        }, i * 45);
      });
    }
    let timer = 0;
    const step = () => {
      const r = live[Math.floor(Math.random() * live.length)];
      r.i = (r.i + 1) % r.states.length;
      flipTo(r.status, r.states[r.i]);
    };
    new IntersectionObserver(([entry]) => {
      clearInterval(timer);
      if (entry.isIntersecting && !calm()) timer = setInterval(step, 2600);
    }).observe(el);
  })();

  /* ---------------- local time in Bengaluru ---------------- */

  (function clock() {
    const outs = $$('[data-clock]');
    if (!outs.length) return;
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) { return; }
    const tick = () => {
      const t = fmt.format(new Date()).replace(/\s?(am|pm)$/i, (m, p) => ` ${p.toLowerCase()}`);
      outs.forEach((o) => { o.textContent = t; });
    };
    tick();
    $$('.clock-note').forEach((n) => { n.hidden = false; });
    setInterval(tick, 15000);
  })();

  /* ---------------- command palette ---------------- */

  (function palette() {
    const dlg = $('#palette'), input = $('#palette-input'), list = $('#palette-list'), empty = $('#palette-empty');
    const openers = $$('[data-palette]');
    if (!dlg || !input || !list || typeof dlg.showModal !== 'function') {
      openers.forEach((b) => { b.hidden = true; });
      $$('.footer-hint').forEach((h) => { h.hidden = true; });
      return;
    }
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $$('[data-kbd]').forEach((k) => { k.textContent = isMac ? '⌘K' : 'Ctrl K'; });

    const flash = (el) => {
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1900);
    };
    const reveal = (target, glow, block = 'start') => () => {
      if (!target) return;
      target.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block });
      if (glow) setTimeout(() => flash(glow), calm() ? 0 : 350);
    };
    const byId = (id) => doc.getElementById(id);
    const openUrl = (url) => () => window.open(url, '_blank', 'noopener');

    const items = [
      { group: 'Jump to', label: 'CareFlow', hint: 'Project', kw: 'voice hospital assistant carebot gemini whisper latency failover', run: reveal(byId('careflow')) },
      { group: 'Jump to', label: 'Muthoot gold-loan voice assistant', hint: 'Featured project', kw: 'muthoot gold loan client voice malayalam tamil gnani guardrails finance', run: reveal(byId('goldloan')) },
      { group: 'Jump to', label: 'Projects', hint: 'Section', run: reveal(byId('projects')) },
      { group: 'Jump to', label: 'Experience and education', hint: 'Section', kw: 'internship mtech manipal degree', run: reveal(byId('experience')) },
      { group: 'Jump to', label: 'Skills', hint: 'Section', run: reveal(byId('skills')) },
      { group: 'Jump to', label: 'Contact', hint: 'Section', kw: 'email hire reach', run: reveal(byId('contact')) },
    ];
    $$('.bento .card[id]').forEach((card) => {
      const h = $('h3', card);
      if (!h) return;
      const chips = $('.chips', card);
      items.push({ group: 'Projects', label: h.textContent.trim(), hint: 'Project', kw: chips ? chips.textContent : '', run: reveal(card, card, 'center') });
    });
    items.push(
      { group: 'Actions', label: 'Copy email address', hint: EMAIL, kw: 'mail contact', run: () => copyText(EMAIL).then((ok) => toast(ok ? 'Email copied' : 'Copy failed. Select the text and copy it instead.')) },
      { group: 'Actions', label: 'Write an email', hint: 'Opens your mail app', kw: 'mail contact', run: () => { location.href = `mailto:${EMAIL}`; } },
      { group: 'Actions', label: 'Open the CareFlow live demo', hint: 'New tab', kw: 'demo live app', run: openUrl(DEMO) },
      { group: 'Actions', label: 'Open the Muthoot assistant live demo', hint: 'New tab', kw: 'demo live app gold muthoot', run: openUrl(GOLDLOAN_DEMO) },
      { group: 'Actions', label: 'Open GitHub', hint: 'New tab', kw: 'code repositories', run: openUrl(GITHUB) },
      { group: 'Actions', label: 'Open LinkedIn', hint: 'New tab', kw: 'profile', run: openUrl(LINKEDIN) },
      { group: 'Actions', label: () => `Switch to ${theme() === 'dark' ? 'light' : 'dark'} theme`, hint: 'Appearance', kw: 'dark light mode theme', run: toggleTheme },
    );
    $$('.skill-group').forEach((g) => {
      const head = $('h3', g);
      const category = head ? head.textContent.trim() : 'Skill';
      $$('li', g).forEach((li) => items.push({ group: 'Skills', label: li.textContent.trim(), hint: category, skill: true, run: reveal(g, li, 'center') }));
    });

    const labelOf = (it) => (typeof it.label === 'function' ? it.label() : it.label);
    const words = (s) => (s || '').toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
    function score(it, q) {
      if (!q) return it.skill ? -1 : 1;
      const label = labelOf(it).toLowerCase();
      if (label.startsWith(q)) return 100 - label.length / 100;
      if (words(label).some((w) => w.startsWith(q))) return 80;
      if (label.includes(q)) return 60;
      if (words(`${it.hint} ${it.kw}`).some((w) => w.startsWith(q))) return 40;
      return -1;
    }

    let results = [];
    let active = 0;
    function setActive(i, scroll) {
      if (!results.length) { input.removeAttribute('aria-activedescendant'); return; }
      active = (i + results.length) % results.length;
      $$('.p-item', list).forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.idx) === active)));
      const el = doc.getElementById(`p-opt-${active}`);
      if (el) {
        input.setAttribute('aria-activedescendant', el.id);
        if (scroll) el.scrollIntoView({ block: 'nearest' });
      }
    }
    function render() {
      const q = input.value.trim().toLowerCase();
      results = items.map((it, i) => ({ it, i, s: score(it, q) })).filter((r) => r.s >= 0);
      if (q) results.sort((a, b) => b.s - a.s || a.i - b.i);
      results = results.slice(0, q ? 12 : 40);
      list.textContent = '';
      let lastGroup = '';
      results.forEach((r, idx) => {
        if (!q && r.it.group !== lastGroup) {
          lastGroup = r.it.group;
          const g = doc.createElement('li');
          g.className = 'p-group';
          g.setAttribute('role', 'presentation');
          g.textContent = lastGroup;
          list.appendChild(g);
        }
        const li = doc.createElement('li');
        li.className = 'p-item';
        li.id = `p-opt-${idx}`;
        li.dataset.idx = String(idx);
        li.setAttribute('role', 'option');
        const label = doc.createElement('span');
        label.className = 'p-label';
        label.textContent = labelOf(r.it);
        const hint = doc.createElement('span');
        hint.className = 'p-hint';
        hint.textContent = r.it.hint || '';
        li.append(label, hint);
        list.appendChild(li);
      });
      empty.hidden = results.length > 0;
      list.hidden = results.length === 0;
      setActive(0, true);
    }
    function runAt(i) {
      const r = results[i];
      if (!r) return;
      dlg.close();
      setTimeout(() => r.it.run(), 40);
    }
    function open() {
      input.value = '';
      render();
      dlg.showModal();
      input.focus();
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1, true); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1, true); }
      else if (e.key === 'Enter') { e.preventDefault(); runAt(active); }
    });
    list.addEventListener('pointermove', (e) => {
      const li = e.target instanceof Element ? e.target.closest('.p-item') : null;
      if (li && Number(li.dataset.idx) !== active) setActive(Number(li.dataset.idx), false);
    });
    list.addEventListener('click', (e) => {
      const li = e.target instanceof Element ? e.target.closest('.p-item') : null;
      if (li) runAt(Number(li.dataset.idx));
    });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    openers.forEach((b) => b.addEventListener('click', open));
    doc.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dlg.open) dlg.close(); else open();
        return;
      }
      const a = doc.activeElement;
      const typing = a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable);
      if (e.key === '/' && !dlg.open && !typing) { e.preventDefault(); open(); }
    });
  })();

  // Fonts change text widths: re-measure everything that sits on top of text.
  if (doc.fonts && doc.fonts.ready) {
    doc.fonts.ready.then(() => { placeIndicator(activeLink, false); onScroll(); });
  }
})();
