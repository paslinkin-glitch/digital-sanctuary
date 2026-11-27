/* Yoursanctuary — SanctuaryPlayer (v126).
 *
 * One small isolated video layer. It owns exactly two <video> elements and no
 * poster image: the stream itself is the picture, from the very first frame.
 *
 *   #playerCurrent (or #playerNext)  the frame on screen, z-index 2
 *   the other slot                   the frame warming up, z-index 1
 *
 * One show(clip, nextClip) does:
 *   1. pick the source: url720 on phones, url1080 on desktop;
 *   2. if the hidden slot already holds that source, promote it — the outgoing
 *      frame stays visible underneath while the new one fades in over 240 ms;
 *   3. otherwise load the source into the hidden slot, keep playing whatever is
 *      on screen, and swap the moment the new frame reports loadeddata/playing;
 *   4. once the visible clip really plays, fetch nextClip into the hidden slot.
 *
 * warm(clip) preloads the very first frame into #playerCurrent while the entry
 * screen is still up, so the swipe up opens a live picture, not a buffer.
 *
 * Public surface (window.SanctuaryPlayer):
 *   show(clip, nextClip)  warm(clip)  setRate(rate)  pause()  resume()
 *   duration()  snapshot()  destroy()  onLoop(clip)  init()
 */
(function () {
  'use strict';

  var LOOP_EDGE = 0.15;
  var LOOP_START = 0.04;
  var MOBILE_MAX_WIDTH = 900;
  var FADE_MS = 240;
  var HANDOFF_MS = FADE_MS + 40;

  var current = null;
  var next = null;
  var currentSrc = '';
  var nextSrc = '';
  var currentClip = null;
  var nextClip = null;
  var pending = null;
  var pendingSrc = '';
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

  function sourceFor(clip) {
    if (!clip) return '';
    return mobile
      ? (clip.url720 || clip.url || '')
      : (clip.url1080 || clip.url || '');
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
  function handOver(target, outgoing) {
    if (!target) return;
    if (outgoing && outgoing !== target) {
      var wasVisible = outgoing.classList.contains('is-current');
      outgoing.classList.remove('is-current');
      if (wasVisible && outgoing.readyState >= 2) outgoing.classList.add('is-outgoing');
      window.clearTimeout(handoffTimer);
      handoffTimer = window.setTimeout(function () {
        if (destroyed || outgoing === target) return;
        outgoing.classList.remove('is-outgoing');
        try { outgoing.pause(); } catch (_) {}
      }, HANDOFF_MS);
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
    pending = null;
    current = target;
    next = outgoing;
    currentSrc = pendingSrc;
    pendingSrc = '';
    nextSrc = '';
    handOver(current, outgoing);
    playVideo(current);
    scheduleWarmFollowing();
  }

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
      if (video === pending) promotePending();
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
      if (!video.classList.contains('is-current')) handOver(video, other(video));
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

  function show(clip, following) {
    if (destroyed || !clip) return false;
    init();
    if (!current || !next) return false;
    var src = sourceFor(clip);
    if (!src) return false;
    nextClip = following && following !== clip ? following : null;
    currentClip = clip;

    // Already buffering or playing in the visible slot.
    if (currentSrc === src && current.getAttribute('src') === src) {
      if (pending && pending !== current) {
        pending = null;
        pendingSrc = '';
      }
      if (current.readyState >= 2) {
        handOver(current, next);
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
      handOver(current, outgoing);
      playVideo(current);
      scheduleWarmFollowing();
      return true;
    }

    // Cold frame: buffer it off screen while the outgoing one keeps playing.
    var slot = next;
    if (!slot || slot === current) return false;
    pending = slot;
    pendingSrc = src;
    nextSrc = src;
    slot.classList.remove('is-current');
    if (slot.classList.contains('is-outgoing')) {
      // Still visible in the previous crossfade: never swap its src mid-fade.
      window.clearTimeout(coldTimer);
      coldTimer = window.setTimeout(function () {
        if (destroyed || pending !== slot) return;
        slot.classList.remove('is-outgoing');
        prepare(slot, src);
        if (slot.readyState >= 2) promotePending();
      }, HANDOFF_MS);
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
    currentClip = null;
    nextClip = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
