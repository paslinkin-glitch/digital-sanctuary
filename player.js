/* Yoursanctuary — SanctuaryPlayer (v127).
 *
 * One small isolated video layer. It owns exactly two <video> elements and no
 * poster image: the stream itself is the picture, from the very first frame.
 *
 *   #playerCurrent (or #playerNext)  the frame on screen, z-index 2
 *   the other slot                   the frame warming up, z-index 1
 *
 * One show(clip, nextClip) does:
 *   1. pick the source: 1080p by default on every device, including phones on
 *      Wi-Fi and iOS Safari; 720p only when the Network Information API says
 *      the link is slow, or after two mobile frames in a row took longer than
 *      1800 ms from src assignment to loadeddata; two fast 720p starts
 *      (< 450 ms) bring 1080p back;
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
 * snapshot() reports the active stream level as '1080' or '720'.
 */
(function () {
  'use strict';

  var LOOP_EDGE = 0.15;
  var LOOP_START = 0.04;
  var MOBILE_MAX_WIDTH = 900;
  var FADE_MS = 240;
  var HANDOFF_MS = FADE_MS + 40;
  var SLOW_START_MS = 1800;
  var FAST_START_MS = 450;
  var SLOW_EFFECTIVE_TYPES = ['slow-2g', '2g', '3g'];
  var FAST_DOWNLINK_MBPS = 5;

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
  var prefer720 = isSlowNetwork();
  var slowStarts = 0;
  var fastStarts = 0;
  var connectionWatched = false;

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

  function connectionInfo() {
    try {
      return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    } catch (_) {
      return null;
    }
  }

  // The Network Information API is the only explicit slow-link hint. If the
  // browser has no API (iOS Safari), the link is treated as fast and 1080p
  // remains the default; the live measurement below can still lower it.
  function isSlowNetwork() {
    var connection = connectionInfo();
    if (!connection) return false;
    if (connection.saveData === true) return true;
    if (SLOW_EFFECTIVE_TYPES.indexOf(connection.effectiveType) !== -1) return true;
    var downlink = Number(connection.downlink);
    return isFinite(downlink) && downlink > 0 && downlink < FAST_DOWNLINK_MBPS;
  }

  // A link that turns slow mid-session (Wi-Fi -> 3G) lowers the level at once;
  // the return to 1080p still needs two genuinely fast mobile starts.
  function watchConnection() {
    if (connectionWatched) return;
    var connection = connectionInfo();
    if (!connection || typeof connection.addEventListener !== 'function') return;
    connectionWatched = true;
    connection.addEventListener('change', function () {
      if (destroyed || !isSlowNetwork() || prefer720) return;
      prefer720 = true;
      slowStarts = 0;
      fastStarts = 0;
    });
  }

  function nowMs() {
    return (window.performance && typeof window.performance.now === 'function')
      ? window.performance.now()
      : Date.now();
  }

  function levelOf(src) {
    return String(src || '').indexOf('/mp4-720/') !== -1 ? '720' : '1080';
  }

  function sourceFor(clip) {
    if (!clip) return '';
    if (prefer720) return clip.url720 || clip.url1080 || clip.url || '';
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
      video._sanctuaryLoadAt = nowMs();
      video._sanctuaryMeasured = false;
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

  // Live channel measurement: from src assignment to the first decoded frame.
  // Only a mobile link changes the level, and only two frames in a row.
  function noteLoadTime(video) {
    if (!video || video._sanctuaryMeasured) return;
    var startedAt = video._sanctuaryLoadAt;
    if (typeof startedAt !== 'number') return;
    video._sanctuaryMeasured = true;
    if (!mobile) return;

    var elapsed = nowMs() - startedAt;
    if (prefer720) {
      if (elapsed < FAST_START_MS) {
        fastStarts += 1;
        slowStarts = 0;
        if (fastStarts >= 2) {
          prefer720 = false;
          fastStarts = 0;
        }
      } else {
        fastStarts = 0;
      }
      return;
    }

    if (elapsed > SLOW_START_MS) {
      slowStarts += 1;
      fastStarts = 0;
      if (slowStarts >= 2) {
        prefer720 = true;
        slowStarts = 0;
      }
    } else {
      slowStarts = 0;
    }
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
      if (video.readyState >= 2) noteLoadTime(video);
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
    if (!prefer720 && isSlowNetwork()) prefer720 = true;
    watchConnection();
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
      level: levelOf(currentSrc),
      prefer720: prefer720,
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
