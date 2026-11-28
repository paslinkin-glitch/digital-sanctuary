/* Yoursanctuary — SanctuaryPlayer (v136).
 *
 * One small isolated video layer. It owns exactly two <video> elements and no
 * poster image: the stream itself is the picture, from the very first frame.
 *
 *   #playerCurrent (or #playerNext)  the frame on screen, z-index 2
 *   the other slot                   the frame warming up, z-index 1
 *
 * One show(clip, nextClip, opts) does:
 *   1. pick the source by device class and never by the current link: every
 *      phone / tablet gets the compact 720p twin (url720, 1.37–2.15 MB,
 *      720×1280) so a 4G session never stalls, every desktop gets the full
 *      1080p studio file (url1080). The level is decided once per device, so
 *      it cannot jump in the middle of a session;
 *   2. if the hidden slot already holds that source, promote it — the outgoing
 *      frame stays visible underneath while the new one breathes in over
 *      600 ms of pure opacity (no transform, filter or black curtain);
 *   3. otherwise load the source into the hidden slot, keep playing whatever is
 *      on screen, and swap the moment the new frame reports loadeddata/playing;
 *   4. once the visible clip really plays, fetch nextClip into the hidden slot.
 *
 * warm(clip) preloads the very first frame into #playerCurrent while the entry
 * screen is still up, so the swipe up opens a live picture, not a buffer.
 *
 * Public surface (window.SanctuaryPlayer):
 *   show(clip, nextClip, opts)  warm(clip)  setRate(rate)  pause()  resume()
 *   duration()  snapshot()  destroy()  onLoop(clip)  init()
 * opts.fadeMs overrides the 600 ms crossfade for that one handoff (the mist
 * story hands over with 950 ms); snapshot() reports the active stream level
 * as '1080' or '720'.
 */
(function () {
  'use strict';

  var LOOP_EDGE = 0.15;
  var LOOP_START = 0.04;
  var MOBILE_MAX_WIDTH = 900;
  // v136: one calm cinematic breath between every two frames. 600 ms of pure
  // opacity crossfade, then the outgoing slot is released at 660 ms.
  var FADE_MS = 600;
  var HANDOFF_MS = FADE_MS + 60;

  var current = null;
  var next = null;
  var currentSrc = '';
  var nextSrc = '';
  var currentClip = null;
  var nextClip = null;
  var pending = null;
  var pendingSrc = '';
  var pendingFadeMs = FADE_MS;
  var activeFadeMs = FADE_MS;
  var currentFadeMs = FADE_MS;
  var currentShowPending = false;
  var rate = 1;
  var ready = false;
  var destroyed = false;
  var warmTimer = 0;
  var handoffTimer = 0;
  var coldTimer = 0;
  var mobile = detectMobile();

  var api = {
    ready: false,
    onLoop: null,
    show: show,
    warm: warm,
    setRate: setRate,
    pause: pause,
    resume: resume,
    duration: duration,
    snapshot: snapshot,
    destroy: destroy,
    init: init,
  };
  window.SanctuaryPlayer = api;

  function detectMobile() {
    try {
      var ua = navigator.userAgent || '';
      if (/iphone|ipod|ipad|android|windows phone/i.test(ua)) return true;
      if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
      return window.matchMedia('(max-width: ' + MOBILE_MAX_WIDTH + 'px)').matches;
    } catch (_) {
      return false;
    }
  }

  function levelOf(src) {
    return String(src || '').indexOf('/mp4-720/') !== -1 ? '720' : '1080';
  }

  // v136: the stream level follows the device, not the momentary link. Phones
  // and tablets always stream the compact 720p twin (1.37–2.15 MB, 720×1280),
  // so a 4G session never stutters and the quality cannot jump mid-session;
  // desktops always stream the full 1080p studio file.
  function sourceFor(clip) {
    if (!clip) return '';
    if (mobile === true) return clip.url720 || clip.url1080 || clip.url || '';
    return clip.url1080 || clip.url || '';
  }

  function other(video) {
    if (!video) return null;
    return video === current ? next : current;
  }

  function prepare(video, src) {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.preload = 'auto';
    if (video.getAttribute('src') !== src) {
      video.setAttribute('src', src);
      try { video.load(); } catch (_) {}
    }
  }

  function playVideo(video) {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.playbackRate = rate;
    var promise = video.play();
    if (promise && typeof promise.catch === 'function') promise.catch(function () {});
  }

  // Put `target` on screen: it fades in at z-index 2 while `outgoing` holds the
  // previous picture at z-index 1, and is paused only after the crossfade ends.
  // v136: the fade is 600 ms by default (a calm cinematic breath between every
  // two frames), still per handoff via --player-fade-ms; the mist story asks
  // for 950 ms and keeps its silk handoff.
  function handOver(target, outgoing, fadeMs) {
    if (!target) return;
    var duration = Number(fadeMs);
    if (!isFinite(duration) || duration <= 0) duration = FADE_MS;
    activeFadeMs = duration;
    var fade = duration + 'ms';
    if (target.style) target.style.setProperty('--player-fade-ms', fade);
    if (outgoing && outgoing !== target && outgoing.style) {
      outgoing.style.setProperty('--player-fade-ms', fade);
    }
    if (outgoing && outgoing !== target) {
      var wasVisible = outgoing.classList.contains('is-current');
      outgoing.classList.remove('is-current');
      if (wasVisible && outgoing.readyState >= 2) outgoing.classList.add('is-outgoing');
      window.clearTimeout(handoffTimer);
      handoffTimer = window.setTimeout(function () {
        if (destroyed || outgoing === target) return;
        outgoing.classList.remove('is-outgoing');
        try { outgoing.pause(); } catch (_) {}
      }, duration + 60);
    }
    target.classList.remove('is-outgoing');
    target.classList.add('is-current');
  }

  function scheduleWarmFollowing() {
    window.clearTimeout(warmTimer);
    warmTimer = window.setTimeout(function () {
      if (!destroyed) warmFollowing();
    }, HANDOFF_MS);
  }

  // Promote a hidden slot that finished buffering into the visible position.
  function promotePending() {
    if (!pending || pending.readyState < 2 || destroyed) return;
    var target = pending;
    var outgoing = current;
    var fadeMs = pendingFadeMs;
    pending = null;
    pendingFadeMs = FADE_MS;
    current = target;
    next = outgoing;
    currentSrc = pendingSrc;
    pendingSrc = '';
    nextSrc = '';
    handOver(current, outgoing, fadeMs);
    playVideo(current);
    scheduleWarmFollowing();
  }

  // v136: the live channel measurement is gone on purpose. The stream level is
  // a property of the device (720p phones, 1080p desktops), so nothing can
  // downgrade or upgrade a session halfway through and force a fresh load().

  function bind(video) {
    if (!video || video.dataset.playerBound === '1') return;
    video.dataset.playerBound = '1';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    var onReady = function () {
      if (destroyed) return;
      if (video === pending) {
        promotePending();
        return;
      }
      // v135: the entry frame may finish buffering after the swipe up has
      // already asked for it. Reveal it the moment data is playable instead of
      // waiting for a second `playing` event and showing a black screen.
      if (video === current && currentShowPending && !video.classList.contains('is-current')) {
        currentShowPending = false;
        handOver(current, next, currentFadeMs);
        playVideo(current);
        scheduleWarmFollowing();
      }
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', function () {
      if (destroyed) return;
      if (video === pending) {
        promotePending();
        return;
      }
      if (video !== current) return;
      if (!video.classList.contains('is-current')) {
        currentShowPending = false;
        handOver(video, other(video), currentFadeMs);
      }
      scheduleWarmFollowing();
    });
    video.addEventListener('timeupdate', function () {
      if (destroyed || video !== current || !currentClip) return;
      var total = video.duration;
      if (!isFinite(total) || total <= 0) return;
      if (video.currentTime < total - LOOP_EDGE) return;
      try { video.currentTime = LOOP_START; } catch (_) {}
      playVideo(video);
      if (typeof api.onLoop === 'function') {
        try { api.onLoop(currentClip); } catch (_) {}
      }
    });
  }

  // The next frame is fetched only after the current one really plays, and only
  // into the slot that is not on screen any more.
  function warmFollowing() {
    if (pending || !nextClip || !next || next === current) return;
    if (next.classList.contains('is-outgoing')) {
      // The previous crossfade is still running; retry once it settles.
      window.clearTimeout(warmTimer);
      warmTimer = window.setTimeout(function () {
        if (!destroyed) warmFollowing();
      }, 120);
      return;
    }
    var src = sourceFor(nextClip);
    if (!src || nextSrc === src) return;
    nextSrc = src;
    next.classList.remove('is-current', 'is-outgoing');
    prepare(next, src);
  }

  function init() {
    if (ready) return api;
    var first = document.getElementById('playerCurrent');
    var second = document.getElementById('playerNext');
    if (!first || !second) return api;
    current = first;
    next = second;
    bind(current);
    bind(next);
    ready = true;
    api.ready = true;
    return api;
  }

  // Entry warm-up: the first frame is buffered in #playerCurrent itself, before
  // the visitor swipes up. Nothing is shown yet, so replacing src is safe.
  // v136: the warmed file is the same one the session will stream — the 720p
  // twin on phones, the 1080p studio file on desktops.
  function warm(clip) {
    if (destroyed || !clip) return false;
    init();
    if (!current || !next) return false;
    var src = sourceFor(clip);
    if (!src) return false;
    if (currentSrc === src || nextSrc === src) return true;
    if (current.getAttribute('src') && current.readyState >= 2) return false;
    if (pending) return false;
    currentSrc = src;
    nextSrc = '';
    prepare(current, src);
    return true;
  }

  function show(clip, following, opts) {
    if (destroyed || !clip) return false;
    init();
    if (!current || !next) return false;
    var fadeMs = opts && Number(opts.fadeMs);
    if (!isFinite(fadeMs) || fadeMs <= 0) fadeMs = FADE_MS;
    var src = sourceFor(clip);
    if (!src) return false;
    nextClip = following && following !== clip ? following : null;
    currentClip = clip;
    currentShowPending = false;

    // Already buffering or playing in the visible slot.
    if (currentSrc === src && current.getAttribute('src') === src) {
      currentFadeMs = (opts && opts.fadeMs) || FADE_MS;
      currentShowPending = true;
      if (pending && pending !== current) {
        pending = null;
        pendingSrc = '';
        pendingFadeMs = FADE_MS;
      }
      if (current.readyState >= 2) {
        currentShowPending = false;
        handOver(current, next, fadeMs);
        playVideo(current);
        scheduleWarmFollowing();
      }
      return true;
    }

    // The hidden slot already holds this frame: promote it, no second load().
    if (nextSrc === src && next.getAttribute('src') === src && next.readyState >= 2) {
      var outgoing = current;
      var target = next;
      current = target;
      next = outgoing;
      currentSrc = src;
      nextSrc = '';
      pending = null;
      pendingSrc = '';
      pendingFadeMs = FADE_MS;
      handOver(current, outgoing, fadeMs);
      playVideo(current);
      scheduleWarmFollowing();
      return true;
    }

    // Cold frame: buffer it off screen while the outgoing one keeps playing.
    var slot = next;
    if (!slot || slot === current) return false;
    pending = slot;
    pendingSrc = src;
    pendingFadeMs = fadeMs;
    nextSrc = src;
    slot.classList.remove('is-current');
    if (slot.classList.contains('is-outgoing')) {
      // Still visible in the previous crossfade: never swap its src mid-fade.
      // The wait follows the current fade length (600 ms by default, the 950 ms
      // mist handoff otherwise), so a quick swipe during the fade cannot cut it
      // short.
      window.clearTimeout(coldTimer);
      coldTimer = window.setTimeout(function () {
        if (destroyed || pending !== slot) return;
        slot.classList.remove('is-outgoing');
        prepare(slot, src);
        if (slot.readyState >= 2) promotePending();
      }, Math.max(HANDOFF_MS, activeFadeMs + 60));
      return true;
    }
    prepare(slot, src);
    if (slot.readyState >= 2) promotePending();
    return true;
  }

  function setRate(value) {
    var wanted = Number(value);
    if (!isFinite(wanted) || wanted <= 0) return;
    rate = wanted;
    if (current) current.playbackRate = rate;
    if (next) next.playbackRate = rate;
  }

  function pause() {
    if (current) { try { current.pause(); } catch (_) {} }
    if (next) { try { next.pause(); } catch (_) {} }
  }

  function resume() {
    if (current && !destroyed) playVideo(current);
  }

  function duration() {
    if (!current) return 0;
    var total = current.duration;
    return isFinite(total) && total > 0 ? total : 0;
  }

  function snapshot() {
    function read(video, src) {
      if (!video) return null;
      return {
        id: video.id,
        src: String(src || '').slice(-34),
        current: video.classList.contains('is-current'),
        outgoing: video.classList.contains('is-outgoing'),
        paused: video.paused,
        readyState: video.readyState,
        networkState: video.networkState,
        time: Math.round(video.currentTime * 100) / 100,
        opacity: Number(window.getComputedStyle(video).opacity),
      };
    }
    return {
      mobile: mobile,
      level: levelOf(currentSrc),
      rate: rate,
      clip: (currentClip && currentClip.id) || null,
      warmed: (nextClip && nextClip.id) || null,
      pending: pending ? pendingSrc.slice(-34) : '',
      current: read(current, currentSrc),
      next: read(next, nextSrc),
    };
  }

  function destroy() {
    destroyed = true;
    window.clearTimeout(warmTimer);
    window.clearTimeout(handoffTimer);
    window.clearTimeout(coldTimer);
    pause();
    [current, next].forEach(function (video) {
      if (!video) return;
      video.classList.remove('is-current', 'is-outgoing');
      try { video.removeAttribute('src'); } catch (_) {}
      try { video.load(); } catch (_) {}
    });
    currentSrc = '';
    nextSrc = '';
    pending = null;
    pendingSrc = '';
    pendingFadeMs = FADE_MS;
    activeFadeMs = FADE_MS;
    currentFadeMs = FADE_MS;
    currentShowPending = false;
    currentClip = null;
    nextClip = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
