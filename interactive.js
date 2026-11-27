/* Yoursanctuary — interactive stage (v128).
 *
 * One isolated WebGL scene, mounted only on the third frame of the first
 * session: "Misty pine forest and scattered light".
 *
 *   window.SanctuaryInteractive.mount(host, {
 *     onDepthChange(deep),   // soft audio dip while the hand is held
 *     onSwipe(direction),    // 'up' | 'down' after a |dy| > 65 px vertical swipe
 *   })
 *   window.SanctuaryInteractive.unmount()
 *   window.SanctuaryInteractive.isMounted()
 *   window.SanctuaryInteractive.snapshot()
 *
 * Rules of the relay:
 *   - on mount the video stream is paused (window.SanctuaryPlayer.pause());
 *   - on unmount requestAnimationFrame is cancelled and the WebGL context is
 *     released through WEBGL_lose_context.loseContext();
 *   - devicePixelRatio is capped at 1.5, and if WebGL is unavailable the scene
 *     falls back to a light 2D canvas painting.
 *
 * No third-party 3D library, no external downloads: one fragment shader built from layered
 * value-noise FBM in the natural palette of dream-shadow-06 / dream-shadow-12.
 */
(function () {
  'use strict';

  var PIXEL_RATIO_CAP = 1.5;
  var SWIPE_MIN_PX = 65;
  var OPEN_FAST_MS = 120;
  var CLOSE_SLOW_MS = 1450;

  var host = null;
  var canvas = null;
  var gl = null;
  var program = null;
  var quadBuffer = null;
  var uniforms = {};
  var ctx2d = null;
  var fogLayer = null;
  var fogCtx = null;
  var grainPattern = null;
  var options = {};
  var listeners = [];
  var resizeHandler = null;
  var visibilityHandler = null;
  var rafId = 0;
  var running = false;
  var mounted = false;
  var fallback2d = false;
  var contextLost = false;

  var width = 0;
  var height = 0;
  var dpr = 1;
  var startTime = 0;
  var lastFrameAt = 0;
  var elapsed = 0;
  var reduceMotion = false;

  var pointer = { x: 0.5, y: 0.52, active: false, moved: false };
  var openStrength = 0;
  var openTarget = 0;
  var depthOn = false;
  var gesture = null;
  var seed = 0;

  // ------------------------------------------------------------------ shaders

  var VERTEX_SOURCE = [
    'attribute vec2 aPos;',
    'void main() {',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}',
  ].join('\n');

  var FRAGMENT_SOURCE = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'uniform vec2 uPointer;',
    'uniform float uOpen;',
    '',
    'float hash21(vec2 p) {',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    '',
    'float fbm(vec2 p) {',
    '  float value = 0.0;',
    '  float amp = 0.52;',
    '  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);',
    '  for (int i = 0; i < 4; i++) {',
    '    value += amp * vnoise(p);',
    '    p = rot * p * 2.03 + vec2(11.3, 7.9);',
    '    amp *= 0.5;',
    '  }',
    '  return value;',
    '}',
    '',
    'float trunkField(vec2 uv) {',
    '  float mask = 0.0;',
    '  for (int i = 0; i < 8; i++) {',
    '    float fi = float(i);',
    '    float lane = (fi + 0.5) / 8.0;',
    '    float jitter = (vnoise(vec2(fi * 3.17, 0.6)) - 0.5) * 0.07;',
    '    float x = lane + jitter;',
    '    float w = 0.007 + 0.021 * hash21(vec2(fi, 7.0));',
    '    float body = 1.0 - smoothstep(w * 0.30, w, abs(uv.x - x));',
    '    float lean = (uv.y - 0.5) * (hash21(vec2(fi, 2.0)) - 0.5) * 0.16;',
    '    body *= smoothstep(0.02, 0.32, uv.y + lean);',
    '    body *= mix(1.0, 0.42, smoothstep(0.55, 1.0, uv.y));',
    '    mask = max(mask, body);',
    '  }',
    '  return clamp(mask, 0.0, 1.0);',
    '}',
    '',
    'void main() {',
    '  vec2 res = max(uRes, vec2(1.0));',
    '  vec2 uv = gl_FragCoord.xy / res;',
    '  float aspect = res.x / res.y;',
    '  vec2 puv = vec2(uv.x * aspect, uv.y);',
    '  float t = uTime;',
    '',
    '  /* dream-shadow-06 / dream-shadow-12 palette */',
    '  vec3 deep = vec3(0.122, 0.165, 0.133);   /* #1F2A22 */',
    '  vec3 moss = vec3(0.231, 0.286, 0.243);   /* #3B493E */',
    '  vec3 stone = vec3(0.196, 0.208, 0.196);',
    '  vec3 mist = vec3(0.788, 0.808, 0.788);   /* #C9CEC9 */',
    '  vec3 warm = vec3(0.933, 0.886, 0.780);',
    '',
    '  vec3 col = mix(deep, moss, smoothstep(0.02, 0.92, uv.y));',
    '  col = mix(col, mix(moss, stone, 0.38), (1.0 - smoothstep(0.0, 0.30, uv.y)) * 0.58);',
    '',
    '  /* layered drifting mist */',
    '  vec2 flow = vec2(t * 0.012, -t * 0.006);',
    '  float n1 = fbm(vec2(puv.x * 2.1 + flow.x, uv.y * 2.6 + flow.y));',
    '  float n2 = fbm(vec2(puv.x * 4.3 - flow.x * 1.7, uv.y * 4.9 + flow.y * 1.4 + 4.0));',
    '  float n3 = vnoise(vec2(puv.x * 7.7 + flow.x * 2.6, uv.y * 7.2 - flow.y * 2.2 + 9.0));',
    '  float band = smoothstep(0.02, 0.38, uv.y) * (1.0 - smoothstep(0.72, 1.0, uv.y) * 0.55);',
    '  float fog = smoothstep(0.34, 0.86, n1 * 0.62 + n2 * 0.26 + n3 * 0.12 + 0.10);',
    '  fog *= band;',
    '',
    '  /* the hand opens a soft window in the mist */',
    '  vec2 finger = uPointer * vec2(aspect, 1.0);',
    '  float dist = length(puv - finger);',
    '  float open = uOpen * (1.0 - smoothstep(0.04, 0.62, dist));',
    '  float halo = uOpen * (1.0 - smoothstep(0.10, 0.95, dist));',
    '',
    '  /* scattered daylight through the canopy */',
    '  float beams = 1.0 - smoothstep(0.02, 0.52, abs(puv.x - 0.72 + (1.0 - uv.y) * 0.26));',
    '  beams *= smoothstep(0.10, 0.95, uv.y);',
    '  float light = (0.16 + 0.84 * beams) * (0.30 + 0.70 * halo) + 0.22 * halo;',
    '  vec3 lit = mix(warm, mist, 0.28) * light;',
    '',
    '  /* trunk silhouettes: in front of the mist, behind the closest fog */',
    '  float trunks = trunkField(vec2(uv.x * 0.94 + 0.03, uv.y));',
    '  col = mix(col, deep * 0.62, trunks * 0.86);',
    '  col = mix(col, lit * 0.55, trunks * beams * 0.24);',
    '',
    '  float fogOpen = fog * (1.0 - 0.92 * open);',
    '  col = mix(col, mist * 0.96, fogOpen * 0.62);',
    '  col = mix(col, mist * 1.02, smoothstep(0.55, 1.0, uv.y) * 0.28 * (1.0 - open));',
    '',
    '  /* warm light pours through the opened gap */',
    '  col += warm * open * 0.35 * (0.35 + 0.65 * beams);',
    '  col += warm * halo * 0.06;',
    '',
    '  /* wet stone floor */',
    '  float floorMask = 1.0 - smoothstep(0.0, 0.22, uv.y);',
    '  float wet = fbm(vec2(puv.x * 5.0 + t * 0.02, uv.y * 9.0 - t * 0.01));',
    '  col = mix(col, mix(stone, deep, 0.55) * (0.55 + 0.45 * wet), floorMask * 0.45);',
    '',
    '  /* sparse drizzle */',
    '  float rain = 0.0;',
    '  for (int i = 0; i < 3; i++) {',
    '    float fi = float(i);',
    '    vec2 rp = vec2(puv.x * 46.0 + fi * 17.0 + t * 0.20, uv.y * 26.0 + t * 0.85 + fi * 9.0);',
    '    vec2 cell = floor(rp);',
    '    vec2 f = fract(rp) - 0.5;',
    '    float s = hash21(cell + fi * 3.1);',
    '    float drop = (1.0 - smoothstep(0.0, 0.05, abs(f.x))) * (1.0 - smoothstep(0.0, 0.26, abs(f.y)));',
    '    rain += drop * step(0.90, s) * (0.55 + 0.45 * s);',
    '  }',
    '  col += mist * rain * 0.16 * (1.0 - open * 0.5);',
    '',
    '  /* 35 mm grain and a soft vignette */',
    '  float grain = hash21(gl_FragCoord.xy * 0.9 + vec2(t * 37.0, t * 17.0));',
    '  col += (grain - 0.5) * 0.045;',
    '  float vig = 1.0 - smoothstep(0.35, 1.15, length((uv - vec2(0.5, 0.56)) * vec2(1.0, 1.15)) * 1.25);',
    '  col *= mix(0.72, 1.0, vig);',
    '',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  // ------------------------------------------------------------- gl plumbing

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('shader compile failed: ' + log);
    }
    return shader;
  }

  function buildProgram() {
    var vertex = compile(gl.VERTEX_SHADER, VERTEX_SOURCE);
    var fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
    var linked = gl.createProgram();
    gl.attachShader(linked, vertex);
    gl.attachShader(linked, fragment);
    gl.linkProgram(linked);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(linked);
      gl.deleteProgram(linked);
      throw new Error('program link failed: ' + log);
    }
    program = linked;
    uniforms = {
      resolution: gl.getUniformLocation(program, 'uRes'),
      time: gl.getUniformLocation(program, 'uTime'),
      pointer: gl.getUniformLocation(program, 'uPointer'),
      open: gl.getUniformLocation(program, 'uOpen'),
    };
    quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    var position = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  function releaseWebGL() {
    if (!gl) return;
    try {
      if (program) gl.deleteProgram(program);
      if (quadBuffer) gl.deleteBuffer(quadBuffer);
    } catch (_) {}
    try {
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose && typeof lose.loseContext === 'function') lose.loseContext();
    } catch (_) {}
    program = null;
    quadBuffer = null;
    uniforms = {};
    gl = null;
  }

  // ----------------------------------------------------------- 2D fallback art

  function makeGrainPattern() {
    if (!ctx2d) return null;
    var tile = document.createElement('canvas');
    tile.width = 96;
    tile.height = 96;
    var tctx = tile.getContext('2d');
    if (!tctx) return null;
    var image = tctx.createImageData(96, 96);
    for (var i = 0; i < image.data.length; i += 4) {
      var v = 120 + Math.floor(Math.random() * 90);
      image.data[i] = v;
      image.data[i + 1] = v;
      image.data[i + 2] = v;
      image.data[i + 3] = 26;
    }
    tctx.putImageData(image, 0, 0);
    return ctx2d.createPattern(tile, 'repeat');
  }

  function ensureFogLayer() {
    if (!fogLayer) {
      fogLayer = document.createElement('canvas');
    }
    if (fogLayer.width !== width || fogLayer.height !== height) {
      fogLayer.width = width;
      fogLayer.height = height;
      fogCtx = fogLayer.getContext('2d');
    }
    return fogCtx;
  }

  function drawTrunks2d(ctx, w, h, t) {
    for (var i = 0; i < 9; i += 1) {
      var lane = (i + 0.5) / 9;
      var jitter = (hash2(i * 3.17, 0.6) - 0.5) * 0.06;
      var x = (lane + jitter) * w;
      var wide = (0.010 + 0.028 * hash2(i, 7.0)) * w;
      var lean = (hash2(i, 2.0) - 0.5) * w * 0.035;
      var top = h * (0.02 + 0.10 * hash2(i, 4.0));
      ctx.save();
      ctx.globalAlpha = 0.86;
      ctx.fillStyle = 'rgba(12,18,14,0.92)';
      ctx.beginPath();
      ctx.moveTo(x - wide * 0.5, h);
      ctx.lineTo(x - wide * 0.30 + lean, top);
      ctx.lineTo(x + wide * 0.30 + lean, top);
      ctx.lineTo(x + wide * 0.5, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFog2d(ctx, w, h, t, px, py, open) {
    ensureFogLayer();
    if (!fogCtx) return;
    var f = fogCtx;
    f.clearRect(0, 0, w, h);
    var layers = [
      { y: 0.48, amp: 0.09, speed: 11, alpha: 0.34, size: 1.7 },
      { y: 0.64, amp: 0.13, speed: 7, alpha: 0.30, size: 2.3 },
      { y: 0.80, amp: 0.10, speed: 5, alpha: 0.26, size: 3.1 },
    ];
    for (var i = 0; i < layers.length; i += 1) {
      var layer = layers[i];
      var drift = Math.sin((t * layer.speed) / 1000 + i * 1.7) * w * 0.06;
      var cy = h * layer.y + Math.sin((t * layer.speed) / 1400 + i) * h * layer.amp;
      var gradient = f.createLinearGradient(0, cy - h * 0.16, 0, cy + h * 0.16);
      gradient.addColorStop(0, 'rgba(201,206,201,0)');
      gradient.addColorStop(0.42, 'rgba(201,206,201,' + layer.alpha + ')');
      gradient.addColorStop(1, 'rgba(201,206,201,0)');
      f.fillStyle = gradient;
      f.fillRect(-w * 0.2 + drift, cy - h * 0.18, w * 1.4, h * 0.36);
      var blob = f.createRadialGradient(
        w * (0.2 + 0.2 * i) + drift, cy, 0,
        w * (0.2 + 0.2 * i) + drift, cy, w * 0.24 * layer.size
      );
      blob.addColorStop(0, 'rgba(201,206,201,' + layer.alpha * 0.9 + ')');
      blob.addColorStop(1, 'rgba(201,206,201,0)');
      f.fillStyle = blob;
      f.fillRect(0, 0, w, h);
    }
    if (open > 0.01) {
      var radius = Math.min(w, h) * (0.20 + 0.16 * open);
      var hole = f.createRadialGradient(px, py, radius * 0.12, px, py, radius);
      hole.addColorStop(0, 'rgba(0,0,0,' + 0.92 * open + ')');
      hole.addColorStop(0.55, 'rgba(0,0,0,' + 0.42 * open + ')');
      hole.addColorStop(1, 'rgba(0,0,0,0)');
      f.globalCompositeOperation = 'destination-out';
      f.fillStyle = hole;
      f.fillRect(0, 0, w, h);
      f.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(fogLayer, 0, 0, w, h);
  }

  function render2d(ctx, w, h, t, px, py, open) {
    var base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#141d16');
    base.addColorStop(0.42, '#1F2A22');
    base.addColorStop(0.78, '#3B493E');
    base.addColorStop(1, '#222c24');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(w * 0.74, h * 0.08, 0, w * 0.74, h * 0.08, w * 0.85);
    glow.addColorStop(0, 'rgba(232,222,201,' + (0.16 + 0.20 * open) + ')');
    glow.addColorStop(0.45, 'rgba(201,206,201,0.10)');
    glow.addColorStop(1, 'rgba(201,206,201,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    drawTrunks2d(ctx, w, h, t);
    drawFog2d(ctx, w, h, t, px, py, open);

    if (open > 0.01) {
      var spill = ctx.createRadialGradient(px, py, 0, px, py, Math.min(w, h) * (0.22 + 0.18 * open));
      spill.addColorStop(0, 'rgba(238,229,206,' + 0.30 * open + ')');
      spill.addColorStop(0.6, 'rgba(201,206,201,' + 0.10 * open + ')');
      spill.addColorStop(1, 'rgba(201,206,201,0)');
      ctx.fillStyle = spill;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.strokeStyle = 'rgba(201,206,201,0.22)';
    ctx.lineWidth = Math.max(1, dpr * 0.6);
    for (var i = 0; i < 44; i += 1) {
      var rx = ((i * 71) % 100) / 100 * w;
      var phase = ((t * 0.06 + i * 13) % (h + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(rx, phase);
      ctx.lineTo(rx - 2, phase + 12);
      ctx.stroke();
    }

    if (grainPattern) {
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = grainPattern;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }

    var vignette = ctx.createRadialGradient(w * 0.5, h * 0.54, Math.min(w, h) * 0.30, w * 0.5, h * 0.54, Math.max(w, h) * 0.78);
    vignette.addColorStop(0, 'rgba(6,8,7,0)');
    vignette.addColorStop(1, 'rgba(6,8,7,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  function hash2(a, b) {
    var s = Math.sin(a * 127.1 + b * 311.7 + seed * 0.001) * 43758.5453;
    return s - Math.floor(s);
  }

  // ------------------------------------------------------------------ drawing

  function renderWebGL(t) {
    if (!gl || !program) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    // uRes is the device-pixel size of the drawing buffer, so gl_FragCoord / uRes
    // stays in 0..1 at any devicePixelRatio.
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, t);
    gl.uniform2f(uniforms.pointer, pointer.x, 1 - pointer.y);
    gl.uniform1f(uniforms.open, openStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function render2dScene(t) {
    if (!ctx2d) return;
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    render2d(
      ctx2d,
      width,
      height,
      t,
      pointer.x * width,
      pointer.y * height,
      openStrength
    );
  }

  function frame(now) {
    if (!running) return;
    rafId = window.requestAnimationFrame(frame);
    var dt = lastFrameAt ? Math.min(80, now - lastFrameAt) : 16;
    lastFrameAt = now;
    elapsed += dt;
    var t = (reduceMotion ? elapsed * 0.35 : elapsed) / 1000;

    var rate = openTarget > openStrength ? OPEN_FAST_MS : CLOSE_SLOW_MS;
    var step = Math.min(1, dt / rate);
    openStrength += (openTarget - openStrength) * step;
    if (Math.abs(openTarget - openStrength) < 0.002) openStrength = openTarget;

    if (fallback2d) render2dScene(t);
    else renderWebGL(t);
  }

  function startLoop() {
    if (running) return;
    running = true;
    lastFrameAt = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  // ------------------------------------------------------------------- sizing

  function measure() {
    if (!host) return;
    var rect = host.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
    height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
    dpr = Math.min(PIXEL_RATIO_CAP, Math.max(1, window.devicePixelRatio || 1));
    if (canvas) {
      var nextWidth = Math.round(width * dpr);
      var nextHeight = Math.round(height * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }
    if (fogLayer && (fogLayer.width !== width || fogLayer.height !== height)) {
      fogLayer.width = width;
      fogLayer.height = height;
      fogCtx = fogLayer.getContext('2d');
    }
  }

  function onResize() {
    measure();
  }

  // --------------------------------------------------------------- interaction

  function setDepth(on) {
    if (on === depthOn) return;
    depthOn = on;
    if (typeof options.onDepthChange === 'function') {
      try { options.onDepthChange(on); } catch (_) {}
    }
  }

  function localPoint(event) {
    var rect = host.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / Math.max(1, rect.width),
      y: (event.clientY - rect.top) / Math.max(1, rect.height),
    };
  }

  function beginGesture(point) {
    gesture = {
      x0: point.x,
      y0: point.y,
      dx: 0,
      dy: 0,
      moved: false,
      at: performance.now(),
      active: true,
    };
    pointer.active = true;
    pointer.moved = false;
    pointer.x = point.x;
    pointer.y = point.y;
    openTarget = 1;
    setDepth(true);
  }

  function moveGesture(point) {
    if (!gesture || !gesture.active) return;
    pointer.x = point.x;
    pointer.y = point.y;
    gesture.dx = point.x - gesture.x0;
    gesture.dy = point.y - gesture.y0;
    if (Math.abs(gesture.dy) * height > 10 || Math.abs(gesture.dx) * width > 10) {
      gesture.moved = true;
      pointer.moved = true;
    }
  }

  function endGesture(point) {
    if (!gesture) return;
    moveGesture(point);
    var dxPx = gesture.dx * width;
    var dyPx = gesture.dy * height;
    gesture.active = false;
    pointer.active = false;
    openTarget = 0;
    setDepth(false);
    var vertical = Math.abs(dyPx) > SWIPE_MIN_PX && Math.abs(dyPx) > Math.abs(dxPx) * 1.1;
    if (vertical) {
      var direction = dyPx < 0 ? 'up' : 'down';
      finishWithSwipe(direction);
      return;
    }
    gesture = null;
  }

  function cancelGesture() {
    gesture = null;
    pointer.active = false;
    openTarget = 0;
    setDepth(false);
  }

  function finishWithSwipe(direction) {
    gesture = null;
    pointer.active = false;
    openTarget = 0;
    setDepth(false);
    unmount();
    if (typeof options.onSwipe === 'function') {
      try { options.onSwipe(direction); } catch (_) {}
    }
  }

  function bindListener(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    listeners.push(function () {
      target.removeEventListener(type, handler, opts);
    });
  }

  function attachEvents() {
    if (!host) return;

    bindListener(host, 'touchstart', function (event) {
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
      if (event.touches.length !== 1) {
        cancelGesture();
        return;
      }
      var touch = event.touches[0];
      beginGesture(localPoint(touch));
    }, { passive: false });

    bindListener(host, 'touchmove', function (event) {
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
      if (event.touches.length !== 1) return;
      moveGesture(localPoint(event.touches[0]));
    }, { passive: false });

    bindListener(host, 'touchend', function (event) {
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
      var touch = event.changedTouches && event.changedTouches[0];
      if (!gesture) return;
      endGesture(touch ? localPoint(touch) : { x: pointer.x, y: pointer.y });
    }, { passive: false });

    bindListener(host, 'touchcancel', function () {
      cancelGesture();
    }, { passive: true });

    bindListener(host, 'pointerdown', function (event) {
      if (event.pointerType === 'touch') return;
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
      beginGesture(localPoint(event));
      if (host.setPointerCapture) {
        try { host.setPointerCapture(event.pointerId); } catch (_) {}
      }
    });

    bindListener(host, 'pointermove', function (event) {
      if (event.pointerType === 'touch') return;
      if (!gesture) return;
      event.stopPropagation();
      moveGesture(localPoint(event));
    });

    bindListener(host, 'pointerup', function (event) {
      if (event.pointerType === 'touch') return;
      if (!gesture) return;
      event.stopPropagation();
      endGesture(localPoint(event));
    });

    bindListener(host, 'pointercancel', function (event) {
      if (event.pointerType === 'touch') return;
      cancelGesture();
    });

    // The page owns wheel / click / keyboard navigation; the scene keeps them
    // inside itself so the relay never fights the stream behind it.
    bindListener(host, 'wheel', function (event) {
      event.stopPropagation();
    }, { passive: true });

    bindListener(host, 'click', function (event) {
      event.stopPropagation();
    }, { passive: true });

    resizeHandler = function () { onResize(); };
    bindListener(window, 'resize', resizeHandler, { passive: true });
    if (typeof ResizeObserver === 'function') {
      var observer = new ResizeObserver(function () { onResize(); });
      observer.observe(host);
      listeners.push(function () { observer.disconnect(); });
    }
  }

  function attachVisibility() {
    visibilityHandler = function () {
      if (document.hidden) stopLoop();
      else if (mounted) {
        lastFrameAt = 0;
        startLoop();
      }
    };
    bindListener(document, 'visibilitychange', visibilityHandler, { passive: true });
  }

  // -------------------------------------------------------------- mount/unmount

  function createCanvas() {
    var layer = document.createElement('canvas');
    layer.className = 'interactive-canvas';
    layer.setAttribute('aria-hidden', 'true');
    return layer;
  }

  // A canvas is locked to one context type, so the lightweight 2D fallback
  // always gets a fresh surface instead of asking a WebGL canvas for 2D.
  function initFallback2d() {
    stopLoop();
    if (canvas) {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    canvas = createCanvas();
    ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      canvas = null;
      return false;
    }
    fallback2d = true;
    grainPattern = makeGrainPattern();
    if (host && mounted) {
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      host.appendChild(canvas);
      measure();
      startLoop();
    }
    return true;
  }

  function onContextLost(event) {
    event.preventDefault();
    contextLost = true;
    if (!mounted) return;
    releaseWebGL();
    initFallback2d();
  }

  function initWebGL() {
    canvas = createCanvas();
    try {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      }) || canvas.getContext('experimental-webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
      });
    } catch (_) {
      gl = null;
    }
    if (!gl) return initFallback2d();
    try {
      buildProgram();
    } catch (error) {
      releaseWebGL();
      return initFallback2d();
    }
    canvas.addEventListener('webglcontextlost', onContextLost);
    return true;
  }

  function unmount() {
    if (!mounted && !canvas) return false;
    mounted = false;
    stopLoop();
    setDepth(false);
    for (var i = 0; i < listeners.length; i += 1) {
      try { listeners[i](); } catch (_) {}
    }
    listeners = [];
    resizeHandler = null;
    visibilityHandler = null;
    releaseWebGL();
    ctx2d = null;
    fogLayer = null;
    fogCtx = null;
    grainPattern = null;
    if (canvas && canvas.parentNode) {
      try { canvas.parentNode.removeChild(canvas); } catch (_) {}
    }
    if (host && host.classList) host.classList.remove('is-live');
    canvas = null;
    host = null;
    pointer.active = false;
    gesture = null;
    openStrength = 0;
    openTarget = 0;
    elapsed = 0;
    lastFrameAt = 0;
    return true;
  }

  function mount(target, config) {
    if (!target || typeof target.appendChild !== 'function') return false;
    if (mounted) unmount();
    host = target;
    options = config || {};
    mounted = true;
    fallback2d = false;
    contextLost = false;
    reduceMotion = false;
    try {
      reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}
    seed = Math.random() * 1000;
    startTime = performance.now();
    elapsed = 0;
    pointer = { x: 0.5, y: 0.52, active: false, moved: false };
    openStrength = 0;
    openTarget = 0;
    depthOn = false;

    // GPU relay: the stream yields the screen while the scene owns it.
    var player = window.SanctuaryPlayer;
    if (player && typeof player.pause === 'function') {
      try { player.pause(); } catch (_) {}
    }

    if (!initWebGL()) {
      mounted = false;
      host = null;
      return false;
    }
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    host.appendChild(canvas);
    measure();
    attachEvents();
    attachVisibility();
    if (host.classList) host.classList.add('is-live');
    startLoop();
    return true;
  }

  function snapshot() {
    return {
      mounted: mounted,
      fallback: fallback2d,
      contextLost: contextLost,
      dpr: dpr,
      width: width,
      height: height,
      open: Math.round(openStrength * 1000) / 1000,
      depth: depthOn,
      pointer: { x: Math.round(pointer.x * 1000) / 1000, y: Math.round(pointer.y * 1000) / 1000 },
      hasContext: Boolean(gl),
      running: running,
      sinceStartMs: startTime ? Math.round(performance.now() - startTime) : 0,
    };
  }

  window.SanctuaryInteractive = {
    mount: mount,
    unmount: unmount,
    isMounted: function () { return mounted; },
    snapshot: snapshot,
    version: '128',
  };
})();
