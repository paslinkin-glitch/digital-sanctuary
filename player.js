/* Yoursanctuary — SanctuaryPlayer (v124).
 *
 * One small isolated video layer. It owns two <video> elements and one poster
 * <img>, and it has a single job: put the incoming frame on screen instantly
 * and never show black.
 *
 *   #playerPoster   (z-index 1)  the WebP still of the current clip
 *   #playerCurrent  (z-index 2)  the clip playing right now
 *   #playerNext     (z-index 2)  the following clip, warming on pause
 *
 * One show(clip, nextClip) does:
 *   1. assign clip.poster to #playerPoster synchronously (0 ms picture) and
 *      warm nextClip.poster in an off-screen Image();
 *   2. pick the source: url720 on phones, url1080 on desktop;
 *   3. if #playerNext already holds that source, promote it to #playerCurrent
 *      and trade places — no load();
 *   4. otherwise set the source on #playerCurrent, play(), and let the video
 *      fade in over 240 ms on its own loadeddata / playing event;
 *   5. once the current clip really plays, fetch nextClip into #playerNext.
 *
 * Public surface (window.SanctuaryPlayer):
 *   show(clip, nextClip)  setRate(rate)  pause()  resume()
 *   duration()  snapshot()  destroy()  onLoop(clip)
 */
(function () {
  'use strict';

  var LOOP_EDGE = 0.15;
  var LOOP_START = 0.04;
  var MOBILE_MAX_WIDTH = 900;

  var poster = null;
  var current = null;
  var next = null;
  var currentSrc = '';
  var nextSrc = '';
  var currentClip = null;
  var nextClip = null;
  var rate = 1;
  var ready = false;
  var destroyed = false;
  var mobile = detectMobile();

  var api = {
    ready: false,
    onLoop: null,
    show: show,
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

  function paintPoster(clip) {
    var src = (clip && clip.poster) || '';
    if (!poster || !src || poster.getAttribute('src') === src) return;
    poster.setAttribute('src', src);
  }

  function warmPoster(clip) {
    var src = (clip && clip.poster) || '';
    if (!src) return;
    var image = new Image();
    image.decoding = 'async';
    image.src = src;
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

  function reveal(video) {
    if (!video) return;
    if (video.readyState < 2) return;
    video.classList.add('is-visible');
  }

  function conceal(video) {
    if (video) video.classList.remove('is-visible');
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
    video.addEventListener('loadeddata', function () {
      if (!destroyed && video === current) reveal(video);
    });
    video.addEventListener('canplay', function () {
      if (!destroyed && video === current) reveal(video);
    });
    video.addEventListener('playing', function () {
      if (destroyed || video !== current) return;
      reveal(video);
      warmFollowing();
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

  // 5. The next frame is fetched only after the current one really plays.
  function warmFollowing() {
    if (!nextClip || !next) return;
    var src = sourceFor(nextClip);
    if (!src || nextSrc === src) return;
    nextSrc = src;
    next.classList.remove('is-visible');
    next.muted = true;
    next.defaultMuted = true;
    next.playsInline = true;
    next.preload = 'auto';
    if (next.getAttribute('src') !== src) {
      next.setAttribute('src', src);
      try { next.load(); } catch (_) {}
    }
  }

  function init() {
    if (ready) return api;
    poster = document.getElementById('playerPoster');
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

  function show(clip, following) {
    if (destroyed || !clip) return false;
    init();
    if (!current || !next) return false;
    var src = sourceFor(clip);
    if (!src) return false;
    // 1. Instant picture, in the same tick as the swipe.
    paintPoster(clip);
    warmPoster(following);
    nextClip = following && following !== clip ? following : null;
    currentClip = clip;

    // 3. #playerNext already holds this frame: promote it, no load().
    if (nextSrc === src && next.getAttribute('src') === src && next.readyState >= 2) {
      var outgoing = current;
      current = next;
      next = outgoing;
      currentSrc = src;
      nextSrc = '';
      conceal(outgoing);
      reveal(current);
      playVideo(current);
      return true;
    }

    // The same frame again (tab return, resume): keep the stream alive.
    if (currentSrc === src && current.getAttribute('src') === src && current.readyState >= 2) {
      reveal(current);
      playVideo(current);
      return true;
    }

    // 4. A cold slot: the poster covers the buffer, the video fades in later.
    currentSrc = src;
    nextSrc = '';
    conceal(current);
    current.preload = 'auto';
    if (current.getAttribute('src') !== src) {
      current.setAttribute('src', src);
      try { current.load(); } catch (_) {}
    }
    playVideo(current);
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
        visible: video.classList.contains('is-visible'),
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
      poster: poster ? String(poster.getAttribute('src') || '').slice(-34) : '',
      current: read(current, currentSrc),
      next: read(next, nextSrc),
    };
  }

  function destroy() {
    destroyed = true;
    pause();
    [current, next].forEach(function (video) {
      if (!video) return;
      video.classList.remove('is-visible');
      try { video.removeAttribute('src'); } catch (_) {}
      try { video.load(); } catch (_) {}
    });
    if (poster) poster.removeAttribute('src');
    currentSrc = '';
    nextSrc = '';
    currentClip = null;
    nextClip = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
