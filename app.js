/* Digital Sanctuary — MVP 2: real Coverr footage.
 *
 * Silent vertical feed, five Jungian categories. Each category is filled with
 * one or two free clips from the official Coverr REST API, muted, looping and
 * autoplaying. Swipe up/down (touch, mouse or wheel) crossfades to the next
 * engine-selected category; the fade adapts to pace and is never input-blocking.
 * Holding slows the active clip to 0.5x and deepens a Web Audio hum, started
 * on the first touch. Every swipe prints one behaviour record.
 */
(() => {
  'use strict';

  /* ------------------------------------------------------------- настройки */

  // Медленный fade — 800 мс из style.css; быстрый — 250 мс для импульсивных свайпов.
  const SLOW_FADE_MS = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--fade-duration')
  ) || 800;
  const QUICK_FADE_MS = 250;
  const QUICK_VIEW_MS = 2500;
  const IMPULSIVE_SPEED = 1.0;

  const HOLD_MS = 260;
  const SWIPE_MIN_RATIO = 0.08;
  const FLICK_MIN_PX = 28;
  const FLICK_MIN_SPEED = 0.65;
  const SLOW_RATE = 0.5;
  const API_TIMEOUT_MS = 7000;
  const CLIPS_PER_CATEGORY = 2;
  const RESONANCE_HOLD_MS = 500;
  const FAST_VIEW_MS = 2000;
  const MAX_WEIGHT = 6;

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
      extendedQuery: 'dark shadow fog mist forest night mystery',
      keywords: ['fog', 'mist', 'dark', 'night', 'forest', 'gloomy', 'mysterious', 'haze', 'tree', 'shadow'],
      blocked: ['coffin', 'cemetery', 'halloween', 'zombie', 'skull', 'horror'],
      preferred: ['VC1PStUKzq', 'Jl07Anu9ty'],
    },
    Trickster: {
      query: 'smoke fire dark',
      fallbackQuery: 'fire',
      extendedQuery: 'trickster chaos smoke fire sparks dark',
      keywords: ['smoke', 'fire', 'flame', 'sparks', 'match', 'lighter', 'burning', 'dark', 'night', 'inferno'],
      blocked: ['sausage', 'cooking', 'food', 'barbecue'],
      preferred: ['ZNfyKwAM8L', 'mGv4TVmkZo'],
    },
    Abyss: {
      query: 'underwater dark ocean',
      fallbackQuery: 'underwater',
      extendedQuery: 'abyss deep underwater ocean dark submerged',
      keywords: ['underwater', 'deep', 'ocean', 'sea', 'blue', 'submerged', 'dark', 'wreck', 'jellyfish', 'whale', 'boat'],
      blocked: ['child', 'goldfish'],
      preferred: ['ni2blF5Md9', '8KyLPpPmVA'],
    },
    Calm: {
      query: 'rain window dark',
      fallbackQuery: 'rain window',
      extendedQuery: 'calm rain window night cozy warm',
      keywords: ['rain', 'window', 'raindrops', 'cozy', 'calm', 'peaceful', 'warm', 'evening', 'lamp', 'coffee', 'dark', 'glass'],
      blocked: [],
      preferred: ['aMlApWfzYF', 'oEw7PbASZW'],
    },
    Path: {
      query: 'empty road night',
      fallbackQuery: 'night road',
      extendedQuery: 'path empty road night journey headlights',
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
      extendedQuery: config.extendedQuery || config.fallbackQuery || tag,
      keywords: config.keywords || [],
      blocked: config.blocked || [],
      preferred: config.preferred || [],
      clips: [],
      activeIndex: 0,
      lastPlayed: null,
      freshIndex: null,
      loading: false,
      extendWanted: false,
      extendedLoading: false,
      extendedLoaded: false,
    };
  });

  const engine = {
    phase: 'diagnostic',       // 'diagnostic' | 'flow'
    diagnosticViews: [],       // первые 3 просмотра: Shadow / Calm / Abyss
    averagePaceMs: 0,
    recentViews: [],
    weights: categories.reduce((map, category) => {
      map[category.tag] = 1;
      return map;
    }, {}),
    resonanceTotal: 0,
    fastStreak: 0,
    forced: [],                // экстренный маршрут Trickster -> Calm
    history: [0],
    historyPos: 0,
    swipes: 0,
    sincePath: 0,
    pathEvery: 5,
    lastDecision: 'start',
  };

  function now() {
    return performance.now();
  }

  const state = {
    index: 0,
    viewStart: now(),
    hiddenAt: null,
    holdsInView: 0,
    heldMs: 0,
    longestHoldMs: 0,
    totalHolds: 0,
    visits: slides.map(() => 0),
    loopsInView: 0,
    totalLoops: 0,
    resonanceAwarded: false,
  };
  state.visits[0] = 1;

  let gesture = null;
  let holdTimer = 0;
  let resonanceTimer = 0;
  let ambience = null;
  let ambienceStarting = false;

  function resetViewClock() {
    state.viewStart = now();
    state.holdsInView = 0;
    state.heldMs = 0;
    state.longestHoldMs = 0;
    state.loopsInView = 0;
    state.resonanceAwarded = false;
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

  function categoryByTag(tag) {
    return categories.find((category) => category.tag === tag) || null;
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

  function nextClipIndex(category) {
    if (!category.clips.length) return 0;

    if (category.freshIndex !== null && category.clips[category.freshIndex]) {
      const fresh = category.freshIndex;
      category.freshIndex = null;
      category.lastPlayed = fresh;
      return fresh;
    }

    if (category.lastPlayed === null) {
      category.lastPlayed = 0;
      return 0;
    }

    const next = (category.lastPlayed + 1) % category.clips.length;
    category.lastPlayed = next;
    return next;
  }

  function playCategory(category) {
    if (!category || category.index !== state.index || !category.clips.length) return;
    playClip(category, nextClipIndex(category));
  }

  function attachVideo(category, clip, index) {
    const media = category.el.querySelector('.media');
    if (!media) return null;

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
    return video;
  }

  function mountClips(category) {
    const media = category.el.querySelector('.media');
    if (!media) return;

    media.textContent = '';
    category.clips.forEach((clip, index) => {
      attachVideo(category, clip, index);
    });

    if (category.index === state.index && category.clips.length) {
      playCategory(category);
    }
  }

  function appendClips(category, clips) {
    if (!clips.length) return;

    const media = category.el.querySelector('.media');
    if (!media) return;

    const firstNew = category.clips.length;
    clips.forEach((clip) => {
      const index = category.clips.length;
      category.clips.push(clip);
      attachVideo(category, clip, index);
    });

    category.freshIndex = firstNew;
  }

  async function loadCategory(category) {
    category.loading = true;
    const queries = [category.query];
    if (category.fallbackQuery && category.fallbackQuery !== category.query) {
      queries.push(category.fallbackQuery);
    }

    try {
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
    } finally {
      category.loading = false;
    }

    if (category.extendWanted) {
      category.extendWanted = false;
      expandCategory(category);
    }
  }

  async function expandCategory(category) {
    if (!category || category.extendedLoaded || category.extendedLoading) return;
    if (category.loading) {
      category.extendWanted = true;
      return;
    }

    category.extendedLoading = true;
    try {
      const hits = await searchVideos(category.extendedQuery);
      const existing = new Set(category.clips.map((clip) => clip.id));
      const seen = new Set();
      const fresh = [];

      for (const hit of hits) {
        const clip = normalizeClip(hit, category);
        if (!clip || existing.has(clip.id) || seen.has(clip.id)) continue;
        seen.add(clip.id);
        fresh.push(clip);
      }

      fresh.sort((a, b) => scoreClip(b, category) - scoreClip(a, category));
      const selected = fresh.slice(0, 2);

      if (selected.length) {
        appendClips(category, selected);
        console.info('[sanctuary] resonance expanded', category.tag, selected.map((clip) => clip.title));
      }

      category.extendedLoaded = true;
    } catch (error) {
      console.warn('[sanctuary] extended Coverr query failed:', category.tag, error);
    } finally {
      category.extendedLoading = false;
    }
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

    if (state.loopsInView >= 2) {
      rewardCategory(category, 'loops');
    }
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

  /* -------------------------------------------------- юнгианский движок */

  function rewardCategory(category, reason) {
    if (!category || engine.phase !== 'flow' || state.resonanceAwarded) return;

    state.resonanceAwarded = true;
    const nextWeight = Math.min(MAX_WEIGHT, (engine.weights[category.tag] || 1) + 1);
    engine.weights[category.tag] = nextWeight;
    engine.resonanceTotal += 1;

    console.info('[sanctuary] resonance', {
      category: category.tag,
      reason,
      weight: nextWeight,
    });

    expandCategory(category);
  }

  function isDeepEngagement() {
    if (engine.resonanceTotal >= 2) return true;
    if (engine.averagePaceMs >= 6000 && engine.recentViews.length >= 2) return true;

    const recent = engine.recentViews.slice(-4);
    if (recent.length < 2) return false;

    const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    return average >= 4500;
  }

  function weightedNext(excludeIndex) {
    const pool = categories.filter((category) => category.index !== excludeIndex);
    if (!pool.length) return null;

    const previous = engine.history[engine.historyPos - 1];
    const weights = pool.map((category) => {
      let weight = Math.max(0.1, engine.weights[category.tag] || 1);
      if (category.index === previous) weight *= 0.7;
      return weight;
    });

    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;

    for (let i = 0; i < pool.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return pool[i].index;
    }

    return pool[pool.length - 1].index;
  }

  function registerBehavior(record) {
    const category = categories[state.index];
    if (!category || engine.phase !== 'flow') return;

    if (!state.resonanceAwarded && (state.longestHoldMs >= RESONANCE_HOLD_MS || record.loopCount >= 2)) {
      rewardCategory(
        category,
        state.longestHoldMs >= RESONANCE_HOLD_MS ? 'hold' : 'loops'
      );
    }

    if (record.viewedMs < FAST_VIEW_MS) {
      engine.fastStreak += 1;
      engine.weights[category.tag] = Math.max(0.5, (engine.weights[category.tag] || 1) - 0.25);

      if (!engine.forced.length) {
        if (category.tag === 'Trickster') {
          engine.forced = ['Calm'];
        } else if (category.tag !== 'Calm') {
          engine.forced = ['Trickster', 'Calm'];
        }
      }
    } else {
      engine.fastStreak = 0;
    }
  }

  function selectFlowTarget() {
    const current = categories[state.index];
    engine.swipes += 1;
    engine.sincePath += 1;

    if (current.tag === 'Path') {
      engine.sincePath = 0;
    }

    while (engine.forced.length) {
      const forced = categoryByTag(engine.forced.shift());
      if (forced && forced.index !== current.index) {
        engine.lastDecision = `forced:${forced.tag}`;
        return forced.index;
      }
    }

    if (isDeepEngagement() && engine.sincePath >= engine.pathEvery && current.tag !== 'Path') {
      engine.sincePath = 0;
      engine.pathEvery = 5 + Math.floor(Math.random() * 2);
      engine.lastDecision = 'path:gestalt';
      return categoryByTag('Path').index;
    }

    const target = weightedNext(current.index);
    if (target !== null) {
      engine.lastDecision = `weighted:${categories[target].tag}`;
      if (categories[target].tag === 'Path') engine.sincePath = 0;
    }
    return target;
  }

  function chooseNext(record) {
    if (engine.phase === 'diagnostic') {
      engine.diagnosticViews.push(record.viewedMs);
      engine.recentViews.push(record.viewedMs);
      if (engine.recentViews.length > 6) engine.recentViews.shift();

      if (engine.diagnosticViews.length === 1) {
        engine.lastDecision = 'diagnostic:calm';
        return categoryByTag('Calm').index;
      }

      if (engine.diagnosticViews.length === 2) {
        engine.lastDecision = 'diagnostic:abyss';
        return categoryByTag('Abyss').index;
      }

      engine.averagePaceMs = Math.round(
        engine.diagnosticViews.reduce((sum, value) => sum + value, 0) /
          engine.diagnosticViews.length
      );
      engine.phase = 'flow';
      engine.lastDecision = 'diagnostic:complete';
      registerBehavior(record);
      return selectFlowTarget();
    }

    engine.recentViews.push(record.viewedMs);
    if (engine.recentViews.length > 6) engine.recentViews.shift();
    registerBehavior(record);
    return selectFlowTarget();
  }

  function fadeDurationFor(viewedMs, speed) {
    const impulsive = speed >= IMPULSIVE_SPEED;
    return viewedMs < QUICK_VIEW_MS || impulsive ? QUICK_FADE_MS : SLOW_FADE_MS;
  }

  function navigateTo(targetIndex, direction, fadeMs) {
    if (targetIndex === null || targetIndex === undefined) return;
    if (!slides[targetIndex]) return;

    const fromIndex = state.index;
    const from = slides[fromIndex];
    const to = slides[targetIndex];
    const duration = fadeMs || SLOW_FADE_MS;

    // Меняем длительность до классов: CSS-переход подхватывает новое значение.
    stage.style.setProperty('--fade-duration', `${duration}ms`);

    stage.classList.remove('is-held');
    setActivePlaybackRate(1);
    setHumDepth(false);
    pauseCategory(categories[fromIndex]);

    // Перекрёстное растворение: старый кадр гаснет, новый проявляется сразу.
    // Никаких таймеров и блокировки — следующий свайп может прервать это в любой момент.
    from.classList.remove('is-active');
    to.classList.add('is-active');

    state.index = targetIndex;
    state.visits[targetIndex] += 1;
    resetViewClock();

    if (direction === 'up') {
      engine.history = engine.history.slice(0, engine.historyPos + 1);
      engine.history.push(targetIndex);
      engine.historyPos = engine.history.length - 1;
    }

    // Видео нового кадра запускается немедленно, ещё под растворяющимся затемнением.
    playCategory(categories[targetIndex]);
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
      longestHoldMs: Math.round(state.longestHoldMs),
      totalHoldCount: state.totalHolds,
      phase: engine.phase,
      weight: Math.round((engine.weights[category.tag] || 1) * 100) / 100,
      averagePaceMs: engine.averagePaceMs,
      loggedAt: new Date().toISOString(),
    };

    console.log('[sanctuary] swipe', record);
    return record;
  }

  /* ------------------------------------------------------------- переходы */

  function go(direction, speed) {
    if (direction === 'down') {
      if (engine.phase === 'diagnostic' || engine.historyPos <= 0) return;

      const targetIndex = engine.history[engine.historyPos - 1];
      const record = reportSwipe('down', speed);
      engine.historyPos -= 1;
      navigateTo(targetIndex, 'down', fadeDurationFor(record.viewedMs, speed));
      return;
    }

    const record = reportSwipe('up', speed);
    const targetIndex = chooseNext(record);
    if (targetIndex === null || targetIndex === undefined) return;
    navigateTo(targetIndex, 'up', fadeDurationFor(record.viewedMs, speed));
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
    const duration = now() - gesture.holdStart;
    state.heldMs += duration;
    state.longestHoldMs = Math.max(state.longestHoldMs, duration);
    stage.classList.remove('is-held');
    setActivePlaybackRate(1);
    setHumDepth(false);
  }

  function abortGesture() {
    window.clearTimeout(holdTimer);
    window.clearTimeout(resonanceTimer);
    holdTimer = 0;
    resonanceTimer = 0;

    if (gesture) {
      if (gesture.holding) {
        const duration = now() - gesture.holdStart;
        state.heldMs += duration;
        state.longestHoldMs = Math.max(state.longestHoldMs, duration);
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
    window.clearTimeout(resonanceTimer);
    holdTimer = 0;
    resonanceTimer = 0;
    stopHold();

    const g = gesture;
    gesture = null;

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

    if (gesture) return;
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
    resonanceTimer = window.setTimeout(() => {
      if (gesture && !gesture.moved) {
        rewardCategory(activeCategory(), 'hold');
      }
    }, RESONANCE_HOLD_MS);
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
      window.clearTimeout(resonanceTimer);
      holdTimer = 0;
      resonanceTimer = 0;
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

    if (gesture) return;

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

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('[sanctuary] service worker registration failed', error);
      });
    });
  }
})();
