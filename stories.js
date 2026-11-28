/* Yoursanctuary — volumetric mist stories (v132).
 *
 * One isolated module, window.SanctuaryStories. It paints a deep natural mist
 * over the live 1080p frame: no video filters, no procedural trunks, no flat
 * matte fill — only 66 overlapping soft cloud puffs in cool morning haze and
 * shadowed forest moisture, slowly breathing above the stream.
 *
 *   window.SanctuaryStories.enter({ onCleared, onInteract, onGesturePrime, onProgress })
 *   window.SanctuaryStories.exit()
 *   window.SanctuaryStories.isActive()
 *   window.SanctuaryStories.snapshot()
 *
 * The visitor sweeps a wide soft brush through the mist, or simply rests a
 * finger on one spot: every 180 ms of contact opens the haze a little wider, so
 * even a slow, almost motionless touch always reaches the threshold. A 16 × 28
 * grid counts the cleared area; at 65 % the remaining haze fades out over
 * 850 ms, the canvas stops catching touches and hides itself.
 *
 * v132: the touch handlers forward the raw gesture through onGesturePrime()
 * before sealing the event, so app.js can unlock the AudioContext from a real
 * mobile touch. Every 5 % of clearing is reported through onProgress(), which
 * lets the soundtrack open from 45 % to 100 % together with the picture.
 *
 * Until that threshold is crossed the surface owns every pointer and touch
 * event: no up, down or sideways movement of the finger is allowed to advance
 * the feed, and the swipe handlers in app.js stay locked out (storyActive).
 */
(function () {
  'use strict';

  var GRID_COLS = 16;
  var GRID_ROWS = 28;
  var CLEAR_TARGET = 65;
  var FADE_MS = 850;
  var DPR_CAP = 1.5;
  var BRUSH_MIN_PX = 80;
  var BRUSH_MAX_PX = 95;
  var BRUSH_ALPHA = 0.45;
  var HOLD_TICK_MS = 180;
  var HOLD_STEP_RATIO = 0.045;
  var HOLD_MAX_RATIO = 1.05;
  var HOLD_ALPHA = 0.16;
  var HOLD_DRIFT_PX = 16;
  var LAYER_PAD = 120;
  var FRAME_MIN_MS = 30;

  var COOL = '210, 218, 213';
  var SHADOW = '148, 162, 154';

  var canvas = null;
  var ctx = null;
  var maskCanvas = null;
  var maskCtx = null;
  var layers = [];
  var options = {};
  var listeners = [];
  var rafId = 0;
  var running = false;
  var active = false;
  var clearing = false;
  var cleared = false;
  var width = 0;
  var height = 0;
  var dpr = 1;
  var brushRadius = 88;
  var cellWidth = 1;
  var cellHeight = 1;
  var clearedCells = 0;
  var clearedPercent = 0;
  var lastReportedPercent = 0;
  var clearedMask = null;
  var startAt = 0;
  var lastDrawAt = 0;
  var fadeTimer = 0;
  var resizeTimer = 0;
  var gesture = null;
  var holdTimer = 0;
  var holdTicks = 0;
  var holdX = 0;
  var holdY = 0;
  var seed = 1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function nextSeed() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  function beginSeed() {
    seed = ((Date.now() & 0xffff) ^ (Math.random() * 0xffff)) >>> 0 || 1;
    for (var i = 0; i < 4; i += 1) nextSeed();
  }

  function rgba(triplet, alpha) {
    return 'rgba(' + triplet + ', ' + alpha + ')';
  }

  // ------------------------------------------------------------------ geometry

  function measure() {
    if (!canvas) return false;
    var rect = canvas.getBoundingClientRect();
    var w = rect.width || window.innerWidth || 0;
    var h = rect.height || window.innerHeight || 0;
    if (!w || !h) return false;
    width = Math.max(1, Math.round(w));
    height = Math.max(1, Math.round(h));
    dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
    var pixelWidth = Math.round(width * dpr);
    var pixelHeight = Math.round(height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    brushRadius = clamp(width * 0.23, BRUSH_MIN_PX, BRUSH_MAX_PX);
    cellWidth = width / GRID_COLS;
    cellHeight = height / GRID_ROWS;
    return true;
  }

  // --------------------------------------------------------------- fog layers

  function makeLayerCanvas() {
    var layer = document.createElement('canvas');
    layer.width = width + LAYER_PAD * 2;
    layer.height = height + LAYER_PAD * 2;
    return layer;
  }

  function paintPuff(target, x, y, radius, stretch, color) {
    target.save();
    target.translate(x, y);
    target.scale(stretch, 1);
    var gradient = target.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, rgba(color, 0.26));
    gradient.addColorStop(0.45, rgba(color, 0.23));
    gradient.addColorStop(0.75, rgba(color, 0.14));
    gradient.addColorStop(1, rgba(color, 0));
    target.fillStyle = gradient;
    target.beginPath();
    target.arc(0, 0, radius, 0, Math.PI * 2);
    target.fill();
    target.restore();
  }

  function buildLayers() {
    layers = [];
    var specs = [
      { count: 22, alpha: 0.75, drift: 12, period: 19000, phase: 0.0, scale: 1.45 },
      { count: 24, alpha: 0.65, drift: 20, period: 25000, phase: 1.7, scale: 1.8 },
      { count: 20, alpha: 0.55, drift: 28, period: 33000, phase: 3.1, scale: 2.25 },
    ];
    for (var s = 0; s < specs.length; s += 1) {
      var spec = specs[s];
      var layerCanvas = makeLayerCanvas();
      var layerCtx = layerCanvas.getContext('2d');
      if (!layerCtx) continue;
      var boardWidth = layerCanvas.width;
      var boardHeight = layerCanvas.height;
      // Stratified placement keeps every band of the frame veiled, so the mist
      // reads as one deep body of air instead of a few detached clouds.
      var cols = 4;
      var rows = Math.ceil(spec.count / cols);
      var boardCellW = boardWidth / cols;
      var boardCellH = boardHeight / rows;
      for (var i = 0; i < spec.count; i += 1) {
        var radius = (0.085 + nextSeed() * 0.155) * Math.min(width, height) * spec.scale;
        radius = clamp(radius, 34, Math.max(width, height) * 0.48);
        var x = ((i % cols) + 0.12 + nextSeed() * 0.76) * boardCellW;
        var y = (Math.floor(i / cols) + 0.12 + nextSeed() * 0.76) * boardCellH;
        var stretch = 1.15 + nextSeed() * 0.95;
        var color = nextSeed() < 0.58 ? COOL : SHADOW;
        paintPuff(layerCtx, x, y, radius, stretch, color);
      }
      layers.push({
        canvas: layerCanvas,
        alpha: spec.alpha,
        drift: spec.drift,
        period: spec.period,
        phase: spec.phase,
      });
    }
  }

  function buildMask() {
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = Math.round(width * dpr);
    maskCanvas.height = Math.round(height * dpr);
    maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return false;
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clearedMask = new Uint8Array(GRID_COLS * GRID_ROWS);
    clearedCells = 0;
    clearedPercent = 0;
    lastReportedPercent = 0;
    return true;
  }

  function rebuildScene() {
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    if (!ctx) return;
    buildLayers();
    buildMask();
  }

  // ------------------------------------------------------------------ painting

  function drawFrame(now) {
    if (!ctx) return;
    var t = Math.max(0, now - startAt) / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (var i = 0; i < layers.length; i += 1) {
      var layer = layers[i];
      var wave = t * (Math.PI * 2) / (layer.period / 1000) + layer.phase;
      var dx = Math.sin(wave) * layer.drift;
      var dy = Math.cos(wave * 0.73) * layer.drift * 0.55;
      ctx.globalAlpha = clamp(layer.alpha + Math.sin(wave * 1.17) * 0.05, 0.16, 0.90);
      ctx.drawImage(
        layer.canvas,
        -LAYER_PAD + dx,
        -LAYER_PAD + dy,
        width + LAYER_PAD * 2,
        height + LAYER_PAD * 2
      );
    }
    ctx.globalAlpha = 1;
    if (maskCanvas) {
      // The brush paints into an accumulated mask; the frame composites it with
      // destination-out so the breathing clouds stay alive while holes persist.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(maskCanvas, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function paintStamp(x, y) {
    if (!maskCtx || clearing) return;
    maskCtx.globalCompositeOperation = 'source-over';
    var gradient = maskCtx.createRadialGradient(x, y, 0, x, y, brushRadius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, ' + BRUSH_ALPHA + ')');
    gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.26)');
    gradient.addColorStop(0.78, 'rgba(0, 0, 0, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, brushRadius, 0, Math.PI * 2);
    maskCtx.fill();
    markCleared(x, y);
  }

  function paintLine(x0, y0, x1, y1) {
    var dx = x1 - x0;
    var dy = y1 - y0;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var spacing = Math.max(6, brushRadius * 0.26);
    var steps = Math.max(1, Math.ceil(distance / spacing));
    for (var i = 1; i <= steps; i += 1) {
      var ratio = i / steps;
      paintStamp(x0 + dx * ratio, y0 + dy * ratio);
    }
  }

  // The light 16 × 28 grid counts how much of the frame the palm has opened.
  function markCleared(x, y, reachRadius) {
    if (!clearedMask) return;
    var reach = reachRadius || brushRadius * 0.7;
    var minCol = clamp(Math.floor((x - reach) / cellWidth), 0, GRID_COLS - 1);
    var maxCol = clamp(Math.floor((x + reach) / cellWidth), 0, GRID_COLS - 1);
    var minRow = clamp(Math.floor((y - reach) / cellHeight), 0, GRID_ROWS - 1);
    var maxRow = clamp(Math.floor((y + reach) / cellHeight), 0, GRID_ROWS - 1);
    for (var row = minRow; row <= maxRow; row += 1) {
      var centerY = (row + 0.5) * cellHeight;
      for (var col = minCol; col <= maxCol; col += 1) {
        var index = row * GRID_COLS + col;
        if (clearedMask[index]) continue;
        var centerX = (col + 0.5) * cellWidth;
        var ox = centerX - x;
        var oy = centerY - y;
        if (ox * ox + oy * oy > reach * reach) continue;
        clearedMask[index] = 1;
        clearedCells += 1;
      }
    }
    clearedPercent = Math.round((clearedCells / clearedMask.length) * 100);
    reportProgress(false);
    if (clearedPercent >= CLEAR_TARGET && !clearing) completeClear();
  }

  // v132: app.js opens the mist soundtrack proportionally to the cleaned area.
  // The hook fires at every >= 5 % step (and once with the final 65 %), never on
  // every brush stamp, so the gain ramp stays smooth and cheap.
  function reportProgress(force) {
    if (typeof options.onProgress !== 'function') return;
    if (clearedPercent <= lastReportedPercent) return;
    if (!force && clearedPercent - lastReportedPercent < 5) return;
    lastReportedPercent = clearedPercent;
    try { options.onProgress({ clearedPercent: clearedPercent }); } catch (_) {}
  }

  // --------------------------------------------------------------- completion

  function completeClear() {
    if (clearing || !canvas) return;
    clearing = true;
    gesture = null;
    stopHoldDissolve();
    clearedPercent = Math.max(clearedPercent, CLEAR_TARGET);
    reportProgress(true);
    canvas.classList.add('is-clearing');
    canvas.classList.remove('is-active');
    if (typeof options.onCleared === 'function') {
      try { options.onCleared({ clearedPercent: clearedPercent }); } catch (_) {}
    }
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(finishCleared, FADE_MS);
  }

  function finishCleared() {
    fadeTimer = 0;
    cleared = true;
    active = false;
    clearing = false;
    gesture = null;
    stopHoldDissolve();
    stopLoop();
    detachEvents();
    releaseScene();
    if (canvas) {
      canvas.classList.remove('is-clearing', 'is-active');
      canvas.hidden = true;
    }
  }

  function releaseScene() {
    layers = [];
    maskCanvas = null;
    maskCtx = null;
    clearedMask = null;
    ctx = null;
  }

  // ------------------------------------------------------------------ gesture

  function localPoint(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function paintOpening(x, y, radius, alpha) {
    if (!maskCtx || clearing) return;
    maskCtx.globalCompositeOperation = 'source-over';
    var gradient = maskCtx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(0, 0, 0, ' + alpha + ')');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, ' + alpha * 0.72 + ')');
    gradient.addColorStop(0.86, 'rgba(0, 0, 0, ' + alpha * 0.34 + ')');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    maskCtx.fillStyle = gradient;
    maskCtx.beginPath();
    maskCtx.arc(x, y, radius, 0, Math.PI * 2);
    maskCtx.fill();
    markCleared(x, y, radius * 0.82);
  }

  function stopHoldDissolve() {
    if (holdTimer) {
      window.clearInterval(holdTimer);
      holdTimer = 0;
    }
    holdTicks = 0;
  }

  // v131: the soundscape breathes with the palm — app.js hears the first touch
  // (primeAudioGesture) and the release, while the 65 % clearing opens the mix.
  function notifyInteract(touching) {
    if (typeof options.onInteract !== 'function') return;
    try { options.onInteract(touching === true); } catch (_) {}
  }

  // v132: the surface seals every event so the feed never swipes, but the raw
  // gesture must still reach app.js first: iOS Safari only unlocks the
  // AudioContext from inside the original touchend/pointerdown handler.
  function notifyGesturePrime() {
    if (typeof options.onGesturePrime !== 'function') return;
    try { options.onGesturePrime(); } catch (_) {}
  }

  // A resting finger still dissolves the haze: every 180 ms the opening around
  // the touch point grows a little, so a slow, almost motionless touch reaches
  // 65 % on its own instead of leaving the frame stuck under the mist.
  function holdDissolve() {
    if (!active || clearing || !gesture || !maskCtx) {
      stopHoldDissolve();
      return;
    }
    var x = gesture.x;
    var y = gesture.y;
    if (Math.abs(x - holdX) + Math.abs(y - holdY) > HOLD_DRIFT_PX) holdTicks = 0;
    holdX = x;
    holdY = y;
    holdTicks += 1;
    // The step scales with the viewport, so a resting finger reaches the
    // threshold in ~1.5–3.5 s on any screen, wherever it touches down.
    var span = Math.max(width, height);
    var radius = Math.min(
      brushRadius + holdTicks * span * HOLD_STEP_RATIO,
      span * HOLD_MAX_RATIO
    );
    paintOpening(x, y, radius, HOLD_ALPHA);
  }

  function startHoldDissolve() {
    stopHoldDissolve();
    if (!active || clearing) return;
    holdTimer = window.setInterval(holdDissolve, HOLD_TICK_MS);
  }

  function beginGesture(point) {
    gesture = {
      x0: point.x,
      y0: point.y,
      x: point.x,
      y: point.y,
      t0: performance.now(),
    };
    holdX = point.x;
    holdY = point.y;
    holdTicks = 0;
    notifyInteract(true);
    paintStamp(point.x, point.y);
    startHoldDissolve();
  }

  // v130: no movement of the palm may advance the feed. Every up, down or
  // sideways stroke only widens the clearing; the frame moves on solely after
  // the 65 % threshold has switched this surface off.
  function moveGesture(point) {
    if (!gesture) return;
    paintLine(gesture.x, gesture.y, point.x, point.y);
    // The 65 % threshold can complete while this very stroke is being painted;
    // completeClear() drops the gesture, so never touch it again unguarded.
    if (!gesture) return;
    gesture.x = point.x;
    gesture.y = point.y;
  }

  function endGesture(point) {
    if (!gesture) return;
    paintLine(gesture.x, gesture.y, point.x, point.y);
    gesture = null;
    stopHoldDissolve();
    notifyInteract(false);
  }

  // -------------------------------------------------------------------- events

  function listen(target, type, handler, opts) {
    target.addEventListener(type, handler, opts);
    listeners.push(function () {
      target.removeEventListener(type, handler, opts);
    });
  }

  function seal(event) {
    if (!event) return;
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();
  }

  function attachEvents() {
    var surface = canvas;
    listen(surface, 'touchstart', function (event) {
      if (!active && !clearing) return;
      notifyGesturePrime();
      seal(event);
      if (clearing) {
        // The cleared haze is still fading: keep this touch away from the feed.
        gesture = null;
        stopHoldDissolve();
        return;
      }
      if (event.touches.length !== 1) {
        gesture = null;
        stopHoldDissolve();
        return;
      }
      var touch = event.touches[0];
      beginGesture(localPoint(touch.clientX, touch.clientY));
    }, { passive: false });

    listen(surface, 'touchmove', function (event) {
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing || !gesture || event.touches.length !== 1) return;
      var touch = event.touches[0];
      moveGesture(localPoint(touch.clientX, touch.clientY));
    }, { passive: false });

    listen(surface, 'touchend', function (event) {
      if (!active && !clearing) return;
      notifyGesturePrime();
      seal(event);
      if (!active || clearing) return;
      if (!gesture) return;
      var touch = event.changedTouches && event.changedTouches[0];
      if (!touch) {
        gesture = null;
        stopHoldDissolve();
        return;
      }
      endGesture(localPoint(touch.clientX, touch.clientY));
    }, { passive: false });

    listen(surface, 'touchcancel', function () {
      var hadGesture = Boolean(gesture);
      gesture = null;
      stopHoldDissolve();
      if (hadGesture) notifyInteract(false);
    }, { passive: true });

    listen(surface, 'pointerdown', function (event) {
      if (event.pointerType === 'touch') return;
      if (!active && !clearing) return;
      notifyGesturePrime();
      seal(event);
      if (clearing) {
        gesture = null;
        stopHoldDissolve();
        return;
      }
      var point = localPoint(event.clientX, event.clientY);
      beginGesture(point);
      if (surface.setPointerCapture) {
        try { surface.setPointerCapture(event.pointerId); } catch (_) {}
      }
    });

    listen(surface, 'pointermove', function (event) {
      if (event.pointerType === 'touch') return;
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing || !gesture) return;
      moveGesture(localPoint(event.clientX, event.clientY));
    });

    listen(surface, 'pointerup', function (event) {
      if (event.pointerType === 'touch') return;
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing || !gesture) return;
      endGesture(localPoint(event.clientX, event.clientY));
    });

    listen(surface, 'pointercancel', function (event) {
      if (event.pointerType === 'touch') return;
      var hadGesture = Boolean(gesture);
      gesture = null;
      stopHoldDissolve();
      if (hadGesture) notifyInteract(false);
    });

    listen(surface, 'click', function (event) {
      if (!active && !clearing) return;
      event.stopPropagation();
    }, { passive: true });

    listen(window, 'resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (!active || clearing) return;
        if (!measure()) return;
        rebuildScene();
      }, 240);
    }, { passive: true });

    listen(window, 'blur', function () {
      var hadGesture = Boolean(gesture);
      gesture = null;
      stopHoldDissolve();
      if (hadGesture) notifyInteract(false);
    }, { passive: true });

    listen(document, 'visibilitychange', function () {
      if (document.hidden) {
        stopLoop();
        stopHoldDissolve();
      } else if (active && !clearing) {
        lastDrawAt = 0;
        startLoop();
      }
    }, { passive: true });
  }

  function detachEvents() {
    for (var i = 0; i < listeners.length; i += 1) {
      try { listeners[i](); } catch (_) {}
    }
    listeners = [];
  }

  // --------------------------------------------------------------------- loop

  function frame(now) {
    if (!running) return;
    rafId = window.requestAnimationFrame(frame);
    if (now - lastDrawAt < FRAME_MIN_MS) return;
    lastDrawAt = now;
    drawFrame(now);
  }

  function startLoop() {
    if (running || !active) return;
    running = true;
    lastDrawAt = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  // --------------------------------------------------------------------- API

  function enter(config) {
    if (active) return false;
    canvas = document.getElementById('story-mist-canvas');
    if (!canvas) return false;
    window.clearTimeout(fadeTimer);
    fadeTimer = 0;
    options = config || {};
    cleared = false;
    clearing = false;
    active = true;
    gesture = null;
    stopHoldDissolve();
    detachEvents();
    canvas.hidden = false;
    if (canvas.classList) canvas.classList.remove('is-clearing');
    void canvas.offsetWidth;
    if (!measure()) {
      canvas.hidden = true;
      active = false;
      return false;
    }
    beginSeed();
    rebuildScene();
    if (!ctx || !maskCtx) {
      canvas.hidden = true;
      active = false;
      releaseScene();
      return false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvas.classList) canvas.classList.add('is-active');
    startAt = performance.now();
    attachEvents();
    startLoop();
    return true;
  }

  function exit() {
    if (!active && !clearing) return false;
    window.clearTimeout(fadeTimer);
    fadeTimer = 0;
    active = false;
    clearing = false;
    gesture = null;
    stopHoldDissolve();
    stopLoop();
    detachEvents();
    releaseScene();
    if (canvas) {
      canvas.classList.remove('is-active', 'is-clearing');
      canvas.hidden = true;
    }
    return true;
  }

  function snapshot() {
    return {
      active: active,
      clearing: clearing,
      cleared: cleared,
      clearedPercent: clearedPercent,
      clearedCells: clearedCells,
      cells: GRID_COLS * GRID_ROWS,
      target: CLEAR_TARGET,
      brushRadius: Math.round(brushRadius),
      layers: layers.length,
      dpr: dpr,
      width: width,
      height: height,
      running: running,
    };
  }

  // ==========================================================================
  // v142 — second interactive scene: «Бухта и порог» / the Dali threshold
  // ==========================================================================
  //
  // A real bay, not a drawing of one. The whole environment is a 2048×1024
  // equirectangular photograph from Poly Haven («Cape Hill»: a low sun over the
  // ocean, a rocky headland, wispy clouds). It is assigned to scene.background
  // for the sharp photographic horizon and pushed through PMREMGenerator into
  // scene.environment, so the water, the stone and every reflection are lit by
  // the actual sky of the photograph.
  //
  // The water is a physical standard material (#183452, roughness 0.14,
  // metalness 0.85, envMapIntensity 1.35) with two opposing layers of a
  // seamless 512 px ripple normal map generated on the runner. It reflects the
  // real clouds, the low sun and the stone portal in real time.
  //
  // The portal is a strict post-and-lintel doorway: two chamfered carved piers
  // on a three-step plinth, a massive lintel with a double cornice, a keystone
  // and cut grooves. Its full PBR set — diffuse colour, GL normal and roughness
  // from one Poly Haven limestone material — is bound to every stone block.
  //
  // The visitor's finger writes the hidden Jungian movement — separation and
  // the crossing to the horizon. Pulling up or simply holding the screen grows
  // progress from 0 to 100: the veil dissolves, the camera glides over water and
  // through the doorway toward the real horizon. At 100 % the scene reports
  // onCleared(), dissolves for 850 ms, disposes every geometry, material,
  // texture, render target and the WebGL context, and hands the GPU relay back
  // to the video.
  //
  // A light 2D fallback paints the same composition when WebGL is unavailable.
  // The scene is deliberately self-contained: app.js owns the player pause and
  // the advance, stories.js owns only the picture and its gestures.
  // ==========================================================================
  var threshold = (function () {
    'use strict';

    var VERSION = '142';
    var ASSET_QUERY = '?v=142';
    var FADE_MS = 850;
    var MAX_PROGRESS = 100;
    var REPORT_STEP = 5;
    // ~2.6 s of pure holding reaches the horizon; an upward drag gets there
    // faster, a downward drag pulls the threshold back a little.
    var HOLD_RATE = MAX_PROGRESS / 2.6;
    var DRAG_GAIN = 0.11;
    var DRAG_BACK = 0.045;
    var DECAY_RATE = 3.4;
    var DPR_CAP = 1.5;
    var FOG_DENSITY = 0.0036;
    var PASS_AT = 0.58;
    var FRAME_MIN_DT = 1 / 240;

    var PALETTE = {
      deep: 0x183452,
      shallow: 0x29517a,
      mountainLow: 0x4e4c49,
      mountainHigh: 0x6e685f,
      stone: 0xd9cbb4,
      stoneDark: 0x8e8272,
      sand: 0x8a7c64,
      fog: 0x9a958c,
      fogBlue: 0x3e4852,
      skyTop: 0x50555e,
      skyMid: 0x7b7d7d,
      glow: 0xf2d6a2,
      veilCool: 0xb7b3a9,
      veilWarm: 0xded0ae,
      shadow: 0x0a141c
    };

    var VEIL_VERT = [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n');

    var VEIL_FRAG = [
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform float uOpacity;',
      'uniform vec3 uCool;',
      'uniform vec3 uWarm;',
      '',
      'float hash21(vec2 p) {',
      '  p = fract(p * vec2(123.34, 456.21));',
      '  p += dot(p, p + 45.32);',
      '  return fract(p.x * p.y);',
      '}',
      'float noise2(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(',
      '    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),',
      '    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),',
      '    u.y',
      '  );',
      '}',
      'float fbm2(vec2 p) {',
      '  float value = 0.0;',
      '  float amplitude = 0.5;',
      '  for (int i = 0; i < 4; i++) {',
      '    value += amplitude * noise2(p);',
      '    p *= 2.05;',
      '    amplitude *= 0.5;',
      '  }',
      '  return value;',
      '}',
      '',
      'void main() {',
      '  vec2 uv = vUv;',
      '  float drift = uTime * 0.06;',
      '  float n1 = fbm2(vec2(uv.x * 3.2 + drift * 0.35, uv.y * 2.4 - drift));',
      '  float n2 = fbm2(vec2(uv.x * 6.1 - drift * 0.22, uv.y * 4.8 - drift * 0.7) + 3.7);',
      '  float veil = smoothstep(0.3, 0.76, n1 * 0.62 + n2 * 0.38);',
      '',
      '  float edgeX = smoothstep(0.0, 0.16, uv.x) * smoothstep(0.0, 0.16, 1.0 - uv.x);',
      '  float edgeY = smoothstep(0.0, 0.1, uv.y) * smoothstep(0.0, 0.22, 1.0 - uv.y);',
      '  float alpha = veil * edgeX * edgeY * uOpacity;',
      '',
      '  vec3 color = mix(uCool, uWarm, n2 * 0.85);',
      '  color *= 0.9 + 0.1 * n1;',
      '',
      '  gl_FragColor = vec4(color, alpha);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n');

    var RAY_FRAG = [
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform float uOpacity;',
      'uniform vec3 uColor;',
      'void main() {',
      '  float edge = smoothstep(0.0, 0.32, vUv.x) * smoothstep(0.0, 0.32, 1.0 - vUv.x);',
      '  float taper = smoothstep(0.0, 0.16, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));',
      '  float shimmer = 0.86 + 0.14 * sin(uTime * 0.5 + vUv.y * 6.5 + vUv.x * 3.1);',
      '  float alpha = edge * taper * uOpacity * shimmer * 0.16;',
      '  gl_FragColor = vec4(uColor, alpha);',
      '  #include <tonemapping_fragment>',
      '  #include <colorspace_fragment>',
      '}'
    ].join('\n');

    var RAY_VERT = VEIL_VERT;

    var host = null;
    var canvas = null;
    var ctx2d = null;
    var renderer = null;
    var scene = null;
    var camera = null;
    var THREE = null;

    var rayUniforms = null;
    var veilUniforms = [];

    var environmentTexture = null;
    var envRenderTarget = null;
    var stoneColor = null;
    var stoneNormal = null;
    var stoneRough = null;
    var stoneMaterials = [];
    var textureCache = {};
    var textures = [];
    var waterNormalTexture = null;
    var waterLayers = [];
    var waterMaterials = [];
    var disposed = true;
    var fallback2d = false;

    var options = {};
    var listeners = [];
    var active = false;
    var clearing = false;
    var running = false;
    var rafId = 0;
    var fadeTimer = 0;
    var resizeTimer = 0;
    var width = 1;
    var height = 1;
    var dpr = 1;
    var progress = 0;
    var lastReport = -1;
    var holding = false;
    var pointerId = null;
    var lastY = 0;
    var lastFrameAt = 0;
    var elapsed = 0;
    var renderFailed = false;

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function smooth(value) {
      var x = clamp(value, 0, 1);
      return x * x * (3 - 2 * x);
    }

    function mix(a, b, t) {
      return a + (b - a) * t;
    }

    function track(texture) {
      if (texture) textures.push(texture);
      return texture;
    }

    function untrack(texture) {
      var index = textures.indexOf(texture);
      if (index >= 0) textures.splice(index, 1);
      return texture;
    }

    function textureAnisotropy() {
      var maximum = 1;
      try {
        maximum = renderer && renderer.capabilities
          ? (renderer.capabilities.getMaxAnisotropy() || 1)
          : 1;
      } catch (_) {}
      return Math.max(1, Math.min(8, maximum));
    }

    // ---------------------------------------------------------------- geometry

    function measure() {
      if (!host) return false;
      var rect = host.getBoundingClientRect();
      var w = rect.width || window.innerWidth || 0;
      var h = rect.height || window.innerHeight || 0;
      if (!w || !h) return false;
      width = Math.max(1, Math.round(w));
      height = Math.max(1, Math.round(h));
      dpr = Math.min(DPR_CAP, Math.max(1, window.devicePixelRatio || 1));
      return true;
    }

    function hash2(x, y) {
      var value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return value - Math.floor(value);
    }

    function valueNoise(x, y) {
      var ix = Math.floor(x);
      var iy = Math.floor(y);
      var fx = x - ix;
      var fy = y - iy;
      var ux = fx * fx * (3 - 2 * fx);
      var uy = fy * fy * (3 - 2 * fy);
      var a = hash2(ix, iy);
      var b = hash2(ix + 1, iy);
      var c = hash2(ix, iy + 1);
      var d = hash2(ix + 1, iy + 1);
      return mix(mix(a, b, ux), mix(c, d, ux), uy);
    }

    // ----------------------------------------------------------- stone textures

    function makeFallbackColor() {
      var size = 128;
      var board = document.createElement('canvas');
      board.width = size;
      board.height = size;
      var context = board.getContext('2d');
      if (!context) return null;
      var image = context.createImageData(size, size);
      var data = image.data;
      for (var y = 0; y < size; y += 1) {
        for (var x = 0; x < size; x += 1) {
          var grain = valueNoise(x * 0.09, y * 0.09) * 0.56
            + valueNoise(x * 0.24, y * 0.24) * 0.3
            + valueNoise(x * 0.61, y * 0.61) * 0.14;
          var shade = 0.72 + grain * 0.36;
          var index = (y * size + x) * 4;
          data[index] = Math.round(205 * shade);
          data[index + 1] = Math.round(190 * shade);
          data[index + 2] = Math.round(165 * shade);
          data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      var texture = new THREE.CanvasTexture(board);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    function makeFallbackNormal() {
      var size = 128;
      var board = document.createElement('canvas');
      board.width = size;
      board.height = size;
      var context = board.getContext('2d');
      if (!context) return null;
      var image = context.createImageData(size, size);
      var data = image.data;
      for (var y = 0; y < size; y += 1) {
        for (var x = 0; x < size; x += 1) {
          var h = valueNoise(x * 0.08, y * 0.08) * 0.62 + valueNoise(x * 0.19, y * 0.19) * 0.38;
          var hx = valueNoise((x + 1) * 0.08, y * 0.08) * 0.62
            + valueNoise((x + 1) * 0.19, y * 0.19) * 0.38 - h;
          var hy = valueNoise(x * 0.08, (y + 1) * 0.08) * 0.62
            + valueNoise(x * 0.19, (y + 1) * 0.19) * 0.38 - h;
          var nx = -hx * 9;
          var ny = -hy * 9;
          var length = Math.sqrt(nx * nx + ny * ny + 1) || 1;
          var index = (y * size + x) * 4;
          data[index] = Math.round((nx / length * 0.5 + 0.5) * 255);
          data[index + 1] = Math.round((ny / length * 0.5 + 0.5) * 255);
          data[index + 2] = Math.round((1 / length * 0.5 + 0.5) * 255);
          data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      var texture = new THREE.CanvasTexture(board);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      return texture;
    }

    function makeFallbackRoughness() {
      var size = 128;
      var board = document.createElement('canvas');
      board.width = size;
      board.height = size;
      var context = board.getContext('2d');
      if (!context) return null;
      var image = context.createImageData(size, size);
      var data = image.data;
      for (var y = 0; y < size; y += 1) {
        for (var x = 0; x < size; x += 1) {
          var value = 0.58 + 0.36 * (valueNoise(x * 0.11, y * 0.11) * 0.7
            + valueNoise(x * 0.27, y * 0.27) * 0.3);
          var channel = Math.round(value * 255);
          var index = (y * size + x) * 4;
          data[index] = channel;
          data[index + 1] = channel;
          data[index + 2] = channel;
          data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      var texture = new THREE.CanvasTexture(board);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      return texture;
    }

    function makeFallbackWaterNormal() {
      var size = 128;
      var board = document.createElement('canvas');
      board.width = size;
      board.height = size;
      var context = board.getContext('2d');
      if (!context) return null;
      var image = context.createImageData(size, size);
      var data = image.data;
      for (var y = 0; y < size; y += 1) {
        for (var x = 0; x < size; x += 1) {
          var nx = Math.sin((x + y) * 0.16) * 0.10;
          var ny = Math.cos((x - y) * 0.13) * 0.10;
          var nz = Math.sqrt(Math.max(0.01, 1 - nx * nx - ny * ny));
          var index = (y * size + x) * 4;
          data[index] = Math.round((nx * 0.5 + 0.5) * 255);
          data[index + 1] = Math.round((ny * 0.5 + 0.5) * 255);
          data[index + 2] = Math.round((nz * 0.5 + 0.5) * 255);
          data[index + 3] = 255;
        }
      }
      context.putImageData(image, 0, 0);
      var texture = new THREE.CanvasTexture(board);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
      return texture;
    }

    function loadStoneTextures() {
      stoneColor = track(makeFallbackColor());
      stoneNormal = track(makeFallbackNormal());
      stoneRough = track(makeFallbackRoughness());
      if (!stoneColor) stoneColor = new THREE.Texture();
      if (!stoneNormal) stoneNormal = new THREE.Texture();
      if (!stoneRough) stoneRough = new THREE.Texture();
      var anisotropy = textureAnisotropy();
      var loader = new THREE.TextureLoader();
      function adopt(kind, texture) {
        // A late loader callback from a 3D build that fell back to 2D must
        // never touch THREE again: renderer is gone and THREE is null.
        if (disposed || !THREE || !renderer || fallback2d) {
          texture.dispose();
          return;
        }
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
        if (kind === 'color') stoneColor = texture;
        else if (kind === 'normal') stoneNormal = texture;
        else stoneRough = texture;
        track(texture);
        rebindStone();
      }
      loader.load('./assets/stone-color.jpg' + ASSET_QUERY, function (texture) {
        adopt('color', texture);
      }, undefined, function () {});
      loader.load('./assets/stone-normal.jpg' + ASSET_QUERY, function (texture) {
        adopt('normal', texture);
      }, undefined, function () {});
      loader.load('./assets/stone-roughness.jpg' + ASSET_QUERY, function (texture) {
        adopt('roughness', texture);
      }, undefined, function () {});
    }

    function stonePair(rx, ry) {
      var key = rx + 'x' + ry;
      if (textureCache[key]) return textureCache[key];
      var color = stoneColor.clone();
      color.wrapS = THREE.RepeatWrapping;
      color.wrapT = THREE.RepeatWrapping;
      color.repeat.set(rx, ry);
      color.colorSpace = THREE.SRGBColorSpace;
      color.needsUpdate = true;
      var normal = stoneNormal.clone();
      normal.wrapS = THREE.RepeatWrapping;
      normal.wrapT = THREE.RepeatWrapping;
      normal.repeat.set(rx, ry);
      normal.colorSpace = THREE.NoColorSpace;
      normal.needsUpdate = true;
      var rough = stoneRough.clone();
      rough.wrapS = THREE.RepeatWrapping;
      rough.wrapT = THREE.RepeatWrapping;
      rough.repeat.set(rx, ry);
      rough.colorSpace = THREE.NoColorSpace;
      rough.needsUpdate = true;
      track(color);
      track(normal);
      track(rough);
      textureCache[key] = { color: color, normal: normal, rough: rough };
      return textureCache[key];
    }

    function bindStone(entry) {
      var pair = stonePair(entry.rx, entry.ry);
      entry.material.map = pair.color;
      entry.material.normalMap = pair.normal;
      entry.material.roughnessMap = pair.rough;
      entry.material.needsUpdate = true;
    }

    function registerStone(material, rx, ry) {
      var entry = { material: material, rx: rx, ry: ry };
      stoneMaterials.push(entry);
      bindStone(entry);
      return material;
    }

    function rebindStone() {
      var keys = Object.keys(textureCache);
      for (var i = 0; i < keys.length; i += 1) {
        var pair = textureCache[keys[i]];
        if (pair.color) pair.color.dispose();
        if (pair.normal) pair.normal.dispose();
        if (pair.rough) pair.rough.dispose();
      }
      textureCache = {};
      for (var j = 0; j < stoneMaterials.length; j += 1) {
        bindStone(stoneMaterials[j]);
      }
    }

    // ------------------------------------------------------- photographic sky

    function applyFogFromImage(image) {
      if (!scene || !scene.fog || !image) return;
      try {
        var board = document.createElement('canvas');
        board.width = 32;
        board.height = 16;
        var context = board.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0, 32, 16);
        // The equirectangular horizon lives on the middle row: sample a narrow
        // band around it so the water fades into the real haze of the photo.
        var data = context.getImageData(0, 7, 32, 3).data;
        var red = 0;
        var green = 0;
        var blue = 0;
        var count = 0;
        for (var i = 0; i < data.length; i += 4) {
          red += data[i];
          green += data[i + 1];
          blue += data[i + 2];
          count += 1;
        }
        if (!count) return;
        var color = new THREE.Color().setStyle(
          'rgb(' + Math.round(red / count) + ',' + Math.round(green / count) + ','
          + Math.round(blue / count) + ')'
        );
        color.lerp(new THREE.Color(0xb9b0a2), 0.16);
        scene.fog.color.copy(color);
      } catch (_) {}
    }

    function applyEnvironment(texture) {
      if (!texture) return;
      if (disposed || !THREE || !renderer || !scene || fallback2d) {
        try { texture.dispose(); } catch (_) {}
        return;
      }
      if (environmentTexture && environmentTexture !== texture) {
        try { environmentTexture.dispose(); } catch (_) {}
        untrack(environmentTexture);
      }
      environmentTexture = texture;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      scene.background = texture;
      scene.backgroundIntensity = 1.0;
      if (envRenderTarget) {
        try { envRenderTarget.dispose(); } catch (_) {}
        envRenderTarget = null;
      }
      try {
        var pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        envRenderTarget = pmrem.fromEquirectangular(texture);
        scene.environment = envRenderTarget.texture;
        pmrem.dispose();
      } catch (_) {
        scene.environment = null;
      }
      applyFogFromImage(texture.image);
      if (textures.indexOf(texture) < 0) track(texture);
    }

    function buildFallbackSky() {
      var board = document.createElement('canvas');
      board.width = 1024;
      board.height = 512;
      var context = board.getContext('2d');
      if (!context) return;
      var sky = context.createLinearGradient(0, 0, 0, 512);
      sky.addColorStop(0, '#2d3b49');
      sky.addColorStop(0.42, '#7f8d98');
      sky.addColorStop(0.5, '#d8c5a5');
      sky.addColorStop(0.56, '#a68f74');
      sky.addColorStop(1, '#3f474d');
      context.fillStyle = sky;
      context.fillRect(0, 0, 1024, 512);
      var glow = context.createRadialGradient(742, 242, 0, 742, 242, 250);
      glow.addColorStop(0, 'rgba(255, 238, 202, 0.95)');
      glow.addColorStop(0.28, 'rgba(242, 214, 162, 0.46)');
      glow.addColorStop(0.7, 'rgba(242, 214, 162, 0.1)');
      glow.addColorStop(1, 'rgba(242, 214, 162, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, 1024, 430);
      for (var i = 0; i < 11; i += 1) {
        var cx = 80 + Math.random() * 880;
        var cy = 70 + Math.random() * 190;
        var radius = 90 + Math.random() * 150;
        var cloud = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
        cloud.addColorStop(0, 'rgba(62, 68, 76, ' + (0.28 + Math.random() * 0.18) + ')');
        cloud.addColorStop(0.55, 'rgba(78, 84, 92, 0.14)');
        cloud.addColorStop(1, 'rgba(78, 84, 92, 0)');
        context.save();
        context.translate(cx, cy);
        context.scale(1.7, 0.48);
        context.translate(-cx, -cy);
        context.fillStyle = cloud;
        context.beginPath();
        context.arc(cx, cy, radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
      var texture = new THREE.CanvasTexture(board);
      applyEnvironment(texture);
    }

    function loadEnvironment() {
      var loader = new THREE.TextureLoader();
      loader.load('./assets/bay-env.jpg' + ASSET_QUERY, function (texture) {
        applyEnvironment(texture);
      }, undefined, function () {});
    }

    // ------------------------------------------------------------ water normal

    function makeWaterNormalClone(repeatCount) {
      var texture = waterNormalTexture.clone();
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeatCount, repeatCount);
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = textureAnisotropy();
      texture.needsUpdate = true;
      return track(texture);
    }

    function loadWaterNormal() {
      var loader = new THREE.TextureLoader();
      loader.load('./assets/water-normal.jpg' + ASSET_QUERY, function (texture) {
        if (disposed || !THREE || !renderer || fallback2d) {
          texture.dispose();
          return;
        }
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.NoColorSpace;
        texture.anisotropy = textureAnisotropy();
        texture.needsUpdate = true;
        var previous = waterNormalTexture;
        waterNormalTexture = texture;
        track(texture);
        for (var i = 0; i < waterLayers.length; i += 1) {
          var layer = waterLayers[i];
          var clone = texture.clone();
          clone.wrapS = THREE.RepeatWrapping;
          clone.wrapT = THREE.RepeatWrapping;
          clone.repeat.copy(layer.repeat);
          clone.colorSpace = THREE.NoColorSpace;
          clone.anisotropy = texture.anisotropy;
          clone.needsUpdate = true;
          if (layer.texture) {
            layer.texture.dispose();
            untrack(layer.texture);
          }
          layer.texture = clone;
          layer.material.normalMap = clone;
          layer.material.needsUpdate = true;
          track(clone);
        }
        if (previous) {
          previous.dispose();
          untrack(previous);
        }
      }, undefined, function () {});
    }

    // --------------------------------------------------------------- 3D build

    function build3D() {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
        stencil: false
      });
      if (!renderer || !renderer.getContext()) throw new Error('WebGL unavailable');
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x8d8c88, 1);
      canvas = renderer.domElement;
      canvas.setAttribute('aria-hidden', 'true');
      host.appendChild(canvas);

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(PALETTE.fog, FOG_DENSITY);
      camera = new THREE.PerspectiveCamera(52, width / height, 0.08, 900);
      camera.position.set(0, 3.0, 10);

      loadStoneTextures();
      waterNormalTexture = track(makeFallbackWaterNormal());
      if (!waterNormalTexture) waterNormalTexture = new THREE.Texture();

      // The panorama is the main light source. A low warm sun adds the long
      // graphic shadow of the doorway; a cool hemisphere only keeps the shadow
      // side of the stone from going black.
      var hemisphere = new THREE.HemisphereLight(0xb9c6d0, 0x3d352b, 0.55);
      scene.add(hemisphere);

      var sun = new THREE.DirectionalLight(0xffd7a1, 2.7);
      sun.position.set(58, 16, -62);
      sun.target.position.set(0, 2.2, -9);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 8;
      sun.shadow.camera.far = 220;
      sun.shadow.camera.left = -28;
      sun.shadow.camera.right = 28;
      sun.shadow.camera.top = 28;
      sun.shadow.camera.bottom = -28;
      sun.shadow.bias = -0.0007;
      sun.shadow.normalBias = 0.04;
      sun.shadow.camera.updateProjectionMatrix();
      scene.add(sun);
      scene.add(sun.target);

      // The photograph is backlit: a soft cool bounce from the water keeps the
      // camera-facing stone readable instead of letting it fall into a black
      // silhouette. It casts no shadow, so the one graphic shadow stays clean.
      var bounce = new THREE.DirectionalLight(0xa9c6d8, 0.8);
      bounce.position.set(-30, 12, 38);
      bounce.target.position.set(0, 2.4, -9);
      scene.add(bounce);
      scene.add(bounce.target);

      buildFallbackSky();
      loadEnvironment();
      buildWater();
      buildPortal();
      buildVeil();
      buildRays();
      loadWaterNormal();

      // The light and every caster are static for the whole scene: render the
      // shadow map once and never spend a second GPU pass on it.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;

      camera.lookAt(0.6, 2.9, -30);
      update3D(0, 0);
    }

    function buildWater() {
      var geometry = new THREE.PlaneGeometry(900, 900, 1, 1);
      geometry.rotateX(-Math.PI / 2);

      // Cobalt-slate physical water: the real panorama is the reflection map,
      // the 512 px ripple normal is the only procedural surface detail.
      var baseMaterial = new THREE.MeshStandardMaterial({
        color: PALETTE.deep,
        roughness: 0.14,
        metalness: 0.85,
        envMapIntensity: 1.35
      });
      var baseNormal = makeWaterNormalClone(22);
      baseMaterial.normalMap = baseNormal;
      baseMaterial.normalScale = new THREE.Vector2(0.72, 0.72);
      var base = new THREE.Mesh(geometry, baseMaterial);
      base.position.set(0, -0.03, -170);
      base.receiveShadow = true;
      scene.add(base);

      // The second, counter-drifting layer breaks the mirror into living chop
      // without hiding the clouds reflected underneath.
      var sheenMaterial = new THREE.MeshStandardMaterial({
        color: PALETTE.shallow,
        roughness: 0.11,
        metalness: 0.92,
        envMapIntensity: 1.5,
        transparent: true,
        opacity: 0.26,
        depthWrite: false
      });
      var sheenNormal = makeWaterNormalClone(31);
      sheenMaterial.normalMap = sheenNormal;
      sheenMaterial.normalScale = new THREE.Vector2(0.48, 0.48);
      var sheen = new THREE.Mesh(geometry, sheenMaterial);
      sheen.position.set(0, 0.008, -170);
      sheen.renderOrder = 2;
      scene.add(sheen);

      waterMaterials = [baseMaterial, sheenMaterial];
      waterLayers = [
        {
          material: baseMaterial,
          texture: baseNormal,
          repeat: new THREE.Vector2(22, 22),
          speedX: 0.012,
          speedY: 0.006
        },
        {
          material: sheenMaterial,
          texture: sheenNormal,
          repeat: new THREE.Vector2(31, 31),
          speedX: -0.018,
          speedY: 0.009
        }
      ];
    }

    function makeChamferedBox(width, height, depth, chamfer) {
      var halfW = width / 2;
      var halfH = height / 2;
      var cut = Math.min(chamfer, Math.min(halfW, halfH) * 0.8);
      var shape = new THREE.Shape();
      shape.moveTo(-halfW + cut, -halfH);
      shape.lineTo(halfW - cut, -halfH);
      shape.lineTo(halfW, -halfH + cut);
      shape.lineTo(halfW, halfH - cut);
      shape.lineTo(halfW - cut, halfH);
      shape.lineTo(-halfW + cut, halfH);
      shape.lineTo(-halfW, halfH - cut);
      shape.lineTo(-halfW, -halfH + cut);
      shape.closePath();
      var geometry = new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1
      });
      geometry.translate(0, 0, -depth / 2);
      return geometry;
    }

    function addStoneBlock(parent, material, w, h, d, x, y, z) {
      var block = new THREE.Mesh(
        makeChamferedBox(w, h, d, Math.min(w, h, d) * 0.07),
        material
      );
      block.position.set(x, y, z);
      block.castShadow = true;
      block.receiveShadow = true;
      parent.add(block);
      return block;
    }

    function buildPortal() {
      // Diffuse colour, GL normal and roughness all come from one Poly Haven
      // weathered limestone material, so every block shares the same grain.
      var stone = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.93,
        metalness: 0.0,
        envMapIntensity: 0.8
      });
      registerStone(stone, 0.62, 0.9);
      var darkStone = new THREE.MeshStandardMaterial({
        color: 0xc4b49b,
        roughness: 0.99,
        metalness: 0.0,
        envMapIntensity: 0.42
      });
      registerStone(darkStone, 0.55, 0.8);

      var portal = new THREE.Group();
      portal.position.set(0, 0, -9);
      scene.add(portal);

      // Three-step island plinth: the doorway stands in the water, not on sand.
      addStoneBlock(portal, darkStone, 6.4, 0.22, 4.2, 0, 0.11, 0);
      addStoneBlock(portal, stone, 5.7, 0.18, 3.7, 0, 0.31, 0);
      addStoneBlock(portal, stone, 5.0, 0.16, 3.2, 0, 0.48, 0);

      var plinthTop = 0.56;
      var pierX = 1.46;
      var pierH = 3.85;
      var shaftBottom = plinthTop + 0.3;
      for (var side = -1; side <= 1; side += 2) {
        var x = side * pierX;
        // Stepped base under each pier.
        addStoneBlock(portal, darkStone, 1.22, 0.18, 1.34, x, plinthTop + 0.09, 0);
        addStoneBlock(portal, stone, 1.08, 0.14, 1.2, x, plinthTop + 0.25, 0);
        // Chamfered carved shaft.
        var shaft = new THREE.Mesh(makeChamferedBox(0.8, pierH, 0.98, 0.06), stone);
        shaft.position.set(x, shaftBottom + pierH / 2, 0);
        shaft.castShadow = true;
        shaft.receiveShadow = true;
        portal.add(shaft);
        // Capital and its cornice.
        addStoneBlock(portal, stone, 1.04, 0.2, 1.1, x, shaftBottom + pierH + 0.1, 0);
        addStoneBlock(portal, darkStone, 1.18, 0.14, 1.24, x, shaftBottom + pierH + 0.27, 0);
        // Three shallow carved grooves on the front face of the shaft.
        for (var groove = -1; groove <= 1; groove += 1) {
          addStoneBlock(
            portal, darkStone, 0.055, 2.65, 0.035,
            x + groove * 0.16, shaftBottom + 1.55, 0.505
          );
        }
        // A worn band near the foot.
        addStoneBlock(portal, darkStone, 0.72, 0.07, 0.035, x, shaftBottom + 0.42, 0.505);
      }

      var lintelBottom = shaftBottom + pierH + 0.34;
      // Massive lintel, double cornice and keystone.
      addStoneBlock(portal, stone, 4.5, 0.64, 1.18, 0, lintelBottom + 0.32, 0);
      addStoneBlock(portal, darkStone, 4.78, 0.14, 1.3, 0, lintelBottom + 0.71, 0);
      addStoneBlock(portal, stone, 5.02, 0.12, 1.42, 0, lintelBottom + 0.84, 0);
      addStoneBlock(portal, darkStone, 0.52, 0.7, 1.24, 0, lintelBottom + 0.35, 0.08);
      // A shallow recess cut into the lintel face.
      addStoneBlock(portal, darkStone, 3.7, 0.08, 0.03, 0, lintelBottom + 0.2, 0.6);

      // The threshold slab the camera crosses.
      addStoneBlock(portal, darkStone, 2.7, 0.12, 0.9, 0, 0.62, 0.7);
    }

    function makeVeilMaterial(opacity) {
      var uniforms = {
        uTime: { value: 0 },
        uOpacity: { value: opacity },
        uCool: { value: new THREE.Color(PALETTE.veilCool) },
        uWarm: { value: new THREE.Color(PALETTE.veilWarm) }
      };
      veilUniforms.push(uniforms);
      return new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: VEIL_VERT,
        fragmentShader: VEIL_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      });
    }

    function buildVeil() {
      var curtain = new THREE.Mesh(
        new THREE.PlaneGeometry(2.02, 4.85),
        makeVeilMaterial(1.0)
      );
      curtain.position.set(0, 2.56, -9.01);
      curtain.renderOrder = 30;
      scene.add(curtain);

      // The same mist climbs out of the doorway and links it to the clouds.
      var column = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 18),
        makeVeilMaterial(0.55)
      );
      column.position.set(0, 11.2, -9.8);
      column.renderOrder = 29;
      scene.add(column);
    }

    function buildRays() {
      rayUniforms = {
        uTime: { value: 0 },
        uOpacity: { value: 0.2 },
        uColor: { value: new THREE.Color(PALETTE.glow) }
      };
      var material = new THREE.ShaderMaterial({
        uniforms: rayUniforms,
        vertexShader: RAY_VERT,
        fragmentShader: RAY_FRAG,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false
      });
      var specs = [
        { x: 5, y: 26, z: -56, w: 4.6, h: 62, tilt: -0.5 },
        { x: 11, y: 28, z: -62, w: 3.2, h: 66, tilt: -0.46 },
        { x: 17, y: 30, z: -48, w: 5.4, h: 70, tilt: -0.55 },
        { x: 23, y: 24, z: -70, w: 2.6, h: 54, tilt: -0.42 },
        { x: 0.5, y: 22, z: -80, w: 7.4, h: 58, tilt: -0.6 },
        { x: 9, y: 18, z: -40, w: 2.2, h: 44, tilt: -0.48 }
      ];
      for (var i = 0; i < specs.length; i += 1) {
        var spec = specs[i];
        var beam = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h), material);
        beam.position.set(spec.x, spec.y, spec.z);
        beam.rotation.z = spec.tilt;
        beam.renderOrder = 15;
        scene.add(beam);
      }
    }

    // -------------------------------------------------------------- 3D update

    function update3D(time, p) {
      if (!renderer || !scene || !camera || renderFailed) return;
      try {
        var eased = smooth(p);

        var z;
        if (p < PASS_AT) z = 10 - 19 * smooth(p / PASS_AT);
        else z = -9 - 43 * smooth((p - PASS_AT) / (1 - PASS_AT));
        var lateral = Math.sin(time * 0.28) * 0.14 * (1 - p);
        var camY = 3.0 + 0.55 * eased + Math.sin(time * 0.55) * 0.025 * (1 - p);
        camera.position.set(lateral, camY, z);
        var lookX = 0.8 + 6.5 * smooth((p - 0.6) / 0.4);
        var lookY = 2.9 + 2.4 * smooth((p - 0.35) / 0.65);
        camera.lookAt(lookX, lookY, z - 40);
        camera.fov = 52 + 9 * p;
        camera.updateProjectionMatrix();

        // Two opposing ripples: the base slides slowly towards the horizon,
        // the thin sheen slides back across it.
        for (var i = 0; i < waterLayers.length; i += 1) {
          var layer = waterLayers[i];
          if (layer.texture) {
            layer.texture.offset.x = time * layer.speedX;
            layer.texture.offset.y = time * layer.speedY;
          }
        }
        if (waterMaterials[1]) {
          waterMaterials[1].opacity = 0.2 + 0.14 * eased;
        }
        if (scene.fog) {
          scene.fog.density = FOG_DENSITY * (1 - 0.34 * eased);
        }
        if (veilUniforms.length) {
          veilUniforms[0].uTime.value = time;
          veilUniforms[0].uOpacity.value = 0.92 * (1 - smooth((p - 0.06) / 0.62));
          if (veilUniforms[1]) {
            veilUniforms[1].uTime.value = time;
            veilUniforms[1].uOpacity.value = 0.55 * (1 - smooth((p - 0.12) / 0.7));
          }
        }
        if (rayUniforms) {
          rayUniforms.uTime.value = time;
          rayUniforms.uOpacity.value = 0.16 + 0.36 * smooth((p - 0.08) / 0.9);
        }
        renderer.render(scene, camera);
      } catch (error) {
        renderFailed = true;
        complete();
      }
    }

    // --------------------------------------------------------------- 2D build

    function build2D() {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      ctx2d = canvas.getContext('2d');
      if (!ctx2d) throw new Error('2D canvas unavailable');
      size2D();
      host.appendChild(canvas);
      fallback2d = true;
    }

    function size2D() {
      if (!canvas || !ctx2d) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    }

    function traceArch(context, cx, baseY, w, h) {
      var radius = w / 2;
      var spring = baseY - h + radius;
      context.moveTo(cx - radius, baseY);
      context.lineTo(cx - radius, spring);
      context.arc(cx, spring, radius, Math.PI, 0, false);
      context.lineTo(cx + radius, baseY);
      context.closePath();
    }

    function drawRidge(context, points, color, alpha) {
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(points[0][0] * width, points[0][1] * height);
      for (var i = 1; i < points.length; i += 1) {
        context.lineTo(points[i][0] * width, points[i][1] * height);
      }
      context.closePath();
      context.fill();
      context.restore();
    }

    function draw2D(time, p) {
      if (!ctx2d) return;
      var w = width;
      var h = height;
      var context = ctx2d;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, w, h);

      var zoom = 1 + 0.55 * p;
      context.save();
      context.translate(w / 2, h * 0.56);
      context.scale(zoom, zoom);
      context.translate(-w / 2, -h * 0.56 - h * 0.05 * p);

      var sky = context.createLinearGradient(0, 0, 0, h * 0.53);
      sky.addColorStop(0, '#50555E');
      sky.addColorStop(0.58, '#6E7276');
      sky.addColorStop(0.9, '#A99D8C');
      sky.addColorStop(1, '#C8B594');
      context.fillStyle = sky;
      context.fillRect(-w * 0.3, -h * 0.3, w * 1.6, h * 0.85);

      var glow = context.createRadialGradient(
        w * 0.72, h * 0.44, 0,
        w * 0.72, h * 0.44, w * 0.62
      );
      glow.addColorStop(0, 'rgba(255, 241, 212, 0.82)');
      glow.addColorStop(0.22, 'rgba(222, 199, 154, 0.55)');
      glow.addColorStop(0.62, 'rgba(222, 199, 154, 0.14)');
      glow.addColorStop(1, 'rgba(222, 199, 154, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, w, h * 0.8);

      for (var cloudIndex = 0; cloudIndex < 6; cloudIndex += 1) {
        var cloudX = w * (0.12 + cloudIndex * 0.17) + Math.sin(time * 0.02 + cloudIndex) * w * 0.02;
        var cloudY = h * (0.12 + (cloudIndex % 3) * 0.055);
        var cloudR = w * (0.24 + (cloudIndex % 2) * 0.1);
        var cloud = context.createRadialGradient(cloudX, cloudY, 0, cloudX, cloudY, cloudR);
        cloud.addColorStop(0, 'rgba(80, 85, 94, 0.55)');
        cloud.addColorStop(0.55, 'rgba(80, 85, 94, 0.24)');
        cloud.addColorStop(1, 'rgba(80, 85, 94, 0)');
        context.save();
        context.translate(cloudX, cloudY);
        context.scale(1, 0.42);
        context.translate(-cloudX, -cloudY);
        context.fillStyle = cloud;
        context.beginPath();
        context.arc(cloudX, cloudY, cloudR, 0, Math.PI * 2);
        context.fill();
        context.restore();
      }

      var sea = context.createLinearGradient(0, h * 0.47, 0, h);
      sea.addColorStop(0, '#29517A');
      sea.addColorStop(0.5, '#234A72');
      sea.addColorStop(1, '#1B3E64');
      context.fillStyle = sea;
      context.fillRect(0, h * 0.47, w, h * 0.6);

      // Slow ripple lines and scattered pearl glints on the bay.
      for (var line = 0; line < 26; line += 1) {
        var depth = line / 25;
        var lineY = h * 0.49 + depth * depth * h * 0.5;
        var drift = Math.sin(time * 0.6 + line * 1.3) * w * 0.03;
        context.strokeStyle = 'rgba(222, 199, 154, ' + (0.025 + 0.05 * (1 - depth)) + ')';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(w * 0.08 + drift, lineY);
        context.lineTo(w * (0.34 + 0.3 * (1 - depth)) + drift, lineY);
        context.stroke();
      }

      drawRidge(context, [
        [0, 0.47], [0.03, 0.44], [0.08, 0.455], [0.12, 0.39], [0.16, 0.42],
        [0.21, 0.34], [0.25, 0.38], [0.3, 0.435], [0.36, 0.45], [0.4, 0.47]
      ], '#4E4C49', 0.96);
      drawRidge(context, [
        [0.58, 0.47], [0.63, 0.445], [0.68, 0.4], [0.72, 0.365], [0.76, 0.395],
        [0.81, 0.34], [0.86, 0.38], [0.9, 0.42], [0.94, 0.445], [1, 0.47]
      ], '#4E4C49', 0.94);
      drawRidge(context, [
        [0.3, 0.465], [0.38, 0.445], [0.46, 0.452], [0.52, 0.437], [0.6, 0.45],
        [0.68, 0.458], [0.75, 0.466], [0.3, 0.465]
      ], '#6E685F', 0.55);

      // The long graphic shadow first, so the stone stands inside its own light.
      var baseY = h * 0.625;
      context.save();
      context.fillStyle = 'rgba(138, 124, 100, 0.92)';
      context.beginPath();
      context.ellipse(w * 0.5, baseY, w * 0.34, h * 0.036, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(95, 90, 79, 0.8)';
      context.beginPath();
      context.ellipse(w * 0.5, baseY + h * 0.012, w * 0.37, h * 0.02, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      context.fillStyle = 'rgba(8, 18, 26, 0.34)';
      context.beginPath();
      context.moveTo(w * 0.5 - w * 0.055, baseY);
      context.lineTo(w * 0.5 + w * 0.055, baseY);
      context.lineTo(w * 0.24, h * 0.86);
      context.lineTo(w * 0.13, h * 0.8);
      context.closePath();
      context.fill();
      context.restore();

      var portalH = h * 0.3 * (1 + 0.75 * p);
      var portalW = portalH * 0.33;
      var frame = portalW * 0.17;
      var innerW = portalW - frame * 2;
      var innerH = portalH - frame;

      context.save();
      context.beginPath();
      traceArch(context, w * 0.5, baseY, portalW, portalH);
      traceArch(context, w * 0.5, baseY - frame * 0.2, innerW, innerH);
      var stoneGradient = context.createLinearGradient(
        w * 0.5 - portalW / 2, 0,
        w * 0.5 + portalW / 2, 0
      );
      stoneGradient.addColorStop(0, '#4E4C49');
      stoneGradient.addColorStop(0.35, '#6E685F');
      stoneGradient.addColorStop(0.62, '#7A7368');
      stoneGradient.addColorStop(1, '#555149');
      context.fillStyle = stoneGradient;
      context.fill('evenodd');
      context.restore();

      var veilFade = 1 - smooth((p - 0.05) / 0.62);
      context.save();
      context.beginPath();
      traceArch(context, w * 0.5, baseY - frame * 0.2, innerW, innerH);
      context.clip();
      var veil = context.createLinearGradient(0, baseY - innerH, 0, baseY);
      veil.addColorStop(0, 'rgba(222, 208, 174, ' + (0.12 * veilFade) + ')');
      veil.addColorStop(0.42, 'rgba(183, 179, 169, ' + (0.42 * veilFade) + ')');
      veil.addColorStop(1, 'rgba(123, 125, 125, ' + (0.22 * veilFade) + ')');
      context.fillStyle = veil;
      context.fillRect(w * 0.5 - innerW, baseY - innerH, innerW * 2, innerH);
      for (var puff = 0; puff < 4; puff += 1) {
        var puffY = baseY - innerH * (0.2 + puff * 0.22) + Math.sin(time * 0.5 + puff) * innerH * 0.03;
        var puffX = w * 0.5 + Math.sin(time * 0.35 + puff * 1.7) * innerW * 0.18;
        var puffGradient = context.createRadialGradient(
          puffX, puffY, 0,
          puffX, puffY, innerW * 0.62
        );
        puffGradient.addColorStop(0, 'rgba(222, 208, 174, ' + (0.22 * veilFade) + ')');
        puffGradient.addColorStop(1, 'rgba(222, 208, 174, 0)');
        context.fillStyle = puffGradient;
        context.beginPath();
        context.arc(puffX, puffY, innerW * 0.62, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      // A soft column of mist rising from the doorway into the clouds.
      var column = context.createLinearGradient(0, baseY - portalH * 1.9, 0, baseY - portalH * 0.4);
      column.addColorStop(0, 'rgba(183, 179, 169, 0)');
      column.addColorStop(0.55, 'rgba(222, 208, 174, ' + (0.14 * veilFade) + ')');
      column.addColorStop(1, 'rgba(222, 208, 174, 0)');
      context.fillStyle = column;
      context.fillRect(w * 0.5 - portalW * 0.9, baseY - portalH * 1.9, portalW * 1.8, portalH * 1.5);

      // Oblique rays: brighter as the threshold opens.
      context.save();
      context.globalCompositeOperation = 'lighter';
      var rayAlpha = 0.03 + 0.075 * smooth((p - 0.05) / 0.9);
      for (var ray = 0; ray < 5; ray += 1) {
        var topX = w * (0.46 + ray * 0.085);
        var topW = w * (0.03 + 0.012 * (ray % 2));
        context.fillStyle = 'rgba(222, 199, 154, ' + rayAlpha + ')';
        context.beginPath();
        context.moveTo(topX, -h * 0.12);
        context.lineTo(topX + topW, -h * 0.12);
        context.lineTo(topX + topW - w * 0.36, h * 0.75);
        context.lineTo(topX - w * 0.36, h * 0.75);
        context.closePath();
        context.fill();
      }
      context.restore();

      context.restore();

      if (p > 0.68) {
        var wash = (p - 0.68) / 0.32;
        context.fillStyle = 'rgba(222, 199, 154, ' + (0.06 + 0.12 * wash) + ')';
        context.fillRect(0, 0, w, h);
      }
    }

    // ---------------------------------------------------------------- gesture

    function notifyPrime() {
      if (typeof options.onGesturePrime !== 'function') return;
      try { options.onGesturePrime(); } catch (_) {}
    }

    function notifyInteract(touching) {
      if (typeof options.onInteract !== 'function') return;
      try { options.onInteract(touching === true); } catch (_) {}
    }

    function reportProgress(force) {
      if (typeof options.onProgress !== 'function') return;
      var value = force ? Math.round(progress) : Math.floor(progress / REPORT_STEP) * REPORT_STEP;
      if (value <= lastReport) return;
      lastReport = value;
      try { options.onProgress({ progress: value, percent: value }); } catch (_) {}
    }

    function addProgress(delta) {
      if (!active || clearing || !isFinite(delta)) return;
      progress = clamp(progress + delta, 0, MAX_PROGRESS);
      reportProgress(false);
      if (progress >= MAX_PROGRESS) complete();
    }

    function beginHold(clientY) {
      if (!active || clearing) return;
      holding = true;
      lastY = clientY;
      notifyInteract(true);
    }

    function moveHold(clientY) {
      if (!holding || clearing) return;
      var delta = clientY - lastY;
      lastY = clientY;
      if (delta < 0) addProgress(-delta * DRAG_GAIN);
      else if (delta > 0) addProgress(-delta * DRAG_BACK);
    }

    function endHold() {
      if (!holding) return;
      holding = false;
      notifyInteract(false);
    }

    function seal(event) {
      if (!event) return;
      event.stopPropagation();
      if (event.cancelable) event.preventDefault();
    }

    function listen(target, type, handler, config) {
      target.addEventListener(type, handler, config);
      listeners.push(function () {
        target.removeEventListener(type, handler, config);
      });
    }

    function onTouchStart(event) {
      if (!active && !clearing) return;
      notifyPrime();
      seal(event);
      if (!active || clearing) return;
      if (event.touches.length !== 1) {
        endHold();
        return;
      }
      beginHold(event.touches[0].clientY);
    }

    function onTouchMove(event) {
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing || !holding || event.touches.length !== 1) return;
      moveHold(event.touches[0].clientY);
    }

    function onTouchEnd(event) {
      if (!active && !clearing) return;
      notifyPrime();
      seal(event);
      if (!active || clearing) {
        endHold();
        return;
      }
      var touch = event.changedTouches && event.changedTouches[0];
      if (touch) moveHold(touch.clientY);
      endHold();
    }

    function onPointerDown(event) {
      if (event.pointerType === 'touch') return;
      if (!active && !clearing) return;
      notifyPrime();
      seal(event);
      if (!active || clearing) return;
      beginHold(event.clientY);
      pointerId = event.pointerId;
      if (host.setPointerCapture) {
        try { host.setPointerCapture(event.pointerId); } catch (_) {}
      }
    }

    function onPointerMove(event) {
      if (event.pointerType === 'touch') return;
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing || !holding) return;
      if (pointerId !== null && event.pointerId !== pointerId) return;
      moveHold(event.clientY);
    }

    function onPointerUp(event) {
      if (event.pointerType === 'touch') return;
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing) {
        endHold();
        return;
      }
      moveHold(event.clientY);
      endHold();
      pointerId = null;
    }

    function onWheel(event) {
      if (!active && !clearing) return;
      seal(event);
      if (!active || clearing) return;
      notifyPrime();
      var unit = event.deltaMode === 1 ? 16 : (event.deltaMode === 2 ? height : 1);
      addProgress(-event.deltaY * unit * 0.028);
    }

    function onKeyDown(event) {
      if (!active) return;
      var key = event.key;
      var forwards = key === 'ArrowUp' || key === 'PageUp' || key === ' ' || key === 'Spacebar';
      var backwards = key === 'ArrowDown' || key === 'PageDown';
      if (!forwards && !backwards) return;
      event.preventDefault();
      event.stopPropagation();
      if (clearing) return;
      notifyPrime();
      addProgress(forwards ? 3.5 : -3.5);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopLoop();
      } else if (active && !clearing) {
        lastFrameAt = 0;
        startLoop();
      }
    }

    function onBlur() {
      endHold();
    }

    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        if (!active) return;
        if (!measure()) return;
        if (renderer) {
          renderer.setPixelRatio(dpr);
          renderer.setSize(width, height, false);
          if (camera) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
          }
        }
        if (ctx2d) size2D();
      }, 220);
    }

    function onContextMenu(event) {
      event.preventDefault();
    }

    function attachEvents() {
      listen(host, 'touchstart', onTouchStart, { passive: false });
      listen(host, 'touchmove', onTouchMove, { passive: false });
      listen(host, 'touchend', onTouchEnd, { passive: false });
      listen(host, 'touchcancel', function () { endHold(); }, { passive: true });
      listen(host, 'pointerdown', onPointerDown);
      listen(host, 'pointermove', onPointerMove);
      listen(host, 'pointerup', onPointerUp);
      listen(host, 'pointercancel', function () { endHold(); });
      listen(host, 'wheel', onWheel, { passive: false });
      listen(host, 'click', function (event) {
        if (!active && !clearing) return;
        event.stopPropagation();
      }, { passive: true });
      listen(host, 'contextmenu', onContextMenu);
      listen(window, 'keydown', onKeyDown, true);
      listen(window, 'blur', onBlur, { passive: true });
      listen(document, 'visibilitychange', onVisibilityChange, { passive: true });
      listen(window, 'resize', onResize, { passive: true });
    }

    function detachEvents() {
      for (var i = 0; i < listeners.length; i += 1) {
        try { listeners[i](); } catch (_) {}
      }
      listeners = [];
    }

    // ------------------------------------------------------------------- loop

    function advance(dt) {
      if (!active || clearing) return;
      if (holding) addProgress(dt * HOLD_RATE);
      else if (progress > 0) {
        progress = Math.max(0, progress - dt * DECAY_RATE);
        reportProgress(false);
      }
    }

    function frame(now) {
      if (!running) return;
      rafId = window.requestAnimationFrame(frame);
      if (!lastFrameAt) lastFrameAt = now;
      var dt = (now - lastFrameAt) / 1000;
      lastFrameAt = now;
      if (dt < FRAME_MIN_DT) dt = FRAME_MIN_DT;
      if (dt > 0.05) dt = 0.05;
      elapsed += dt;
      advance(dt);
      try {
        if (fallback2d) draw2D(elapsed, progress / MAX_PROGRESS);
        else update3D(elapsed, progress / MAX_PROGRESS);
      } catch (error) {
        renderFailed = true;
        complete();
      }
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

    // -------------------------------------------------------------- completion

    function complete() {
      if (!active || clearing) return;
      clearing = true;
      holding = false;
      progress = MAX_PROGRESS;
      reportProgress(true);
      if (host) host.classList.add('is-clearing');
      notifyInteract(false);
      if (typeof options.onCleared === 'function') {
        try { options.onCleared({ progress: MAX_PROGRESS, percent: MAX_PROGRESS }); } catch (_) {}
      }
      window.clearTimeout(fadeTimer);
      fadeTimer = window.setTimeout(function () {
        fadeTimer = 0;
        finish();
      }, FADE_MS);
    }

    function finish() {
      stopLoop();
      detachEvents();
      // The 2D canvas must be detached before dispose3D() clears the shared
      // canvas reference; otherwise a fallback canvas could stay in the DOM.
      dispose2D();
      dispose3D();
      if (host) {
        host.classList.remove('is-active', 'is-clearing');
        host.hidden = true;
      }
      active = false;
      clearing = false;
      holding = false;
      disposed = true;
    }

    function disposeMaterial(material) {
      if (!material) return;
      var maps = [
        'map', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap',
        'emissiveMap', 'aoMap', 'bumpMap', 'lightMap'
      ];
      for (var i = 0; i < maps.length; i += 1) {
        var texture = material[maps[i]];
        if (texture && typeof texture.dispose === 'function') {
          try { texture.dispose(); } catch (_) {}
        }
      }
      try { material.dispose(); } catch (_) {}
    }

    function dispose3D() {
      if (scene) {
        scene.background = null;
        scene.environment = null;
        var geometries = [];
        var materials = [];
        scene.traverse(function (object) {
          if (object.geometry && geometries.indexOf(object.geometry) < 0) {
            geometries.push(object.geometry);
          }
          var material = object.material;
          if (Array.isArray(material)) {
            for (var i = 0; i < material.length; i += 1) {
              if (materials.indexOf(material[i]) < 0) materials.push(material[i]);
            }
          } else if (material && materials.indexOf(material) < 0) {
            materials.push(material);
          }
        });
        for (var g = 0; g < geometries.length; g += 1) {
          try { geometries[g].dispose(); } catch (_) {}
        }
        for (var m = 0; m < materials.length; m += 1) disposeMaterial(materials[m]);
        try { scene.clear(); } catch (_) {}
      }
      if (envRenderTarget) {
        try { envRenderTarget.dispose(); } catch (_) {}
        envRenderTarget = null;
      }
      if (environmentTexture) {
        try { environmentTexture.dispose(); } catch (_) {}
        untrack(environmentTexture);
        environmentTexture = null;
      }
      for (var t = 0; t < textures.length; t += 1) {
        try { textures[t].dispose(); } catch (_) {}
      }
      textures = [];
      textureCache = {};
      stoneMaterials = [];
      veilUniforms = [];
      rayUniforms = null;
      stoneColor = null;
      stoneNormal = null;
      stoneRough = null;
      waterNormalTexture = null;
      waterLayers = [];
      waterMaterials = [];
      if (renderer) {
        var element = renderer.domElement;
        try { renderer.dispose(); } catch (_) {}
        try { renderer.forceContextLoss(); } catch (_) {}
        if (element && element.parentNode) element.parentNode.removeChild(element);
      }
      renderer = null;
      scene = null;
      camera = null;
      canvas = null;
      THREE = null;
    }

    function dispose2D() {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx2d = null;
      fallback2d = false;
    }

    // -------------------------------------------------------------------- API

    function enter(config) {
      if (active) return false;
      host = document.getElementById('story-3d-stage');
      if (!host) return false;
      window.clearTimeout(fadeTimer);
      fadeTimer = 0;
      options = config || {};
      progress = 0;
      lastReport = -1;
      holding = false;
      pointerId = null;
      clearing = false;
      renderFailed = false;
      fallback2d = false;
      elapsed = 0;
      lastFrameAt = 0;
      host.hidden = false;
      void host.offsetWidth;
      if (!measure()) {
        host.hidden = true;
        return false;
      }
      THREE = window.THREE || null;
      disposed = false;
      var built = false;
      if (THREE && typeof THREE.WebGLRenderer === 'function') {
        try {
          build3D();
          built = true;
        } catch (error) {
          dispose3D();
          disposed = true;
          built = false;
        }
      }
      if (!built) {
        try {
          build2D();
          built = true;
        } catch (error) {
          dispose2D();
          built = false;
        }
      }
      if (!built) {
        host.hidden = true;
        disposed = true;
        return false;
      }
      disposed = false;
      active = true;
      attachEvents();
      if (host.classList) host.classList.remove('is-clearing');
      host.classList.add('is-active');
      reportProgress(true);
      startLoop();
      return true;
    }

    function exit() {
      if (!active && !clearing) return false;
      window.clearTimeout(fadeTimer);
      fadeTimer = 0;
      active = false;
      clearing = false;
      holding = false;
      finish();
      return true;
    }

    function isActive() {
      return active;
    }

    function snapshot() {
      return {
        active: active,
        clearing: clearing,
        progress: Math.round(progress),
        fallback2d: fallback2d,
        running: running,
        width: width,
        height: height,
        dpr: dpr,
        version: VERSION
      };
    }

    return {
      enter: enter,
      exit: exit,
      isActive: isActive,
      snapshot: snapshot
    };
  })();

  window.SanctuaryStories = {
    enter: enter,
    exit: exit,
    enter3D: threshold.enter,
    exit3D: threshold.exit,
    isActive: function () { return active; },
    is3DActive: threshold.isActive,
    snapshot: snapshot,
    snapshot3D: threshold.snapshot,
    version: '142',
  };
})();
