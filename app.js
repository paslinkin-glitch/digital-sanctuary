/* Digital Sanctuary — MVP 2: real Coverr footage.
 *
 * Silent vertical feed, five Jungian categories. Each category is filled with
 * one or two free clips from the official Coverr REST API, muted, looping and
 * autoplaying. Swipe up/down (touch, mouse or wheel) crosses a slow fade to
 * black. Holding slows the active clip to 0.5x and deepens a Web Audio hum,
 * started on the first touch. Every swipe prints one behaviour record.
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------- настройки */

  // Длительность одного fade задаётся в style.css (--fade-duration).
  const FADE_MS = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--fade-duration')
  ) || 800;

  const HOLD_MS = 260;
  const SWIPE_MIN_RATIO = 0.08;
  const FLICK_MIN_PX = 28;
  const FLICK_MIN_SPEED = 0.65;
  const SLOW_RATE = 0.5;
  const API_TIMEOUT_MS = 7000;
  const CLIPS_PER_CATEGORY = 2;

  // Demo key from the brief. A static prototype must expose it; for production
  // this call belongs behind a tiny server-side proxy.
  const API_KEY = 'b1155018766256bd1ea645df7d64e178';
  const API_ENDPOINT = 'https://api.coverr.co/videos';

  /* ------------------------------------------------------ клипы на случай,
     если API недоступен: те же ролики Coverr, уже проверенные по API. */

  const FALLBACK_CLIPS = {
    Shadow: [
      {
        id: 'VC1PStUKzq',
        title: 'Rain falling in the forest',
        duration: 16.29,
        url: 'https://cdn.coverr.co/videos/coverr-rain-falling-in-the-forest-9275/1080p.mp4',
      },
      {
        id: 'Jl07Anu9ty',
        title: 'Tree in the mist',
        duration: 26.17,
        url: 'https://cdn.coverr.co/videos/coverr-tree-in-the-mist-4598/1080p.mp4',
      },
    ],
    Trickster: [
      {
        id: 'ZNfyKwAM8L',
        title: 'Ring of burning matches',
        duration: 6.0,
        url: 'https://cdn.coverr.co/videos/user-ai-generation-4kf566VvRQxB/1080p.mp4',
      },
      {
        id: 'mGv4TVmkZo',
        title: 'Using a lighter in the dark',
        duration: 12.0,
        url: 'https://cdn.coverr.co/videos/coverr-using-a-lighter-in-the-dark-7305/1080p.mp4',
      },
    ],
    Abyss: [
      {
        id: 'ni2blF5Md9',
        title: 'Caged boat hull descending',
        duration: 5.04,
        url: 'https://cdn.coverr.co/videos/user-ai-generation-gTC7iYAR37SD/1080p.mp4',
      },
      {
        id: '8KyLPpPmVA',
        title: 'Pink jellyfish in deep blue',
        duration: 4.0,
        url: 'https://cdn.coverr.co/videos/user-ai-generation-lNY7b4F0UVS3/1080p.mp4',
      },
    ],
    Calm: [
      {
        id: 'aMlApWfzYF',
        title: 'Raindrops on the window',
        duration: 7.88,
        url: 'https://cdn.coverr.co/videos/coverr-raindrops-on-the-window-7102/1080p.mp4',
      },
      {
        id: 'oEw7PbASZW',
        title: 'Cozy coffee by the window',
        duration: 8.0,
        url: 'https://cdn.coverr.co/videos/user-ai-generation-lZ8wOYvP6xmM/1080p.mp4',
      },
    ],
    Path: [
      {
        id: 'KK342MfQEX',
        title: 'Moving car on an empty road',
        duration: 11.85,
        url: 'https://cdn.coverr.co/videos/coverr-moving-car-on-an-empty-road-5120/1080p.mp4',
      },
      {
        id: 'fwwKKUlRGF',
        title: 'Night city from a moving car',
        duration: 23.61,
        url: 'https://cdn.coverr.co/videos/coverr-night-city-from-a-moving-car-6550/1080p.mp4',
      },
    ],
  };

  /* ---------------------------------------------------------- категории */

  const CATEGORY_CONFIG = {
    Shadow: {
      query: 'dark fog night',
      fallbackQuery: 'fog forest',
      keywords: ['fog', 'mist', 'dark', 'night', 'forest', 'gloomy', 'mysterious', 'haze', 'tree', 'shadow'],
      blocked: ['coffin', 'cemetery', 'halloween', 'zombie', 'skull', 'horror'],
      preferred: ['VC1PStUKzq', 'Jl07Anu9ty'],
    },
    Trickster: {
      query: 'smoke fire dark',
      fallbackQuery: 'fire',
      keywords: ['smoke', 'fire', 'flame', 'sparks', 'match', 'lighter', 'burning', 'dark', 'night', 'inferno'],
      blocked: ['sausage', 'cooking', 'food', 'barbecue'],
      preferred: ['ZNfyKwAM8L', 'mGv4TVmkZo'],
    },
    Abyss: {
      query: 'underwater dark ocean',
      fallbackQuery: 'underwater',
      keywords: ['underwater', 'deep', 'ocean', 'sea', 'blue', 'submerged', 'dark', 'wreck', 'jellyfish', 'whale', 'boat'],
      blocked: ['child', 'goldfish'],
      preferred: ['ni2blF5Md9', '8KyLPpPmVA'],
    },
    Calm: {
      query: 'rain window dark',
      fallbackQuery: 'rain window',
      keywords: ['rain', 'window', 'raindrops', 'cozy', 'calm', 'peaceful', 'warm', 'evening', 'lamp', 'coffee', 'dark', 'glass'],
      blocked: [],
      preferred: ['aMlApWfzYF', 'oEw7PbASZW'],
    },
    Path: {
      query: 'empty road night',
      fallbackQuery: 'night road',
      keywords: ['road', 'night', 'empty', 'street', 'driving', 'car', 'lights', 'city', 'journey', 'highway'],
      blocked: ['halloween', 'makeup', 'zombie', 'skull'],
      preferred: ['KK342MfQEX', 'fwwKKUlRGF'],
    },
  };

  /* ------------------------------------------------------------------ DOM */

  const stage = document.querySelector('.stage');
  const slides = Array.from(document.querySelectorAll('.slide'));

  const categories = slides.map((slide, index) => {
    const tag = slide.dataset.tag;
    const config = CATEGORY_CONFIG[tag] || {};
    return {
      index,
      tag,
      el: slide,
      query: config.query || tag,
      fallbackQuery: config.fallbackQuery || '',
      keywords: config.keywords || [],
      blocked: config.blocked || [],
      preferred: config.preferred || [],
      clips: [],
      activeIndex: 0,
    };
  });

  function now() {
    return performance.now();
  }

  const state = {
    index: 0,
    locked: false,
    viewStart: now(),
    hiddenAt: null,
    holdsInView: 0,
    heldMs: 0,
    totalHolds: 0,
    visits: slides.map(() => 0),
    loopsInView: 0,
    totalLoops: 0,
  };
  state.visits[0] = 1;

  let gesture = null;
  let holdTimer = 0;
  let ambience = null;
  let ambienceStarting = false;

  function resetViewClock() {
    state.viewStart = now();
    state.holdsInView = 0;
    state.heldMs = 0;
    state.loopsInView = 0;
  }

  function activeCategory() {
    return categories[state.index];
  }

  function activeClip() {
    const category = activeCategory();
    return category && category.clips[category.activeIndex]
      ? category.clips[category.activeIndex]
      : null;
  }

  /* ------------------------------------------------------- мягкий эмбиент */

  function enableAmbience() {
    if (ambience) {
      if (ambience.ctx.state === 'suspended') {
        ambience.ctx.resume().catch(() => {});
      }
      return;
    }
    if (ambienceStarting) return;

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    ambienceStarting = true;
    try {
      const ctx = new AudioCtor();
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 5);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      filter.Q.value = 0.55;

      const voices = [
        { frequency: 55, gain: 0.5, detune: -3 },
        { frequency: 82.5, gain: 0.26, detune: 4 },
        { frequency: 110, gain: 0.12, detune: -6 },
        { frequency: 164.81, gain: 0.07, detune: -2 },
        { frequency: 220, gain: 0.05, detune: 3 },
      ];

      for (const voice of voices) {
        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = voice.frequency;
        oscillator.detune.value = voice.detune;

        const gain = ctx.createGain();
        gain.gain.value = voice.gain;

        oscillator.connect(gain);
        gain.connect(filter);
        oscillator.start();
      }

      // Медленное дыхание тембра, а не громкости: без риска уйти в минус.
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 40;
      lfo.connect(lfoDepth);
      lfoDepth.connect(filter.frequency);
      lfo.start();

      filter.connect(master);
      master.connect(ctx.destination);

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      ambience = { ctx, master, filter };
    } catch (_) {
      // Web Audio недоступен — сцена просто остаётся визуальной.
    } finally {
      ambienceStarting = false;
    }
  }

  function setHumDepth(deep) {
    if (!ambience) return;
    const t = ambience.ctx.currentTime;
    ambience.filter.frequency.setTargetAtTime(deep ? 170 : 240, t, 0.7);
    ambience.master.gain.setTargetAtTime(deep ? 0.07 : 0.055, t, 2);
  }

  /* ------------------------------------------------------------- Coverr API */

  async function searchVideos(query) {
    if (!query) return [];

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const url = new URL(API_ENDPOINT);
      url.searchParams.set('query', query);
      url.searchParams.set('api_key', API_KEY);
      url.searchParams.set('urls', 'true');
      url.searchParams.set('page_size', '20');

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Coverr API HTTP ${response.status}`);
      }

      const payload = await response.json();
      return Array.isArray(payload.hits) ? payload.hits : [];
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeClip(hit, category) {
    if (!hit || hit.is_premium === true) return null;
    if (hit.state && hit.state !== 'published') return null;

    const url = hit.urls && hit.urls.mp4;
    if (typeof url !== 'string' || !url.endsWith('.mp4')) return null;

    // Только прямые mp4 самого Coverr: никаких shutterstock и внешних ссылок.
    if (/shutterstock/i.test(url)) return null;
    if (!/^https:\/\/[a-z0-9.-]+\.coverr\.co\/videos\//i.test(url)) return null;

    const duration = Number(hit.duration);
    if (!Number.isFinite(duration) || duration < 3 || duration > 45) return null;

    const tags = Array.isArray(hit.tags) ? hit.tags : [];
    const haystack = `${hit.title || ''} ${tags.join(' ')} ${hit.description || ''}`.toLowerCase();
    if (category.blocked.some((word) => haystack.includes(word))) return null;

    return {
      id: hit.video_id || hit.id || hit.objectID,
      title: hit.title || 'Untitled',
      url,
      playUrl: playbackUrl(url),
      duration,
      description: hit.description || '',
      vertical: Boolean(hit.is_vertical),
      tags,
    };
  }

  // 720p — тот же ролик Coverr, но легче для мобильного автозапуска.
  // Если варианта нет, обработчик ошибки вернётся к исходному 1080p.
  function playbackUrl(url) {
    return url.replace(/\/1080p\.mp4$/i, '/720p.mp4');
  }

  function scoreClip(clip, category) {
    const preferredIndex = category.preferred.indexOf(clip.id);
    if (preferredIndex >= 0) return 1000 - preferredIndex;

    let score = 0;
    const title = clip.title.toLowerCase();
    const description = clip.description.toLowerCase();
    const tags = clip.tags.map((tag) => tag.toLowerCase());

    for (const keyword of category.keywords) {
      const key = keyword.toLowerCase();
      if (title.includes(key)) score += 4;
      if (tags.includes(key)) {
        score += 4;
      } else if (tags.some((tag) => tag.includes(key))) {
        score += 1;
      }
      if (description.includes(key)) score += 1;
    }

    if (clip.vertical) score += 3;
    if (clip.duration >= 5 && clip.duration <= 20) score += 1;
    return score;
  }

  function selectClips(pool, category) {
    const unique = [];
    const seen = new Set();

    for (const clip of pool) {
      if (!clip || seen.has(clip.id)) continue;
      seen.add(clip.id);
      unique.push(clip);
    }

    unique.sort((a, b) => scoreClip(b, category) - scoreClip(a, category));

    const selected = unique.slice(0, CLIPS_PER_CATEGORY);
    const reserve = FALLBACK_CLIPS[category.tag] || [];

    for (const clip of reserve) {
      if (selected.length >= CLIPS_PER_CATEGORY) break;
      if (!selected.some((item) => item.id === clip.id)) selected.push(clip);
    }

    return selected;
  }

  function mountClips(category) {
    const media = category.el.querySelector('.media');
    if (!media) return;

    media.textContent = '';
    category.clips.forEach((clip, index) => {
      const video = document.createElement('video');
      const playUrl = clip.playUrl || playbackUrl(clip.url);
      let triedOriginal = false;

      clip.playUrl = playUrl;
      video.className = 'clip';
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.disablePictureInPicture = true;
      video.preload = category.index === state.index && index === 0 ? 'auto' : 'metadata';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('aria-hidden', 'true');

      video.addEventListener('canplay', () => video.classList.add('is-ready'));
      video.addEventListener('playing', () => video.classList.add('is-ready'));
      video.addEventListener('timeupdate', () => handleLoop(category, index, video));
      video.addEventListener('error', () => {
        if (!triedOriginal && playUrl !== clip.url) {
          triedOriginal = true;
          video.classList.remove('is-ready');
          video.src = clip.url;
          video.load();
          if (category.index === state.index && category.activeIndex === index) {
            const promise = video.play();
            if (promise && typeof promise.catch === 'function') promise.catch(() => {});
          }
          return;
        }
        console.warn('[sanctuary] video unavailable:', clip.title);
      });

      video.src = playUrl;
      clip.el = video;
      clip.lastTime = 0;
      media.appendChild(video);
    });

    if (category.index === state.index && category.clips.length) {
      const index = Math.max(0, state.visits[state.index] - 1) % category.clips.length;
      playClip(category, index);
    }
  }

  async function loadCategory(category) {
    const queries = [category.query];
    if (category.fallbackQuery && category.fallbackQuery !== category.query) {
      queries.push(category.fallbackQuery);
    }

    try {
      const results = await Promise.allSettled(queries.map((query) => searchVideos(query)));
      const pool = [];

      for (let i = 0; i < results.length; i += 1) {
        const result = results[i];
        if (result.status !== 'fulfilled') {
          console.warn(`[sanctuary] Coverr query failed: "${queries[i]}"`, result.reason);
          continue;
        }
        for (const hit of result.value) {
          const clip = normalizeClip(hit, category);
          if (clip) pool.push(clip);
        }
      }

      category.clips = selectClips(pool, category);
    } catch (error) {
      console.warn('[sanctuary] Coverr category failed:', category.tag, error);
      category.clips = [];
    }

    if (!category.clips.length) {
      category.clips = (FALLBACK_CLIPS[category.tag] || []).slice(0, CLIPS_PER_CATEGORY);
    }

    mountClips(category);
  }

  function handleLoop(category, clipIndex, video) {
    if (category.index !== state.index || category.activeIndex !== clipIndex) return;

    const clip = category.clips[clipIndex];
    if (!clip) return;

    const current = video.currentTime;
    if (clip.lastTime > 0.5 && current + 0.35 < clip.lastTime) {
      state.loopsInView += 1;
      state.totalLoops += 1;
    }
    clip.lastTime = current;
  }

  /* ---------------------------------------------------------- воспроизведение */

  function playClip(category, index) {
    if (!category || category.index !== state.index) return;
    const selected = category.clips[index];
    if (!selected || !selected.el) return;

    category.activeIndex = index;

    category.clips.forEach((clip, clipIndex) => {
      const video = clip.el;
      if (!video) return;

      if (clipIndex === index) {
        video.classList.add('is-current');
        video.preload = 'auto';
        video.playbackRate = stage.classList.contains('is-held') ? SLOW_RATE : 1;
        clip.lastTime = video.currentTime;

        const promise = video.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            // Autoplay может ждать первого касания; проснёмся в pointerdown.
          });
        }
      } else {
        video.classList.remove('is-current');
        video.pause();
      }
    });
  }

  function pauseCategory(category) {
    if (!category) return;
    category.clips.forEach((clip) => {
      if (clip.el) clip.el.pause();
    });
  }

  function setActivePlaybackRate(rate) {
    const clip = activeClip();
    if (clip && clip.el) clip.el.playbackRate = rate;
  }

  function wakePlayback() {
    const category = activeCategory();
    const clip = category && category.clips[category.activeIndex];
    if (!clip || !clip.el || !clip.el.paused) return;

    const promise = clip.el.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }

  /* ------------------------------------------------------------- телеметрия */

  function reportSwipe(direction, speed) {
    const category = activeCategory();
    const clip = category.clips[category.activeIndex];
    const visits = state.visits[state.index];

    const record = {
      category: category.tag,
      video: clip ? clip.title : null,
      videoId: clip ? clip.id : null,
      clip: category.clips.length ? category.activeIndex + 1 : null,
      viewedMs: Math.max(0, Math.round(now() - state.viewStart)),
      swipeSpeed: Math.round(speed * 100) / 100,
      swipeSpeedUnit: 'px/ms',
      swipeDirection: direction,
      loopCount: state.loopsInView,
      totalLoopCount: state.totalLoops,
      repeatCount: Math.max(0, visits - 1),
      visitCount: visits,
      holdCount: state.holdsInView,
      heldMs: Math.round(state.heldMs),
      totalHoldCount: state.totalHolds,
      loggedAt: new Date().toISOString(),
    };

    console.log('[sanctuary] swipe', record);
    return record;
  }

  /* ------------------------------------------------------------- переходы */

  function go(direction, speed) {
    if (state.locked) return;

    const step = direction === 'up' ? 1 : -1;
    const fromIndex = state.index;
    const toIndex = (fromIndex + step + slides.length) % slides.length;
    const from = slides[fromIndex];
    const to = slides[toIndex];

    reportSwipe(direction, speed);

    state.locked = true;
    stage.classList.remove('is-held');
    setActivePlaybackRate(1);
    setHumDepth(false);
    pauseCategory(categories[fromIndex]);

    from.classList.remove('is-active');
    from.classList.add('is-leaving');

    state.index = toIndex;
    state.visits[toIndex] += 1;

    // Первая половина: старый кадр уходит в чёрное.
    window.setTimeout(() => {
      from.classList.remove('is-leaving');
      to.classList.add('is-active');
      resetViewClock();

      const category = categories[toIndex];
      if (category.clips.length) {
        const index = (state.visits[toIndex] - 1) % category.clips.length;
        playClip(category, index);
      }

      // Вторая половина: новый кадр проявляется.
      window.setTimeout(() => {
        state.locked = false;
      }, FADE_MS + 50);
    }, FADE_MS);
  }

  /* ---------------------------------------------------------- удержание */

  function startHold() {
    holdTimer = 0;
    if (!gesture || gesture.moved || gesture.holding) return;

    gesture.holding = true;
    gesture.holdStart = now();

    if (!gesture.holdCounted) {
      gesture.holdCounted = true;
      state.holdsInView += 1;
      state.totalHolds += 1;
    }

    stage.classList.add('is-held');
    setActivePlaybackRate(SLOW_RATE);
    setHumDepth(true);
  }

  function stopHold() {
    if (!gesture || !gesture.holding) return;

    gesture.holding = false;
    state.heldMs += now() - gesture.holdStart;
    stage.classList.remove('is-held');
    setActivePlaybackRate(1);
    setHumDepth(false);
  }

  function abortGesture() {
    window.clearTimeout(holdTimer);
    holdTimer = 0;

    if (gesture) {
      if (gesture.holding) {
        state.heldMs += now() - gesture.holdStart;
        setActivePlaybackRate(1);
        setHumDepth(false);
      }
      gesture = null;
    }

    stage.classList.remove('is-held');
  }

  /* -------------------------------------------------------------- свайпы */

  function swipeThreshold() {
    return Math.max(44, stage.clientHeight * SWIPE_MIN_RATIO);
  }

  function endGesture(event) {
    if (!gesture || event.pointerId !== gesture.id) return;

    window.clearTimeout(holdTimer);
    holdTimer = 0;
    stopHold();

    const g = gesture;
    gesture = null;

    if (state.locked) return;

    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    const distance = Math.abs(dy);
    const elapsed = Math.max(1, now() - g.t0);
    const speed = g.peakSpeed > 0 ? g.peakSpeed : distance / elapsed;

    if (distance < Math.abs(dx)) return;

    const isLongEnough = distance >= swipeThreshold();
    const isFlick = distance >= FLICK_MIN_PX && speed >= FLICK_MIN_SPEED;

    if (isLongEnough || isFlick) {
      go(dy < 0 ? 'up' : 'down', speed);
    }
  }

  stage.addEventListener('pointerdown', (event) => {
    enableAmbience();
    wakePlayback();

    if (state.locked || gesture) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    gesture = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      xPrev: event.clientX,
      yPrev: event.clientY,
      t0: now(),
      tPrev: now(),
      moved: false,
      holding: false,
      holdStart: 0,
      holdCounted: false,
      peakSpeed: 0,
    };

    try {
      stage.setPointerCapture(event.pointerId);
    } catch (_) {
      // Захват недоступен — жест всё равно обработается всплывающими событиями.
    }

    holdTimer = window.setTimeout(startHold, HOLD_MS);
  });

  stage.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;

    const t = now();
    const dt = Math.max(1, t - gesture.tPrev);
    const stepY = Math.abs(event.clientY - gesture.yPrev);
    const distance = Math.hypot(
      event.clientX - gesture.x0,
      event.clientY - gesture.y0
    );

    if (!gesture.moved && distance > 10) {
      gesture.moved = true;
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    }

    if (gesture.holding && distance > 26) {
      stopHold();
    }

    if (stepY > 0) {
      gesture.peakSpeed = Math.max(gesture.peakSpeed, stepY / dt);
    }

    gesture.xPrev = event.clientX;
    gesture.yPrev = event.clientY;
    gesture.tPrev = t;
  });

  stage.addEventListener('pointerup', endGesture);

  stage.addEventListener('pointercancel', (event) => {
    if (gesture && event.pointerId === gesture.id) {
      abortGesture();
    }
  });

  stage.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  window.addEventListener('blur', abortGesture);

  /* ------------------------------- колесо мыши как свайп на десктопе */

  let wheelSum = 0;
  let wheelFirstAt = 0;
  let wheelLastAt = 0;

  stage.addEventListener('wheel', (event) => {
    event.preventDefault();

    if (state.locked || gesture) return;

    const t = now();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1;
    const delta = event.deltaY * unit;

    if (t - wheelLastAt > 180) {
      wheelSum = 0;
      wheelFirstAt = t;
    }
    wheelLastAt = t;
    wheelSum += delta;

    if (Math.abs(wheelSum) >= 40) {
      const direction = wheelSum > 0 ? 'up' : 'down';
      const dt = Math.max(24, t - wheelFirstAt);
      const speed = Math.min(4, Math.abs(wheelSum) / dt);

      wheelSum = 0;
      go(direction, speed);
    }
  }, { passive: false });

  /* ------------------------------------ пауза, когда вкладка скрыта */

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.hiddenAt = now();
      abortGesture();
      pauseCategory(activeCategory());
      if (ambience) ambience.ctx.suspend().catch(() => {});
    } else if (state.hiddenAt !== null) {
      state.viewStart += now() - state.hiddenAt;
      state.hiddenAt = null;

      if (ambience) ambience.ctx.resume().catch(() => {});
      const category = activeCategory();
      if (category.clips.length) playClip(category, category.activeIndex);
      wakePlayback();
    }
  });

  /* ------------------------------------------------------------ инициализация */

  Promise.allSettled(categories.map(loadCategory)).then(() => {
    const total = categories.reduce((sum, category) => sum + category.clips.length, 0);
    console.info('[sanctuary] video feed ready:', {
      clips: total,
      categories: categories.map((category) => `${category.tag}: ${category.clips.length}`),
    });
  });
})();
