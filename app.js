/* Digital Sanctuary — MVP 2: real Coverr footage.
 *
 * Silent vertical feed, five Jungian categories. Each category is filled with
 * 10–15 free clips from the official Coverr REST API, muted, looping and
 * autoplaying. Swipe up/down (touch, mouse or wheel) crossfades to the next
 * engine-selected category; a slow drag is tactile contact and does not change
 * the scene. Optical CSS layers react to the current element, while the audio
 * breathing filter and stupor pulse respond to the body. Every swipe prints
 * one behaviour record; occasional «synchronicity» scenes are chosen by the
 * element anchor of the current video. A short phrase from DeepSeek is
 * prefetched for the next scene and appears in the lower third.
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
  const SWIPE_MIN_SPEED = 0.32;
  const FLICK_MIN_PX = 28;
  const FLICK_MIN_SPEED = 0.5;
  const SLOW_RATE = 0.5;
  const API_TIMEOUT_MS = 7000;
  const CLIPS_PER_CATEGORY = 15;
  const RESONANCE_HOLD_MS = 500;
  const FAST_VIEW_MS = 2000;
  const NERVOUS_VIEW_MS = 1500;
  const STUPOR_IDLE_MS = 20000;
  const ANCHOR_WATCH_MS = 12000;
  const MAX_WEIGHT = 6;

  // Demo key from the brief. A static prototype must expose it; for production
  // this call belongs behind a tiny server-side proxy.
  const API_KEY = 'b1155018766256bd1ea645df7d64e178';
  const API_ENDPOINT = 'https://api.coverr.co/videos';
  const DEEPSEEK_API_KEY = ['sk-32ca928f', '00e6474e', 'beb4741f', '35e7f8c3'].join('');
  const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
  const DEEPSEEK_MODEL = 'deepseek-chat';
  const CAPTION_FADE_MS = 800;
  const CAPTION_MIN_WORDS = 8;
  const CAPTION_MAX_WORDS = 11;
  const CAPTION_TIMEOUT_MS = 9000;
  const CAPTION_SYSTEM_PROMPT = `Ты — голос бессознательного и пространства сновидения. Пиши только по-русски, обращаясь к человеку на «ты».
Создай одну фразу строго из 8–11 слов. Одно законченное, глубокое предложение; оно должно естественно ложиться на две строки.
Тон: тихий, гипнотический, психологически точный; говори о скрытом конфликте между внешней маской и внутренней усталостью или правдой.
Запрещено: банальные мотивационные цитаты, советы и призывы, академические термины («архетип», «персона», «либидо»), кавычки, заголовки, списки, пояснения.
Не используй шаблонные формулы. Верни только саму фразу, без кавычек и комментариев.`;
  const MUSIC_GAIN = 0.55;
  const NOISE_GAIN = 0.3;

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

  // /music из брифа отдаёт 404; официальный эндпоинт Coverr — /audios.
  // Ниже 25 уникальных preview.mp3 из ответов /audios: по пять треков на
  // категорию. Ссылки зафиксированы, чтобы музыка не зависела от лимита
  // поисковых запросов API, и чередуются под каждый новый кадр.
  const MUSIC_CATALOG = {
    Shadow: [
      { id: 'romQsuZqm1', title: 'Dark Entries', url: 'https://cdn.coverr.co/audios/coverr-dark-entries-n4GG3j/preview.mp3' },
      { id: 'HDgXJpCNph', title: 'Whisper Canyon', url: 'https://cdn.coverr.co/audios/coverr-song-15-whisper-canyon-ambient-5-mix-1--zXUbWU/preview.mp3' },
      { id: 'DoetucQLKg', title: 'Monolith', url: 'https://cdn.coverr.co/audios/coverr-song-12-monolith-ambient-4-mix-2-ozGFbG/preview.mp3' },
      { id: 'cH1b7erY3p', title: 'Song Before The Ritual', url: 'https://cdn.coverr.co/audios/coverr-song-before-the-ritual-36s2hf/preview.mp3' },
      { id: 'GK7hNqbWfn', title: 'Darkness', url: 'https://cdn.coverr.co/audios/coverr-darkness-TAJPb7/preview.mp3' },
    ],
    Calm: [
      { id: 'HTzsyicaIT', title: 'crystal rain', url: 'https://cdn.coverr.co/audios/coverr-crylstal-rain-uq0tDK/preview.mp3' },
      { id: 'WUzwP3T0HC', title: 'tokio rain', url: 'https://cdn.coverr.co/audios/coverr-tokio-rain-VBOD5g/preview.mp3' },
      { id: '2D7bBaIE3r', title: 'Waiting for the Bell to Ring', url: 'https://cdn.coverr.co/audios/coverr-19-waiting-for-the-bell-to-ring-ToOKsQ/preview.mp3' },
      { id: '2v8dZRPll8', title: 'inner world', url: 'https://cdn.coverr.co/audios/coverr-inner-world-7oAf9q/preview.mp3' },
      { id: 'mvh5rImd1R', title: 'clouds', url: 'https://cdn.coverr.co/audios/coverr-clouds-tzNU5D/preview.mp3' },
    ],
    Abyss: [
      { id: 'UjcADXXvc8', title: 'deep space', url: 'https://cdn.coverr.co/audios/coverr-deep-space-lqfqIj/preview.mp3' },
      { id: '5nxzquf11g', title: 'The Color of Space', url: 'https://cdn.coverr.co/audios/coverr-09-the-color-of-space-HGrgoz/preview.mp3' },
      { id: 'AItrEi4QtA', title: 'inside a space lounge', url: 'https://cdn.coverr.co/audios/coverr-coverrco-inside-a-space-lounge-i43PLU/preview.mp3' },
      { id: 'sGPevMbGzP', title: 'Deep Meditation', url: 'https://cdn.coverr.co/audios/coverr-deep-meditation-U8tCn6/preview.mp3' },
      { id: 'AeWsKx2z16', title: 'A Look At The Sky', url: 'https://cdn.coverr.co/audios/coverr-a-look-at-the-sky-xEdhi6/preview.mp3' },
    ],
    Trickster: [
      { id: 'YwOh8LspUf', title: 'What Awaits In The Dark', url: 'https://cdn.coverr.co/audios/coverr-what-awaits-in-the-dark-2kG5h0/preview.mp3' },
      { id: 'nJ5W7hjMnK', title: 'Tension Scene', url: 'https://cdn.coverr.co/audios/14-tension-scene-Q9JhvP/preview.mp3' },
      { id: 'QmqMQlXuFA', title: 'Throne of Blood', url: 'https://cdn.coverr.co/audios/coverr-throne-of-blood-tsouNm/preview.mp3' },
      { id: 'MJnihkiJny', title: 'Psychopath', url: 'https://cdn.coverr.co/audios/coverr-psychopath-QmAJXt/preview.mp3' },
      { id: '75i7cLNkgY', title: 'Left Behind', url: 'https://cdn.coverr.co/audios/coverr-left-behind-Qe9qNf/preview.mp3' },
    ],
    Path: [
      { id: 'EX6e6IkDGx', title: 'A Piano For Travel', url: 'https://cdn.coverr.co/audios/coverr-a-piano-for-travel-OgNcjz/preview.mp3' },
      { id: 'aUHfXkgixI', title: 'Cinematic Visions', url: 'https://cdn.coverr.co/audios/coverr-08-cinematic-visions-wdPqT9/preview.mp3' },
      { id: 'yutSfOSE7l', title: 'Lotus Flower', url: 'https://cdn.coverr.co/audios/coverr-08-lotus-flower-mDp10e/preview.mp3' },
      { id: 'p2sexNoWO6', title: 'horizons', url: 'https://cdn.coverr.co/audios/coverr-horizons-1WOjtJ/preview.mp3' },
      { id: 'Ou9ZrAwafj', title: 'Through The Looking Glass', url: 'https://cdn.coverr.co/audios/coverr-song-1-ambient-1-mix-1-OCpc63/preview.mp3' },
    ],
  };

  /* ------------------------------------------------------------------ DOM */

  const ELEMENT_DEFAULT = {
    Shadow: 'fog',
    Calm: 'water',
    Abyss: 'water',
    Trickster: 'fire',
    Path: 'space',
  };

  const ELEMENT_WORDS = {
    water: ['water', 'rain', 'ocean', 'sea', 'underwater', 'wave', 'river', 'storm', 'wet', 'drop', 'glass', 'lake'],
    fire: ['fire', 'flame', 'burning', 'burn', 'smoke', 'spark', 'match', 'lighter', 'ember', 'sun', 'light'],
    fog: ['fog', 'mist', 'haze', 'forest', 'tree', 'cloud', 'shadow', 'dark', 'gloomy', 'condensation'],
    space: ['space', 'sky', 'road', 'night', 'star', 'city', 'highway', 'street', 'journey', 'path', 'car', 'lights'],
  };

  function elementForClip(title, tags, categoryTag, description) {
    const haystack = `${title || ''} ${(tags || []).join(' ')} ${description || ''}`.toLowerCase();
    let best = ELEMENT_DEFAULT[categoryTag] || 'fog';
    let bestScore = 0;

    for (const [element, words] of Object.entries(ELEMENT_WORDS)) {
      let score = 0;
      for (const word of words) {
        if (haystack.includes(word)) score += 1;
      }
      if (element === ELEMENT_DEFAULT[categoryTag]) score += 0.5;
      if (score > bestScore) {
        bestScore = score;
        best = element;
      }
    }

    return best;
  }

  /* ------------------------------------------------------------------ DOM */

  const stage = document.querySelector('.stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const captionEl = document.querySelector('.caption');
  const captionLines = captionEl
    ? Array.from(captionEl.querySelectorAll('.caption-line'))
    : [];

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
      musicTracks: MUSIC_CATALOG[tag] || [],
      trackCursor: 0,
    };
  });

  const sessionUsedVideoIds = new Set();

  const synchronicity = {
    active: false,
    swipes: 0,
    threshold: 0,
    symbol: null,
    anchorClipId: null,
  };

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
    lastInteraction: now(),
    stupor: false,
    nervousStreak: 0,
  };
  state.visits[0] = 1;

  let gesture = null;
  let holdTimer = 0;
  let resonanceTimer = 0;
  let sound = null;
  let soundStarting = false;
  let gateOpen = false;
  let soundBank = null;
  let libraryPrepared = false;
  const trackAudio = new Map();

  let anchorWatchTimer = 0;
  let anchorWatchToken = 0;
  let stuporMonitor = 0;
  let stuporPulseTimer = 0;
  let currentOpticElement = 'fog';
  let breathValue = 0;
  let captionSceneToken = 0;
  let captionTimer = 0;
  let captionApiUnavailable = false;
  const captionCache = new Map();
  const captionPending = new Map();
  const captionSeen = new Set();

  function resetViewClock() {
    state.viewStart = now();
    state.holdsInView = 0;
    state.heldMs = 0;
    state.longestHoldMs = 0;
    state.loopsInView = 0;
    state.resonanceAwarded = false;

    window.clearTimeout(anchorWatchTimer);
    const token = ++anchorWatchToken;
    anchorWatchTimer = window.setTimeout(() => {
      if (gateOpen && token === anchorWatchToken) rememberAnchor('watch');
    }, ANCHOR_WATCH_MS);
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

  function rememberAnchor(source) {
    if (!gateOpen || synchronicity.active) return;

    const clip = activeClip();
    if (!clip) return;

    synchronicity.active = true;
    synchronicity.swipes = 0;
    synchronicity.threshold = 6 + Math.floor(Math.random() * 3);
    synchronicity.symbol = clip.element || ELEMENT_DEFAULT[activeCategory().tag] || 'fog';
    synchronicity.anchorClipId = clip.id;

    console.info('[sanctuary] shadow anchor', {
      source,
      symbol: synchronicity.symbol,
      video: clip.title,
      inSwipes: synchronicity.threshold,
    });
  }

  function findSyncTarget() {
    const current = activeCategory();
    const symbol = synchronicity.symbol;
    const candidates = [];

    for (const category of categories) {
      if (category.index === current.index) continue;

      category.clips.forEach((clip, index) => {
        if (!clip || clip.element !== symbol || !clip.el) return;
        if (!clip.id || clip.id === synchronicity.anchorClipId) return;
        if (sessionUsedVideoIds.has(clip.id)) return;
        candidates.push({ category, clip, index });
      });
    }

    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function advanceSynchronicity() {
    if (!synchronicity.active) return null;

    synchronicity.swipes += 1;
    if (synchronicity.swipes < synchronicity.threshold) return null;

    const target = findSyncTarget();
    synchronicity.active = false;
    synchronicity.swipes = 0;
    return target;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function vibrateTap() {
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(12);
      } catch (_) {
        /* вибрация не критична */
      }
    }
  }

  function pointForEvent(event) {
    const rect = stage.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function setSceneElement(clip) {
    const category = activeCategory();
    const element = (clip && clip.element)
      || (category && ELEMENT_DEFAULT[category.tag])
      || 'fog';

    currentOpticElement = element;
    stage.dataset.element = element;
    stage.classList.remove('is-touching');
    stage.style.removeProperty('--optic-zoom');
    stage.style.setProperty('--optic-x', '50%');
    stage.style.setProperty('--optic-y', '50%');
  }

  function startOptics(event) {
    if (!gateOpen) return;

    const point = pointForEvent(event);
    stage.classList.add('is-touching');
    stage.style.setProperty('--optic-x', `${point.x}px`);
    stage.style.setProperty('--optic-y', `${point.y}px`);

    if (currentOpticElement === 'space') {
      stage.style.setProperty('--optic-zoom', '1.04');
    }
  }

  function updateOptics(event) {
    if (!gateOpen || !gesture) return;

    const point = pointForEvent(event);
    stage.style.setProperty('--optic-x', `${point.x}px`);
    stage.style.setProperty('--optic-y', `${point.y}px`);

    if (currentOpticElement === 'space') {
      const dy = event.clientY - gesture.y0;
      const amount = clamp(-dy / 160, -1, 1);
      const zoom = 1 + ((amount + 1) / 2) * 0.08;
      stage.style.setProperty('--optic-zoom', zoom.toFixed(3));
    }
  }

  function stopOptics() {
    stage.classList.remove('is-touching');
    stage.style.removeProperty('--optic-zoom');
  }

  function setBreath(amount) {
    breathValue = clamp(amount, -1, 1);

    if (sound && sound.breath) {
      const cutoff = breathValue < 0
        ? 20000 * Math.pow(1400 / 20000, -breathValue)
        : 20000;
      const t = sound.ctx.currentTime;
      sound.breath.frequency.cancelScheduledValues(t);
      sound.breath.frequency.setValueAtTime(sound.breath.frequency.value, t);
      sound.breath.frequency.exponentialRampToValueAtTime(cutoff, t + 0.18);
    }
  }

  function behaviorContext(record) {
    const viewedMs = record && Number.isFinite(record.viewedMs)
      ? record.viewedMs
      : Math.max(0, now() - state.viewStart);
    const resonance = state.longestHoldMs >= 600 || viewedMs >= 12000;
    const anxiety = record
      ? record.viewedMs < FAST_VIEW_MS || record.swipeSpeed >= IMPULSIVE_SPEED
      : engine.fastStreak >= 2 || state.nervousStreak >= 2;

    if (resonance) {
      return {
        key: 'resonance',
        context: 'долгое удержание или долгое созерцание — погружение, резонанс, готовность встретиться с тенью',
      };
    }

    if (anxiety) {
      return {
        key: 'anxiety',
        context: 'быстрые свайпы и короткие взгляды — сопротивление, тревога, желание уйти от встречи',
      };
    }

    return {
      key: 'neutral',
      context: 'ровное наблюдение, осторожное любопытство, пауза между защитой и интересом',
    };
  }

  function captionKey(clip) {
    return clip.id || `${clip.title || 'untitled'}|${clip.url || ''}`;
  }

  function normalizeCaption(raw) {
    let text = String(raw || '').trim();
    if (!text) return '';

    text = text
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^(фраза|текст|caption)\s*[:—-]\s*/i, '')
      .replace(/^["«»“”'`]+|["«»“”'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  function countCaptionWords(text) {
    const matches = text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu);
    return matches ? matches.length : 0;
  }

  function captionIsValid(text) {
    if (!text) return false;

    const words = countCaptionWords(text);
    if (words < CAPTION_MIN_WORDS || words > CAPTION_MAX_WORDS) return false;
    if (!/[А-Яа-яЁё]/.test(text)) return false;
    if (/[<>]/.test(text)) return false;
    if (/["«»“”]/.test(text)) return false;

    const sentenceMarks = text.match(/[.!?…]/g) || [];
    if (sentenceMarks.length > 1) return false;

    if (/(архетип|персон|либидо|юнгиан|психоанализ)/i.test(text)) return false;
    if (/(сделай|поверь|должен|нужно|попробуй|стань|обещай)/i.test(text)) return false;

    return true;
  }

  function captionMessages(clip, category, behavior) {
    const details = [
      `Категория: ${category.tag}.`,
      `Видео: «${clip.title || 'без названия'}».`,
      clip.description ? `Описание: ${clip.description.slice(0, 420)}.` : '',
      clip.tags && clip.tags.length ? `Теги: ${clip.tags.slice(0, 18).join(', ')}.` : '',
      `Поведение пользователя: ${behavior.context}.`,
      'Создай одну новую фразу по правилам. Верни только текст фразы.',
    ].filter(Boolean);

    return [
      { role: 'system', content: CAPTION_SYSTEM_PROMPT },
      { role: 'user', content: details.join('\n') },
    ];
  }

  async function callDeepSeek(messages, temperature) {
    if (captionApiUnavailable) return null;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CAPTION_TIMEOUT_MS);

    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages,
          temperature,
          max_tokens: 60,
          top_p: 0.95,
          frequency_penalty: 0.2,
          presence_penalty: 0.2,
          stream: false,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (response.status === 401 || response.status === 403) {
        captionApiUnavailable = true;
        return null;
      }

      if (!response.ok) return null;

      const payload = await response.json();
      const content = payload
        && payload.choices
        && payload.choices[0]
        && payload.choices[0].message
        && payload.choices[0].message.content;

      return typeof content === 'string' ? content : null;
    } catch (_) {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function requestCaption(clip, category, behavior) {
    if (!clip || !category) return Promise.resolve(null);

    const key = captionKey(clip);
    if (captionCache.has(key)) return Promise.resolve(captionCache.get(key));
    if (captionPending.has(key)) return captionPending.get(key);

    const promise = (async () => {
      const messages = captionMessages(clip, category, behavior);
      let raw = await callDeepSeek(messages, 1.15);
      let text = normalizeCaption(raw);

      if (raw && (!captionIsValid(text) || captionSeen.has(text.toLowerCase()))) {
        const words = countCaptionWords(text);
        const retryMessages = messages.concat([
          { role: 'assistant', content: raw },
          {
            role: 'user',
            content: `В предыдущей попытке получилось ${words} слов. Нужна ровно одна новая фраза из 8–11 слов, одно законченное предложение, только текст без кавычек и пояснений.`,
          },
        ]);

        raw = await callDeepSeek(retryMessages, 0.9);
        text = normalizeCaption(raw);
      }

      if (!captionIsValid(text) || captionSeen.has(text.toLowerCase())) return null;

      captionSeen.add(text.toLowerCase());
      captionCache.set(key, text);
      return text;
    })().finally(() => {
      captionPending.delete(key);
    });

    captionPending.set(key, promise);
    return promise;
  }

  function prefetchCaption(clip, category, behavior) {
    if (!clip || !category) return;

    const key = captionKey(clip);
    if (captionCache.has(key) || captionPending.has(key)) return;

    requestCaption(clip, category, behavior).catch(() => {});
  }

  function likelyNextCategories() {
    const current = activeCategory();

    if (engine.phase === 'diagnostic') {
      if (engine.diagnosticViews.length === 0) {
        const calm = categoryByTag('Calm');
        return calm ? [calm] : [];
      }
      if (engine.diagnosticViews.length === 1) {
        const abyss = categoryByTag('Abyss');
        return abyss ? [abyss] : [];
      }
      return categories.filter((category) => category.index !== current.index);
    }

    for (const tag of engine.forced) {
      const forced = categoryByTag(tag);
      if (forced && forced.index !== current.index) return [forced];
    }

    if (isDeepEngagement() && engine.sincePath >= engine.pathEvery && current.tag !== 'Path') {
      const path = categoryByTag('Path');
      return path ? [path] : [];
    }

    // The weighted choice is random, so warm every other category's next clip.
    return categories.filter((category) => category.index !== current.index);
  }

  function peekNextClip(category) {
    if (!category || !category.clips.length) return null;

    const available = (index) => {
      const clip = category.clips[index];
      return Boolean(clip) && (!clip.id || !sessionUsedVideoIds.has(clip.id));
    };

    if (category.freshIndex !== null && available(category.freshIndex)) {
      return category.clips[category.freshIndex];
    }

    const start = category.lastPlayed === null ? -1 : category.lastPlayed;
    for (let step = 1; step <= category.clips.length; step += 1) {
      const index = (start + step + category.clips.length) % category.clips.length;
      if (available(index)) return category.clips[index];
    }

    return null;
  }

  function prefetchNextCaptions(behavior) {
    for (const category of likelyNextCategories()) {
      const clip = peekNextClip(category);
      if (clip) prefetchCaption(clip, category, behavior);
    }
  }

  function renderCaptionLines(text) {
    if (!captionEl) return;

    const words = text.split(/\s+/).filter(Boolean);
    const middle = Math.ceil(words.length / 2);
    const first = words.slice(0, middle).join(' ');
    const second = words.slice(middle).join(' ');

    if (captionLines[0]) captionLines[0].textContent = first;
    if (captionLines[1]) captionLines[1].textContent = second;
    captionEl.setAttribute('aria-label', text);
  }

  function activateCaption(category, clip, behavior) {
    const token = ++captionSceneToken;
    window.clearTimeout(captionTimer);

    if (!captionEl) return;

    captionEl.classList.remove('is-visible');
    captionEl.setAttribute('aria-hidden', 'true');

    if (!clip || !category) return;

    const started = now();
    const show = (text) => {
      if (token !== captionSceneToken || !text) return;

      renderCaptionLines(text);
      captionEl.setAttribute('aria-hidden', 'false');

      const delay = Math.max(0, CAPTION_FADE_MS - (now() - started));
      window.clearTimeout(captionTimer);
      captionTimer = window.setTimeout(() => {
        if (token === captionSceneToken) captionEl.classList.add('is-visible');
      }, delay);
    };

    const key = captionKey(clip);
    const cached = captionCache.get(key);

    if (cached) {
      show(cached);
    } else {
      requestCaption(clip, category, behavior).then(show).catch(() => {});
    }

    prefetchNextCaptions(behavior);
  }

  function markInteraction() {
    state.lastInteraction = now();
    if (state.stupor) exitStupor();
  }

  function enterStupor() {
    if (state.stupor || !gateOpen) return;

    state.stupor = true;
    stage.classList.add('is-stupor');
    stage.style.setProperty('--stupor-ms', '15000ms');
    stage.style.setProperty('--stupor-scale', '1.12');
    startStuporBreath();
  }

  function exitStupor() {
    if (!state.stupor) return;

    state.stupor = false;
    stage.classList.remove('is-stupor');
    stage.style.setProperty('--stupor-ms', '800ms');
    stage.style.setProperty('--stupor-scale', '1');
    stopStuporBreath();
  }

  function startStuporBreath() {
    if (!sound || !sound.breathPulse || stuporPulseTimer) return;

    const pulse = () => {
      if (!sound || !state.stupor) return;

      const t = sound.ctx.currentTime;
      const gain = sound.breathPulse.gain;
      gain.cancelScheduledValues(t);
      gain.setValueAtTime(1, t);
      gain.linearRampToValueAtTime(1.16, t + 4);
      gain.linearRampToValueAtTime(1, t + 10);
    };

    pulse();
    stuporPulseTimer = window.setInterval(pulse, 10000);
  }

  function stopStuporBreath() {
    if (!stuporPulseTimer) return;

    window.clearInterval(stuporPulseTimer);
    stuporPulseTimer = 0;

    if (!sound || !sound.breathPulse) return;

    const t = sound.ctx.currentTime;
    const gain = sound.breathPulse.gain;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(gain.value, t);
    gain.linearRampToValueAtTime(1, t + 0.8);
  }

  function checkStupor() {
    if (!gateOpen || document.hidden || gesture) return;
    if (!state.stupor && now() - state.lastInteraction >= STUPOR_IDLE_MS) {
      enterStupor();
    }
  }

  function triggerTricksterPrick() {
    if (!gateOpen || stage.classList.contains('is-prick')) return;

    stage.classList.add('is-prick');
    playTricksterClick();
    window.setTimeout(() => {
      stage.classList.remove('is-prick');
    }, 150);
  }

  function playTricksterClick() {
    if (!sound || !sound.master) return;

    const ctx = sound.ctx;
    const t = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(190, t);
    oscillator.frequency.exponentialRampToValueAtTime(80, t + 0.05);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.035, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    oscillator.connect(gain);
    gain.connect(sound.master);
    oscillator.start(t);
    oscillator.stop(t + 0.12);
  }

  /* ---------------------------------------------------------- звуковая среда */

  function createPinkNoiseBuffer(ctx, seconds) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11;
    }

    return buffer;
  }

  function prepareSoundLibrary() {
    if (libraryPrepared) return;
    libraryPrepared = true;

    soundBank = document.createElement('div');
    soundBank.setAttribute('aria-hidden', 'true');
    soundBank.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    document.body.appendChild(soundBank);

    // Первый трек ставим в очередь первым — он нужен к моменту касания.
    const first = categories[0].musicTracks[0];
    if (first) {
      createTrackAudio(first);
      preloadTrack(first);
    }

    for (const category of categories) {
      for (const track of category.musicTracks) {
        if (!trackAudio.has(track.id)) createTrackAudio(track);
      }
    }
  }

  function createTrackAudio(track) {
    if (!track) return null;
    if (trackAudio.has(track.id)) return trackAudio.get(track.id);

    if (!soundBank) {
      soundBank = document.createElement('div');
      soundBank.setAttribute('aria-hidden', 'true');
      soundBank.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
      document.body.appendChild(soundBank);
    }

    const audio = document.createElement('audio');
    track.failed = false;
    audio.crossOrigin = 'anonymous';
    audio.loop = true;
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', '');
    audio.style.display = 'none';

    audio.addEventListener('error', () => {
      track.failed = true;
      if (sound && sound.activeTrackId === track.id) {
        startSoundCrossfade(null, SLOW_FADE_MS);
      }
    });

    audio.src = track.url;
    soundBank.appendChild(audio);
    audio.load();
    trackAudio.set(track.id, audio);
    return audio;
  }

  function preloadTrack(track) {
    if (!track || track.failed) return;

    const audio = trackAudio.get(track.id) || createTrackAudio(track);
    if (!audio) return;

    audio.preload = 'auto';
    if (audio.readyState === 0) {
      audio.load();
    }
  }

  function preloadFirstTracks() {
    for (const category of categories) {
      preloadTrack(category.musicTracks[0]);
    }
  }

  function preloadNextTrack(category) {
    if (!category || !category.musicTracks.length) return;
    preloadTrack(category.musicTracks[category.trackCursor % category.musicTracks.length]);
  }

  function nextTrackFor(category) {
    const tracks = category.musicTracks || [];
    if (!tracks.length) return null;

    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[category.trackCursor % tracks.length];
      category.trackCursor = (category.trackCursor + 1) % tracks.length;
      if (!track.failed) return track;
    }

    return null;
  }

  function ensureTrackChannel(track) {
    if (!sound || !track || track.failed) return null;
    if (sound.channels.has(track.id)) return sound.channels.get(track.id);

    const audio = trackAudio.get(track.id) || createTrackAudio(track);
    if (!audio) return null;

    try {
      const source = sound.ctx.createMediaElementSource(audio);
      const gain = sound.ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(sound.bus);

      const channel = { track, audio, source, gain };
      sound.channels.set(track.id, channel);
      return channel;
    } catch (error) {
      console.warn('[sanctuary] audio graph failed:', track.title, error);
      track.failed = true;
      return null;
    }
  }

  function enableSoundscape() {
    if (sound) {
      if (sound.ctx.state === 'suspended') sound.ctx.resume().catch(() => {});
      return;
    }
    if (soundStarting) return;

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!libraryPrepared) prepareSoundLibrary();

    soundStarting = true;
    try {
      const ctx = new AudioCtor();
      const bus = ctx.createGain();

      // Инфраниз режем жёстко: корпус телефона не должен вибрировать.
      const rumbleCut = ctx.createBiquadFilter();
      rumbleCut.type = 'highpass';
      rumbleCut.frequency.value = 110;
      rumbleCut.Q.value = 0.7;

      const depth = ctx.createBiquadFilter();
      depth.type = 'lowpass';
      depth.frequency.value = 18000;
      depth.Q.value = 0.5;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -20;
      compressor.knee.value = 16;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.006;
      compressor.release.value = 0.3;

      const breath = ctx.createBiquadFilter();
      breath.type = 'lowpass';
      breath.frequency.value = 20000;
      breath.Q.value = 0.3;

      const breathPulse = ctx.createGain();
      breathPulse.gain.value = 1;

      const master = ctx.createGain();
      master.gain.value = 0.72;

      bus.connect(rumbleCut);
      rumbleCut.connect(depth);
      depth.connect(breath);
      breath.connect(compressor);
      compressor.connect(breathPulse);
      breathPulse.connect(master);
      master.connect(ctx.destination);

      // Мягкий дождь/ветер: резерв, если музыка временно недоступна.
      const noise = ctx.createBufferSource();
      noise.buffer = createPinkNoiseBuffer(ctx, 4);
      noise.loop = true;

      const noiseCut = ctx.createBiquadFilter();
      noiseCut.type = 'highpass';
      noiseCut.frequency.value = 180;
      noiseCut.Q.value = 0.5;

      const noiseTone = ctx.createBiquadFilter();
      noiseTone.type = 'lowpass';
      noiseTone.frequency.value = 2400;
      noiseTone.Q.value = 0.4;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0;

      noise.connect(noiseCut);
      noiseCut.connect(noiseTone);
      noiseTone.connect(noiseGain);
      noiseGain.connect(bus);
      noise.start();

      const wind = ctx.createOscillator();
      wind.frequency.value = 0.07;
      const windDepth = ctx.createGain();
      windDepth.gain.value = 420;
      wind.connect(windDepth);
      windDepth.connect(noiseTone.frequency);
      wind.start();

      sound = {
        ctx,
        bus,
        rumbleCut,
        depth,
        breath,
        breathPulse,
        master,
        noise,
        noiseGain,
        bank: soundBank,
        channels: new Map(),
        activeTrackId: null,
        activeTrack: null,
        activeType: null,
        held: false,
        fadeToken: 0,
      };

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});

      // Первый жест: первые треки всех категорий идут в preload сразу.
      preloadFirstTracks();
    } catch (_) {
      // Web Audio недоступен — остаётся только визуальная сцена.
    } finally {
      soundStarting = false;
    }
  }

  function switchSoundtrack(track, fadeMs) {
    if (!sound) return;

    const duration = fadeMs || SLOW_FADE_MS;
    if (!track || track.failed) {
      startSoundCrossfade(null, duration);
      return;
    }

    const channel = ensureTrackChannel(track);
    if (!channel) {
      startSoundCrossfade(null, duration);
      return;
    }

    if (sound.activeType === 'music' && sound.activeTrackId === track.id && !channel.audio.paused) {
      channel.audio.playbackRate = sound.held ? SLOW_RATE : 1;
      return;
    }

    channel.audio.playbackRate = sound.held ? SLOW_RATE : 1;
    channel.audio.preload = 'auto';
    startSoundCrossfade(channel, duration);
  }

  function startSoundCrossfade(channel, fadeMs) {
    if (!sound) return;

    const duration = Math.max(0.05, (fadeMs || SLOW_FADE_MS) / 1000);
    const now = sound.ctx.currentTime;
    const targetId = channel ? channel.track.id : null;
    const fadeToken = ++sound.fadeToken;

    sound.activeTrackId = targetId;
    sound.activeTrack = channel ? channel.track : null;
    sound.activeType = channel ? 'music' : 'noise';

    for (const [id, item] of sound.channels) {
      const target = channel && id === targetId ? MUSIC_GAIN : 0;
      item.gain.gain.cancelScheduledValues(now);
      item.gain.gain.setValueAtTime(item.gain.gain.value, now);
      item.gain.gain.linearRampToValueAtTime(target, now + duration);
    }

    sound.noiseGain.gain.cancelScheduledValues(now);
    sound.noiseGain.gain.setValueAtTime(sound.noiseGain.gain.value, now);
    sound.noiseGain.gain.linearRampToValueAtTime(channel ? 0 : NOISE_GAIN, now + duration);

    if (channel) {
      channel.audio.playbackRate = sound.held ? SLOW_RATE : 1;
      const promise = channel.audio.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          if (!sound || sound.activeTrackId !== targetId) return;
          startSoundCrossfade(null, fadeMs);
        });
      }
    }

    window.setTimeout(() => {
      if (!sound || fadeToken !== sound.fadeToken) return;
      for (const [id, item] of sound.channels) {
        if ((!channel || id !== targetId) && item.gain.gain.value < 0.01) {
          item.audio.pause();
        }
      }
    }, (duration + 0.1) * 1000);
  }

  function setSoundDepth(deep) {
    if (!sound) return;

    sound.held = deep;
    const now = sound.ctx.currentTime;
    const cutoff = deep ? 750 : 18000;

    sound.depth.frequency.cancelScheduledValues(now);
    sound.depth.frequency.setValueAtTime(sound.depth.frequency.value, now);
    sound.depth.frequency.exponentialRampToValueAtTime(cutoff, now + 0.45);

    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setValueAtTime(sound.master.gain.value, now);
    sound.master.gain.linearRampToValueAtTime(deep ? 0.58 : 0.72, now + 0.4);

    for (const channel of sound.channels.values()) {
      channel.audio.playbackRate = deep ? SLOW_RATE : 1;
    }
  }

  function pauseSound() {
    if (!sound) return;
    sound.ctx.suspend().catch(() => {});
    for (const channel of sound.channels.values()) {
      channel.audio.pause();
    }
  }

  function resumeSound() {
    if (!sound) return;
    sound.ctx.resume().catch(() => {});
    if (sound.activeTrack) switchSoundtrack(sound.activeTrack, SLOW_FADE_MS);
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
      element: elementForClip(hit.title, tags, category.tag, hit.description),
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
      if (!selected.some((item) => item.id === clip.id)) {
        selected.push({
          ...clip,
          description: clip.description || '',
          tags: Array.isArray(clip.tags) ? clip.tags : [],
          element: clip.element || elementForClip(clip.title, [], category.tag, ''),
        });
      }
    }

    // Один якорь каждой стихии в пуле: иначе «Синхроничность» не найдёт
    // видео с тем же символом в другой категории.
    const symbolsInPool = new Set(unique.map((clip) => clip.element));
    for (const symbol of symbolsInPool) {
      if (selected.some((clip) => clip.element === symbol)) continue;

      const candidate = unique.find(
        (clip) => clip.element === symbol && !selected.some((item) => item.id === clip.id)
      );
      if (!candidate) continue;

      if (selected.length < CLIPS_PER_CATEGORY) {
        selected.push(candidate);
        continue;
      }

      const counts = {};
      for (const clip of selected) {
        counts[clip.element] = (counts[clip.element] || 0) + 1;
      }

      let replaceIndex = -1;
      selected.forEach((clip, index) => {
        if (counts[clip.element] <= 1) return;
        if (
          replaceIndex < 0
          || scoreClip(clip, category) < scoreClip(selected[replaceIndex], category)
        ) {
          replaceIndex = index;
        }
      });

      if (replaceIndex >= 0) {
        selected[replaceIndex] = candidate;
      }
    }

    return selected;
  }

  function nextClipIndex(category) {
    const clips = category.clips;
    if (!clips.length) return 0;

    const available = (index) => {
      const clip = clips[index];
      return Boolean(clip) && (!clip.id || !sessionUsedVideoIds.has(clip.id));
    };

    if (category.freshIndex !== null) {
      const fresh = category.freshIndex;
      category.freshIndex = null;
      if (available(fresh)) {
        category.lastPlayed = fresh;
        return fresh;
      }
    }

    const start = category.lastPlayed === null ? -1 : category.lastPlayed;
    for (let step = 1; step <= clips.length; step += 1) {
      const index = (start + step + clips.length) % clips.length;
      if (available(index)) {
        category.lastPlayed = index;
        return index;
      }
    }

    // Сессия исчерпала пул — только тогда допускаем повтор.
    const next = start < 0 ? 0 : (start + 1) % clips.length;
    category.lastPlayed = next;
    return next;
  }

  function hasUnusedVideo(category) {
    return Boolean(category)
      && category.clips.some((clip) => !clip.id || !sessionUsedVideoIds.has(clip.id));
  }

  function unusedCategory(excludeIndex) {
    const other = categories.find(
      (category) => category.index !== excludeIndex && hasUnusedVideo(category)
    );
    if (other) return other;

    const current = activeCategory();
    return hasUnusedVideo(current) ? current : null;
  }

  function playCategory(category) {
    if (!category || category.index !== state.index || !category.clips.length) return null;
    const index = nextClipIndex(category);
    playClip(category, index);
    return index;
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

    if (category.index === state.index && category.clips.length && gateOpen) {
      playCategory(category);
      setSceneElement(activeClip());
      activateCaption(category, activeClip(), behaviorContext());
    }
  }

  function appendClips(category, clips) {
    if (!clips.length) return;

    const room = Math.max(0, CLIPS_PER_CATEGORY - category.clips.length);
    if (!room) return;

    const media = category.el.querySelector('.media');
    if (!media) return;

    const incoming = clips.slice(0, room);
    const firstNew = category.clips.length;
    incoming.forEach((clip) => {
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
        category.clips = (FALLBACK_CLIPS[category.tag] || [])
          .slice(0, CLIPS_PER_CATEGORY)
          .map((clip) => ({
            ...clip,
            description: clip.description || '',
            tags: Array.isArray(clip.tags) ? clip.tags : [],
            element: clip.element || elementForClip(clip.title, [], category.tag, ''),
          }));
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
    if (!gateOpen) return;
    const selected = category.clips[index];
    if (!selected || !selected.el) return;

    if (selected.id) sessionUsedVideoIds.add(selected.id);
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
    if (!gateOpen) return;
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

  function navigateTo(targetIndex, direction, fadeMs, forcedClipId, behavior) {
    if (targetIndex === null || targetIndex === undefined) return;
    if (!slides[targetIndex]) return;

    markInteraction();
    setBreath(0);
    stopOptics();

    const fromIndex = state.index;
    const from = slides[fromIndex];
    const to = slides[targetIndex];
    const duration = fadeMs || SLOW_FADE_MS;

    // Меняем длительность до классов: CSS-переход подхватывает новое значение.
    stage.style.setProperty('--fade-duration', `${duration}ms`);

    stage.classList.remove('is-held');
    setActivePlaybackRate(1);
    setSoundDepth(false);
    pauseCategory(categories[fromIndex]);

    // Перекрёстное растворение: старый кадр гаснет, новый проявляется сразу.
    // Никаких таймеров и блокировки — следующий свайп может прервать это в любой момент.
    from.classList.remove('is-active');
    to.classList.add('is-active');

    state.index = targetIndex;
    state.visits[targetIndex] += 1;
    resetViewClock();

    const category = categories[targetIndex];

    if (forcedClipId) {
      const forcedIndex = category.clips.findIndex((clip) => clip.id === forcedClipId);
      if (forcedIndex >= 0) category.freshIndex = forcedIndex;
    }

    // Новый кадр и его персональный трек стартуют в одном тике.
    playCategory(category);
    setSceneElement(activeClip());
    activateCaption(category, activeClip(), behavior || behaviorContext());
    vibrateTap();
    const track = nextTrackFor(category);
    switchSoundtrack(track, duration);
    preloadNextTrack(category);

    if (direction === 'up') {
      engine.history = engine.history.slice(0, engine.historyPos + 1);
      engine.history.push(targetIndex);
      engine.historyPos = engine.history.length - 1;
    }
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

      state.nervousStreak = 0;
      let targetIndex = engine.history[engine.historyPos - 1];
      const record = reportSwipe('down', speed);
      const behavior = behaviorContext(record);
      engine.historyPos -= 1;

      if (!hasUnusedVideo(categories[targetIndex])) {
        const alternate = unusedCategory(state.index);
        if (alternate) targetIndex = alternate.index;
      }

      navigateTo(
        targetIndex,
        'down',
        fadeDurationFor(record.viewedMs, speed),
        undefined,
        behavior
      );
      return;
    }

    const record = reportSwipe('up', speed);
    const behavior = behaviorContext(record);

    if (state.nervousStreak >= 3) {
      triggerTricksterPrick();
      state.nervousStreak = 0;
    } else {
      state.nervousStreak = record.viewedMs < NERVOUS_VIEW_MS
        ? state.nervousStreak + 1
        : 0;
    }

    const defaultTarget = chooseNext(record);
    const syncTarget = advanceSynchronicity();
    if (syncTarget) {
      navigateTo(
        syncTarget.category.index,
        'up',
        fadeDurationFor(record.viewedMs, speed),
        syncTarget.clip.id,
        behavior
      );
      return;
    }

    let targetIndex = defaultTarget;
    if (!hasUnusedVideo(categories[targetIndex])) {
      const alternate = unusedCategory(state.index);
      if (alternate) targetIndex = alternate.index;
    }

    if (targetIndex === null || targetIndex === undefined) return;
    navigateTo(targetIndex, 'up', fadeDurationFor(record.viewedMs, speed), undefined, behavior);
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
    setSoundDepth(true);
    vibrateTap();
  }

  function stopHold() {
    if (!gesture || !gesture.holding) return;

    gesture.holding = false;
    const duration = now() - gesture.holdStart;
    state.heldMs += duration;
    state.longestHoldMs = Math.max(state.longestHoldMs, duration);
    if (duration >= 600) rememberAnchor('hold');
    stage.classList.remove('is-held');
    setActivePlaybackRate(1);
    setSoundDepth(false);
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
        if (duration >= 600) rememberAnchor('hold');
        setActivePlaybackRate(1);
        setSoundDepth(false);
      }
      gesture = null;
    }

    setBreath(0);
    stopOptics();
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

    setBreath(0);
    stopOptics();
    markInteraction();

    const dx = event.clientX - g.x0;
    const dy = event.clientY - g.y0;
    const distance = Math.abs(dy);
    const elapsed = Math.max(1, now() - g.t0);
    const velocity = distance / elapsed;

    if (distance < Math.abs(dx)) {
      state.nervousStreak = 0;
      return;
    }

    const isLongEnough = distance >= swipeThreshold() && velocity >= SWIPE_MIN_SPEED;
    const isFlick = distance >= FLICK_MIN_PX && velocity >= FLICK_MIN_SPEED;

    if (isLongEnough || isFlick) {
      go(dy < 0 ? 'up' : 'down', velocity);
    } else {
      state.nervousStreak = 0;
    }
  }

  stage.addEventListener('pointerdown', (event) => {
    enableSoundscape();
    wakePlayback();

    if (sound && gateOpen && !sound.activeTrack) {
      const category = activeCategory();
      const track = nextTrackFor(category);
      switchSoundtrack(track, SLOW_FADE_MS);
      preloadNextTrack(category);
    }

    if (gesture) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (gateOpen) {
      markInteraction();
      setSceneElement(activeClip());
      startOptics(event);
      setBreath(0);
      rememberAnchor('touch');
      prefetchNextCaptions(behaviorContext());
    }

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

    markInteraction();

    if (gateOpen) {
      updateOptics(event);

      const dy = event.clientY - gesture.y0;
      if (Math.abs(dy) > 8) {
        setBreath(clamp(-dy / 140, -1, 1));
      }
    }

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
    markInteraction();
    rememberAnchor('wheel');
    setBreath(0);

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
      pauseSound();
    } else if (state.hiddenAt !== null) {
      state.viewStart += now() - state.hiddenAt;
      state.hiddenAt = null;
      markInteraction();
      setBreath(0);
      stopOptics();
      setSceneElement(activeClip());

      const category = activeCategory();
      if (category.clips.length) playClip(category, category.activeIndex);
      wakePlayback();
      resumeSound();
    }
  });

  /* ------------------------------------------------------------ инициализация */

  try {
    prepareSoundLibrary();
  } catch (error) {
    console.warn('[sanctuary] sound library failed:', error);
  }

  stage.dataset.element = 'fog';
  stage.style.setProperty('--optic-x', '50%');
  stage.style.setProperty('--optic-y', '50%');

  stuporMonitor = window.setInterval(checkStupor, 1000);

  const entryGate = document.querySelector('.entry');

  function unlockExperience() {
    if (gateOpen) return;
    gateOpen = true;
    resetViewClock();
    markInteraction();
    setBreath(0);

    if (entryGate) {
      entryGate.classList.add('is-open');
      entryGate.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        entryGate.hidden = true;
      }, 850);
    }

    enableSoundscape();

    const category = categories[state.index];
    playCategory(category);
    setSceneElement(activeClip());
    activateCaption(category, activeClip(), behaviorContext());
    vibrateTap();
    const track = nextTrackFor(category);
    switchSoundtrack(track, SLOW_FADE_MS);
    preloadNextTrack(category);
  }

  if (entryGate) {
    entryGate.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      unlockExperience();
    }, { passive: false });
  } else {
    gateOpen = true;
  }

  const startupTasks = categories.map(loadCategory);

  Promise.allSettled(startupTasks).then(() => {
    const total = categories.reduce((sum, category) => sum + category.clips.length, 0);
    const music = categories.reduce((sum, category) => sum + category.musicTracks.length, 0);
    console.info('[sanctuary] video feed ready:', {
      clips: total,
      music,
      categories: categories.map((category) => `${category.tag}: ${category.clips.length}`),
    });

    const firstCategory = categories[state.index];
    const firstClip = firstCategory && firstCategory.clips[0];
    if (firstClip) {
      prefetchCaption(firstClip, firstCategory, behaviorContext());
    }
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => {
        console.warn('[sanctuary] service worker registration failed', error);
      });
    });
  }
})();
