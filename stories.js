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

  window.SanctuaryStories = {
    enter: enter,
    exit: exit,
    isActive: function () { return active; },
    snapshot: snapshot,
    version: '132',
  };
})();
