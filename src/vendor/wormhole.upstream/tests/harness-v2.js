// v2 shader harness: compiles storm, lightning, logo and screen shaders with
// three r170's GLSL3 prefixes (see shader-harness.html) and renders frames.
import { stormVertexShader, stormFragmentShader } from '../wormhole/shaders/storm.glsl.js';
import { lightningVertexShader, lightningFragmentShader } from '../wormhole/shaders/lightning.glsl.js';
import { logoVertexShader, logoFragmentShader } from '../wormhole/shaders/logo.glsl.js';
import { screenVertexShader, screenFragmentShader } from '../wormhole/shaders/screen.glsl.js';
import { VISUAL, QUALITY_TIERS, STORM_PALETTE, LIGHTNING, DEFAULTS } from '../wormhole/config.js';
import {
  createBoltBuffers, generateBolt, buildRibbon, MAX_RIBBON_VERTICES, MAX_RIBBON_INDICES,
} from '../wormhole/entities/boltPath.js';
import { drawLogoMask, drawScreenTexture, logoFit } from '../wormhole/entities/canvasArt.js';

const PAGE_BG = '#05080d'; // demo page background (index.html --bg)
const BODY = '#c6d2e8';
const HEADING = '#eef4ff';

export function setupV2({ gl, canvas, report, program, srgbToLinear, quadVao }) {
  const storm = program(stormVertexShader, stormFragmentShader, 'storm');
  const bolt = program(lightningVertexShader, lightningFragmentShader, 'lightning');
  const screen = program(screenVertexShader, screenFragmentShader, 'screen');
  const logo = program(logoVertexShader, logoFragmentShader, 'logo', { instancing: true });
  if (report.errors.length) return;

  // Quad VAO for storm: attribute "position" location may differ per program.
  const stormVao = gl.createVertexArray(); gl.bindVertexArray(stormVao);
  const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), gl.STATIC_DRAW);
  let loc = gl.getAttribLocation(storm, 'position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);

  // Bolt ribbon buffers (same pure code as LightningEntity).
  const boltData = createBoltBuffers();
  const positions = new Float32Array(MAX_RIBBON_VERTICES * 3);
  const ribbon = new Float32Array(MAX_RIBBON_VERTICES * 2);
  const indices = new Uint16Array(MAX_RIBBON_INDICES);
  const boltVao = gl.createVertexArray(); gl.bindVertexArray(boltVao);
  const posBuf = gl.createBuffer(); const ribBuf = gl.createBuffer(); const idxBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, positions.byteLength, gl.DYNAMIC_DRAW);
  loc = gl.getAttribLocation(bolt, 'position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, ribBuf); gl.bufferData(gl.ARRAY_BUFFER, ribbon.byteLength, gl.DYNAMIC_DRAW);
  loc = gl.getAttribLocation(bolt, 'aRibbon'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices.byteLength, gl.DYNAMIC_DRAW);
  gl.bindVertexArray(null);

  // Plane (position + uv) for logo and screen.
  const planeVao = (prog, instances) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, -0.5, 0.5, 0, 0, 1, 0.5, 0.5, 0, 1, 1]), gl.STATIC_DRAW);
    let l = gl.getAttribLocation(prog, 'position'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 3, gl.FLOAT, false, 20, 0);
    l = gl.getAttribLocation(prog, 'uv'); if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 20, 12); }
    if (instances) {
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, instances, gl.STATIC_DRAW);
      const base = gl.getAttribLocation(prog, 'instanceMatrix');
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(base + i);
        gl.vertexAttribPointer(base + i, 4, gl.FLOAT, false, 64, i * 16);
        gl.vertexAttribDivisor(base + i, 1);
      }
    }
    gl.bindVertexArray(null);
    return vao;
  };

  // Textures from the production canvas drawing code (flipY like three's CanvasTexture).
  const upload = (source) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return t;
  };
  const createCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

  const lin = (hex) => srgbToLinear(hex);
  const P = STORM_PALETTE;

  function drawStorm(s) {
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(storm);
    const u = (n) => gl.getUniformLocation(storm, n);
    gl.uniform2f(u('uResolution'), canvas.width, canvas.height);
    gl.uniform2f(u('uCenter'), s.cx ?? 0, s.cy ?? 0);
    gl.uniform1f(u('uTime'), s.time); gl.uniform1f(u('uOffset'), s.offset);
    gl.uniform1f(u('uOctaves'), QUALITY_TIERS[s.tier].stormOctaves);
    gl.uniform1f(u('uWarp'), QUALITY_TIERS[s.tier].stormWarp ? 1 : 0);
    gl.uniform1f(u('uIntensity'), s.intensity ?? 0.8);
    gl.uniform1f(u('uDepthScale'), VISUAL.depthScale); gl.uniform1f(u('uTwist'), VISUAL.twist); gl.uniform1f(u('uSpin'), VISUAL.spin);
    gl.uniform1f(u('uCalm'), s.calm ?? 0.6);
    gl.uniform1f(u('uFlash'), s.flash ?? 0); gl.uniform2f(u('uFlashPos'), s.fx ?? 0, s.fy ?? 0);
    gl.uniform1f(u('uFlashRadius'), LIGHTNING.flashRadius);
    gl.uniform1f(u('uAmbient'), s.ambient ?? 0); gl.uniform1f(u('uFade'), s.fade ?? 0);
    gl.uniform3fv(u('uDeep'), lin(P.deep)); gl.uniform3fv(u('uCloudDark'), lin(P.cloudDark));
    gl.uniform3fv(u('uCloudMid'), lin(P.cloudMid)); gl.uniform3fv(u('uCloudLight'), lin(P.cloudLight));
    gl.uniform3fv(u('uCore'), lin(P.core)); gl.uniform3fv(u('uLightning'), lin(P.lightning));
    gl.bindVertexArray(stormVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function drawBolt(b) {
    let seed = b.seed ?? 7;
    const random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    generateBolt(boltData, b.x0, b.y0, b.x1, b.y1, random, { width: b.width ?? 0.006 });
    const count = buildRibbon(boltData, positions, ribbon, indices);
    gl.bindVertexArray(boltVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, ribBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, ribbon);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, indices);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // three AdditiveBlending
    gl.useProgram(bolt);
    const u = (n) => gl.getUniformLocation(bolt, n);
    gl.uniform2f(u('uResolution'), canvas.width, canvas.height);
    gl.uniform3fv(u('uCoreColor'), lin(P.lightning)); gl.uniform3fv(u('uGlowColor'), lin('#9a7dff'));
    gl.uniform1f(u('uAlpha'), b.alpha ?? 1);
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
    gl.disable(gl.BLEND);
  }

  // ── Logo ───────────────────────────────────────────────────────────────────
  const logoLayers = QUALITY_TIERS.high.logoLayers;
  let logoState = null;
  function ensureLogo(portrait) {
    if (logoState?.portrait === portrait) return logoState;
    const mask = drawLogoMask(createCanvas, DEFAULTS.logoText, '"Arial Black", Impact, system-ui, sans-serif', portrait);
    const step = 0.006;
    const inst = new Float32Array(logoLayers * 16);
    for (let i = 0; i < logoLayers; i++) {
      inst.set([mask.aspect, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -i * step, 1], i * 16);
    }
    logoState = { portrait, mask, tex: upload(mask.canvas), vao: planeVao(logo, inst) };
    return logoState;
  }
  const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
  const perspective = (tanHalfV, aspect, near, far) => new Float32Array([1 / (tanHalfV * aspect), 0, 0, 0, 0, 1 / tanHalfV, 0, 0, 0, 0, -(far + near) / (far - near), -1, 0, 0, -2 * far * near / (far - near), 0]);
  const translate = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  const rotY = (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);
  const scale = (s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);

  function drawLogo(s) {
    const W = canvas.width; const H = canvas.height;
    const portrait = W < H;
    const st = ensureLogo(portrait);
    const tanShort = Math.tan((50 * Math.PI) / 360);
    const aspect = W / H;
    const tanV = aspect >= 1 ? tanShort : tanShort / aspect;
    const dist = s.dist ?? 7;
    const sc = logoFit(aspect, st.mask.aspect, tanShort, 7); // same fit as LogoEntity
    const mv = mul(translate(0, 0, -dist), mul(rotY(s.yaw ?? 0.28), scale(sc)));
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(logo);
    const u = (n) => gl.getUniformLocation(logo, n);
    gl.uniformMatrix4fv(u('projectionMatrix'), false, perspective(tanV, aspect, 0.1, 200));
    gl.uniformMatrix4fv(u('modelViewMatrix'), false, mv);
    gl.uniform1f(u('uLayers'), logoLayers);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex); gl.uniform1i(u('uMask'), 0);
    gl.uniform2f(u('uTexel'), 1 / st.mask.canvas.width, 1 / st.mask.canvas.height);
    gl.uniform1f(u('uAspect'), st.mask.aspect);
    gl.uniform1f(u('uReveal'), s.reveal ?? 1); gl.uniform1f(u('uFlash'), s.flash ?? 0); gl.uniform1f(u('uTime'), s.time ?? 0);
    gl.uniform3fv(u('uSteel'), lin('#c9d3de')); gl.uniform3fv(u('uSteelDark'), lin('#3b4350')); gl.uniform3fv(u('uRim'), lin('#8f7bff'));
    gl.bindVertexArray(st.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, logoLayers);
    gl.disable(gl.DEPTH_TEST);
  }

  // ── Screen ─────────────────────────────────────────────────────────────────
  const screenArt = drawScreenTexture(createCanvas);
  const screenTex = upload(screenArt.canvas);
  const screenVaoObj = planeVao(screen, null);
  function drawScreen(s) {
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(screen);
    const u = (n) => gl.getUniformLocation(screen, n);
    const aspect = canvas.width / canvas.height;
    gl.uniformMatrix4fv(u('projectionMatrix'), false, perspective(Math.tan((50 * Math.PI) / 360), aspect, 0.1, 100));
    gl.uniformMatrix4fv(u('modelViewMatrix'), false, mul(translate(0, 0, -1.2), new Float32Array([0.8, 0, 0, 0, 0, 0.6, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, screenTex); gl.uniform1i(u('uMap'), 0);
    const c = screenArt.cursor; gl.uniform4f(u('uCursor'), c[0], c[1], c[2], c[3]);
    gl.uniform1f(u('uTime'), s.time ?? 0.1); gl.uniform1f(u('uFlash'), s.flash ?? 0);
    gl.uniform3fv(u('uPhosphor'), lin('#5dff8a')); gl.uniform3fv(u('uGlint'), lin(P.lightning));
    gl.bindVertexArray(screenVaoObj); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const lin1 = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const hexRgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lum = (r, g, b) => 0.2126 * lin1(r) + 0.7152 * lin1(g) + 0.0722 * lin1(b);
  const contrast = (L1, L2) => (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  const read = () => { const px = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };

  /** Composite at CSS opacity over the page background (browsers blend in sRGB space). */
  function ambientContrast(px, opacity) {
    const bg = hexRgb(PAGE_BG);
    const W = canvas.width; const H = canvas.height;
    const all = new Float32Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      all[j] = lum(px[i] * opacity + bg[0] * (1 - opacity), px[i + 1] * opacity + bg[1] * (1 - opacity), px[i + 2] * opacity + bg[2] * (1 - opacity));
    }
    const sorted = Array.from(all).sort((a, b) => a - b);
    const max = sorted[sorted.length - 1];
    const body = lum(...hexRgb(BODY)); const heading = lum(...hexRgb(HEADING));
    return {
      compositeMax: max,
      compositeP999: sorted[Math.floor(sorted.length * 0.999)],
      bodyContrastWorst: contrast(body, max),
      headingContrastWorst: contrast(heading, max),
    };
  }

  function meanLum(px) { let s = 0; for (let i = 0; i < px.length; i += 4) s += lum(px[i], px[i + 1], px[i + 2]); return s / (px.length / 4); }

  function resize(s) {
    const w = s.w ?? 960; const h = s.h ?? 540;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    }
    gl.viewport(0, 0, w, h);
  }

  window.__renderStorm = (s) => {
    resize(s);
    drawStorm(s);
    if (s.bolt) drawBolt(s.bolt);
    if (s.logo) drawLogo({ ...s.logo, flash: s.flash, time: s.time });
    gl.finish();
    const px = read();
    const out = { mean: meanLum(px), glError: gl.getError() };
    if (s.opacity) Object.assign(out, ambientContrast(px, s.opacity));
    if (s.measureFlash && s.flash) {
      // Flash area: how much of the screen the cloud flash brightens by more
      // than half (and 90%) of its peak brightening. Storm only, no bolt.
      drawStorm(s); gl.finish();
      const lit = read();
      drawStorm({ ...s, flash: 0 }); gl.finish();
      const base = read();
      const W = canvas.width; const H = canvas.height;
      const diff = new Float32Array(W * H); let peak = 0;
      for (let i = 0, j = 0; i < px.length; i += 4, j++) {
        diff[j] = Math.max(0, lum(lit[i], lit[i + 1], lit[i + 2]) - lum(base[i], base[i + 1], base[i + 2]));
        if (diff[j] > peak) peak = diff[j];
      }
      let half = 0; let near = 0;
      for (const d of diff) { if (d > peak * 0.5) half++; if (d > peak * 0.9) near++; }
      out.flashPeakDelta = peak; out.flashAreaHalf = half / diff.length; out.flashAreaNearPeak = near / diff.length;
      drawStorm(s); if (s.bolt) drawBolt(s.bolt); if (s.logo) drawLogo({ ...s.logo, flash: s.flash, time: s.time }); gl.finish();
    }
    return out;
  };

  window.__renderScreen = (s) => {
    resize(s);
    gl.clearColor(0.02, 0.02, 0.03, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    drawScreen(s); gl.finish();
    return { mean: meanLum(read()), glError: gl.getError() };
  };
}
