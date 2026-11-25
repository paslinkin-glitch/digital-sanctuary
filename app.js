
(() => {
  'use strict';
  if (window.SANCTUARY_MAINTENANCE) {
    document.documentElement.dataset.maintenance = 'true';
    const screen = document.getElementById('maintenance-screen');
    if (screen) screen.hidden = false;
    return;
  }
  const SLOW_FADE_MS = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--fade-duration')
  ) || 800;
  const QUICK_FADE_MS = 250;
  const QUICK_VIEW_MS = 2500;
  const IMPULSIVE_SPEED = 1.0;
  const HOLD_MS = 260;
  const SWIPE_MIN_RATIO = 0.08;
  const SWIPE_MIN_PX = 30;
  const SWIPE_MIN_SPEED = 0.32;
  const FLICK_MIN_PX = 28;
  const FLICK_MIN_SPEED = 0.5;
  const SLOW_RATE = 0.45;
  const API_TIMEOUT_MS = 1500;
  const CLIPS_PER_CATEGORY = 65;
  const RESONANCE_HOLD_MS = 500;
  const FAST_VIEW_MS = 2000;
  const NERVOUS_VIEW_MS = 1500;
  const STUPOR_IDLE_MS = 20000;
  const ANCHOR_WATCH_MS = 12000;
  const MAX_WEIGHT = 6;
  const CYCLE_LENGTH = 15;
  const SESSION_LENGTH = 30;
  const CYCLE_STAGES = [
    { id: 1, count: 5 },
    { id: 2, count: 4 },
    { id: 3, count: 3 },
    { id: 4, count: 3 },
  ];
  const SESSION_FINALE_DELAY_MS = 3400;
  const SESSION_LOCK_MS = 2 * 60 * 60 * 1000;
  const SESSION_LOCK_KEY = 'sanctuary-unlock-at';
  const BLOCKED_VIDEO_IDS = new Set(['vecteezy-23002431', 'vecteezy-28326594']);
  const HAPTIC_COOLDOWN_MS = 180;
  const SWIPE_HAPTIC_COOLDOWN_MS = 600;
  const HOLD_HEARTBEAT_MS = 1800;
  const HAPTIC_PATTERNS = {
    fire: { frame: [32, 45, 48], hold: [42, 85, 58], interval: 1400, whisper: [12, 70, 18], anchor: [28, 90, 12, 90, 34] },
    water: { frame: [20, 55, 36, 70, 54], hold: [52, 160, 72], interval: 2200, whisper: [8, 55, 14], anchor: [20, 120, 10, 120, 26] },
    fog: { frame: [46, 110, 28], hold: [58, 130, 34], interval: 2000, whisper: [10, 85, 12], anchor: [18, 110, 14, 110, 30] },
    space: { frame: [34, 65, 34], hold: [44, 180, 44], interval: 2400, whisper: [6, 95, 10], anchor: [24, 150, 18, 150, 40] },
  };
  const PORTRAIT_TIMEOUT_MS = 1500;
  const DEEPSEEK_PROXY_ENDPOINT = '/api/deepseek';
  const CAPTION_START_DELAY_MS = 1200;
  const CAPTION_MIN_WORDS = 4;
  const CAPTION_MAX_WORDS = 6;
  const CAPTION_MAX_RATIO = 0.30;
  const EARLY_SWIPE_RATIO = 0.55;
  const CAPTION_LINGER_MS = 3500;
  const CAPTION_HOLD_REVEAL_MS = 750;
  const CAPTION_YOU_LIMIT = 1;
  const CAPTION_TIMEOUT_MS = 1500;
  const CAPTION_SYSTEM_PROMPT_RU = `Ты — тихий голос сна, который звучит рядом с изображением. Пиши только по-русски.
Верни одну короткую фразу строго из 4–6 слов, 1–2 короткие строки. Без поэтических загадок, терминов, оценок, советов и латиницы.
Говори образами и присутствием: дождь, тень, вода, свет, дыхание, дорога. Не называй поведение и не объясняй человеку, что он делает.
Не морализируй, не утешай нарочито, не задавай вопросов. Верни только саму фразу.`;
  const CAPTION_SYSTEM_PROMPT_EN = `You are a quiet voice of the dream, speaking beside the image. Write only in natural English.
Return one short line strictly 4–6 words, 1–2 short lines. No riddles, jargon, judgments, advice, or Latin padding.
Speak through images and presence: rain, shadow, water, light, breath, road. Do not name behavior or explain what the person is doing.
Do not moralize, over-comfort, or ask questions. Return only the line.`;
  const MUSIC_GAIN = 0.36;
  const NOISE_GAIN = 0.075;
  const LANG_STORAGE_KEY = 'sanctuary-lang';
  const I18N = {
    ru: {
      docTitle: 'Quiet Space — когда мысли не останавливаются',
      entryAria: 'Вход в убежище',
      entryKicker: 'ТИХОЕ ПРОСТРАНСТВО',
      guideSwipe: 'Потяни вверх, чтобы войти',
      entryTitle: 'Когда мысли<br>не останавливаются',
      entrySub: 'Перед сном, после тяжёлого дня<br>или между созвонами',
      installApp: 'Установить приложение на экран',
      installHint: 'Нажмите «Поделиться» → «На экран Домой»',
      installedTitle: 'Убежище установлено',
      installedSub: 'Закройте браузер и откройте иконку с экрана телефона',
      inSilenceNow: 'СЕЙЧАС В ТИШИНЕ: {n}',
      installManual: 'Меню браузера ⋮ → Установить приложение / На экран Домой',
      finaleGift: 'Поделиться',
      artNote: 'Уникальная картина этой сессии',
      copied: 'Скопировано',
      doorNote: 'Дверь закрывается на два часа, чтобы тишина улеглась',
      scenarioHold: 'Ты замирал там, где взгляд обычно скользит мимо. Пространство запомнило этот отклик.',
      scenarioFast: 'Ты шёл сквозь кадры быстрее, чем успевал выдохнуть. Пространство запомнило этот отклик.',
      scenarioSteady: 'Ты прошёл этот круг ровно, не торопя ни один кадр. Пространство запомнило этот отклик.',
      cycle1: 'Первый круг завершён. Теперь сон опускается глубже',
      cycleKicker: 'КРУГ I // ПРОЙДЕН',
      cycle2: 'Второй круг пройден. Тишина остаётся рядом.',
      cycle3: 'Круг сна завершён. Дыхание продолжается.',
      lockEntryKicker: 'ДВЕРЬ ЗАКРЫТА',
      lockEntryHint: 'Тишина ещё длится',
      notificationBody: 'Продолжение открыто. Вернись, чтобы узнать, что дальше.',
      notify: 'Уведомить через 2 часа',
      notifySet: 'Уведомление поставлено',
      notifyOff: 'Уведомления отключены',
      notifyUnavailable: 'Уведомления недоступны',
      saveFrame: 'Сохранить образ сна',
      giftKicker: 'ТЕБЕ ПЕРЕДАЛИ 3 МИНУТЫ ТИШИНЫ',
      giftTitle: 'Просто побудь здесь<br>без слов',
      giftSub: 'Ничего не нужно делать — просто смотри.',
      giftShareText: 'Тебе передали 3 минуты тишины. Просто смотри.',
      giftShareTitle: 'Тишина для тебя',
    },
    en: {
      docTitle: 'Quiet Space — when thoughts won’t stop',
      entryAria: 'Entrance to the sanctuary',
      entryKicker: 'A QUIET SPACE',
      guideSwipe: 'Swipe up to enter',
      entryTitle: 'When thoughts<br>won’t stop',
      entrySub: 'Before sleep, after a hard day,<br>or between calls',
      installApp: 'Add the app to your screen',
      installHint: 'Tap Share → Add to Home Screen',
      installedTitle: 'Sanctuary installed',
      installedSub: 'Close the browser and open it from your home screen',
      inSilenceNow: 'IN SILENCE NOW: {n}',
      installManual: 'Browser menu ⋮ → Install app / Add to Home Screen',
      finaleGift: 'Share',
      artNote: 'A unique painting from this session',
      copied: 'Copied',
      doorNote: 'The door closes for two hours so the silence can settle',
      scenarioHold: 'You lingered where the gaze usually slips past. The space remembered that response.',
      scenarioFast: 'You moved through the frames faster than you could exhale. The space remembered that response.',
      scenarioSteady: 'You passed this circle evenly, hurrying no frame. The space remembered that response.',
      cycle1: 'First cycle complete. The dream now descends deeper',
      cycleKicker: 'CYCLE I // COMPLETE',
      cycle2: 'Second cycle passed. Silence remains beside you.',
      cycle3: 'Dream cycle complete. Breathing continues.',
      lockEntryKicker: 'THE DOOR IS CLOSED',
      lockEntryHint: 'The silence is still here',
      notificationBody: 'The next chapter is open. Come back and see what it holds.',
      notify: 'Notify me in 2 hours',
      notifySet: 'Notification set',
      notifyOff: 'Notifications off',
      notifyUnavailable: 'Notifications unavailable',
      saveFrame: 'Save dream frame',
      giftKicker: 'SOMEONE SENT YOU 3 MINUTES OF SILENCE',
      giftTitle: 'Just stay here<br>without words',
      giftSub: 'Nothing to do — just watch.',
      giftShareText: 'Someone sent you 3 minutes of silence. Just watch.',
      giftShareTitle: 'Silence for you',
    },
  };
  const CAPTION_FALLBACK_POOL = {
    Shadow: [
      'Тень дышит рядом с тобой',
      'Свет уходит в глубину',
      'Здесь темно и спокойно',
      'Отражение ждёт у окна',
      'Туман держит твою тень',
      'Ночь не требует ответа',
    ],
    Trickster: [
      'Огонь помнит твой ритм',
      'Волна уносит лишнее',
      'Дым рисует новый путь',
      'Глубина дышит очень медленно',
      'Искра живёт одно мгновение',
      'Вода хранит твой шёпот',
    ],
    Abyss: [
      'Бездна не зовёт по имени',
      'Тишина здесь глубже слов',
      'Мрак мягко держит тебя',
      'В глубине нет спешки',
      'Пустота становится тихим пространством',
      'Ты слышишь только дыхание',
    ],
    Calm: [
      'Листья шепчут о покое',
      'Озеро хранит твоё дыхание',
      'Рассвет приходит без слов',
      'Ветер стихает у воды',
      'Свет ложится на траву',
      'Мягкий дождь остаётся рядом',
    ],
    Path: [
      'Дорога ведёт к свету',
      'Горизонт открыт перед тобой',
      'Шаги звучат всё тише',
      'Птицы летят над водой',
      'Утро ждёт впереди',
      'Путь дышит вместе с тобой',
    ],
  };
  const CAPTION_FALLBACK_POOL_EN = {
    Shadow: ['Shadow breathes beside you', 'Light goes into depth', 'Darkness stays quietly here', 'A reflection waits by the window', 'Fog holds your shadow', 'Night asks for nothing'],
    Trickster: ['Fire remembers your rhythm', 'The wave carries away noise', 'Smoke draws another path', 'The deep breathes very slowly', 'A spark lives one moment', 'Water keeps your whisper'],
    Abyss: ['The abyss does not call', 'Silence here is deeper', 'Darkness holds you softly', 'The deep has no hurry', 'Emptiness becomes quiet space', 'You hear only breathing'],
    Calm: ['Leaves whisper of peace', 'The lake holds your breath', 'Dawn arrives without words', 'Wind softens by water', 'Light rests on grass', 'Soft rain stays beside you'],
    Path: ['The road leads to light', 'The horizon opens before you', 'Footsteps grow quieter now', 'Birds fly above water', 'Morning waits ahead', 'The path breathes with you'],
  };
  let fallbackCaptionUsed = new Set();
  function pickFallbackCaption(categoryTag) {
    const tag = categoryTag || 'Shadow';
    const pool = (currentLang === 'en' ? CAPTION_FALLBACK_POOL_EN : CAPTION_FALLBACK_POOL)[tag]
      || CAPTION_FALLBACK_POOL.Shadow;
    const fresh = pool.find((line) => !fallbackCaptionUsed.has(line));
    if (fresh) {
      fallbackCaptionUsed.add(fresh);
      return fresh;
    }
    fallbackCaptionUsed = new Set();
    const fallback = pool[0] || '';
    if (fallback) fallbackCaptionUsed.add(fallback);
    return fallback;
  }
  function detectLanguage() {
    try {
      const stored = localStorage.getItem(LANG_STORAGE_KEY);
      if (stored === 'ru' || stored === 'en') return stored;
    } catch (_) {
    }
    const language = String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase();
    return language.startsWith('ru') ? 'ru' : 'en';
  }
  function detectScreenTier() {
    const nav = navigator || {};
    const memory = Number(nav['dev' + 'iceMemory'] || 8);
    const cores = Number(nav.hardwareConcurrency || 8);
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection || null;
    const network = connection && connection.effectiveType ? connection.effectiveType : '';
    const saveData = Boolean(connection && connection.saveData);
    if (saveData || memory <= 4 || cores <= 4 || network === 'slow-2g' || network === '2g' || network === '3g') {
      return 'low';
    }
    if (memory >= 8 && cores >= 8) return 'high';
    return 'mid';
  }
  const SCREEN_TIER = detectScreenTier();
  const GIFT_MODE = new URLSearchParams(location.search).get('gift') === '1';
  const APP_ENTRY = new URLSearchParams(location.search).get('app') === '1';
  const COMPLETED_KEY = 'sanctuary-session-completed';
  const trackedMilestones = new Set();
  const holdGestureFrames = new Set();
  document.documentElement.dataset.tier = SCREEN_TIER;
  function timeOfDayFor(hour) {
    if (hour >= 23 || hour < 5) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 18) return 'day';
    return 'evening';
  }
  let envContext = {
    timeOfDay: timeOfDayFor(new Date().getHours()),
    weatherType: 'clear',
  };
  function applyNightPupil() {
    const hour = new Date().getHours();
    document.documentElement.dataset.nightPupil = (hour >= 22 || hour < 6) ? 'true' : 'false';
  }
  async function loadEnvironment() {
    applyNightPupil();
    if ('AmbientLightSensor' in window) {
      try {
        const sensor = new window.AmbientLightSensor({ frequency: 1 });
        sensor.addEventListener('reading', () => {
          if (sensor.illuminance !== null && sensor.illuminance < 18) {
            document.documentElement.dataset.nightPupil = 'true';
          }
        });
        sensor.start();
      } catch (_) {
      }
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1500);
    try {
      const geoResponse = await fetch('https://get.geojs.io/v1/ip/geo.json', {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!geoResponse.ok) return;
      const geo = await geoResponse.json();
      const lat = Number(geo.latitude);
      const lon = Number(geo.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code`,
        { signal: controller.signal, cache: 'no-store' }
      );
      if (!weatherResponse.ok) return;
      const weather = await weatherResponse.json();
      const code = Number(weather.current && weather.current.weather_code);
      let type = 'clear';
      if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) type = 'rain';
      else if ((code >= 71 && code <= 77) || code === 85 || code === 86) type = 'snow';
      else if (code === 45 || code === 48) type = 'fog';
      envContext = { ...envContext, weatherType: type };
    } catch (_) {
    } finally {
      window.clearTimeout(timer);
      setElementalNoise(currentOpticElement);
    }
  }
  function environmentScoreFor(title, stage) {
    const text = String(title || '').toLowerCase();
    let score = 0;
    if (envContext.timeOfDay === 'night' && /night|dark|moon|shadow|dusk/.test(text)) score += 5;
    if (envContext.timeOfDay === 'morning' && /morning|fog|mist|dawn|sunrise/.test(text)) score += 5;
    if (envContext.timeOfDay === 'evening' && /sunset|evening|dusk|cloud/.test(text)) score += 4;
    if (envContext.timeOfDay === 'day' && /sun|sky|cloud|light/.test(text)) score += 3;
    if (envContext.weatherType === 'rain' && /rain|storm|window|drop/.test(text)) score += 6;
    if (envContext.weatherType === 'fog' && /fog|mist|forest|cloud/.test(text)) score += 6;
    if (envContext.weatherType === 'snow' && /snow|winter|ice/.test(text)) score += 6;
    if (stage === 'shadow') score += 1;
    return score;
  }
  let currentLang = detectLanguage();
  function tr(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.ru[key] || key;
  }
  function trackEvent(eventName, props = {}) {
    try {
      if (typeof window.trackSanctuaryEvent === 'function') {
        window.trackSanctuaryEvent(eventName, props);
      } else if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(eventName, props);
      }
    } catch (_) {
    }
  }
  const FALLBACK_CLIPS = {
    Shadow: [],
    Trickster: [],
    Abyss: [],
    Calm: [],
    Path: [],
  };
  const STAGES = [
    {
      id: 1,
      name: 'I',
      archetype: 'I',
      categories: ['Shadow'],
      tone: 'quiet tension',
      tags: ['silhouette shadow', 'dark corridor', 'smoke dark', 'night window rain', 'alone dark'],
    },
    {
      id: 2,
      name: 'II',
      archetype: 'II',
      categories: ['Trickster', 'Abyss'],
      tone: 'fracture and movement',
      tags: ['crowd blur night', 'reflection glass dark', 'deep underwater dark', 'black waves ocean', 'fire sparks dark'],
      shadowTags: ['crowd blur night', 'reflection glass dark', 'fire sparks dark'],
      abyssTags: ['deep underwater dark', 'black waves ocean'],
    },
    {
      id: 3,
      name: 'III',
      archetype: 'III',
      categories: ['Calm'],
      tone: 'slowness and breath',
      tags: ['dust light beam', 'candle flame dark', 'fog forest dark', 'moonlight water', 'slow clouds night'],
    },
    {
      id: 4,
      name: 'IV',
      archetype: 'IV',
      categories: ['Path'],
      tone: 'light and movement',
      tags: ['tunnel light dark', 'train tracks night', 'birds sky dusk', 'empty highway night', 'sunrise fog'],
    },
  ];
  const STAGE_BY_CATEGORY = {
    Shadow: 1,
    Trickster: 2,
    Abyss: 2,
    Calm: 3,
    Path: 4,
  };
  function shuffleArray(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function randomFrom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }
  const stagePlan = STAGES.map((stage) => {
    if (stage.id === 2) {
      return {
        ...stage,
        selected: [randomFrom(stage.shadowTags), randomFrom(stage.abyssTags)],
      };
    }
    return {
      ...stage,
      selected: shuffleArray(stage.tags).slice(0, 2),
    };
  });
    const MUSIC_CATALOG = {
    Shadow: [
      { id: 'HDgXJpCNph', title: 'Whisper Canyon', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/whisper-canyon-HDgXJpCNph.mp3' },
      { id: 'DoetucQLKg', title: 'Monolith', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/monolith-DoetucQLKg.mp3' },
      { id: '2v8dZRPll8', title: 'inner world', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/inner-world-2v8dZRPll8.mp3' },
      { id: 'mvh5rImd1R', title: 'clouds', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/clouds-mvh5rImd1R.mp3' },
      { id: 'ash-garden', title: 'Ash Garden', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/ash-garden.mp3' },
    ],
    Calm: [
      { id: 'HTzsyicaIT', title: 'crystal rain', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/crystal-rain-HTzsyicaIT.mp3' },
      { id: 'WUzwP3T0HC', title: 'tokio rain', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/tokio-rain-WUzwP3T0HC.mp3' },
      { id: 'still-water', title: 'Still Water', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/still-water.mp3' },
      { id: 'distant-rain', title: 'Distant Rain', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/distant-rain.mp3' },
      { id: 'deep-green', title: 'Deep Green', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/deep-green.mp3' },
    ],
    Abyss: [
      { id: '5nxzquf11g', title: 'The Color of Space', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/the-color-of-space-5nxzquf11g.mp3' },
      { id: 'AeWsKx2z16', title: 'A Look At The Sky', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/a-look-at-the-sky-AeWsKx2z16.mp3' },
      { id: 'sGPevMbGzP', title: 'Deep Meditation', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/deep-meditation-sGPevMbGzP.mp3' },
      { id: 'night-current', title: 'Night Current', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/night-current.mp3' },
      { id: 'long-exposure', title: 'Long Exposure', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/long-exposure.mp3' },
    ],
    Trickster: [
      { id: 'EX6e6IkDGx', title: 'A Piano For Travel', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/a-piano-for-travel-EX6e6IkDGx.mp3' },
      { id: 'aUHfXkgixI', title: 'Cinematic Visions', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/cinematic-visions-aUHfXkgixI.mp3' },
      { id: 'yutSfOSE7l', title: 'Lotus Flower', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/lotus-flower-yutSfOSE7l.mp3' },
      { id: 'p2sexNoWO6', title: 'horizons', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/horizons-p2sexNoWO6.mp3' },
      { id: 'ember-breath', title: 'Ember Breath', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/ember-breath.mp3' },
    ],
    Path: [
      { id: 'Ou9ZrAwafj', title: 'Through The Looking Glass', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/through-the-looking-glass-Ou9ZrAwafj.mp3' },
      { id: 'pale-horizon', title: 'Pale Horizon', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/pale-horizon.mp3' },
      { id: 'low-tide', title: 'Low Tide', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/low-tide.mp3' },
      { id: 'quiet-ember', title: 'Quiet Ember', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/quiet-ember.mp3' },
      { id: 'open-sky', title: 'Open Sky', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/open-sky.mp3' },
    ],
  };
  const LIVE_AUDIO_TRACKS = [{"id":"city-01-night-current","category":"city","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/city-01-night-current.mp3"},{"id":"city-02-monolith","category":"city","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/city-02-monolith.mp3"},{"id":"city-03-night-lights","category":"city","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/city-03-night-lights.mp3"},{"id":"city-04-deep-city","category":"city","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/city-04-deep-city.mp3"},{"id":"fire-01-ember-breath","category":"fire","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fire-01-ember-breath.mp3"},{"id":"fire-02-quiet-ember","category":"fire","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fire-02-quiet-ember.mp3"},{"id":"fire-03-candle-glow","category":"fire","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fire-03-candle-glow.mp3"},{"id":"fog-01-clouds","category":"fog","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fog-01-clouds.mp3"},{"id":"fog-02-open-sky","category":"fog","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fog-02-open-sky.mp3"},{"id":"fog-03-pale-horizon","category":"fog","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fog-03-pale-horizon.mp3"},{"id":"fog-04-long-exposure","category":"fog","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fog-04-long-exposure.mp3"},{"id":"fog-05-look-at-sky","category":"fog","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/fog-05-look-at-sky.mp3"},{"id":"people-01-inner-world","category":"people","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/people-01-inner-world.mp3"},{"id":"people-02-looking-glass","category":"people","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/people-02-looking-glass.mp3"},{"id":"people-03-distant-steps","category":"people","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/people-03-distant-steps.mp3"},{"id":"rain-01-crystal-rain","category":"rain","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/rain-01-crystal-rain.mp3"},{"id":"rain-02-tokio-rain","category":"rain","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/rain-02-tokio-rain.mp3"},{"id":"rain-03-distant-rain","category":"rain","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/rain-03-distant-rain.mp3"},{"id":"rain-04-night-window","category":"rain","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/rain-04-night-window.mp3"},{"id":"road-01-cinematic-visions","category":"road","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/road-01-cinematic-visions.mp3"},{"id":"road-02-piano-travel","category":"road","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/road-02-piano-travel.mp3"},{"id":"road-03-wet-asphalt","category":"road","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/road-03-wet-asphalt.mp3"},{"id":"road-04-tunnel-road","category":"road","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/road-04-tunnel-road.mp3"},{"id":"space-01-color-of-space","category":"space","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/space-01-color-of-space.mp3"},{"id":"space-02-deep-meditation","category":"space","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/space-02-deep-meditation.mp3"},{"id":"space-03-horizons","category":"space","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/space-03-horizons.mp3"},{"id":"water-01-still-water","category":"water","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/water-01-still-water.mp3"},{"id":"water-02-low-tide","category":"water","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/water-02-low-tide.mp3"},{"id":"water-03-whisper-canyon","category":"water","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/water-03-whisper-canyon.mp3"},{"id":"water-04-lotus-flower","category":"water","url":"https://s3.twcstorage.ru/digital-sanctuary/audio/water-04-lotus-flower.mp3"}];
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
  const ALL_MUSIC_TRACKS = Object.values(MUSIC_CATALOG).flat();
  const stage = document.querySelector('.stage');
  const cycleWhisperEl = document.getElementById('cycle-whisper');
  const cycleWhisperKickerEl = document.getElementById('cycle-whisper-kicker');
  const cycleWhisperTextEl = document.getElementById('cycle-whisper-text');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const captionEl = document.querySelector('.caption');
  const captionLines = captionEl
    ? Array.from(captionEl.querySelectorAll('.caption-line'))
    : [];
  if (!stage || !slides.length || slides.some((slide) => !slide.querySelector('.media'))) {
    console.error('[sanctuary] stage markup is missing or incomplete');
    return;
  }
  const progressFill = document.getElementById('session-progress-fill');
  const entryInstallButton = document.getElementById('install-btn');
  const entryLock = document.getElementById('entry-lock');
  const entryLockKicker = document.getElementById('entry-lock-kicker');
  const entryLockTime = document.getElementById('entry-lock-time');
  const entryLockHint = document.getElementById('entry-lock-hint');
  const entryLockLight = document.getElementById('entry-lock-light');
  const guideLine1 = document.getElementById('guide-line-1');
  const entryInstalledNote = document.getElementById('entry-installed-note');
  const installedTitle = document.querySelector('.installed-title');
  const installedSub = document.querySelector('.installed-sub');
  const entryInstallHint = document.getElementById('entry-install-hint');
  const finaleEl = document.getElementById('finale');
  const finaleSessionVideo = document.getElementById('finale-session-video');
  if (SCREEN_TIER === 'low' && finaleSessionVideo) finaleSessionVideo.remove();
  const finaleCountdownEl = document.getElementById('finale-countdown');
  const finaleReflectionEl = document.getElementById('finale-reflection');
  const finaleDoorNote = document.getElementById('finale-door-note');
  const finaleArtNote = document.getElementById('finale-art-note');
  const notifyReturnButton = document.getElementById('notify-return');
  const langSwitch = document.getElementById('lang-switch');
  const langButtons = Array.from(document.querySelectorAll('.lang-switch-btn'));
  const presenceTexts = Array.from(document.querySelectorAll('[data-presence]'));
  const finaleArtifact = document.getElementById('finale-artifact');
  const artifactCanvas = document.getElementById('session-artifact');
  const shareSilenceButton = document.getElementById('share-silence');
  const artLightbox = document.getElementById('art-lightbox');
  const artLightboxImage = document.getElementById('art-lightbox-image');
  const artLightboxClose = document.getElementById('art-lightbox-close');
  const artLightboxSave = document.getElementById('art-lightbox-save');
  let presenceCount = 0;
  let presenceTimer = 0;
  function presenceBaseForHour(hour) {
    if (hour >= 7 && hour < 18) return 7 + Math.floor(Math.random() * 8);
    return 18 + Math.floor(Math.random() * 17);
  }
  function updatePresenceCounter() {
    const label = tr('inSilenceNow').replace('{n}', String(presenceCount));
    for (const node of presenceTexts) {
      window.clearTimeout(node._presenceTimer);
      node.style.opacity = '0';
      node._presenceTimer = window.setTimeout(() => {
        node.textContent = label;
        node.style.opacity = '1';
      }, 180);
    }
  }
  function startPresenceCounter() {
    presenceCount = presenceBaseForHour(new Date().getHours());
    updatePresenceCounter();
    const tick = () => {
      const drift = Math.random() < 0.5 ? -1 : 1;
      presenceCount = Math.max(7, Math.min(34, presenceCount + drift));
      updatePresenceCounter();
      presenceTimer = window.setTimeout(tick, 25000 + Math.random() * 15000);
    };
    window.clearTimeout(presenceTimer);
    presenceTimer = window.setTimeout(tick, 25000 + Math.random() * 15000);
  }
  const ENTRY_MOTIFS = ['mountains', 'sea', 'forest', 'dunes', 'night'];
  const ENTRY_LANDSCAPE_KEY = 'sanctuary-entry-landscape-history';
  let entryLandscapeState = null;
  let entryResizeBound = false;

  function initEntryAbstract() {
    const canvas = document.getElementById('entry-abstract-canvas');
    if (!canvas) return;
    if (!entryLandscapeState) {
      let history = [];
      try { history = JSON.parse(localStorage.getItem(ENTRY_LANDSCAPE_KEY) || '[]'); } catch (_) { history = []; }
      if (!Array.isArray(history)) history = [];
      history = history.slice(-5);
      const raw = (window.crypto && crypto.getRandomValues)
        ? crypto.getRandomValues(new Uint32Array(1))[0]
        : Math.floor(Math.random() * 0xFFFFFFFF);
      const seed = raw >>> 0;
      const recentMotifs = history.map((item) => item && item.motif).filter(Boolean);
      let available = ENTRY_MOTIFS.filter((motif) => !recentMotifs.includes(motif));
      if (!available.length) available = ENTRY_MOTIFS.filter((motif) => motif !== recentMotifs[recentMotifs.length - 1]);
      if (!available.length) available = ENTRY_MOTIFS.slice();
      const motif = available[seed % available.length];
      entryLandscapeState = { seed, motif };
      history.push({ seed, motif });
      try { localStorage.setItem(ENTRY_LANDSCAPE_KEY, JSON.stringify(history.slice(-5))); } catch (_) {}
      canvas.dataset.seed = String(seed);
      canvas.dataset.motif = motif;
    }
    drawEntryLandscape(canvas);
    if (!entryResizeBound) {
      entryResizeBound = true;
      window.addEventListener('resize', () => drawEntryLandscape(canvas), { passive: true });
    }
  }

  function drawEntryLandscape(canvas) {
    const state = entryLandscapeState;
    if (!state) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.max(1, window.innerWidth);
    const H = Math.max(1, window.innerHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    let local = state.seed >>> 0;
    const rand = () => {
      local = (local * 1664525 + 1013904223) >>> 0;
      return local / 4294967296;
    };
    const rgba = (hex, a) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
    };

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070709');
    sky.addColorStop(0.46, '#090A0D');
    sky.addColorStop(1, '#070709');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const mist = (y, a, color) => {
      const g = ctx.createLinearGradient(0, y - H * 0.12, 0, y + H * 0.14);
      g.addColorStop(0, rgba(color, 0));
      g.addColorStop(0.48, rgba(color, a));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - H * 0.14, W, H * 0.28);
    };

    if (state.motif === 'mountains') {
      mist(H * 0.58, 0.045, '#D6C7B2');
      const ridges = 4 + (state.seed % 2);
      for (let i = 0; i < ridges; i += 1) {
        const baseY = H * (0.32 + i * 0.075);
        const amp = H * (0.12 + rand() * 0.12);
        const color = i % 2 ? '#7E8F82' : '#5D6D82';
        const g = ctx.createLinearGradient(0, baseY - amp, 0, H * 0.86);
        g.addColorStop(0, rgba(color, 0.14 + i * 0.018));
        g.addColorStop(0.55, rgba(color, 0.075));
        g.addColorStop(1, rgba('#070709', 0.02));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-W * 0.08, H * 0.9);
        ctx.lineTo(-W * 0.08, baseY + amp * 0.3);
        let x = -W * 0.08;
        while (x < W * 1.08) {
          const nx = x + W * (0.14 + rand() * 0.2);
          const peak = baseY - amp * (0.2 + rand() * 0.9);
          ctx.quadraticCurveTo((x + nx) / 2, peak, nx, baseY + amp * (rand() * 0.18));
          x = nx;
        }
        ctx.lineTo(W * 1.08, H * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba('#D6C7B2', 0.13 + i * 0.012);
        ctx.lineWidth = 0.6 + rand() * 0.5;
        ctx.beginPath();
        let sx = -W * 0.08;
        ctx.moveTo(sx, baseY + amp * 0.32);
        while (sx < W * 1.08) {
          const nx = sx + W * (0.16 + rand() * 0.2);
          ctx.quadraticCurveTo((sx + nx) / 2, baseY - amp * (0.15 + rand() * 0.5), nx, baseY + amp * 0.2);
          sx = nx;
        }
        ctx.stroke();
      }
    } else if (state.motif === 'sea') {
      const horizon = H * 0.47;
      const glow = ctx.createRadialGradient(W * 0.52, horizon, 0, W * 0.52, horizon, W * 0.7);
      glow.addColorStop(0, rgba('#D6C7B2', 0.15));
      glow.addColorStop(0.4, rgba('#5D6D82', 0.1));
      glow.addColorStop(1, rgba('#070709', 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      mist(horizon, 0.05, '#D6C7B2');
      ctx.strokeStyle = rgba('#D6C7B2', 0.24);
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(W * 0.06, horizon); ctx.lineTo(W * 0.94, horizon); ctx.stroke();
      const water = ctx.createLinearGradient(0, horizon, 0, H);
      water.addColorStop(0, rgba('#5D6D82', 0.14));
      water.addColorStop(0.55, rgba('#5D6D82', 0.06));
      water.addColorStop(1, rgba('#070709', 0.02));
      ctx.fillStyle = water;
      ctx.fillRect(0, horizon, W, H - horizon);
      for (let i = 0; i < 28; i += 1) {
        const y = horizon + (H - horizon) * rand() * 0.9;
        const x = W * rand() * 0.8;
        const len = W * (0.04 + rand() * 0.22);
        ctx.strokeStyle = rgba(i % 4 ? '#D6C7B2' : '#8A798D', 0.035 + rand() * 0.08);
        ctx.lineWidth = 0.5 + rand() * 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      }
    } else if (state.motif === 'forest') {
      mist(H * 0.54, 0.075, '#7E8F82');
      mist(H * 0.72, 0.045, '#D6C7B2');
      const trees = 22 + Math.floor(rand() * 10);
      for (let i = 0; i < trees; i += 1) {
        const x = W * (0.04 + rand() * 0.92);
        const top = H * (0.17 + rand() * 0.3);
        const bottom = H * (0.68 + rand() * 0.2);
        const color = i % 3 ? '#7E8F82' : '#D6C7B2';
        ctx.strokeStyle = rgba(color, 0.045 + rand() * 0.11);
        ctx.lineWidth = 0.5 + rand() * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.bezierCurveTo(x + (rand() - 0.5) * W * 0.03, H * 0.42, x + (rand() - 0.5) * W * 0.04, H * 0.6, x, bottom);
        ctx.stroke();
        if (rand() > 0.55) {
          ctx.strokeStyle = rgba(color, 0.035 + rand() * 0.05);
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(x, top + (bottom - top) * 0.32);
          ctx.quadraticCurveTo(x + W * 0.06, top + (bottom - top) * 0.25, x + W * 0.09, top + (bottom - top) * 0.38);
          ctx.stroke();
        }
      }
    } else if (state.motif === 'dunes') {
      const dunes = 4;
      for (let i = 0; i < dunes; i += 1) {
        const baseY = H * (0.42 + i * 0.11);
        const color = i % 2 ? '#D6C7B2' : '#A67B63';
        const g = ctx.createLinearGradient(0, baseY, 0, H);
        g.addColorStop(0, rgba(color, 0.12 + i * 0.025));
        g.addColorStop(0.6, rgba(color, 0.055));
        g.addColorStop(1, rgba('#070709', 0.01));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-W * 0.1, H * 0.9);
        ctx.lineTo(-W * 0.1, baseY);
        let x = -W * 0.1;
        while (x < W * 1.1) {
          const nx = x + W * (0.28 + rand() * 0.25);
          ctx.bezierCurveTo(x + W * 0.12, baseY - H * (0.03 + rand() * 0.1), nx - W * 0.1, baseY + H * (0.02 + rand() * 0.08), nx, baseY + H * (0.01 + rand() * 0.03));
          x = nx;
        }
        ctx.lineTo(W * 1.1, H * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba('#D6C7B2', 0.16 + i * 0.015);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-W * 0.1, baseY);
        ctx.quadraticCurveTo(W * 0.42, baseY - H * 0.08, W * 1.1, baseY + H * 0.02);
        ctx.stroke();
      }
    } else {
      mist(H * 0.62, 0.035, '#8A798D');
      const stars = 34 + Math.floor(rand() * 18);
      for (let i = 0; i < stars; i += 1) {
        const x = rand() * W;
        const y = rand() * H * 0.52;
        const a = 0.12 + rand() * 0.38;
        ctx.fillStyle = rgba(i % 5 ? '#D6C7B2' : '#8A798D', a);
        ctx.beginPath();
        ctx.arc(x, y, 0.4 + rand() * 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      const beam = ctx.createLinearGradient(W * 0.52, 0, W * 0.48, H);
      beam.addColorStop(0, rgba('#8A798D', 0.09));
      beam.addColorStop(0.5, rgba('#D6C7B2', 0.035));
      beam.addColorStop(1, rgba('#070709', 0));
      ctx.fillStyle = beam;
      ctx.fillRect(W * 0.3, 0, W * 0.4, H);
      const hill = ctx.createLinearGradient(0, H * 0.64, 0, H);
      hill.addColorStop(0, rgba('#5D6D82', 0.16));
      hill.addColorStop(1, rgba('#070709', 0.02));
      ctx.fillStyle = hill;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.72);
      ctx.bezierCurveTo(W * 0.2, H * 0.64, W * 0.32, H * 0.76, W * 0.5, H * 0.69);
      ctx.bezierCurveTo(W * 0.7, H * 0.62, W * 0.82, H * 0.75, W, H * 0.66);
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba('#D6C7B2', 0.12); ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.72);
      ctx.bezierCurveTo(W * 0.2, H * 0.64, W * 0.32, H * 0.76, W * 0.5, H * 0.69);
      ctx.bezierCurveTo(W * 0.7, H * 0.62, W * 0.82, H * 0.75, W, H * 0.66);
      ctx.stroke();
    }
  }

  function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.title = tr('docTitle');
    const setText = (selector, key) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = tr(key);
    };
    const setHtml = (selector, key) => {
      const node = document.querySelector(selector);
      if (node) node.innerHTML = tr(key);
    };
    setText('.entry-kicker', 'entryKicker');
    setHtml('.entry-title', 'entryTitle');
    setHtml('.entry-sub', 'entrySub');
    if (installedTitle) installedTitle.textContent = tr('installedTitle');
    if (installedSub) installedSub.textContent = tr('installedSub');
    updatePresenceCounter();
    if (GIFT_MODE) {
      setText('.entry-kicker', 'giftKicker');
      setHtml('.entry-title', 'giftTitle');
      setHtml('.entry-sub', 'giftSub');
    }
    if (guideLine1) guideLine1.textContent = tr('guideSwipe');
    if (entryGate) entryGate.setAttribute('aria-label', tr('entryAria'));
    if (entryInstallButton) entryInstallButton.textContent = tr('installApp');
    if (entryInstallHint) entryInstallHint.textContent = tr('installHint');
    if (entryLockKicker) entryLockKicker.textContent = tr('lockEntryKicker');
    if (entryLockHint) entryLockHint.textContent = tr('lockEntryHint');
    if (notifyReturnButton) notifyReturnButton.textContent = tr('notify');
    if (shareSilenceButton) shareSilenceButton.textContent = tr('finaleGift');
    if (artLightboxSave) artLightboxSave.textContent = tr('saveFrame');
    if (finaleDoorNote) finaleDoorNote.textContent = tr('doorNote');
    if (finaleArtNote) finaleArtNote.textContent = tr('artNote');
    for (const button of langButtons) {
      const active = button.dataset.lang === currentLang;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    updateSessionLockUI();
  }
  function setLanguage(lang) {
    if (lang !== 'ru' && lang !== 'en') return;
    currentLang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, currentLang);
    } catch (_) {
    }
    applyLanguage();
  }
  if (langSwitch) {
    langSwitch.addEventListener('pointerdown', (event) => event.stopPropagation());
  }
  for (const button of langButtons) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setLanguage(button.dataset.lang);
    });
  }
  const categories = slides.map((slide, index) => {
    const tag = slide.dataset.tag;
    return {
      index,
      tag,
      el: slide,
      query: tag,
      fallbackQuery: '',
      extendedQuery: tag,
      keywords: [],
      blocked: [],
      preferred: [],
      clips: [],
      activeIndex: 0,
      lastPlayed: null,
      freshIndex: null,
      extendWanted: false,
      extendedLoading: false,
      extendedLoaded: false,
      musicTracks: MUSIC_CATALOG[tag] || [],
      trackCursor: 0,
    };
  });
  const VIEWED_STORAGE_KEY = 'sanctuary-viewed-video-ids-v1';
  const VIEWED_ALL_KEY = 'sanctuary-viewed-all-v1';
  const MAX_VIEWED_IDS = 100;
  const MAX_ALL_VIEWED_IDS = 500;
  function readViewedVideoIds() {
    try {
      const raw = localStorage.getItem(VIEWED_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === 'string' && id).slice(-MAX_VIEWED_IDS)
        : [];
    } catch (_) {
      return [];
    }
  }
  let viewedVideoIds = readViewedVideoIds();
  function readAllViewedVideoIds() {
    try {
      const raw = localStorage.getItem(VIEWED_ALL_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === 'string' && id).slice(-MAX_ALL_VIEWED_IDS)
        : [];
    } catch (_) {
      return [];
    }
  }
  let allViewedVideoIds = new Set(readAllViewedVideoIds());
  let catalogVideoIds = new Set();
  if (!allViewedVideoIds.size) {
    for (const id of viewedVideoIds) allViewedVideoIds.add(id);
  }
  function persistViewedVideoIds() {
    try {
      localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify(viewedVideoIds));
    } catch (_) {
    }
  }
  function persistAllViewedVideoIds() {
    try {
      localStorage.setItem(VIEWED_ALL_KEY, JSON.stringify([...allViewedVideoIds]));
    } catch (_) {
    }
  }
  const sessionUsedVideoIds = new Set(allViewedVideoIds);
  function resetViewedCycleIfComplete() {
    if (!catalogVideoIds.size) return false;
    for (const id of catalogVideoIds) {
      if (!allViewedVideoIds.has(id)) return false;
    }
    allViewedVideoIds.clear();
    viewedVideoIds = [];
    sessionUsedVideoIds.clear();
    try {
      localStorage.removeItem(VIEWED_ALL_KEY);
      localStorage.removeItem(VIEWED_STORAGE_KEY);
    } catch (_) {
    }
    return true;
  }
  function markVideoViewed(id) {
    if (!id) return;
    sessionUsedVideoIds.add(id);
    allViewedVideoIds.add(id);
    while (allViewedVideoIds.size > MAX_ALL_VIEWED_IDS) {
      allViewedVideoIds.delete(allViewedVideoIds.values().next().value);
    }
    const previous = viewedVideoIds.indexOf(id);
    if (previous >= 0) viewedVideoIds.splice(previous, 1);
    viewedVideoIds.push(id);
    if (viewedVideoIds.length > MAX_VIEWED_IDS) {
      viewedVideoIds = viewedVideoIds.slice(-MAX_VIEWED_IDS);
    }
    persistViewedVideoIds();
    persistAllViewedVideoIds();
  }
  function isVideoSeen(id) {
    return Boolean(id) && sessionUsedVideoIds.has(id);
  }
  function stageFor(id) {
    return stagePlan.find((stage) => stage.id === id) || stagePlan[0];
  }
  function setCategorySearch(tag, tags) {
    const category = categories.find((item) => item.tag === tag);
    if (!category || !tags.length) return;
    category.query = tags[0];
    category.fallbackQuery = tags[1] || tags[0];
    category.extendedQuery = tags.join(' ');
  }
  function applyStageQueries() {
    setCategorySearch('Shadow', stageFor(1).selected);
    setCategorySearch('Trickster', [stageFor(2).selected[0]]);
    setCategorySearch('Abyss', [stageFor(2).selected[1]]);
    setCategorySearch('Calm', stageFor(3).selected);
    setCategorySearch('Path', stageFor(4).selected);
  }
  applyStageQueries();
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
    captionFastStreak: 0,
  };
  state.visits[0] = 1;
  let gesture = null;
  let isTransitioning = false;
  let touchOrigin = null;
  let holdTimer = 0;
  let lastSwipeAt = 0;
  let lastBottomTapAt = 0;
  let resonanceTimer = 0;
  let recentTrackIds = [];
  let sound = null;
  let soundStarting = false;
  let nativeTrack = null;
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
  let sceneOrdinal = 0;
  let captionAllow = false;
  let captionSuppressed = false;
  let captionHoldReady = false;
  let captionHasText = false;
  let captionRevealed = false;
  let currentCaption = null;
  let captionMemoryTimer = 0;
  let captionZeroTimer = 0;
  let captionWakeTimer = 0;
  let captionRevealTimer = 0;
  let captionAcceptedCount = 0;
  let captionYouStartCount = 0;
  let resonanceMemoryVersion = 0;
  const resonanceMemory = [];
  const captionCache = new Map();
  const CAPTION_CACHE_MAX = 200;
  const captionPending = new Map();
  const captionSeen = new Set();
  let pathPlan = [];
  let pathPos = -1;
  let pathPicked = new Set();
  let pathStarted = false;
  let pathStartPending = false;
  let sessionEvents = [];
  let sessionStartedAt = 0;
  let sessionComplete = false;
  let sessionStage = 1;
  let sessionAccounted = 0;
  let lastSessionProgressAt = 0;
  let userAvgWatchTime = 0;
  let sessionTextFrames = 0;
  let quietSinceText = 0;
  let quietRequired = 1;
  let lastCaptionFrame = -99;
  let sessionFinalTimer = 0;
  let cycleNumber = 1;
  let cycleWhisperTimer = 0;
  let captionStartDelayOverride = 0;
  let cycleWhisperUntil = 0;
  let cycleCaptionBlocked = false;
  let anchorClip = null;
  let anchorHoldMs = 0;
  let firstShadowDurations = [];
  let shadowCompressed = false;
  let wakeLock = null;
  let activeHapticStage = 0;
  let holdPulseTimer = 0;
  let holdBreathStep = 0;
  let entryLockRevealTimer = 0;
  let lastHapticAt = 0;
  let sessionLockAt = 0;
  let lockTicker = 0;
  let returnAfterLock = false;
  let lastTrackedStage = 0;
  let lastHoldTrackedFrame = -1;
  let returnNotificationTimer = 0;
  let deferredPrompt = null;
  let installHintTimer = 0;
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
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function safeVibrate(pattern = 10, cooldown = HAPTIC_COOLDOWN_MS) {
    if (typeof navigator.vibrate !== 'function') return false;
    const time = now();
    if (time - lastHapticAt < cooldown) return false;
    lastHapticAt = time;
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (_) {
      return false;
    }
  }
  function stopHaptics() {
    if (typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch (_) {
      }
    }
  }
  function hapticPatternForCurrent() {
    return HAPTIC_PATTERNS[currentOpticElement] || HAPTIC_PATTERNS.fog;
  }
  function startHoldPulse() {
    stopHoldPulse();
    const pattern = hapticPatternForCurrent();
    holdBreathStep = 0;
    safeVibrate(pattern.hold, 0);
    const breathe = () => {
      if (!gesture || !gesture.holding) return;
      holdBreathStep += 1;
      safeVibrate(pattern.whisper, 0);
      const wait = holdBreathStep % 2 === 1 ? 6000 : 4000;
      holdPulseTimer = window.setTimeout(breathe, wait);
    };
    holdPulseTimer = window.setTimeout(breathe, 4000);
  }
  function stopHoldPulse() {
    const wasHolding = Boolean(holdPulseTimer);
    window.clearTimeout(holdPulseTimer);
    holdPulseTimer = 0;
    if (wasHolding) stopHaptics();
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
    currentSoundClip = clip || currentSoundClip;
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
  function updateUserAverage(viewedMs) {
    if (!Number.isFinite(viewedMs) || viewedMs <= 0) return;
    userAvgWatchTime = userAvgWatchTime
      ? userAvgWatchTime * 0.8 + viewedMs * 0.2
      : viewedMs;
  }
  function behaviorContext(record) {
    const viewedMs = record && Number.isFinite(record.viewedMs)
      ? record.viewedMs
      : Math.max(0, now() - state.viewStart);
    const held = (record && record.heldMs > 0)
      || state.longestHoldMs >= 600
      || Boolean(gesture && gesture.holding);
    const looped = Boolean(record && record.loopCount > 0);
    const resonance = held || looped;
    const early = record
      ? (userAvgWatchTime > 0
        ? record.viewedMs < userAvgWatchTime * EARLY_SWIPE_RATIO
        : record.viewedMs < FAST_VIEW_MS)
      : engine.fastStreak >= 2 || state.nervousStreak >= 2;
    const anxiety = early || (record && record.swipeSpeed >= IMPULSIVE_SPEED);
    if (resonance) {
      return {
        key: 'resonance',
        context: 'удержание или повторный круг — реальное погружение, а не обычный просмотр',
      };
    }
    if (anxiety) {
      return {
        key: 'anxiety',
        context: 'досрочный уход — скрытое сопротивление, слишком быстрый пропуск',
      };
    }
    return {
      key: 'neutral',
      context: 'спокойный просмотр без выраженного удержания',
    };
  }
  function sceneContextFor(record, behavior) {
    const fast = record.viewedMs < FAST_VIEW_MS || record.swipeSpeed >= IMPULSIVE_SPEED;
    const held = record.heldMs > 0
      || record.longestHoldMs >= 600
      || state.longestHoldMs >= 600;
    const looped = record.loopCount > 0;
    const early = userAvgWatchTime > 0
      ? record.viewedMs < userAvgWatchTime * EARLY_SWIPE_RATIO
      : record.viewedMs < FAST_VIEW_MS;
    const linger = record.viewedMs >= CAPTION_LINGER_MS
      || held;
    state.captionFastStreak = fast && !linger
      ? state.captionFastStreak + 1
      : 0;
    return {
      behavior,
      linger,
      fastStreak: state.captionFastStreak,
      held,
      looped,
      early,
      viewedMs: record.viewedMs,
    };
  }
  function captionKey(clip) {
    return `${clip.id || `${clip.title || 'untitled'}|${clip.url || ''}`}|${resonanceMemoryVersion}`;
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
  function captionStartsWithYou(text) {
    return /^(ты|твой|твоя|твои)(?=\s|$|[,.;:!?…—–-])/iu.test(text);
  }
  function captionVoiceAllowed(text) {
    if (!captionStartsWithYou(text)) return true;
    const nextTotal = captionAcceptedCount + 1;
    const nextYou = captionYouStartCount + 1;
    return nextYou / nextTotal <= CAPTION_YOU_LIMIT + 1e-9;
  }
  function captionIsValid(text) {
    if (!text) return false;
    const words = countCaptionWords(text);
    if (words < CAPTION_MIN_WORDS || words > CAPTION_MAX_WORDS) return false;
    if (currentLang === 'en') {
      if (!/[A-Za-z]/.test(text)) return false;
    } else if (!/[А-Яа-яЁё]/.test(text)) {
      return false;
    }
    if (/[<>]/.test(text)) return false;
    if (/["«»“”]/.test(text)) return false;
    const sentenceMarks = text.match(/[.!?…]/g) || [];
    if (sentenceMarks.length > 2) return false;
    if (/(сделай|поверь|должен|нужно|попробуй|стань|обещай|you should|you must|try to|promise me)/iu.test(text)) return false;
    return true;
  }

  function localTimeContext() {
    const date = new Date();
    const hour = date.getHours();
    let label = currentLang === 'en' ? 'deep night' : 'глубокая ночь';
    if (hour >= 5 && hour < 8) label = currentLang === 'en' ? 'early morning' : 'раннее утро';
    else if (hour >= 8 && hour < 12) label = currentLang === 'en' ? 'morning' : 'утро';
    else if (hour >= 12 && hour < 17) label = currentLang === 'en' ? 'day' : 'день';
    else if (hour >= 17 && hour < 21) label = currentLang === 'en' ? 'evening' : 'вечер';
    else if (hour >= 21) label = currentLang === 'en' ? 'late evening' : 'поздний вечер';
    return {
      clock: `${String(hour).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
      label,
    };
  }
  function captionMessages(clip, category, behavior, stageId) {
    const stage = stageFor(stageId || STAGE_BY_CATEGORY[category.tag] || 1);
    const archetype = clip.archetype || stage.archetype || stage.name;
    const time = localTimeContext();
    const behaviorKey = (behavior && behavior.key) || 'neutral';
    const behaviorLine = currentLang === 'en'
      ? 'quiet presence with the image'
      : 'тихое присутствие рядом с образом';
    const details = currentLang === 'en'
      ? [
        `Category: ${category.tag}.`,
        `Stage: ${stage.id}.`,
        `Local time: ${time.clock}.`,
        `Video: “${clip.title || 'untitled'}”.`,
        clip.description ? `Description: ${clip.description.slice(0, 420)}.` : '',
        clip.tags && clip.tags.length ? `Tags: ${clip.tags.slice(0, 18).join(', ')}.` : '',
        `Behavior: ${behaviorLine}.`,
        'Write one new line in natural conversational English, strictly 4–6 words. Return only the line.',
      ]
      : [
        `Stage: ${archetype}.`,
        `Категория: ${category.tag}.`,
        `Стадия: ${stage.id}.`,
        `Локальное время: ${time.clock}.`,
        `Видео: «${clip.title || 'без названия'}».`,
        clip.description ? `Описание: ${clip.description.slice(0, 420)}.` : '',
        clip.tags && clip.tags.length ? `Теги: ${clip.tags.slice(0, 18).join(', ')}.` : '',
        `Поведение: ${behaviorLine}.`,
        'Создай одну новую фразу строго из 4–6 слов. Верни только текст.',
      ];
    const systemPrompt = currentLang === 'en' ? CAPTION_SYSTEM_PROMPT_EN : CAPTION_SYSTEM_PROMPT_RU;
    return [
      {
        role: 'system',
        content: `${systemPrompt}\n\n${currentLang === 'en' ? 'Respond only in English.' : 'Отвечай только по-русски.'}`,
      },
      { role: 'user', content: details.filter(Boolean).join('\n') },
    ];
  }
  async function callDeepSeek(messages, temperature) {
    return null;
    if (location.protocol === 'file:') return null;
    if (location.hostname.endsWith('.github.io') || location.hostname === 's3.twcstorage.ru' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
    if (captionApiUnavailable) return null;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CAPTION_TIMEOUT_MS);
    try {
      const response = await fetch(DEEPSEEK_PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature,
          max_tokens: 60,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      if (response.status === 401 || response.status === 403) {
        captionApiUnavailable = true;
        return null;
      }
      if (!response.ok) {
        captionApiUnavailable = true;
        return null;
      }
      const payload = await response.json();
      const content = payload
        && payload.choices
        && payload.choices[0]
        && payload.choices[0].message
        && payload.choices[0].message.content;
      return typeof content === 'string' ? content : null;
    } catch (_) {
      captionApiUnavailable = true;
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }
  function requestCaption(clip, category, behavior, stageId) {
    if (!clip || !category) return Promise.resolve(null);
    const key = captionKey(clip);
    if (captionCache.has(key)) return Promise.resolve(captionCache.get(key));
    if (captionPending.has(key)) return captionPending.get(key);
    const promise = (async () => {
      const messages = captionMessages(clip, category, behavior, stageId);
      let raw = await callDeepSeek(messages, 1.15);
      let text = normalizeCaption(raw);
      if (
        !captionIsValid(text)
        || captionSeen.has(text.toLowerCase())
        || !captionVoiceAllowed(text)
      ) {
        return null;
      }
      const startsWithYou = captionStartsWithYou(text);
      captionAcceptedCount += 1;
      if (startsWithYou) captionYouStartCount += 1;
      captionSeen.add(text.toLowerCase());
      if (captionCache.size >= CAPTION_CACHE_MAX) {
        captionCache.delete(captionCache.keys().next().value);
      }
      captionCache.set(key, text);
      return text;
    })().finally(() => {
      captionPending.delete(key);
    });
    captionPending.set(key, promise);
    return promise;
  }
  function prefetchCaption(clip, category, behavior, stageId) {
    if (!clip || !category) return;
    const key = captionKey(clip);
    if (captionCache.has(key) || captionPending.has(key)) return;
    requestCaption(clip, category, behavior, stageId).catch(() => {});
  }
  function prefetchNextCaptions(behavior) {
    const next = pathPlan[pathPos + 1];
    if (next) {
      prefetchCaption(next.clip, next.category, behavior, next.stage);
    }
  }
  function renderCaptionLines(text) {
    if (!captionEl) return;
    const words = text.split(/\s+/).filter(Boolean);
    const middle = Math.ceil(words.length / 2);
    const renderLine = (line, list, offset) => {
      if (!line) return;
      line.textContent = '';
      list.forEach((word, index) => {
        const span = document.createElement('span');
        span.textContent = word;
        span.style.setProperty('--word-delay', `${(offset + index) * 0.14}s`);
        line.appendChild(span);
        if (index < list.length - 1) line.appendChild(document.createTextNode(' '));
      });
    };
    renderLine(captionLines[0], words.slice(0, middle), 0);
    renderLine(captionLines[1], words.slice(middle), middle);
    captionEl.setAttribute('aria-label', text);
  }
  function registerCaptionFrame() {
    sessionTextFrames = Math.min(
      Math.max(1, Math.floor(CYCLE_LENGTH * CAPTION_MAX_RATIO)),
      sessionTextFrames + 1
    );
    quietSinceText = 0;
    quietRequired = 2 + Math.floor(Math.random() * 2);
  }
  function captionAllowedForScene(context) {
    if (cycleCaptionBlocked) {
      cycleCaptionBlocked = false;
      quietSinceText = 0;
      return false;
    }
    const cap = Math.max(1, Math.floor(CYCLE_LENGTH * CAPTION_MAX_RATIO));
    if (context && context.held) return true;
    if (sessionTextFrames >= cap) return false;
    if (Math.abs(pathPos - lastCaptionFrame) < 3) {
      quietSinceText = Math.max(quietSinceText, 2);
      return false;
    }
    if (quietSinceText < quietRequired) {
      quietSinceText += 1;
      return false;
    }
    registerCaptionFrame();
    lastCaptionFrame = pathPos;
    return true;
  }
  function maybeRecordResonance() {
    if (!currentCaption || !currentCaption.text || !currentCaption.revealed) return;
    if (currentCaption.recorded) return;
    const held = currentCaption.held || (gesture && gesture.holding);
    const video = currentCaption.clip && currentCaption.clip.el;
    const durationMs = video && Number.isFinite(video.duration) && video.duration > 0
      ? video.duration * 1000
      : (currentCaption.clip.duration || 10) * 1000;
    const looped = state.loopsInView > 0
      || (now() - state.viewStart) > durationMs * 1.2;
    if (!held && !looped) return;
    currentCaption.recorded = true;
    resonanceMemory.push({
      category: currentCaption.category.tag,
      image: currentCaption.clip.title || 'без названия',
      phrase: currentCaption.text,
    });
    if (resonanceMemory.length > 4) resonanceMemory.shift();
    resonanceMemoryVersion += 1;
    safeVibrate(hapticPatternForCurrent().anchor, 6000);
    prefetchNextCaptions(behaviorContext());
  }
  function scheduleCaptionZero() {
    window.clearTimeout(captionZeroTimer);
    if (!captionEl || !captionHasText || !captionEl.classList.contains('is-visible')) return;
    captionZeroTimer = window.setTimeout(() => {
      if (captionEl && captionEl.classList.contains('is-visible') && !stage.classList.contains('is-touching') && !stage.classList.contains('is-held')) {
        captionEl.classList.remove('is-visible', 'is-zero');
        stage.classList.remove('is-caption-active');
        captionRevealed = false;
        captionSuppressed = true;
        captionHoldReady = false;
        if (currentCaption) currentCaption.revealed = false;
      }
    }, 4800);
  }
  function wakeCaption() {
    if (!captionEl) return;
    window.clearTimeout(captionZeroTimer);
    window.clearTimeout(captionWakeTimer);
    captionEl.classList.remove('is-zero');
    captionEl.classList.add('is-awake');
    captionWakeTimer = window.setTimeout(() => captionEl.classList.remove('is-awake'), 1600);
  }
  function scheduleCaptionVisible(started, token, immediate) {
    if (!captionEl || !captionHasText || token !== captionSceneToken) return;
    const requestedDelay = captionStartDelayOverride || CAPTION_START_DELAY_MS;
    const delay = immediate ? 0 : Math.max(0, requestedDelay - (now() - started));
    captionStartDelayOverride = 0;
    window.clearTimeout(captionTimer);
    captionTimer = window.setTimeout(() => {
      if (token !== captionSceneToken || !captionHasText) return;
      captionEl.setAttribute('aria-hidden', 'false');
      captionEl.classList.remove('is-zero');
      captionEl.classList.add('is-visible');
      stage.classList.add('is-caption-active');
      captionRevealed = true;
      if (currentCaption) {
        currentCaption.revealed = true;
        if (!currentCaption.haptic) {
          currentCaption.haptic = true;
          safeVibrate(10, 3000);
        }
      }
      scheduleCaptionZero();
      maybeRecordResonance();
    }, delay);
  }
  function revealCaptionForHold() {
    if (!captionSuppressed || captionHoldReady) return;
    if (Date.now() < cycleWhisperUntil) return;
    if (!gesture || !gesture.holding) return;
    captionHoldReady = true;
    if (currentCaption) currentCaption.held = true;
    if (!captionHasText) return;
    window.clearTimeout(captionTimer);
    captionEl.setAttribute('aria-hidden', 'false');
    captionEl.classList.remove('is-zero');
    captionEl.classList.add('is-visible');
    stage.classList.add('is-caption-active');
    captionRevealed = true;
    if (currentCaption) {
      currentCaption.holdReveal = true;
      currentCaption.revealed = true;
      if (!currentCaption.haptic) {
        currentCaption.haptic = true;
        safeVibrate(10, 3000);
      }
    }
    scheduleCaptionZero();
    maybeRecordResonance();
  }
  function activateCaption(category, clip, behavior, allowed, stageId) {
    const token = ++captionSceneToken;
    window.clearTimeout(captionTimer);
    window.clearTimeout(captionMemoryTimer);
    window.clearTimeout(captionRevealTimer);
    const stage = stageId || STAGE_BY_CATEGORY[category && category.tag] || 1;
    captionAllow = Boolean(allowed);
    captionSuppressed = !captionAllow;
    captionHoldReady = false;
    captionHasText = false;
    captionRevealed = false;
    currentCaption = null;
    if (!captionEl) return;
    captionEl.classList.remove('is-visible', 'is-zero', 'is-awake');
    document.querySelector('.stage')?.classList.remove('is-caption-active');
    captionEl.setAttribute('aria-hidden', 'true');
    if (!clip || !category) return;
    currentCaption = {
      category,
      clip,
      text: '',
      revealed: false,
      held: false,
      recorded: false,
      haptic: false,
      token,
    };
    const hiddenEligible = true;
    const started = now();
    const applyText = (text) => {
      if (token !== captionSceneToken || !text) return;
      renderCaptionLines(text);
      captionHasText = true;
      currentCaption.text = text;
      if (captionAllow) {
        scheduleCaptionVisible(started, token, false);
      } else if (captionHoldReady) {
        scheduleCaptionVisible(started, token, true);
      }
      maybeRecordResonance();
    };
    const key = captionKey(clip);
    const cached = captionCache.get(key);
    const staticCaption = currentLang === 'en' ? clip.caption_en : clip.caption_ru;
    const fallbackFirst = () => {
      applyText(pickFallbackCaption(category.tag));
    };
    if (staticCaption) {
      applyText(staticCaption);
      captionMemoryTimer = window.setTimeout(() => {
        if (token === captionSceneToken) maybeRecordResonance();
      }, CAPTION_LINGER_MS);
      return;
    }
    if (cached) applyText(cached);
    else if (captionAllow || hiddenEligible) {
      fallbackFirst();
    }
    captionMemoryTimer = window.setTimeout(() => {
      if (token === captionSceneToken) maybeRecordResonance();
    }, CAPTION_LINGER_MS);
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
    const first = categories[0].musicTracks[0];
    if (first) {
      createTrackAudio(first);
      preloadTrack(first);
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
    if (SCREEN_TIER === 'low' && trackAudio.size >= 2) {
      for (const [id, oldAudio] of [...trackAudio]) {
        if (id === sound?.activeTrackId) continue;
        try { oldAudio.pause(); oldAudio.removeAttribute('src'); oldAudio.load(); oldAudio.remove(); } catch (_) {}
        trackAudio.delete(id);
      }
    }
    const audio = document.createElement('audio');
    track.failed = false;
    audio.loop = true;
    audio.preload = 'metadata';
    audio.setAttribute('playsinline', '');
    audio.crossOrigin = 'anonymous';
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
    const first = categories[0] && categories[0].musicTracks[0];
    if (first) preloadTrack(first);
  }
  function preloadNextTrack(category) {
    if (SCREEN_TIER === 'low') return;
    if (!category || !category.musicTracks.length) return;
    preloadTrack(category.musicTracks[category.trackCursor % category.musicTracks.length]);
  }
  let globalTrackCursor = 0;
  function nextTrackFor(category) {
    const tracks = ALL_MUSIC_TRACKS.length ? ALL_MUSIC_TRACKS : (category.musicTracks || []);
    if (!tracks.length) return null;
    let fallback = null;
    for (let i = 0; i < tracks.length; i += 1) {
      const track = tracks[globalTrackCursor % tracks.length];
      globalTrackCursor = (globalTrackCursor + 1) % tracks.length;
      if (!track.failed && !recentTrackIds.includes(track.id)) return track;
      if (!fallback && !track.failed) fallback = track;
    }
    return fallback;
  }
  function disposeTrackChannel(channel) {
    if (!channel) return;
    const { track, audio } = channel;
    if (channel.fadeRaf) cancelAnimationFrame(channel.fadeRaf);
    try { audio.pause(); } catch (_) {}
    try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
    try { audio.remove(); } catch (_) {}
    if (track) {
      if (trackAudio.get(track.id) === audio) trackAudio.delete(track.id);
      if (sound && sound.channels.get(track.id) === channel) sound.channels.delete(track.id);
    }
  }
  function fadeChannelVolume(channel, target, ms) {
    if (!channel || !channel.audio) return;
    if (channel.fadeRaf) cancelAnimationFrame(channel.fadeRaf);
    const from = Number(channel.audio.volume) || 0;
    const duration = Math.max(80, ms || 400);
    const started = performance.now();
    const step = (ts) => {
      const p = Math.min(1, (ts - started) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      channel.audio.volume = Math.max(0, Math.min(1, from + (target - from) * eased));
      if (p < 1) channel.fadeRaf = requestAnimationFrame(step);
      else channel.fadeRaf = 0;
    };
    channel.fadeRaf = requestAnimationFrame(step);
  }
  function connectTrackToGraph(audio) {
    // Native HTMLAudioElement playback only. Do not route MP3 through Web Audio
    // on Android: MediaElementSource + compressors causes crackle and hiss.
    return;
  }
  function ensureTrackChannel(track) {
    if (!sound || !track || track.failed) return null;
    if (sound.channels.has(track.id)) return sound.channels.get(track.id);
    if (sound.channels.size >= 2) {
      for (const [id, item] of sound.channels) {
        if (id !== sound.activeTrackId) { disposeTrackChannel(item); break; }
      }
    }
    const audio = trackAudio.get(track.id) || createTrackAudio(track);
    if (!audio) return null;
    connectTrackToGraph(audio);
    audio.volume = 0;
    const channel = { track, audio, fadeRaf: 0 };
    sound.channels.set(track.id, channel);
    return channel;
  }
  let currentSoundClip = null;
  let lastPerspective = '';
  const recentLiveTrackIds = [];
  let soundSessionSalt = (Math.random() * 0xffffffff) >>> 0;
  const usedSoundSeeds = new Set();
  const SEMANTIC_SOUND_RULES = [
    { key: 'road', words: ['road', 'roads', 'highway', 'highways', 'car', 'cars', 'traffic', 'train', 'trains', 'street', 'streets', 'дорог', 'машин', 'поезд', 'улиц', 'трасс'] },
    { key: 'people', words: ['people', 'crowd', 'crowds', 'silhouette', 'silhouettes', 'person', 'alone', 'люди', 'силуэт', 'шаги', 'толпа', 'человек'] },
    { key: 'rain', words: ['rain', 'rains', 'window', 'windows', 'drops', 'дожд', 'капл', 'окн'] },
    { key: 'city', words: ['city', 'urban', 'bokeh', 'corridor', 'building', 'buildings', 'lights', 'город', 'огни', 'коридор', 'здани'] },
    { key: 'fire', words: ['fire', 'candle', 'sparks', 'огон', 'свеч', 'искр', 'пламя'] },
    { key: 'water', words: ['water', 'ocean', 'waves', 'underwater', 'sea', 'вода', 'мор', 'глубин', 'волн', 'река'] },
    { key: 'fog', words: ['fog', 'forest', 'mist', 'clouds', 'wind', 'лес', 'туман', 'облак', 'ветер'] },
    { key: 'space', words: ['space', 'light', 'sky', 'tunnel', 'свет', 'горизонт', 'путь', 'космос'] },
  ];
  const ELEMENT_SOUND = { fire: 'fire', water: 'water', fog: 'fog', space: 'space' };
  function semanticSoundKey(clip) {
    const text = [
      clip && clip.id, clip && clip.title, clip && clip.title_ru,
      clip && clip.caption_ru, clip && clip.caption_en,
      clip && clip.description, clip && clip.stage,
      clip && Array.isArray(clip.tags) ? clip.tags.join(' ') : '',
    ].filter(Boolean).join(' ').toLowerCase();
    const matches = (word) => {
      if (/[а-яё]/i.test(word)) return text.includes(word);
      return new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(text);
    };
    for (const rule of SEMANTIC_SOUND_RULES) {
      if (rule.words.some(matches)) return rule.key;
    }
    if (clip && ELEMENT_SOUND[clip.element]) return ELEMENT_SOUND[clip.element];
    if (clip && clip.stage === 'path') return 'space';
    if (clip && clip.stage === 'shadow') return 'fog';
    if (clip && clip.stage === 'trickster_abyss') return 'water';
    return 'fog';
  }
  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value + 0x6D2B79F5) >>> 0;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function soundSeedForClip(clip) {
    let hash = (soundSessionSalt ^ 0x9e3779b9) >>> 0;
    const text = `${(clip && clip.id) || 'empty'}|${(clip && clip.title) || ''}|${(clip && clip.stage) || ''}`;
    for (let i = 0; i < text.length; i += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    }
    let seed = hash || 1;
    let guard = 0;
    while (usedSoundSeeds.has(seed) && guard < 100000) {
      seed = (seed + 0x9e3779b9) >>> 0;
      guard += 1;
    }
    usedSoundSeeds.add(seed);
    return seed;
  }
  function profileForSoundKey(key) {
    return AMBIENT_PROFILES[key] || AMBIENT_PROFILES.fog;
  }
  function applySoundForClip(clip, instant = true) {
    if (!sound) return;
    const key = semanticSoundKey(clip);
    const base = profileForSoundKey(key);
    const seed = soundSeedForClip(clip);
    const random = seededRandom(seed);
    const recipes = PERSPECTIVE_RECIPES[key] || PERSPECTIVE_RECIPES.fog;
    const letters = Object.keys(recipes).filter((letter) => letter !== lastPerspective);
    const perspective = letters[Math.floor(random() * letters.length)] || Object.keys(recipes)[0];
    const recipe = recipes[perspective];
    const root = base.root * (recipe.rootScale || 1) * (0.94 + random() * 0.12);
    const cutoff = (recipe.cutoff || base.cutoff) * (0.92 + random() * 0.16);
    const voiceGains = base.voiceGains.map((gain) => gain * (recipe.voiceScale || 1) * (0.9 + random() * 0.2));
    const pans = base.pans.map((pan) => Math.max(-0.85, Math.min(0.85, pan * (recipe.panScale || 1) + (random() * 2 - 1) * 0.1)));
    const profile = {
      ...base,
      root,
      cutoff,
      q: recipe.q || base.q,
      voiceGains,
      pans,
      noiseType: recipe.noiseType || base.noiseType,
      noiseHighpass: recipe.noiseHighpass || base.noiseHighpass,
      noiseLowpass: recipe.noiseLowpass || base.noiseLowpass,
      noiseQ: recipe.noiseQ || base.noiseQ,
      noiseGain: base.noiseGain * (recipe.noiseGainScale || 1),
      sparkle: recipe.sparkle !== undefined ? recipe.sparkle : base.sparkle,
      delay: recipe.delay !== undefined ? recipe.delay : base.delay,
      delayMix: recipe.delayMix !== undefined ? recipe.delayMix : base.delayMix,
      delayFeedback: recipe.delayFeedback !== undefined ? recipe.delayFeedback : base.delayFeedback,
      reverb: recipe.reverb !== undefined ? recipe.reverb : base.reverb,
      lfoScale: recipe.lfoScale || 1,
    };
    sound.currentClip = clip || null;
    sound.currentSeed = seed;
    sound.currentProfile = key;
    sound.currentPerspective = perspective;
    lastPerspective = perspective;
    applyAmbientProfile(profile, 1.6, seed, instant);
  }
  const AMBIENT_PROFILES = {
    fire: {
      root: 55, intervals: [1, 1.5, 2, 3.02], cutoff: 1100, q: 0.8,
      voiceGains: [0.030, 0.018, 0.012, 0.008], pans: [-0.25, 0.35, -0.55, 0.6],
      noiseType: 'bandpass', noiseHighpass: 180, noiseLowpass: 1600, noiseQ: 1.1, noiseGain: 0.014,
      wind: 0.10, windDepth: 300, sparkle: 0.018, delay: 0.18, delayMix: 0.10, delayFeedback: 0.18, reverb: 0.06,
    },
    water: {
      root: 46.25, intervals: [1, 1.5, 2, 3], cutoff: 620, q: 0.7,
      voiceGains: [0.028, 0.020, 0.016, 0.010], pans: [-0.4, 0.4, -0.15, 0.15],
      noiseType: 'lowpass', noiseHighpass: 70, noiseLowpass: 1100, noiseQ: 0.5, noiseGain: 0.020,
      wind: 0.05, windDepth: 150, sparkle: 0, delay: 0.26, delayMix: 0.08, delayFeedback: 0.16, reverb: 0.18,
    },
    fog: {
      root: 42, intervals: [1, 1.33, 1.5, 2], cutoff: 520, q: 1.0,
      voiceGains: [0.026, 0.018, 0.012, 0.008], pans: [-0.2, 0.2, -0.35, 0.35],
      noiseType: 'lowpass', noiseHighpass: 100, noiseLowpass: 600, noiseQ: 0.7, noiseGain: 0.025,
      wind: 0.04, windDepth: 100, sparkle: 0, delay: 0.3, delayMix: 0.06, delayFeedback: 0.12, reverb: 0.20,
    },
    space: {
      root: 110, intervals: [1, 1.5, 2, 2.997], cutoff: 9000, q: 0.4,
      voiceGains: [0.022, 0.015, 0.012, 0.008], pans: [-0.7, 0.7, -0.45, 0.45],
      noiseType: 'bandpass', noiseHighpass: 300, noiseLowpass: 7000, noiseQ: 0.5, noiseGain: 0.008,
      wind: 0.02, windDepth: 500, sparkle: 0.006, delay: 0.42, delayMix: 0.22, delayFeedback: 0.28, reverb: 0.35,
    },
    road: {
      root: 48, intervals: [1, 1.5, 2, 2.01], cutoff: 230, q: 0.6,
      voiceGains: [0.022, 0.014, 0.008, 0.006], pans: [-0.55, 0.55, -0.25, 0.25],
      noiseType: 'lowpass', noiseHighpass: 80, noiseLowpass: 280, noiseQ: 0.7, noiseGain: 0.024,
      wind: 0.035, windDepth: 90, sparkle: 0, delay: 0.3, delayMix: 0.10, delayFeedback: 0.14, reverb: 0.08,
    },
    city: {
      root: 55, intervals: [1, 1.33, 2, 2.5], cutoff: 190, q: 0.8,
      voiceGains: [0.020, 0.012, 0.007, 0.005], pans: [-0.35, 0.35, -0.6, 0.6],
      noiseType: 'lowpass', noiseHighpass: 70, noiseLowpass: 240, noiseQ: 0.6, noiseGain: 0.020,
      wind: 0.025, windDepth: 70, sparkle: 0, delay: 0.36, delayMix: 0.08, delayFeedback: 0.16, reverb: 0.24,
    },
    people: {
      root: 65, intervals: [1, 1.5, 2, 3], cutoff: 330, q: 1.2,
      voiceGains: [0.017, 0.010, 0.006, 0.004], pans: [-0.25, 0.25, -0.5, 0.5],
      noiseType: 'bandpass', noiseHighpass: 140, noiseLowpass: 520, noiseQ: 1.3, noiseGain: 0.014,
      wind: 0.02, windDepth: 80, sparkle: 0, delay: 0.32, delayMix: 0.06, delayFeedback: 0.12, reverb: 0.30,
    },
    rain: {
      root: 42, intervals: [1, 1.25, 1.5, 2], cutoff: 780, q: 0.9,
      voiceGains: [0.018, 0.012, 0.008, 0.005], pans: [-0.45, 0.45, -0.2, 0.2],
      noiseType: 'bandpass', noiseHighpass: 420, noiseLowpass: 2600, noiseQ: 0.8, noiseGain: 0.022,
      wind: 0.05, windDepth: 220, sparkle: 0.006, delay: 0.18, delayMix: 0.05, delayFeedback: 0.1, reverb: 0.12,
    },
  };
  const PERSPECTIVE_RECIPES = {
    water: {
      A: { cutoff: 150, voiceScale: 1.10, panScale: 0.55, noiseGainScale: 1.05, lfoScale: 0.55, delayMix: 0.05, reverb: 0.25 },
      B: { cutoff: 420, noiseType: 'bandpass', noiseLowpass: 900, noiseHighpass: 240, noiseQ: 1.1, noiseGainScale: 1.30, voiceScale: 0.78, panScale: 1.30, lfoScale: 1.8, delayMix: 0.04, reverb: 0.12 },
      C: { cutoff: 760, noiseType: 'bandpass', noiseLowpass: 1200, noiseHighpass: 260, noiseQ: 1.5, noiseGainScale: 0.45, voiceScale: 0.55, panScale: 0.8, lfoScale: 0.35, delayMix: 0.16, delayFeedback: 0.34, reverb: 0.42, sparkle: 0.010 },
      D: { cutoff: 480, voiceScale: 1.18, panScale: 1.45, noiseGainScale: 1.45, lfoScale: 0.28, delayMix: 0.08, reverb: 0.26 },
    },
    rain: {
      A: { cutoff: 520, noiseType: 'lowpass', noiseLowpass: 1600, noiseHighpass: 240, noiseGainScale: 1.2, voiceScale: 0.75, panScale: 0.8, lfoScale: 0.6, delayMix: 0.06, reverb: 0.2 },
      B: { cutoff: 1200, noiseType: 'bandpass', noiseLowpass: 3200, noiseHighpass: 700, noiseQ: 1.4, noiseGainScale: 0.9, voiceScale: 0.55, panScale: 1.2, lfoScale: 1.6, delayMix: 0.05, reverb: 0.16 },
      C: { cutoff: 360, noiseType: 'lowpass', noiseLowpass: 900, noiseHighpass: 180, noiseGainScale: 1.0, voiceScale: 0.7, panScale: 0.6, lfoScale: 0.4, delayMix: 0.10, reverb: 0.3 },
      D: { cutoff: 2200, noiseType: 'bandpass', noiseLowpass: 3600, noiseHighpass: 500, noiseQ: 0.9, noiseGainScale: 1.45, voiceScale: 0.6, panScale: 1.4, lfoScale: 2.1, delayMix: 0.04, reverb: 0.10 },
    },
    fire: {
      A: { cutoff: 650, voiceScale: 1.15, panScale: 0.7, noiseGainScale: 0.8, sparkle: 0.006, lfoScale: 0.6, delayMix: 0.06, reverb: 0.12 },
      B: { cutoff: 1800, noiseType: 'bandpass', noiseLowpass: 2400, noiseHighpass: 420, noiseQ: 1.6, noiseGainScale: 1.4, voiceScale: 0.8, panScale: 1.3, sparkle: 0.030, lfoScale: 1.4, delayMix: 0.04, reverb: 0.08 },
      C: { cutoff: 360, noiseType: 'lowpass', noiseLowpass: 900, noiseHighpass: 160, noiseGainScale: 0.7, voiceScale: 0.65, panScale: 0.5, sparkle: 0.008, lfoScale: 0.4, delayMix: 0.10, reverb: 0.30 },
      D: { cutoff: 1100, voiceScale: 1.2, panScale: 1.0, noiseGainScale: 1.0, sparkle: 0.020, lfoScale: 1.0, delayMix: 0.03, reverb: 0.10 },
    },
    fog: {
      A: { cutoff: 400, voiceScale: 1.1, panScale: 0.6, noiseGainScale: 1.35, lfoScale: 0.45, delayMix: 0.04, reverb: 0.24 },
      B: { cutoff: 620, noiseType: 'bandpass', noiseLowpass: 1200, noiseHighpass: 280, noiseQ: 0.9, noiseGainScale: 1.2, voiceScale: 0.85, panScale: 1.4, lfoScale: 1.5, delayMix: 0.04, reverb: 0.12 },
      C: { cutoff: 260, noiseType: 'lowpass', noiseLowpass: 420, noiseHighpass: 90, noiseGainScale: 0.55, voiceScale: 0.65, panScale: 0.4, lfoScale: 0.25, delayMix: 0.14, reverb: 0.45 },
      D: { cutoff: 540, noiseType: 'lowpass', noiseLowpass: 820, noiseHighpass: 150, noiseGainScale: 1.5, voiceScale: 1.0, panScale: 1.6, lfoScale: 0.8, delayMix: 0.06, reverb: 0.28 },
    },
    people: {
      A: { cutoff: 300, noiseType: 'bandpass', noiseLowpass: 520, noiseHighpass: 140, noiseQ: 1.3, noiseGainScale: 1.0, voiceScale: 0.8, panScale: 0.5, lfoScale: 0.4, delayMix: 0.06, reverb: 0.36 },
      B: { cutoff: 460, noiseType: 'bandpass', noiseLowpass: 780, noiseHighpass: 220, noiseQ: 1.0, noiseGainScale: 1.25, voiceScale: 0.65, panScale: 1.5, lfoScale: 1.2, delayMix: 0.04, reverb: 0.28 },
      C: { cutoff: 260, noiseType: 'lowpass', noiseLowpass: 420, noiseHighpass: 100, noiseGainScale: 0.6, voiceScale: 0.55, panScale: 0.4, lfoScale: 0.3, delayMix: 0.12, reverb: 0.48 },
      D: { cutoff: 620, noiseType: 'bandpass', noiseLowpass: 1000, noiseHighpass: 260, noiseQ: 0.8, noiseGainScale: 1.4, voiceScale: 0.75, panScale: 1.7, lfoScale: 1.8, delayMix: 0.03, reverb: 0.22 },
    },
    road: {
      A: { cutoff: 140, voiceScale: 1.15, panScale: 0.5, noiseGainScale: 1.2, lfoScale: 0.35, delayMix: 0.06, reverb: 0.14 },
      B: { cutoff: 260, noiseType: 'bandpass', noiseLowpass: 700, noiseHighpass: 100, noiseQ: 0.8, noiseGainScale: 1.25, voiceScale: 0.75, panScale: 1.8, lfoScale: 0.7, delayMix: 0.05, reverb: 0.10 },
      C: { cutoff: 320, noiseType: 'lowpass', noiseLowpass: 760, noiseHighpass: 120, noiseGainScale: 1.35, voiceScale: 0.85, panScale: 1.2, lfoScale: 1.3, delayMix: 0.04, reverb: 0.18 },
      D: { cutoff: 180, voiceScale: 1.0, panScale: 0.7, noiseGainScale: 0.8, lfoScale: 0.25, delayMix: 0.2, delayFeedback: 0.4, reverb: 0.5 },
    },
    city: {
      A: { cutoff: 140, voiceScale: 1.1, panScale: 0.6, noiseGainScale: 1.2, lfoScale: 0.4, delayMix: 0.05, reverb: 0.3 },
      B: { cutoff: 260, noiseType: 'bandpass', noiseLowpass: 700, noiseHighpass: 100, noiseQ: 0.9, noiseGainScale: 1.1, voiceScale: 0.8, panScale: 1.7, lfoScale: 0.8, delayMix: 0.06, reverb: 0.14 },
      C: { cutoff: 220, noiseType: 'lowpass', noiseLowpass: 620, noiseHighpass: 90, noiseGainScale: 1.3, voiceScale: 0.75, panScale: 1.1, lfoScale: 0.5, delayMix: 0.04, reverb: 0.24 },
      D: { cutoff: 150, voiceScale: 1.0, panScale: 0.5, noiseGainScale: 0.7, lfoScale: 0.3, delayMix: 0.22, delayFeedback: 0.45, reverb: 0.58 },
    },
    space: {
      A: { cutoff: 4200, voiceScale: 0.9, panScale: 1.1, noiseGainScale: 0.7, lfoScale: 0.4, delayMix: 0.18, reverb: 0.35 },
      B: { cutoff: 7600, noiseType: 'bandpass', noiseLowpass: 5200, noiseHighpass: 600, noiseQ: 0.7, noiseGainScale: 0.8, voiceScale: 0.8, panScale: 1.8, lfoScale: 0.9, delayMix: 0.24, reverb: 0.48 },
      C: { cutoff: 3000, voiceScale: 1.0, panScale: 0.7, noiseGainScale: 0.5, lfoScale: 0.3, delayMix: 0.35, delayFeedback: 0.42, reverb: 0.62 },
      D: { cutoff: 6000, noiseType: 'lowpass', noiseLowpass: 4200, noiseHighpass: 200, noiseGainScale: 0.6, voiceScale: 1.15, panScale: 1.5, lfoScale: 0.55, delayMix: 0.12, reverb: 0.38 },
    },
  };
  function createReverbImpulse(ctx, seconds = 2.2) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.4) * 0.34;
      }
    }
    return buffer;
  }
  function scheduleSparkle() {
    if (!sound || !sound.sparkleGain) return;
    window.clearTimeout(sound.sparkleTimer);
    const profile = AMBIENT_PROFILES[sound.currentProfile] || AMBIENT_PROFILES.fog;
    if (!profile.sparkle || sound.held) return;
    const wait = (sound.currentProfile === 'fire' ? 2200 : 3600) + Math.random() * 4200;
    sound.sparkleTimer = window.setTimeout(() => {
      if (!sound || !sound.sparkleGain || sound.held) return;
      const now = sound.ctx.currentTime;
      const gain = sound.sparkleGain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(0.0001, now);
      gain.linearRampToValueAtTime(profile.sparkle, now + 0.012);
      gain.linearRampToValueAtTime(0.0001, now + 0.22 + Math.random() * 0.18);
      scheduleSparkle();
    }, wait);
  }
  function applyAmbientProfile(profile, duration = 1.6, seed = 0, instant = false) {
    if (!sound || !sound.ambientFilter) return;
    const now = sound.ctx.currentTime;
    const at = instant ? now + 0.03 : now;
    const held = Boolean(sound.held);
    const random = seededRandom(seed || 1);
    const transparent = !held && sound.transparentUntil > Date.now();
    let cutoff = held ? Math.min(profile.cutoff, 360) : profile.cutoff;
    if (transparent) cutoff = Math.max(cutoff, 15000);
    const target = (param, value) => {
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      if (instant) param.setValueAtTime(value, at);
      else param.linearRampToValueAtTime(value, now + duration);
    };
    if (instant) {
      sound.master.gain.cancelScheduledValues(now);
      sound.master.gain.setValueAtTime(sound.master.gain.value, now);
      sound.master.gain.linearRampToValueAtTime(0.0001, now + 0.025);
      sound.master.gain.setValueAtTime(0.0001, at);
      sound.master.gain.linearRampToValueAtTime(held ? 0.52 : 0.68, now + 0.1);
    }
    target(sound.ambientFilter.frequency, cutoff);
    target(sound.ambientFilter.Q, profile.q);
    sound.voices.forEach((voice, index) => {
      const frequency = profile.root * profile.intervals[index % profile.intervals.length];
      target(voice.osc.frequency, frequency);
      target(voice.osc.detune, -6 + random() * 12);
      const level = (profile.voiceGains[index % profile.voiceGains.length] || 0.008) * (held ? 0.82 : 1);
      target(voice.gain.gain, level);
      if (voice.panner) {
        const pan = (profile.pans[index % profile.pans.length] || 0) * (held ? 0.55 : 1);
        target(voice.panner.pan, pan);
      }
      if (voice.lfo) target(voice.lfo.frequency, (0.024 + index * 0.012 + random() * 0.025) * (profile.lfoScale || 1));
      if (voice.panLfo) target(voice.panLfo.frequency, 0.018 + index * 0.009 + random() * 0.02);
    });
    target(sound.noiseCut.frequency, profile.noiseHighpass);
    sound.noiseTone.type = profile.noiseType;
    target(sound.noiseTone.frequency, held ? Math.min(profile.noiseLowpass, 700) : profile.noiseLowpass);
    target(sound.noiseTone.Q, profile.noiseQ);
    target(sound.noiseGain.gain, profile.noiseGain * (held ? 0.45 : 1));
    target(sound.windDepth.gain, profile.windDepth);
    if (sound.delay) {
      target(sound.delay.delayTime, profile.delay);
      target(sound.delayWet.gain, profile.delayMix);
      target(sound.delayFeedback.gain, profile.delayFeedback);
    }
    if (sound.reverbWet) target(sound.reverbWet.gain, profile.reverb);
    if (sound.sparkleGain) {
      if (profile.sparkle && !held) scheduleSparkle();
      else {
        window.clearTimeout(sound.sparkleTimer);
        target(sound.sparkleGain.gain, 0.0001);
      }
    }
  }
  function setElementalNoise(element = currentOpticElement) {
    if (element) currentOpticElement = element;
    if (!sound) return;
    if (!sound.currentClip) applySoundForClip(null, false);
  }
  function setStageOvertone(stageId) {
    if (SCREEN_TIER === 'low') {
      if (sound && sound.overtoneGain) sound.overtoneGain.gain.value = 0;
      return;
    }
    if (!sound || !sound.overtone) return;
    const frequencies = [110, 146.83, 174.61, 196];
    const frequency = frequencies[Math.max(0, Math.min(3, Number(stageId) - 1))];
    const now = sound.ctx.currentTime;
    sound.overtone.frequency.cancelScheduledValues(now);
    sound.overtone.frequency.setValueAtTime(sound.overtone.frequency.value, now);
    sound.overtone.frequency.linearRampToValueAtTime(frequency, now + 1.2);
    sound.overtoneGain.gain.linearRampToValueAtTime(0.008, now + 1.2);
  }
  function setStageSubBass(stageId) {
    if (!sound || !sound.subBassGain) return;
    const stage = Number(stageId) || 1;
    if (SCREEN_TIER === 'low') {
      sound.subBassGain.gain.cancelScheduledValues(sound.ctx.currentTime);
      sound.subBassGain.gain.linearRampToValueAtTime(0, sound.ctx.currentTime + 0.2);
      return;
    }
    const frequency = stage === 1 ? 38 : stage === 2 ? 44 : stage === 3 ? 50 : 56;
    const gain = stage === 1 ? 0.010 : stage === 2 ? 0.014 : stage === 3 ? 0.017 : 0.021;
    const now = sound.ctx.currentTime;
    sound.subBass.frequency.cancelScheduledValues(now);
    sound.subBass.frequency.setValueAtTime(sound.subBass.frequency.value, now);
    sound.subBass.frequency.linearRampToValueAtTime(frequency, now + 2.4);
    sound.subBassGain.gain.cancelScheduledValues(now);
    sound.subBassGain.gain.setValueAtTime(sound.subBassGain.gain.value, now);
    sound.subBassGain.gain.linearRampToValueAtTime(gain, now + 2.4);
  }
  function activateAudioSession() {
    if (navigator.audioSession) {
      try { navigator.audioSession.type = 'playback'; } catch (_) {}
    }
  }
  function primeAudioGesture() {
    activateAudioSession();
    if (!sound) {
      if (nativeTrack && nativeTrack.paused) {
        nativeTrack.volume = Math.max(nativeTrack.volume, MUSIC_GAIN);
        const promise = nativeTrack.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      }
      return;
    }
    if (sound.ctx.state === 'suspended') sound.ctx.resume().catch(() => {});
    const channel = sound.activeTrackId ? sound.channels.get(sound.activeTrackId) : null;
    if (channel && channel.audio.paused) {
      channel.audio.volume = Math.max(channel.audio.volume, MUSIC_GAIN);
      const promise = channel.audio.play();
      if (promise && typeof promise.catch === 'function') promise.catch(() => {});
    }
  }
  function disposeNativeAudio(audio) {
    if (!audio) return;
    try { audio.pause(); } catch (_) {}
    try { audio.removeAttribute('src'); audio.load(); } catch (_) {}
    try { audio.remove(); } catch (_) {}
    for (const [id, item] of [...trackAudio]) {
      if (item === audio) trackAudio.delete(id);
    }
  }
  function playNativeTrack(track) {
    if (!track || track.failed) {
      if (nativeTrack) {
        const previous = nativeTrack;
        nativeTrack = null;
        fadeChannelVolume({ audio: previous }, 0, 600);
        window.setTimeout(() => {
          if (nativeTrack !== previous) disposeNativeAudio(previous);
        }, 650);
      }
      return;
    }
    const audio = trackAudio.get(track.id) || createTrackAudio(track);
    if (!audio) return;
    if (nativeTrack === audio && !audio.paused) return;
    const previous = nativeTrack;
    if (previous && previous !== audio) {
      fadeChannelVolume({ audio: previous }, 0, 650);
      window.setTimeout(() => {
        if (nativeTrack !== previous) disposeNativeAudio(previous);
      }, 700);
    }
    nativeTrack = audio;
    audio.volume = 0;
    const promise = audio.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
    fadeChannelVolume({ audio }, MUSIC_GAIN, 700);
  }

  function enableSoundscape() {
    activateAudioSession();
    if (sound) {
      if (sound.ctx.state === 'suspended') sound.ctx.resume().catch(() => {});
      return;
    }
    if (soundStarting) return;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    soundStarting = true;
    try {
      const ctx = SCREEN_TIER === 'low' ? new AudioCtor({ latencyHint: 'playback' }) : new AudioCtor();
      const bus = ctx.createGain();
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
      master.gain.value = 0.68;
      const safetyCompressor = ctx.createDynamicsCompressor();
      safetyCompressor.threshold.value = -12;
      safetyCompressor.knee.value = 12;
      safetyCompressor.ratio.value = 4;
      safetyCompressor.attack.value = 0.004;
      safetyCompressor.release.value = 0.25;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2;
      limiter.knee.value = 2;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      bus.connect(rumbleCut);
      rumbleCut.connect(depth);
      depth.connect(breath);
      breath.connect(compressor);
      compressor.connect(breathPulse);
      breathPulse.connect(master);
      master.connect(safetyCompressor);
      safetyCompressor.connect(limiter);
      limiter.connect(ctx.destination);
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
      const overtone = ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.value = 110;
      const overtoneGain = ctx.createGain();
      overtoneGain.gain.value = 0.008;
      overtone.connect(overtoneGain);
      overtoneGain.connect(bus);
      overtone.start();
      const subBass = ctx.createOscillator();
      subBass.type = 'triangle';
      subBass.frequency.value = 42;
      const subBassGain = ctx.createGain();
      subBassGain.gain.value = 0;
      subBass.connect(subBassGain);
      subBassGain.connect(master);
      subBass.start();
      sound = {
        ctx,
        bus,
        rumbleCut,
        depth,
        breath,
        breathPulse,
        master,
        safetyCompressor,
        limiter,
        noise,
        noiseCut,
        noiseTone,
        noiseGain,
        wind,
        windDepth,
        overtone,
        overtoneGain,
        subBass,
        subBassGain,
        elementalGain: NOISE_GAIN,
        bank: soundBank,
        channels: new Map(),
        activeTrackId: null,
        activeTrack: null,
        activeType: null,
        held: false,
        fadeToken: 0,
      };
      try { noise.stop(); wind.stop(); overtone.stop(); subBass.stop(); } catch (_) {}
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      sound.activeType = 'music';
      setStageOvertone(sessionStage);
      setStageSubBass(sessionStage);
    } catch (_) {
    } finally {
      soundStarting = false;
    }
  }
  function tuneGenerativeScene(track, fadeMs) {
    if (!sound) return;
    sound.activeType = 'generative';
    sound.activeTrack = track || null;
    applySoundForClip(activeClip() || currentSoundClip, true);
    if (!sound.driftTimer) scheduleAmbientDrift();
  }
  function startGenerativeAmbient() {
    if (!sound || sound.voices) return;
    const ctx = sound.ctx;
    const now = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 11000;
    filter.Q.value = 0.55;
    filter.connect(sound.bus);
    const delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.25;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.18;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.1;
    filter.connect(delay);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(sound.bus);
    const reverb = ctx.createConvolver();
    reverb.buffer = createReverbImpulse(ctx, 2.2);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.1;
    filter.connect(reverb);
    reverb.connect(reverbWet);
    reverbWet.connect(sound.bus);
    const sparkle = ctx.createBufferSource();
    sparkle.buffer = createPinkNoiseBuffer(ctx, 2);
    sparkle.loop = true;
    const sparkleFilter = ctx.createBiquadFilter();
    sparkleFilter.type = 'bandpass';
    sparkleFilter.frequency.value = 4200;
    sparkleFilter.Q.value = 6;
    const sparkleGain = ctx.createGain();
    sparkleGain.gain.value = 0.0001;
    sparkle.connect(sparkleFilter);
    sparkleFilter.connect(sparkleGain);
    sparkleGain.connect(sound.bus);
    sparkle.start(now);
    const count = SCREEN_TIER === 'low' ? 2 : 4;
    const roots = [55, 73.42, 82.41, 110];
    const levels = [0.024, 0.019, 0.016, 0.012];
    const voices = [];
    for (let index = 0; index < count; index += 1) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = roots[index];
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.035 + index * 0.017;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 1.2 + index * 0.35;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      let panLfo = null;
      let panDepth = null;
      if (panner) {
        panLfo = ctx.createOscillator();
        panLfo.frequency.value = 0.021 + index * 0.011;
        panDepth = ctx.createGain();
        panDepth.gain.value = 0.24;
        panLfo.connect(panDepth);
        panDepth.connect(panner.pan);
      }
      osc.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(filter);
      } else {
        gain.connect(filter);
      }
      osc.start(now);
      lfo.start(now);
      if (panLfo) panLfo.start(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(levels[index], now + 2.5 + index * 0.25);
      voices.push({ osc, gain, panner, lfo, panLfo });
    }
    sound.voices = voices;
    sound.ambientFilter = filter;
    sound.delay = delay;
    sound.delayFeedback = delayFeedback;
    sound.delayWet = delayWet;
    sound.reverb = reverb;
    sound.reverbWet = reverbWet;
    sound.sparkle = sparkle;
    sound.sparkleFilter = sparkleFilter;
    sound.sparkleGain = sparkleGain;
    sound.sparkleTimer = 0;
    sound.currentProfile = 'fog';
    sound.driftTimer = 0;
    scheduleAmbientDrift();
  }
  function scheduleAmbientDrift() {
    if (!sound || !sound.voices || !sound.voices.length) return;
    window.clearTimeout(sound.driftTimer);
    const wait = 10000 + Math.random() * 10000;
    sound.driftTimer = window.setTimeout(() => {
      if (!sound) return;
      const now = sound.ctx.currentTime;
      const profile = AMBIENT_PROFILES[sound.currentProfile] || AMBIENT_PROFILES.fog;
      const voice = sound.voices[Math.floor(Math.random() * sound.voices.length)];
      const ratio = profile.intervals[Math.floor(Math.random() * profile.intervals.length)];
      const target = profile.root * ratio;
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, now);
      voice.osc.frequency.linearRampToValueAtTime(target, now + 4);
      if (voice.panner) {
        voice.panner.pan.cancelScheduledValues(now);
        voice.panner.pan.setValueAtTime(voice.panner.pan.value, now);
        voice.panner.pan.linearRampToValueAtTime((Math.random() * 2 - 1) * 0.7, now + 5);
      }
      if (sound.ambientFilter) {
        const cutoff = profile.cutoff * (0.88 + Math.random() * 0.24);
        sound.ambientFilter.frequency.cancelScheduledValues(now);
        sound.ambientFilter.frequency.setValueAtTime(sound.ambientFilter.frequency.value, now);
        sound.ambientFilter.frequency.linearRampToValueAtTime(cutoff, now + 3);
      }
      scheduleAmbientDrift();
    }, wait);
  }
  function stopAmbientDrift() {
    if (!sound) return;
    window.clearTimeout(sound.driftTimer);
    sound.driftTimer = 0;
  }
  function liveTracksForCategory(category) {
    return LIVE_AUDIO_TRACKS.filter((track) => track.category === category);
  }
  function chooseLiveTrack(clip) {
    const category = (clip && clip.soundCategory) || semanticSoundKey(clip);
    const candidates = liveTracksForCategory(category);
    if (!candidates.length) return null;
    const preferred = candidates.find((track) => track.id === (clip && clip.trackId));
    const free = candidates.filter((track) => !recentLiveTrackIds.includes(track.id));
    const chosen = (preferred && !recentLiveTrackIds.includes(preferred.id) ? preferred : null)
      || free[0]
      || preferred
      || candidates[0];
    if (!chosen) return null;
    recentLiveTrackIds.push(chosen.id);
    if (recentLiveTrackIds.length > 12) recentLiveTrackIds.shift();
    return chosen;
  }
  function applyLivePerspective(channel, clip) {
    if (!sound || !channel) return;
    const category = (clip && clip.soundCategory) || semanticSoundKey(clip);
    const recipes = PERSPECTIVE_RECIPES[category] || PERSPECTIVE_RECIPES.fog;
    const letters = Object.keys(recipes).filter((letter) => letter !== lastPerspective);
    const seed = soundSeedForClip(clip);
    const perspective = letters[seed % letters.length] || Object.keys(recipes)[0];
    const recipe = recipes[perspective];
    lastPerspective = perspective;
    sound.currentPerspective = perspective;
    const now = sound.ctx.currentTime;
    const cutoff = recipe.cutoff || 800;
    sound.depth.frequency.cancelScheduledValues(now);
    sound.depth.frequency.setValueAtTime(sound.depth.frequency.value, now);
    sound.depth.frequency.linearRampToValueAtTime(cutoff, now + 0.03);
    if (channel.audio._graphPanner) {
      const pan = (recipe.panScale || 1) * ((seed % 100) / 100 * 2 - 1) * 0.55;
      channel.audio._graphPanner.pan.cancelScheduledValues(now);
      channel.audio._graphPanner.pan.setValueAtTime(channel.audio._graphPanner.pan.value, now);
      channel.audio._graphPanner.pan.linearRampToValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), now + 0.03);
    }
    try {
      const duration = Number(channel.audio.duration) || 17;
      channel.audio.currentTime = (seed % Math.max(1, Math.floor(duration * 1000))) / 1000;
    } catch (_) {}
  }
  function switchSoundtrack(track, fadeMs) {
    if (!sound) return;
    const clip = activeClip() || currentSoundClip;
    const chosen = chooseLiveTrack(clip);
    if (!chosen) return;
    const channel = ensureTrackChannel(chosen);
    if (!channel) return;
    applyLivePerspective(channel, clip);
    const now = sound.ctx.currentTime;
    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setValueAtTime(sound.master.gain.value, now);
    sound.master.gain.linearRampToValueAtTime(0.0001, now + 0.025);
    sound.master.gain.setValueAtTime(0.0001, now + 0.03);
    sound.master.gain.linearRampToValueAtTime(0.68, now + 0.1);
    startSoundCrossfade(channel, 25);
  }
  function startSoundCrossfade(channel, fadeMs) {
    if (!sound) return;
    const duration = Math.max(25, fadeMs || SLOW_FADE_MS);
    const targetId = channel ? channel.track.id : null;
    const firstPlayback = !sound.activeTrackId;
    const fadeToken = ++sound.fadeToken;
    sound.activeTrackId = targetId;
    sound.activeTrack = channel ? channel.track : null;
    sound.activeType = channel ? 'music' : 'noise';
    if (channel && channel.track) {
      recentTrackIds.push(channel.track.id);
      recentTrackIds = recentTrackIds.slice(-18);
    }
    for (const [id, item] of [...sound.channels]) {
      if (channel && id === targetId) {
        item.audio.volume = 0;
        fadeChannelVolume(item, 0, duration);
      } else {
        fadeChannelVolume(item, 0, 25);
        window.setTimeout(() => {
          try {
            item.audio.pause();
            item.audio.volume = 0;
          } catch (_) {}
          disposeTrackChannel(item);
        }, 25);
      }
    }
    const now = sound.ctx.currentTime;
    sound.noiseGain.gain.cancelScheduledValues(now);
    sound.noiseGain.gain.setValueAtTime(sound.noiseGain.gain.value, now);
    sound.noiseGain.gain.linearRampToValueAtTime(
      channel ? 0 : (sound.noiseBaseGain || NOISE_GAIN),
      now + duration / 1000
    );
    if (channel) {
      channel.audio.playbackRate = 1;
      channel.audio.volume = 0;
      const begin = () => {
        if (!sound || fadeToken !== sound.fadeToken) return;
        const promise = channel.audio.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            if (!sound || sound.activeTrackId !== targetId) return;
            startSoundCrossfade(null, fadeMs);
          });
        }
        fadeChannelVolume(channel, MUSIC_GAIN, duration);
      };
      window.setTimeout(begin, 30);
    }
    window.setTimeout(() => {
      if (!sound || fadeToken !== sound.fadeToken) return;
      for (const [id, item] of [...sound.channels]) {
        if ((!channel || id !== targetId) && item.audio.volume < 0.01) {
          disposeTrackChannel(item);
        }
      }
    }, duration + 260);
  }
  function setSoundDepth(deep) {
    if (!sound) return;
    sound.held = deep;
    if (deep) sound.transparentUntil = 0;
    const now = sound.ctx.currentTime;
    const cutoff = deep ? 520 : 18000;
    sound.depth.frequency.cancelScheduledValues(now);
    sound.depth.frequency.setValueAtTime(sound.depth.frequency.value, now);
    sound.depth.frequency.exponentialRampToValueAtTime(cutoff, now + 0.45);
    if (sound.ambientFilter) {
      const profile = AMBIENT_PROFILES[sound.currentProfile] || AMBIENT_PROFILES.fog;
      const open = !deep && sound.transparentUntil > Date.now() ? 16000 : profile.cutoff;
      sound.ambientFilter.frequency.cancelScheduledValues(now);
      sound.ambientFilter.frequency.setValueAtTime(sound.ambientFilter.frequency.value, now);
      sound.ambientFilter.frequency.linearRampToValueAtTime(deep ? 520 : open, now + 0.6);
    }
    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setValueAtTime(sound.master.gain.value, now);
    sound.master.gain.linearRampToValueAtTime(deep ? 0.52 : 0.68, now + 0.4);
    for (const channel of sound.channels.values()) {
      channel.audio.playbackRate = 1;
      fadeChannelVolume(channel, deep ? MUSIC_GAIN * 0.45 : MUSIC_GAIN, 350);
    }
  }
  function setSoundTransparency(active) {
    if (!sound || !sound.ambientFilter) return;
    const now = sound.ctx.currentTime;
    sound.transparentUntil = active ? Date.now() + 1200 : 0;
    sound.ambientFilter.frequency.cancelScheduledValues(now);
    sound.ambientFilter.frequency.setValueAtTime(sound.ambientFilter.frequency.value, now);
    const profile = AMBIENT_PROFILES[sound.currentProfile] || AMBIENT_PROFILES.fog;
    sound.ambientFilter.frequency.linearRampToValueAtTime(active ? 16000 : profile.cutoff, now + 0.45);
  }
  function pauseSound() {
    if (!sound) {
      if (nativeTrack) nativeTrack.pause();
      return;
    }
    stopAmbientDrift();
    sound.ctx.suspend().catch(() => {});
    for (const channel of sound.channels.values()) {
      channel.audio.pause();
    }
  }
  function resumeSound() {
    if (!sound) {
      if (nativeTrack && nativeTrack.paused) nativeTrack.play().catch(() => {});
      return;
    }
    sound.ctx.resume().catch(() => {});
    if (sound.activeTrack) switchSoundtrack(sound.activeTrack, SLOW_FADE_MS);
  }
  let activeQuality = chooseQuality();
  function connectionSnapshot() {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const type = String((c && c.type) || '').toLowerCase();
    const effectiveType = String((c && c.effectiveType) || '').toLowerCase();
    const downlink = Number((c && c.downlink) || 0);
    const saveData = Boolean(c && c.saveData);
    const cellular = type === 'cellular' || (!type && /2g|3g|4g|5g/.test(effectiveType));
    const wifi = type === 'wifi' || type === 'ethernet';
    return { type, effectiveType, downlink, saveData, cellular, wifi };
  }
  function chooseQuality() {
    const n = connectionSnapshot();
    if (n.saveData) return '480';
    if (n.downlink > 0 && n.downlink < 2) return '480';
    if (n.effectiveType === 'slow-2g' || n.effectiveType === '2g' || n.effectiveType === '3g') return '480';
    if (n.effectiveType === '4g' || n.cellular) return '720';
    if (n.wifi || n.type === 'ethernet' || n.downlink >= 10) return '1080';
    if (n.downlink > 0 && n.downlink < 4) return '480';
    return '1080';
  }
  function sourceForClip(clip) {
    if (!clip) return '';
    const raw = (window.VIDEOS_DATA || []).find((item) => item && item.url === clip.url) || {};
    if (activeQuality === '480') return clip.url480 || raw.url480 || clip.url720 || raw.url720 || clip.url;
    if (activeQuality === '720') return clip.url720 || raw.url720 || clip.url480 || raw.url480 || clip.url;
    return clip.url;
  }
  function setQuality(force) {
    const next = chooseQuality();
    if (!force && next === activeQuality) return;
    activeQuality = next;
    const category = typeof activeCategory === 'function' ? activeCategory() : null;
    const clip = category && category.clips[category.activeIndex];
    if (!clip || !clip.el) return;
    const url = sourceForClip(clip);
    if (!url || clip.el.src === url) return;
    const time = clip.el.currentTime || 0;
    clip.playUrl = url;
    clip.el.src = url;
    if (clip.el.readyState === 0) clip.el.load();
    try { clip.el.currentTime = time; } catch (_) {}
    const promise = clip.el.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }
  function playbackUrl(url, clip) {
    return clip ? sourceForClip(clip) : url;
  }

  function nextClipIndex(category) {
    const clips = category.clips;
    if (!clips.length) return null;
    const available = (index) => {
      const clip = clips[index];
      return Boolean(clip) && !clip.invalid && (!clip.id || !isVideoSeen(clip.id));
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
    return null;
  }

  function playCategory(category) {
    if (!category || category.index !== state.index || !category.clips.length) return null;
    const index = nextClipIndex(category);
    if (index === null) return null;
    playClip(category, index);
    return index;
  }
  function contextAllowsClip(clip) {
    const text = `${clip.title || ''} ${clip.description || ''}`.toLowerCase();
    const darkContext = ['rain', 'fog', 'snow'].includes(envContext.weatherType)
      || ['evening', 'night'].includes(envContext.timeOfDay);
    if (darkContext && /\b(beach|tropical|palm|summer|flower|sunny|sunlight|golden)\b/.test(text)) return false;
    return true;
  }
  function pickStageClips(stage, count, picked, allowSeen = false) {
    const stageCategories = categories.filter((category) => stage.categories.includes(category.tag));
    const pools = stageCategories.map((category) => {
      const filtered = category.clips.filter((clip) => (
        Boolean(clip)
        && Boolean(clip.id)
        && !clip.invalid
        && !pathPicked.has(clip.id)
        && !picked.has(clip.id)
        && (allowSeen || !isVideoSeen(clip.id))
        && contextAllowsClip(clip)
      ));
      const ordered = shuffleArray(filtered).sort((a, b) => (b.envScore || 0) - (a.envScore || 0));
      return { category, clips: ordered };
    });
    const picks = [];
    let guard = 0;
    while (picks.length < count && guard < count * 4) {
      let added = false;
      for (const pool of pools) {
        if (picks.length >= count) break;
        const clip = pool.clips.shift();
        if (!clip) continue;
        picked.add(clip.id);
        picks.push({ stage: stage.id, category: pool.category, clip });
        added = true;
      }
      if (!added) break;
      guard += 1;
    }
    return picks;
  }
  function appendFallbackPath(allowSeen = false) {
    const entries = [];
    for (const stage of STAGES) {
      for (const tag of stage.categories) {
        const category = categories.find((item) => item.tag === tag);
        if (!category) continue;
        const clip = category.clips.find((item) => (
          item.id
          && !pathPicked.has(item.id)
          && (allowSeen || !isVideoSeen(item.id))
        ));
        if (!clip) continue;
        pathPicked.add(clip.id);
        entries.push({ stage: stage.id, category, clip });
      }
    }
    if (!entries.length) return false;
    pathPlan.push(...entries);
    return true;
  }
  function ensureFallbackCategories() {
    for (const category of categories) {
      if (category.clips.length) continue;
      const fallback = (FALLBACK_CLIPS[category.tag] || []).map((clip) => ({
        ...clip,
        description: clip.description || '',
        tags: Array.isArray(clip.tags) ? clip.tags : [],
        element: clip.element || elementForClip(clip.title, [], category.tag, ''),
      }));
      if (!fallback.length) continue;
      category.clips = fallback;
      mountClips(category);
    }
  }
  function forceNextAvailableScene(direction) {
    ensureFallbackCategories();
    const playable = categories.filter((category) => category.clips.length);
    if (!playable.length) {
      return false;
    }
    const current = activeCategory();
    const ordered = playable
      .filter((category) => category !== current)
      .concat(playable.includes(current) ? [current] : []);
    for (const category of ordered) {
      const clip = category.clips.find((item) => !item.invalid && !isVideoSeen(item.id))
        || category.clips.find((item) => !item.invalid);
      if (!clip) continue;
      navigateTo(
        category.index,
        direction,
        SLOW_FADE_MS,
        clip.id,
        {
          behavior: behaviorContext(),
          stage: STAGE_BY_CATEGORY[category.tag] || 1,
        }
      );
      return true;
    }
    return false;
  }
  function normalizeSessionKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }
  function sessionPlanIsUnique(entries) {
    const ids = new Set();
    const urls = new Set();
    const titles = new Set();
    for (const entry of entries) {
      const clip = entry && entry.clip;
      if (!clip) return false;
      const id = String(clip.id || '');
      const url = String(clip.url || '');
      const title = normalizeSessionKey(clip.title);
      if (!id || !url || !title) return false;
      if (ids.has(id) || urls.has(url) || titles.has(title)) return false;
      ids.add(id);
      urls.add(url);
      titles.add(title);
    }
    return true;
  }
  function buildSessionPlan() {
    resetViewedCycleIfComplete();
    pathPicked = new Set();
    const attempt = (allowSeen) => {
      const picked = new Set();
      const entries = [];
      for (let cycle = 0; cycle < 2; cycle += 1) {
        const cycleEntries = [];
        for (const spec of CYCLE_STAGES) {
          const stage = stageFor(spec.id);
          const picks = pickStageClips(stage, spec.count, picked, allowSeen);
          if (picks.length < spec.count) return null;
          cycleEntries.push(...picks);
        }
        if (cycleEntries.length !== CYCLE_LENGTH) return null;
        const last = cycleEntries[cycleEntries.length - 1];
        if (last && last.stage === 4 && !last.clip.is_finale) {
          const used = new Set(cycleEntries.map((entry) => entry.clip.id));
          const pathStage = stageFor(4);
          const pathCategories = categories.filter((category) => pathStage.categories.includes(category.tag));
          const final = pathCategories
            .flatMap((category) => category.clips.map((clip) => ({ category, clip })))
            .find(({ category, clip }) => (
              clip.is_finale
              && !clip.invalid
              && !used.has(clip.id)
              && !picked.has(clip.id)
              && (allowSeen || !isVideoSeen(clip.id))
            ));
          if (final) {
            last.clip = final.clip;
            last.category = final.category;
          }
        }
        for (const entry of cycleEntries) picked.add(entry.clip.id);
        entries.push(...cycleEntries);
      }
      return entries;
    };
    let entries = attempt(false);
    if (!entries || entries.length !== SESSION_LENGTH || !sessionPlanIsUnique(entries)) {
      allViewedVideoIds.clear();
      sessionUsedVideoIds.clear();
      persistAllViewedVideoIds();
      entries = attempt(false) || attempt(true);
    }
    if (!entries || entries.length !== SESSION_LENGTH || !sessionPlanIsUnique(entries)) return false;
    pathPlan = entries;
    pathPicked = new Set(entries.map((entry) => entry.clip.id));
    pathPos = -1;
    pathStarted = false;
    return true;
  }
  function updateSessionProgress() {
    if (!progressFill) return;
    const currentFrame = sessionComplete
      ? SESSION_LENGTH
      : Math.min(SESSION_LENGTH, Math.max(0, pathPos + 1));
    progressFill.style.width = `${(currentFrame / SESSION_LENGTH) * 100}%`;
  }
  function updateStageLabel(stageId) {
    sessionStage = stageId || sessionStage;
    setStageOvertone(sessionStage);
    setStageSubBass(sessionStage);
  }
  function trackStageReached(stageId) {
    const stage = Number(stageId);
    if (!stage || stage === lastTrackedStage) return;
    lastTrackedStage = stage;
    trackEvent('stage_reached', { stage });
  }
  function stopFinaleSessionVideo() {
    if (!finaleSessionVideo) return;
    try {
      finaleSessionVideo.pause();
      finaleSessionVideo.removeAttribute('src');
      finaleSessionVideo.load();
    } catch (_) {
    }
  }
  function syncFinaleSessionVideo() {
    if (!finaleSessionVideo) return;
    const anchorVideo = anchorClip && anchorClip.el;
    const activeVideo = document.querySelector('.slide.is-active video');
    const source = (anchorVideo && (anchorVideo.currentSrc || anchorVideo.getAttribute('src') || anchorVideo.src))
      || (anchorClip && anchorClip.url)
      || (activeVideo && (activeVideo.currentSrc || activeVideo.getAttribute('src') || activeVideo.src));
    if (!source) return;
    if (finaleSessionVideo.getAttribute('src') !== source) {
      finaleSessionVideo.src = source;
      finaleSessionVideo.load();
    }
    finaleSessionVideo.muted = true;
    const promise = finaleSessionVideo.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  }
  function hideCycleWhisper() {
    window.clearTimeout(cycleWhisperTimer);
    cycleWhisperTimer = 0;
    cycleWhisperUntil = 0;
    if (!cycleWhisperEl) return;
    cycleWhisperEl.classList.remove('is-visible');
    cycleWhisperEl.setAttribute('aria-hidden', 'true');
  }
  function showCycleWhisper(completedCycle) {
    if (!cycleWhisperEl) return;
    window.clearTimeout(cycleWhisperTimer);
    const key = completedCycle === 1 ? 'cycle1' : (completedCycle === 2 ? 'cycle2' : 'cycle3');
    if (cycleWhisperKickerEl) cycleWhisperKickerEl.textContent = tr('cycleKicker');
    if (cycleWhisperTextEl) cycleWhisperTextEl.textContent = tr(key);
    cycleWhisperUntil = Date.now() + 5000;
    cycleWhisperEl.setAttribute('aria-hidden', 'false');
    window.requestAnimationFrame(() => {
      if (cycleWhisperEl) cycleWhisperEl.classList.add('is-visible');
    });
    cycleWhisperTimer = window.setTimeout(() => {
      if (!cycleWhisperEl) return;
      cycleWhisperEl.classList.remove('is-visible');
      cycleWhisperEl.setAttribute('aria-hidden', 'true');
    }, 5000);
  }
  function beginSession() {
    window.clearTimeout(sessionFinalTimer);
    sessionFinalTimer = 0;
    sessionEvents = [];
    sessionStartedAt = now();
    sessionComplete = false;
    sessionStage = 1;
    sessionAccounted = 0;
    cycleNumber = 1;
    anchorClip = null;
    anchorHoldMs = 0;
    firstShadowDurations = [];
    shadowCompressed = false;
    cycleCaptionBlocked = false;
    hideCycleWhisper();
    captionStartDelayOverride = 0;
    lastSessionProgressAt = Date.now();
    userAvgWatchTime = 0;
    sessionTextFrames = 1;
    quietSinceText = 0;
    quietRequired = 1;
    fallbackCaptionUsed.clear();
    activeHapticStage = 0;
    lastTrackedStage = 0;
    lastHoldTrackedFrame = -1;
    if (notifyReturnButton) {
      notifyReturnButton.disabled = false;
      notifyReturnButton.textContent = tr('notify');
    }
    if (finaleEl) {
      finaleEl.hidden = true;
      finaleEl.classList.remove('is-visible');
      finaleEl.setAttribute('aria-hidden', 'true');
    }
    stopFinaleSessionVideo();
    stage.classList.remove('is-finalizing');
    updateStageLabel(1);
    updateSessionProgress();
  }
  function readSessionLock() {
    try {
      const value = Number(localStorage.getItem(SESSION_LOCK_KEY));
      return Number.isFinite(value) ? value : 0;
    } catch (_) {
      return 0;
    }
  }
  function writeSessionLock(value) {
    sessionLockAt = value;
    try {
      if (value) localStorage.setItem(SESSION_LOCK_KEY, String(value));
      else localStorage.removeItem(SESSION_LOCK_KEY);
    } catch (_) {
    }
  }
  function formatSessionCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  function updateSessionLockUI() {
    const remaining = sessionLockAt ? Math.max(0, sessionLockAt - Date.now()) : 0;
    const text = formatSessionCountdown(remaining);
    const showEntryLock = remaining > 0 && !gateOpen;
    if (finaleCountdownEl) finaleCountdownEl.textContent = text;
    if (entryLock) {
      entryLock.hidden = !showEntryLock;
      if (entryLockTime) entryLockTime.textContent = text;
      if (entryLockLight) entryLockLight.style.width = `${Math.max(0, Math.min(100, (remaining / SESSION_LOCK_MS) * 100))}%`;
      if (entryGate) entryGate.classList.toggle('is-locked', showEntryLock);
    }
    if (sessionLockAt && remaining <= 0) {
      returnAfterLock = true;
      writeSessionLock(0);
      window.clearInterval(lockTicker);
      lockTicker = 0;
    }
  }
  function startSessionLockTicker() {
    window.clearInterval(lockTicker);
    updateSessionLockUI();
    lockTicker = window.setInterval(updateSessionLockUI, 1000);
  }
  function setSessionLock() {
    writeSessionLock(Date.now() + SESSION_LOCK_MS);
    startSessionLockTicker();
  }
  function clearSessionLock() {
    writeSessionLock(0);
    if (lockTicker) {
      window.clearInterval(lockTicker);
      lockTicker = 0;
    }
    updateSessionLockUI();
  }
  function isSessionLocked() {
    return Boolean(sessionLockAt && sessionLockAt > Date.now());
  }
  function recordSessionEvent(record) {
    if (sessionComplete) return false;
    if (sessionEvents.length > pathPos) return false;
    const category = activeCategory();
    const clip = activeClip();
    if (!category || !clip) return false;
    const viewedMs = record && Number.isFinite(record.viewedMs)
      ? record.viewedMs
      : Math.max(0, Math.round(now() - state.viewStart));
    const heldMs = record && Number.isFinite(record.heldMs) ? record.heldMs : state.heldMs;
    const swipeSpeed = record && Number.isFinite(record.swipeSpeed) ? record.swipeSpeed : 0;
    const direction = record && record.swipeDirection ? record.swipeDirection : 'time';
    const counted = viewedMs >= 800 || (Date.now() - lastSessionProgressAt >= 1500);
    const early = userAvgWatchTime > 0
      ? viewedMs < userAvgWatchTime * EARLY_SWIPE_RATIO
      : viewedMs < FAST_VIEW_MS;
    if (counted) {
      sessionAccounted = Math.min(CYCLE_LENGTH, sessionAccounted + 1);
      lastSessionProgressAt = Date.now();
    }
    sessionEvents.push({
      frame: sessionEvents.length + 1,
      stage: sessionStage,
      archetype: stageFor(sessionStage).archetype,
      category: category.tag,
      title: clip.title || 'без названия',
      viewedMs: Math.round(viewedMs),
      heldMs: Math.round(heldMs),
      longestHoldMs: Math.round(record && record.longestHoldMs || state.longestHoldMs),
      swipeSpeed,
      direction,
      lingered: viewedMs >= CAPTION_LINGER_MS || heldMs > 0,
      held: heldMs >= 800,
      fast: viewedMs < FAST_VIEW_MS || swipeSpeed > 2.2,
      early,
      counted,
    });
    updateSessionProgress();
    return counted;
  }
  const FINALE_TIMEOUT_MS = 1500;


  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (_) {
      wakeLock = null;
    }
  }
  function releaseWakeLock() {
    if (!wakeLock) return;
    try { wakeLock.release(); } catch (_) {  }
    wakeLock = null;
  }
  function artifactArchiveNumber() {
    try {
      const stored = localStorage.getItem('sanctuary-artifact-code');
      if (stored && /^[0-9]{4}-[0-9A-Z]{2}$/.test(stored)) return stored;
    } catch (_) {}
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
    const code = `${digits}-${suffix}`;
    try { localStorage.setItem('sanctuary-artifact-code', code); } catch (_) {}
    return code;
  }
  function drawSessionArtifact() {
    if (!artifactCanvas || !finaleArtifact) return;
    const ctx = artifactCanvas.getContext('2d');
    if (!ctx) return;
    const W = artifactCanvas.width;
    const H = artifactCanvas.height;
    const archive = artifactArchiveNumber();
    const pace = Number(engine.averagePaceMs) || 0;
    const holds = Number(state.totalHolds) || 0;
    const heldMs = Number(state.heldMs) || 0;
    const hour = new Date().getHours();
    const seedSource = `${archive}|${pace}|${holds}|${heldMs}|${hour}|${artifactSalt}`;
    let seed = 0;
    for (let i = 0; i < seedSource.length; i += 1) seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const palettes = [
      { bg: '#ECE6DA', ink: '#1A1B1E', a: '#D8BC94', b: '#B8B2A6', c: '#6E8C89' },
      { bg: '#E7E2D6', ink: '#232528', a: '#B8B2A6', b: '#D8BC94', c: '#587673' },
      { bg: '#E4D8C3', ink: '#2A2523', a: '#C98E6A', b: '#8E6F62', c: '#5F7B78' },
      { bg: '#E9E4DC', ink: '#24262A', a: '#D8BC94', b: '#C9B9A4', c: '#7A9291' },
      { bg: '#DEDDD7', ink: '#202326', a: '#B8B2A6', b: '#8A9A96', c: '#D8BC94' },
      { bg: '#EFE8D9', ink: '#2B2824', a: '#C6A97D', b: '#7F9691', c: '#B8B2A6' },
    ];
    const palette = palettes[Math.floor(random() * palettes.length)];
    const composition = ['bird', 'grove', 'feather', 'branch', 'horizon', 'stone'][Math.floor(random() * 6)];
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);
    // Canvas grain.
    for (let i = 0; i < 10000; i += 1) {
      const alpha = 0.012 + random() * 0.045;
      ctx.fillStyle = random() > 0.45 ? `rgba(26, 27, 30, ${alpha * 0.55})` : `rgba(255, 250, 240, ${alpha})`;
      ctx.fillRect(random() * W, random() * H, 1 + random() * 2.4, 1 + random() * 2.4);
    }
    // Translucent pigment washes.
    const washes = 3 + Math.floor(random() * 3);
    for (let i = 0; i < washes; i += 1) {
      const color = [palette.a, palette.b, palette.c][Math.floor(random() * 3)];
      const x = W * (0.15 + random() * 0.7);
      const y = H * (0.12 + random() * 0.5);
      const r = W * (0.24 + random() * 0.34);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `${color}55`);
      g.addColorStop(0.55, `${color}22`);
      g.addColorStop(1, `${color}00`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // Scattered pigment and brush marks.
    for (let i = 0; i < 18; i += 1) {
      ctx.save();
      ctx.globalAlpha = 0.035 + random() * 0.08;
      ctx.strokeStyle = [palette.a, palette.b, palette.c][Math.floor(random() * 3)];
      ctx.lineWidth = 2 + random() * 12;
      ctx.beginPath();
      const x = random() * W;
      const y = random() * H;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (random() - 0.5) * 120, y + (random() - 0.5) * 60, x + (random() - 0.5) * 240, y + (random() - 0.5) * 140);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(W / 2, H * 0.48);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = palette.ink;
    ctx.strokeStyle = palette.ink;
    const bird = (x, y, scale, flip) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip ? -scale : scale, scale);
      ctx.rotate((random() - 0.5) * 0.24);
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.ellipse(26, 38, 100, 32, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.ellipse(0, 0, 92, 30, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-18, -2);
      ctx.quadraticCurveTo(52, -128, 166, -70);
      ctx.quadraticCurveTo(74, -40, 24, 20);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-12, 4);
      ctx.quadraticCurveTo(-80, -34, -128, -10);
      ctx.quadraticCurveTo(-68, 28, -16, 20);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.a;
      ctx.beginPath(); ctx.moveTo(92, 2); ctx.lineTo(126, 15); ctx.lineTo(90, 20); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    if (composition === 'bird') {
      bird(-20, -30, 1, false);
      if (random() > 0.2) bird(190, 130, 0.52, true);
    } else if (composition === 'grove') {
      const count = 2 + Math.floor(random() * 4);
      for (let i = 0; i < count; i += 1) {
        const x = -190 + i * (380 / Math.max(1, count - 1)) + (random() - 0.5) * 28;
        const lean = (random() - 0.5) * 48;
        ctx.strokeStyle = i % 2 ? `${palette.ink}AA` : `${palette.c}AA`;
        ctx.lineWidth = 1.5 + random() * 3;
        ctx.beginPath(); ctx.moveTo(x, 210); ctx.quadraticCurveTo(x + lean, -20, x + lean * 0.4, -230); ctx.stroke();
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = palette.a;
        ctx.beginPath(); ctx.ellipse(x + lean * 0.4, -220 + random() * 60, 44, 20, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9;
      }
      const g = ctx.createLinearGradient(0, 170, 0, 280);
      g.addColorStop(0, `${palette.a}30`); g.addColorStop(1, `${palette.a}00`);
      ctx.fillStyle = g; ctx.fillRect(-320, 170, 640, 110);
    } else if (composition === 'feather') {
      ctx.rotate(-0.5 + random() * 0.9);
      const fg = ctx.createLinearGradient(0, -230, 0, 190);
      fg.addColorStop(0, '#FFF8EC'); fg.addColorStop(0.65, palette.bg); fg.addColorStop(1, `${palette.a}88`);
      ctx.fillStyle = fg; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(0, -230); ctx.bezierCurveTo(90, -110, 98, 55, 0, 200); ctx.bezierCurveTo(-98, 55, -90, -110, 0, -230); ctx.fill();
      ctx.strokeStyle = `${palette.ink}80`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -210); ctx.quadraticCurveTo(8, 0, 0, 188); ctx.stroke();
      for (let i = -8; i <= 8; i += 1) {
        const y = i * 23;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(38, y - 16, 68, y - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(-38, y - 16, -68, y - 5); ctx.stroke();
      }
    } else if (composition === 'branch') {
      ctx.strokeStyle = `${palette.ink}AA`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-240, 80); ctx.bezierCurveTo(-80, -60, 90, -110, 220, -210); ctx.stroke();
      for (let i = 0; i < 12; i += 1) {
        const t = random();
        const x = -240 + t * 460;
        const y = 80 - t * 290;
        ctx.globalAlpha = 0.16 + random() * 0.22;
        ctx.fillStyle = i % 2 ? palette.c : palette.a;
        ctx.beginPath(); ctx.ellipse(x + (random() - 0.5) * 50, y + (random() - 0.5) * 40, 8 + random() * 13, 4 + random() * 7, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 0.9;
    } else if (composition === 'horizon') {
      const water = ctx.createLinearGradient(0, 60, 0, 260);
      water.addColorStop(0, `${palette.c}55`); water.addColorStop(1, `${palette.c}12`);
      ctx.fillStyle = water; ctx.fillRect(-340, 60, 680, 230);
      ctx.strokeStyle = `${palette.ink}66`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-340, 60); ctx.lineTo(340, 60); ctx.stroke();
      if (random() > 0.4) {
        ctx.fillStyle = `${palette.ink}CC`;
        ctx.beginPath(); ctx.ellipse(90, 40, 54, 22, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const fog = ctx.createRadialGradient(0, 60, 10, 0, 60, 300);
      fog.addColorStop(0, `${palette.b}88`); fog.addColorStop(1, `${palette.b}00`);
      ctx.fillStyle = fog; ctx.fillRect(-340, -120, 680, 400);
      ctx.fillStyle = `${palette.ink}CC`;
      ctx.beginPath(); ctx.ellipse(-20, 40, 86, 48, -0.15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `${palette.a}33`;
      ctx.beginPath(); ctx.ellipse(-30, 100, 150, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Only the archive number lives on the canvas.
    ctx.fillStyle = `${palette.ink}B8`;
    ctx.font = '300 22px "JetBrains Mono", monospace';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.textAlign = 'left';
    ctx.fillText(`ARCHIVE № ${archive}`, 74, 92);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.strokeStyle = `${palette.a}AA`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(74, 116); ctx.lineTo(144, 116); ctx.stroke();
    finaleArtifact.dataset.scenario = sessionScenario;
    finaleArtifact.dataset.composition = composition;
    artifactCanvas.dataset.archive = archive;
    finaleArtifact.hidden = false;
  }
  function artifactBlob() {
    return new Promise((resolve) => {
      if (!artifactCanvas) { resolve(null); return; }
      try { artifactCanvas.toBlob((blob) => resolve(blob), 'image/png'); }
      catch (_) { resolve(null); }
    });
  }
  async function copyGiftLink() {
    const link = 'https://yoursanctuary.ru/?gift=1';
    try {
      await navigator.clipboard.writeText(link);
      if (shareSilenceButton) {
        shareSilenceButton.textContent = tr('copied');
        window.setTimeout(() => { shareSilenceButton.textContent = tr('finaleGift'); }, 2200);
      }
    } catch (_) {}
  }
  async function shareSilence() {
    trackEvent('finale_action', { type: 'gift_share' });
    const url = 'https://yoursanctuary.ru/?gift=1';
    try {
      const blob = await artifactBlob();
      const file = blob ? new File([blob], 'sanctuary-quiet.png', { type: 'image/png' }) : null;
      const data = { title: tr('giftShareTitle'), text: tr('giftShareText'), url };
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) data.files = [file];
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') return;
    }
    await copyGiftLink();
  }
  let sessionScenario = 'grove';
  function chooseSessionScenario() {
    if (state.totalHolds > 0 || state.heldMs > 1200) return 'feather';
    if (engine.averagePaceMs && engine.averagePaceMs < 2200) return 'bird';
    return 'grove';
  }
  let artifactSalt = '';
  function applyScenarioReflection() {
    sessionScenario = chooseSessionScenario();
    artifactSalt = Math.random().toString(36).slice(2, 10);
    const key = sessionScenario === 'feather' ? 'scenarioHold' : sessionScenario === 'bird' ? 'scenarioFast' : 'scenarioSteady';
    if (finaleReflectionEl) finaleReflectionEl.textContent = tr(key);
    if (finaleDoorNote) finaleDoorNote.textContent = tr('doorNote');
    if (finaleArtifact) finaleArtifact.dataset.scenario = sessionScenario;
    if (artifactCanvas) artifactCanvas.dataset.scenario = sessionScenario;
  }
  function openArtLightbox() {
    trackEvent('finale_action', { type: 'artwork_zoom' });
    if (!artifactCanvas || !artLightbox || !artLightboxImage) return;
    try {
      const url = artifactCanvas.toDataURL('image/png');
      artLightboxImage.src = url;
      if (artLightboxSave) artLightboxSave.href = url;
    } catch (_) {
      return;
    }
    artLightbox.hidden = false;
    window.requestAnimationFrame(() => artLightbox.classList.add('is-visible'));
  }
  function closeArtLightbox() {
    if (!artLightbox) return;
    artLightbox.classList.remove('is-visible');
    window.setTimeout(() => { artLightbox.hidden = true; }, 260);
  }
  function trackFrameMilestone() {
    const frame = pathPos + 1;
    if (![5, 15, 25, 30].includes(frame) || trackedMilestones.has(frame)) return;
    trackedMilestones.add(frame);
    trackEvent('frame_milestone', { frame });
  }

  function finishSession() {
    if (sessionComplete) return;
    window.clearTimeout(sessionFinalTimer);
    sessionFinalTimer = 0;
    sessionComplete = true;
    trackFrameMilestone();
    trackEvent('session_complete', { totalHolds: state.totalHolds, avgSwipeMs: Math.round(engine.averagePaceMs || 0) });
    try { localStorage.setItem(COMPLETED_KEY, '1'); } catch (_) {}
    stopHoldPulse();
    if (gesture) stopHold();
    clearFramePlaceholder();
    const category = activeCategory();
    if (category) pauseCategory(category);
    pauseSound();
    stage.classList.add('is-finalizing');
    releaseWakeLock();
    setSessionLock();
    updateSessionProgress();
    updateSessionLockUI();
    applyScenarioReflection();
    if (finaleEl) {
      finaleEl.hidden = false;
      finaleEl.setAttribute('aria-hidden', 'false');
      syncFinaleSessionVideo();
      window.requestAnimationFrame(() => {
        finaleEl.classList.add('is-visible');
        window.setTimeout(drawSessionArtifact, 260);
      });
    }
  }

  function scheduleReturnNotification(unlockAt) {
    const body = tr('notificationBody');
    const delay = Math.max(0, unlockAt - Date.now());
    window.clearTimeout(returnNotificationTimer);
    returnNotificationTimer = window.setTimeout(() => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        new Notification('Digital Sanctuary', {
          body,
          icon: './icon-192.png',
          tag: 'sanctuary-return',
        });
      } catch (_) {
      }
    }, delay);
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      const worker = registration.active || navigator.serviceWorker.controller;
      if (worker) {
        worker.postMessage({
          type: 'schedule-return',
          deliverAt: unlockAt,
          title: 'Digital Sanctuary',
          body,
        });
      }
    }).catch(() => {});
  }
  async function enableReturnNotification() {
    trackEvent('notify_enable');
    if (!('Notification' in window)) {
      if (notifyReturnButton) notifyReturnButton.textContent = tr('notifyUnavailable');
      return;
    }
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch (_) {
        permission = 'denied';
      }
    }
    if (permission !== 'granted') {
      if (notifyReturnButton) notifyReturnButton.textContent = tr('notifyOff');
      return;
    }
    const unlockAt = sessionLockAt || (Date.now() + SESSION_LOCK_MS);
    scheduleReturnNotification(unlockAt);
    if (notifyReturnButton) {
      notifyReturnButton.textContent = tr('notifySet');
      notifyReturnButton.disabled = true;
    }
  }
  function startNewSessionAfterUnlock() {
    clearSessionLock();
    if (returnAfterLock) {
      trackEvent('session_return');
      returnAfterLock = false;
    }
    window.clearTimeout(sessionFinalTimer);
    sessionFinalTimer = 0;
    sessionComplete = false;
    sessionEvents = [];
    sessionAccounted = 0;
    lastSessionProgressAt = Date.now();
    pathPlan = [];
    pathPicked = new Set();
    pathPos = -1;
    pathStarted = false;
    if (finaleEl) {
      finaleEl.hidden = true;
      finaleEl.classList.remove('is-visible');
      finaleEl.setAttribute('aria-hidden', 'true');
    }
    stopFinaleSessionVideo();
    stage.classList.remove('is-finalizing');
    if (!buildSessionPlan()) appendFallbackPath(true);
    if (!pathPlan.length) {
      gateOpen = false;
      if (entryGate) {
        entryGate.hidden = false;
        entryGate.classList.remove('is-open');
        entryGate.setAttribute('aria-hidden', 'false');
      }
      updateSessionLockUI();
      return;
    }
    gateOpen = true;
    if (!startPathFirst()) {
      gateOpen = false;
      if (entryGate) {
        entryGate.hidden = false;
        entryGate.classList.remove('is-open');
        entryGate.setAttribute('aria-hidden', 'false');
      }
      updateSessionLockUI();
    }
  }
  function attachLockSwipe(surface, onSwipe) {
    if (!surface) return;
    let start = null;
    let touchStart = null;
    surface.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1 || event.target.closest('button, a')) {
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    surface.addEventListener('touchend', (event) => {
      if (!touchStart) return;
      const touch = event.changedTouches && event.changedTouches[0];
      const origin = touchStart;
      touchStart = null;
      if (!touch) return;
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      if (dx > 75 && dx > Math.abs(dy) * 1.2) onSwipe();
    }, { passive: true });
    surface.addEventListener('touchcancel', () => {
      touchStart = null;
    }, { passive: true });
    surface.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'mouse' || event.target.closest('button, a')) {
        start = null;
        return;
      }
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }, { passive: true });
    surface.addEventListener('pointerup', (event) => {
      if (!start || event.pointerId !== start.id || event.pointerType !== 'mouse') {
        start = null;
        return;
      }
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (dx > 75 && dx > Math.abs(dy) * 1.2) onSwipe();
    });
    surface.addEventListener('pointercancel', () => {
      start = null;
    });
  }
  function makeCycleEntries(allowSeen) {
    const picked = new Set(pathPicked);
    const entries = [];
    for (const spec of CYCLE_STAGES) {
      const stage = stageFor(spec.id);
      const picks = pickStageClips(stage, spec.count, picked, allowSeen);
      if (picks.length < spec.count) return null;
      entries.push(...picks);
    }
    if (entries.length !== CYCLE_LENGTH) return null;
    const last = entries[entries.length - 1];
    if (last && last.stage === 4 && !last.clip.is_finale) {
      const used = new Set(entries.map((entry) => entry.clip.id));
      const pathStage = stageFor(4);
      const pathCategories = categories.filter((category) => pathStage.categories.includes(category.tag));
      const final = pathCategories
        .flatMap((category) => category.clips.map((clip) => ({ category, clip })))
        .find(({ category, clip }) => (
          clip.is_finale
          && !clip.invalid
          && !used.has(clip.id)
          && !pathPicked.has(clip.id)
          && (allowSeen || !isVideoSeen(clip.id))
        ));
      if (final) {
        last.clip = final.clip;
        last.category = final.category;
      }
    }
    return entries;
  }
  function extendPathPlan() {
    for (const allowSeen of [false, true]) {
      const entries = makeCycleEntries(allowSeen);
      if (!entries) continue;
      for (const entry of entries) pathPicked.add(entry.clip.id);
      pathPlan.push(...entries);
      return true;
    }
    pathPicked.clear();
    const entries = makeCycleEntries(true);
    if (!entries) return false;
    for (const entry of entries) pathPicked.add(entry.clip.id);
    pathPlan.push(...entries);
    return true;
  }
  function startPathFirst() {
    isTransitioning = false;
    if (pathStarted || !pathPlan.length) return false;
    beginSession();
    if (!sceneOrdinal) sceneOrdinal = 1;
    const entry = pathPlan[0];
    const category = entry.category;
    const index = category.clips.findIndex((clip) => clip.id === entry.clip.id);
    if (index < 0) return false;
    if (state.index !== category.index) {
      slides[state.index].classList.remove('is-active');
      category.el.classList.add('is-active');
      state.index = category.index;
      state.visits[category.index] += 1;
    }
    resetViewClock();
    if (isVideoSeen(entry.clip.id)) sessionUsedVideoIds.delete(entry.clip.id);
    category.freshIndex = index;
    preparePlaybackWindow(entry, pathPlan[1]);
    const clipIndex = playCategory(category);
    if (clipIndex === null) return false;
    pathPos = 0;
    pathStarted = true;
    pathStartPending = false;
    updateStageLabel(entry.stage);
    activeHapticStage = entry.stage;
    trackStageReached(entry.stage);
    updateSessionProgress();
    setSceneElement(activeClip());
    activateCaption(category, activeClip(), behaviorContext(), false, entry.stage);
    const track = nextTrackFor(category);
    switchSoundtrack(track, SLOW_FADE_MS);
    return true;
  }
  function attachVideo(category, clip, index) {
    const media = category.el.querySelector('.media');
    if (!media) return null;
    const video = document.createElement('video');
    const playUrl = playbackUrl(clip.url, clip);
    clip.playUrl = playUrl;
    video.className = 'clip';
    video.style.zIndex = '1';
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
    const markReady = () => {
      video.classList.add('is-ready');
      if (category.index === state.index && category.activeIndex === index) clearFramePlaceholder();
    };
    video.addEventListener('canplaythrough', markReady);
    video.addEventListener('playing', () => {
      if (video.readyState >= 4) markReady();
    });
    video.addEventListener('timeupdate', () => handleLoop(category, index, video));
    let fallbackCursor = 0;
    video.addEventListener('error', () => {
      const original = clip.url;
      if (original && video.src !== original) {
        video.classList.remove('is-ready');
        video.src = original;
        if (video.readyState < 1) video.load();
        const retry = video.play();
        if (retry && typeof retry.catch === 'function') retry.catch(() => {});
        return;
      }
      const alternatives = category.clips.filter((candidate) => (
        candidate !== clip && candidate.url && !candidate.invalid
      ));
      if (!alternatives.length) return;
      const replacement = alternatives[fallbackCursor % alternatives.length];
      fallbackCursor += 1;
      const nextUrl = replacement.playUrl || playbackUrl(replacement.url);
      const current = video.currentSrc || video.src || '';
      if (current === nextUrl && video.readyState >= 1) return;
      video.classList.remove('is-ready');
      video.src = nextUrl;
      if (video.readyState < 1) video.load();
      if (category.index === state.index && category.activeIndex === index) {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => {});
      }
    });
    video.src = playUrl;
    video.dataset.clipId = clip.id || '';
    clip.el = video;
    clip.lastTime = 0;
    media.appendChild(video);
    return video;
  }
  function mountClips(category) {
    const media = category.el.querySelector('.media');
    if (!media) return;
    category.clips.forEach((clip) => {
      if (clip.el) releaseClipVideo(clip);
      clip.el = null;
    });
    media.textContent = '';
  }
  function releaseClipVideo(clip) {
    if (!clip || !clip.el) return;
    const video = clip.el;
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    } catch (_) {
    }
    clip.el = null;
    clip.lastTime = 0;
  }
  function ensureClipVideo(category, clip) {
    if (!category || !clip) return null;
    if (clip.el) return clip.el;
    const index = category.clips.findIndex((item) => item.id === clip.id);
    if (index < 0) return null;
    return attachVideo(category, clip, index);
  }
  function prunePlaybackVideos(keepIds) {
    for (const category of categories) {
      for (const clip of category.clips) {
        if (clip.el && !keepIds.has(clip.id)) releaseClipVideo(clip);
      }
      const media = category.el.querySelector('.media');
      if (!media) continue;
      media.querySelectorAll('video').forEach((video) => {
        if (video.classList.contains('frame-placeholder')) return;
        if (!keepIds.has(video.dataset.clipId)) {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.remove();
          } catch (_) {
          }
        }
      });
    }
  }
  function preparePlaybackWindow(currentEntry, nextEntry) {
    const base = pathPos < 0 ? 0 : pathPos;
    const current = currentEntry || pathPlan[base];
    const next = nextEntry || pathPlan[base + 1];
    const keep = new Set();
    if (current && current.clip) {
      keep.add(current.clip.id);
      ensureClipVideo(current.category, current.clip);
      if (current.clip.el) {
        current.clip.el.preload = 'auto';
        if (current.clip.el.readyState === 0) current.clip.el.load();
      }
    }
    if (next && next.clip) {
      keep.add(next.clip.id);
      ensureClipVideo(next.category, next.clip);
      if (next.clip.el) {
        next.clip.el.preload = 'auto';
        if (next.clip.el.readyState === 0) next.clip.el.load();
      }
    }
    if (anchorClip && anchorClip.id) {
      keep.add(anchorClip.id);
      ensureClipVideo(activeCategory(), anchorClip);
    }
    prunePlaybackVideos(keep);
  }

  const CATALOG_STAGE_CATEGORIES = {
    shadow: ['Shadow'],
    trickster_abyss: ['Trickster', 'Abyss'],
    calm: ['Calm'],
    path: ['Path'],
  };
  function lightPriorityFor(title) {
    const text = String(title || '').toLowerCase();
    const bright = [
      'sun', 'sunrise', 'dawn', 'morning', 'light', 'bright', 'cloud', 'sky',
      'mist', 'fog', 'water', 'sea', 'ocean', 'horizon', 'bird', 'glow',
      'beam', 'reflection', 'moon', 'white', 'clear', 'open', 'field', 'snow',
    ];
    const dark = ['black', 'dark', 'night', 'cave', 'underground', 'shadow'];
    let score = 0;
    for (const word of bright) if (text.includes(word)) score += 1;
    for (const word of dark) if (text.includes(word)) score -= 0.7;
    return score;
  }
  async function loadVideoCatalog() {
    const embedded = Array.isArray(window.VIDEOS_DATA) && window.VIDEOS_DATA.length
      ? window.VIDEOS_DATA
      : null;
    const catalog = embedded;
    if (!Array.isArray(catalog) || !catalog.length) {
      throw new Error('videos-data.js is empty or malformed');
    }
    const pools = {
      Shadow: [],
      Trickster: [],
      Abyss: [],
      Calm: [],
      Path: [],
    };
    const usedIds = new Set();
    const usedUrls = new Set();
    const usedBaseKeys = new Set();
    const baseVideoKey = (value) => String(value || '').split('/').pop().split('?')[0]
      .replace(/^(shadow|trickster_abyss|calm|path)_\d+_/, '')
      .replace(/\.mp4$/, '');
    let tricksterFlip = 0;
    let loaded = 0;
    for (const item of catalog) {
      if (!item || typeof item.url !== 'string' || !/^https:\/\//i.test(item.url)) continue;
      if (usedUrls.has(item.url)) continue;
      if (BLOCKED_VIDEO_IDS.has(String(item.id || '')) || BLOCKED_VIDEO_IDS.has(String(item.fileHash || '')) || BLOCKED_VIDEO_IDS.has(String(item.url || ''))) continue;
      const baseKey = baseVideoKey(item.url);
      if (usedBaseKeys.has(baseKey)) continue;
      usedBaseKeys.add(baseKey);
      const itemSize = Number(item.size) || 0;
      const itemWidth = Number(item.width) || 0;
      const itemHeight = Number(item.height) || 0;
      const itemDuration = Number(item.duration) || 0;
      const itemBitrate = itemSize * 8 / Math.max(1, itemDuration);
      if (
        !itemSize || !itemWidth || !itemHeight
        || itemSize < 3_500_000
        || itemSize > 10_500_000
        || itemWidth !== 1080
        || itemHeight !== 1920
        || itemBitrate < 2_500_000
      ) continue;
      const rawStage = String(item.stage || '').toLowerCase().replace(/\s+/g, '_');
      const stageKey = rawStage === 'trickster' || rawStage === 'abyss'
        ? 'trickster_abyss'
        : rawStage;
      const tags = CATALOG_STAGE_CATEGORIES[stageKey];
      if (!tags) continue;
      const tag = tags.length > 1
        ? tags[tricksterFlip++ % tags.length]
        : tags[0];
      const category = categories.find((entry) => entry.tag === tag);
      if (!category) continue;
      const id = String(item.id || item.url);
      if (usedIds.has(id)) continue;
      usedIds.add(id);
      usedUrls.add(item.url);
      const title = String(item.title || 'Без названия').trim();
      const archetype = String(item.archetype || category.tag);
      const clip = {
        id,
        fileHash: String(item.fileHash || id),
        caption_ru: String(item.caption_ru || ''),
        caption_en: String(item.caption_en || ''),
        title,
        title_ru: String(item.title_ru || ''),
        url: item.url,
        url720: String(item.url720 || ''),
        url480: String(item.url480 || ''),
        duration: Number.isFinite(Number(item.duration)) ? Number(item.duration) : 10,
        description: archetype,
        tags: [stageKey, archetype],
        vertical: Boolean(item.vertical),
        is_finale: Boolean(item.is_finale),
        element: elementForClip(title, [stageKey, archetype], tag, archetype),
        archetype,
        stage: stageKey,
        soundCategory: String(item.soundCategory || ''),
        trackId: String(item.trackId || ''),
        source: item.source || 'catalog',
        width: itemWidth,
        height: itemHeight,
        size: itemSize,
        bitrate: itemBitrate,
        lightPriority: lightPriorityFor(title),
        envScore: environmentScoreFor(title, stageKey),
      };
      pools[tag].push(clip);
      loaded += 1;
    }
    if (!loaded) {
      throw new Error('videos-data.js contains no playable entries');
    }
    for (const category of categories) {
      category.clips = shuffleArray(pools[category.tag] || []).slice(0, CLIPS_PER_CATEGORY);
      category.activeIndex = 0;
      category.lastPlayed = null;
      category.freshIndex = null;
      mountClips(category);
    }
    catalogVideoIds = new Set();
    for (const category of categories) {
      for (const clip of category.clips) {
        if (clip && clip.id) catalogVideoIds.add(clip.id);
      }
    }
    resetViewedCycleIfComplete();
    return loaded;
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
  function playClip(category, index) {
    if (!category || category.index !== state.index) return;
    if (!gateOpen) return;
    const selected = category.clips[index];
    if (!selected) return;
    ensureClipVideo(category, selected);
    if (!selected.el) return;
    if (selected.id) markVideoViewed(selected.id);
    category.activeIndex = index;
    category.clips.forEach((clip, clipIndex) => {
      const video = clip.el;
      if (!video) return;
      if (clipIndex === index) {
        video.classList.add('is-current');
        video.preload = 'auto';
        if (video.readyState >= 4) clearFramePlaceholder();
        video.playbackRate = stage.classList.contains('is-held') ? SLOW_RATE : 1;
        clip.lastTime = video.currentTime;
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
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
  function rewardCategory(category, reason) {
    if (!category || engine.phase !== 'flow' || state.resonanceAwarded) return;
    state.resonanceAwarded = true;
    const nextWeight = Math.min(MAX_WEIGHT, (engine.weights[category.tag] || 1) + 1);
    engine.weights[category.tag] = nextWeight;
    engine.resonanceTotal += 1;
  }


  function fadeDurationFor(viewedMs, speed) {
    const impulsive = speed >= IMPULSIVE_SPEED;
    return viewedMs < QUICK_VIEW_MS || impulsive ? QUICK_FADE_MS : SLOW_FADE_MS;
  }
  let framePlaceholder = null;
  function clearFramePlaceholder() {
    if (!framePlaceholder) return;
    const ghost = framePlaceholder;
    framePlaceholder = null;
    ghost.style.opacity = '0';
    window.setTimeout(() => ghost.remove(), 450);
  }
  function showFramePlaceholder(fromVideo, targetCategory, targetClip) {
    clearFramePlaceholder();
    if (!fromVideo || !fromVideo.src || !targetCategory || !targetClip) return;
    const media = targetCategory.el && targetCategory.el.querySelector('.media');
    if (!media) return;
    try {
      const ghost = fromVideo.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.className = 'frame-placeholder';
      ghost.muted = true;
      ghost.pause();
      ghost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#070709;filter:blur(16px) brightness(.55) saturate(.8);transform:scale(1.06);opacity:1;pointer-events:none;z-index:0;transition:opacity .45s ease';
      try {
        const time = Number(fromVideo.currentTime) || 0;
        if (Number.isFinite(time)) ghost.currentTime = time;
      } catch (_) {}
      media.insertBefore(ghost, media.firstChild);
      framePlaceholder = ghost;
    } catch (_) {}
  }
  function showFrameAfterglow() {
    if (SCREEN_TIER !== 'high') return;
    if (!gateOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const video = document.querySelector('.slide.is-active video');
    if (!video || !video.src) return;
    try {
      const ghost = video.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.className = 'afterglow-video';
      ghost.muted = true;
      document.body.appendChild(ghost);
      try { ghost.pause(); } catch (_) {}
      try {
        const time = Number(video.currentTime) || 0;
        if (Number.isFinite(time)) ghost.currentTime = time;
      } catch (_) {}
      requestAnimationFrame(() => ghost.classList.add('is-visible'));
      window.setTimeout(() => ghost.remove(), 520);
    } catch (_) {}
  }
  function navigateTo(targetIndex, direction, fadeMs, forcedClipId, sceneContext) {
    if (targetIndex === null || targetIndex === undefined) return;
    if (!slides[targetIndex]) return;
    showFrameAfterglow();
    maybeRecordResonance();
    markInteraction();
    setBreath(0);
    stopOptics();
    window.clearTimeout(captionRevealTimer);
    const fromIndex = state.index;
    const from = slides[fromIndex];
    const to = slides[targetIndex];
    const fromVideo = from.querySelector('video.is-current') || from.querySelector('video');
    const duration = fadeMs || SLOW_FADE_MS;
    stage.style.setProperty('--fade-duration', `${duration}ms`);
    stage.classList.remove('is-held');
    stopHoldPulse();
    setActivePlaybackRate(1);
    setSoundDepth(false);
    pauseCategory(categories[fromIndex]);
    from.classList.remove('is-active');
    to.classList.add('is-active');
    state.index = targetIndex;
    state.visits[targetIndex] += 1;
    resetViewClock();
    if (!sceneOrdinal) sceneOrdinal = 1;
    sceneOrdinal += 1;
    const category = categories[targetIndex];
    const behavior = sceneContext && sceneContext.behavior
      ? sceneContext.behavior
      : behaviorContext();
    const allowed = captionAllowedForScene(sceneContext);
    const sceneStage = sceneContext && sceneContext.stage
      ? sceneContext.stage
      : (STAGE_BY_CATEGORY[category.tag] || 1);
    if (activeHapticStage !== sceneStage) {
      activeHapticStage = sceneStage;
      trackStageReached(sceneStage);
    }
    updateStageLabel(sceneStage);
    updateSessionProgress();
    if (forcedClipId) {
      const forcedIndex = category.clips.findIndex((clip) => clip.id === forcedClipId);
      if (forcedIndex >= 0) category.freshIndex = forcedIndex;
      if (isVideoSeen(forcedClipId)) sessionUsedVideoIds.delete(forcedClipId);
    }
    const planned = pathPlan[pathPos];
    if (!forcedClipId && planned && planned.category === category) {
      const plannedIndex = category.clips.findIndex((clip) => clip.id === planned.clip.id);
      if (plannedIndex >= 0) category.freshIndex = plannedIndex;
    }
    const targetClip = forcedClipId
      ? category.clips.find((clip) => clip.id === forcedClipId)
      : (planned && planned.category === category ? planned.clip : category.clips[category.activeIndex]);
    showFramePlaceholder(fromVideo, category, targetClip);
    preparePlaybackWindow(planned, pathPlan[pathPos + 1]);
    playCategory(category);
    setSceneElement(activeClip());
    activateCaption(category, activeClip(), behavior, allowed, sceneStage);
    const track = nextTrackFor(category);
    switchSoundtrack(track, duration);
    if (direction === 'up') {
      engine.history = engine.history.slice(0, engine.historyPos + 1);
      engine.history.push(targetIndex);
      engine.historyPos = engine.history.length - 1;
    }
  }
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
    return record;
  }
  function compressShadowCycle() {
    if (shadowCompressed || pathPos !== 1) return;
    const replacements = [];
    for (const tag of ['Calm', 'Path']) {
      const category = categoryByTag(tag);
      if (!category) continue;
      for (const clip of category.clips) {
        if (!clip || clip.invalid || pathPicked.has(clip.id)) continue;
        replacements.push({
          stage: STAGE_BY_CATEGORY[tag] || (tag === 'Calm' ? 3 : 4),
          category,
          clip,
        });
        if (replacements.length >= 3) break;
      }
      if (replacements.length >= 3) break;
    }
    if (replacements.length < 3) return;
    const removed = pathPlan.slice(2, 5);
    for (const entry of removed) pathPicked.delete(entry.clip.id);
    pathPlan.splice(2, 3, ...replacements);
    for (const entry of replacements) pathPicked.add(entry.clip.id);
    shadowCompressed = true;
  }
  function go(direction, speed) {
    if (!gateOpen || sessionComplete) return;
    safeVibrate(hapticPatternForCurrent().frame, SWIPE_HAPTIC_COOLDOWN_MS);
    if (sound && speed > 1.1) setSoundTransparency(true);
    hideCycleWhisper();
    lastSwipeAt = now();
    const record = reportSwipe(direction, speed);
    updateUserAverage(record.viewedMs);
    const behavior = behaviorContext(record);
    const sceneContext = sceneContextFor(record, behavior);
    if (state.nervousStreak >= 3) {
      triggerTricksterPrick();
      state.nervousStreak = 0;
    } else {
      state.nervousStreak = record.viewedMs < NERVOUS_VIEW_MS
        ? state.nervousStreak + 1
        : 0;
    }
    if (!pathStarted) {
      try {
        if (startPathFirst()) {
          return;
        }
      } catch (error) {
      }
      forceNextAvailableScene(direction);
      return;
    }
    recordSessionEvent(record);
    if (direction === 'down') {
      if (pathPos <= 0) return;
      pathPos -= 1;
      const previous = pathPlan[pathPos];
      if (!previous) return;
      sceneContext.stage = previous.stage;
      updateStageLabel(previous.stage);
      trackStageReached(previous.stage);
      preparePlaybackWindow(previous, pathPlan[pathPos + 1]);
      navigateTo(
        previous.category.index,
        'down',
        fadeDurationFor(record.viewedMs, speed),
        previous.clip.id,
        sceneContext
      );
      return;
    }
    if (pathPos < 2) firstShadowDurations.push(record.viewedMs);
    if (
      pathPos === 1
      && !shadowCompressed
      && firstShadowDurations.length === 2
      && firstShadowDurations.every((duration) => duration < 1500)
    ) {
      compressShadowCycle();
    }
    if (pathPos >= SESSION_LENGTH - 1) {
      finishSession();
      return;
    }
    const isCycleBoundary = (pathPos + 1) % CYCLE_LENGTH === 0;
    if (pathPos + 1 >= pathPlan.length) {
      if (!extendPathPlan()) {
        pathPicked.clear();
        if (!extendPathPlan()) return;
      }
    }
    const entry = pathPlan[pathPos + 1];
    if (!entry) return;
    pathPos += 1;
    trackFrameMilestone();
    sceneContext.stage = entry.stage;
    if (isCycleBoundary) {
      const completedCycle = cycleNumber;
      cycleNumber += 1;
      sessionAccounted = 2;
      sessionTextFrames = 1;
      quietSinceText = 0;
      quietRequired = 1;
      captionStartDelayOverride = 0;
      cycleCaptionBlocked = true;
      showCycleWhisper(completedCycle);
    } else {
      captionStartDelayOverride = 0;
    }
    navigateTo(
      entry.category.index,
      direction,
      fadeDurationFor(record.viewedMs, speed),
      entry.clip.id,
      sceneContext
    );
  }
  function startHold() {
    holdTimer = 0;
    if (!gesture || gesture.moved || gesture.holding) return;
    gesture.holding = true;
    gesture.holdStart = now();
    if (!gesture.holdCounted) {
      gesture.holdCounted = true;
      state.holdsInView += 1;
      state.totalHolds += 1;
      if (lastHoldTrackedFrame !== sceneOrdinal) {
        lastHoldTrackedFrame = sceneOrdinal;
        trackEvent('deep_hold', { frame: sceneOrdinal, stage: sessionStage });
      }
    }
    if (currentCaption) currentCaption.held = true;
    stage.classList.add('is-held');
    wakeCaption();
    setActivePlaybackRate(SLOW_RATE);
    setSoundDepth(true);
    startHoldPulse();
    maybeRecordResonance();
  }
  function stopHold() {
    if (!gesture || !gesture.holding) return;
    gesture.holding = false;
    if (currentCaption && currentCaption.holdReveal) {
      currentCaption.holdReveal = false;
      captionEl.classList.remove('is-visible');
      stage.classList.remove('is-caption-active');
      captionRevealed = false;
      currentCaption.revealed = false;
    }
    const duration = now() - gesture.holdStart;
    const gestureDuration = now() - gesture.t0;
    if (gestureDuration >= 1000 && !holdGestureFrames.has(sceneOrdinal)) {
      holdGestureFrames.add(sceneOrdinal);
      trackEvent('hold_gesture', { frame: sceneOrdinal, durationMs: Math.round(gestureDuration) });
    }
    state.heldMs += duration;
    state.longestHoldMs = Math.max(state.longestHoldMs, duration);
    if (duration >= 600) rememberAnchor('hold');
    if (duration >= 3500 && (!anchorClip || duration > anchorHoldMs)) {
      const clip = activeClip();
      if (clip) {
        anchorClip = clip;
        anchorHoldMs = duration;
      }
    }
    stage.classList.remove('is-held');
    setSoundDepth(false);
    stopHoldPulse();
  }
  function abortGesture() {
    window.clearTimeout(holdTimer);
    window.clearTimeout(resonanceTimer);
    window.clearTimeout(captionRevealTimer);
    holdTimer = 0;
    resonanceTimer = 0;
    captionRevealTimer = 0;
    if (gesture) {
      if (gesture.holding) {
        const duration = now() - gesture.holdStart;
        state.heldMs += duration;
        state.longestHoldMs = Math.max(state.longestHoldMs, duration);
        if (duration >= 600) rememberAnchor('hold');
        if (duration >= 3500 && (!anchorClip || duration > anchorHoldMs)) {
          const clip = activeClip();
          if (clip) {
            anchorClip = clip;
            anchorHoldMs = duration;
          }
        }
        setSoundDepth(false);
      }
      gesture = null;
    }
    stopHoldPulse();
    setActivePlaybackRate(1);
    setBreath(0);
    stopOptics();
    stage.classList.remove('is-held');
  }
  function isInterfaceTarget(target) {
    return Boolean(target && target.closest('button, a, .install-card, .install-card--ios, .lang-switch, .finale'));
  }
  document.addEventListener('touchstart', (event) => {
    if (!gateOpen || sessionComplete) return;
    if (event.touches.length !== 1 || isInterfaceTarget(event.target)) return;
    stage.classList.add('is-touching');
    wakeCaption();
    const touch = event.touches[0];
    if (gesture) abortGesture();
    enableSoundscape();
    wakePlayback();
    gesture = {
      id: 'touch', x0: touch.clientX, y0: touch.clientY,
      xPrev: touch.clientX, yPrev: touch.clientY,
      t0: now(), tPrev: now(), moved: false, holding: false,
      holdStart: 0, holdCounted: false, thresholdFelt: false, peakSpeed: 0,
    };
    touchOrigin = { x: touch.clientX, y: touch.clientY, lastY: touch.clientY, t: now(), lastT: now() };
    markInteraction();
    setSceneElement(activeClip());
    startOptics(touch);
    setActivePlaybackRate(SLOW_RATE);
    setBreath(0);
    rememberAnchor('touch');
    prefetchNextCaptions(behaviorContext());
    if (captionSuppressed && currentCaption) {
      window.clearTimeout(captionRevealTimer);
      captionRevealTimer = window.setTimeout(() => {
        captionRevealTimer = 0;
        revealCaptionForHold();
      }, CAPTION_HOLD_REVEAL_MS);
    }
    holdTimer = window.setTimeout(startHold, HOLD_MS);
    resonanceTimer = window.setTimeout(() => {
      if (gesture && !gesture.moved) rewardCategory(activeCategory(), 'hold');
    }, RESONANCE_HOLD_MS);
  }, { passive: false });
  document.addEventListener('touchmove', (event) => {
    if (!gateOpen || sessionComplete) return;
    if (!touchOrigin || !gesture || event.touches.length !== 1) return;
    if (isInterfaceTarget(event.target)) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchOrigin.x;
    const dy = touch.clientY - touchOrigin.y;
    if (event.cancelable) event.preventDefault();
    updateOptics(touch);
    if (Math.abs(dy) > Math.abs(dx)) {
      setBreath(clamp(-dy / 140, -1, 1));
    }
    if (Math.hypot(dx, dy) > 22 && !gesture.moved) {
      gesture.moved = true;
      window.clearTimeout(holdTimer);
      window.clearTimeout(resonanceTimer);
      holdTimer = 0;
      resonanceTimer = 0;
    }
    if (gesture.holding && Math.hypot(dx, dy) > 30) {
      stopHold();
      setActivePlaybackRate(1);
    }
    touchOrigin.lastY = touch.clientY;
    touchOrigin.lastT = now();
  }, { passive: false });
  document.addEventListener('touchend', (event) => {
    if (!touchOrigin) return;
    const changed = event.changedTouches && event.changedTouches[0];
    const origin = touchOrigin;
    touchOrigin = null;
    if (!changed) { abortGesture(); return; }
    const dx = changed.clientX - origin.x;
    const dy = changed.clientY - origin.y;
    const velocity = Math.abs(dy) / Math.max(1, now() - origin.t);
    if (gesture && gesture.holding) stopHold();
    stage.classList.remove('is-touching');
    setActivePlaybackRate(1);
    setBreath(0);
    abortGesture();
    scheduleCaptionZero();
    primeAudioGesture();
    if (Math.abs(dy) > 35 && Math.abs(dy) > Math.abs(dx)) {
      go(dy < 0 ? 'up' : 'down', velocity);
    }
  }, { passive: false });
  document.addEventListener('touchcancel', () => {
    if (gesture && gesture.holding) stopHold();
    stage.classList.remove('is-touching');
    scheduleCaptionZero();
    touchOrigin = null;
    setActivePlaybackRate(1);
    setBreath(0);
    abortGesture();
  }, { passive: false });
  window.addEventListener('blur', abortGesture);
  let wheelSum = 0;
  let wheelFirstAt = 0;
  let wheelLastAt = 0;
  window.addEventListener('wheel', (event) => {
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
  window.addEventListener('keydown', (event) => {
    const key = event.key;
    if (!gateOpen) {
      if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        unlockExperience();
      }
      return;
    }
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'PageUp' && key !== 'PageDown') {
      return;
    }
    event.preventDefault();
    markInteraction();
    rememberAnchor('key');
    setBreath(0);
    go(key === 'ArrowUp' || key === 'PageUp' ? 'up' : 'down', 1);
  });
  stage.addEventListener('click', (event) => {
    if (!gateOpen) return;
    if (now() - lastSwipeAt < 450) return;
    if (event.clientY < window.innerHeight * 0.6) return;
    const t = now();
    if (t - lastBottomTapAt < 450) {
      lastBottomTapAt = 0;
      event.preventDefault();
      markInteraction();
      go('up', 1);
    } else {
      lastBottomTapAt = t;
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      state.hiddenAt = now();
      releaseWakeLock();
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
      if (gateOpen) requestWakeLock();
      wakePlayback();
      resumeSound();
    }
  });
  window.addEventListener('online', () => {
    if (!gateOpen || document.hidden) return;
    const clip = activeClip();
    const video = clip && clip.el;
    if (!video || !video.paused) return;
    if (gesture && gesture.holding) return;
    video.play().catch(() => {});
  });
  stage.dataset.element = 'fog';
  stage.style.setProperty('--optic-x', '50%');
  stage.style.setProperty('--optic-y', '50%');
  stuporMonitor = window.setInterval(checkStupor, 1000);
  const entryGate = document.querySelector('.entry');
  function isStandaloneMode() {
    if (new URLSearchParams(location.search).get('app') === '1') return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (document.referrer.startsWith('android-app://')) return true;
    return false;
  }
  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function syncInstallButton() {
    if (!entryInstallButton) return;
    const available = !isStandaloneMode();
    entryInstallButton.hidden = !available;
    if (!available && entryInstallHint) entryInstallHint.hidden = true;
  }
  function showIosInstallHint() {
    if (!entryInstallHint) return;
    window.clearTimeout(installHintTimer);
    entryInstallHint.hidden = false;
    installHintTimer = window.setTimeout(() => {
      entryInstallHint.hidden = true;
    }, 4000);
  }
  async function handleInstallClick(event) {
    event.preventDefault();
    event.stopPropagation();
    trackEvent('pwa_install_click', { mode: isStandaloneMode() ? 'pwa' : 'browser' });
    trackEvent('install_prompt_accepted');
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          showInstalledState();
          try { window.close(); window.blur(); } catch (_) {}
        }
      } catch (_) {
      }
      syncInstallButton();
      return;
    }
    if (isIos()) {
      showIosInstallHint();
      return;
    }
    if (entryInstallHint) {
      entryInstallHint.textContent = tr('installManual');
      entryInstallHint.hidden = false;
      window.clearTimeout(installHintTimer);
      installHintTimer = window.setTimeout(() => { entryInstallHint.hidden = true; }, 5000);
    }
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });
  deferredPrompt = window.__deferredInstallPrompt || deferredPrompt;
  window.addEventListener('appinstalled', () => {
    trackEvent('pwa_installed', { mode: isStandaloneMode() ? 'pwa' : 'browser' });
    deferredPrompt = null;
    showInstalledState();
    if (entryInstallButton) entryInstallButton.hidden = true;
    if (entryInstallHint) entryInstallHint.hidden = true;
  });
  const displayModeQuery = window.matchMedia('(display-mode: standalone)');
  if (typeof displayModeQuery.addEventListener === 'function') {
    displayModeQuery.addEventListener('change', syncInstallButton);
  } else if (typeof displayModeQuery.addListener === 'function') {
    displayModeQuery.addListener(syncInstallButton);
  }
  if (entryInstallButton) {
    entryInstallButton.addEventListener('pointerdown', (event) => event.stopPropagation());
    entryInstallButton.addEventListener('click', handleInstallClick);
  }
  function showInstalledState() {
    if (entryGate) entryGate.classList.add('is-installed');
    if (entryInstallButton) entryInstallButton.hidden = true;
    if (entryInstallHint) entryInstallHint.hidden = true;
    if (entryInstalledNote) entryInstalledNote.hidden = false;
  }
  if (entryGate) {
    entryGate.classList.toggle('is-gift', GIFT_MODE);
    entryGate.classList.toggle('is-standalone', isStandaloneMode());
    entryGate.classList.toggle('is-browser', !isStandaloneMode());
    entryGate.classList.toggle('entry-app-mode', isStandaloneMode());
    entryGate.classList.toggle('entry-browser-mode', !isStandaloneMode());
  }
  if (entryInstalledNote) entryInstalledNote.hidden = true;
  syncInstallButton();
  function unlockExperience() {
    if (gateOpen) return;
    activateAudioSession();
    isTransitioning = false;
    window.setTimeout(() => { isTransitioning = false; }, 1000);
    if (isSessionLocked()) {
      updateSessionLockUI();
      return;
    }
    gateOpen = true;
    isTransitioning = false;
    requestWakeLock();
    let completedBefore = false;
    try { completedBefore = localStorage.getItem(COMPLETED_KEY) === '1'; } catch (_) {}
    if (completedBefore) trackEvent('return_after_lock', { mode: isStandaloneMode() ? 'pwa' : 'browser' });
    trackEvent('session_start', { mode: isStandaloneMode() ? 'pwa' : 'browser' });
    if (returnAfterLock) {
      trackEvent('session_return');
      returnAfterLock = false;
    }
    resetViewClock();
    markInteraction();
    setBreath(0);
    if (entryGate) {
      entryGate.classList.add('is-open');
      entryGate.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => {
        entryGate.hidden = true;
      }, 1100);
    }
    enableSoundscape();
    if (!sceneOrdinal) sceneOrdinal = 1;
    try {
      if (!startPathFirst()) pathStartPending = true;
    } catch (error) {
      pathStartPending = true;
      console.error('[sanctuary] gate start failed:', error);
    }
  }
  if (entryGate) {
    let entryStart = null;
    entryGate.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1 || event.target.closest('.lang-switch, .install-card, .install-card--ios, .entry-begin, button')) {
        entryStart = null;
        return;
      }
      const touch = event.touches[0];
      entryStart = { x: touch.clientX, y: touch.clientY };
    }, { passive: true });
    entryGate.addEventListener('touchend', (event) => {
      if (!entryStart) return;
      const touch = event.changedTouches && event.changedTouches[0];
      const start = entryStart;
      entryStart = null;
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (dy < -35 && Math.abs(dy) > Math.abs(dx)) {
        unlockExperience();
      }
    }, { passive: false });
    entryGate.addEventListener('wheel', (event) => {
      if (event.deltaY < 0) {
        event.preventDefault();
        unlockExperience();
      }
    }, { passive: false });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp' && !gateOpen) {
        event.preventDefault();
        unlockExperience();
      }
    });
  } else if (!entryGate) {
    gateOpen = true;
  }
  sessionLockAt = readSessionLock();
  returnAfterLock = Boolean(sessionLockAt && sessionLockAt <= Date.now());
  startSessionLockTicker();
  applyLanguage();
  activeQuality = chooseQuality();
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection && typeof connection.addEventListener === 'function') connection.addEventListener('change', () => setQuality(false));
  startPresenceCounter();
  initEntryAbstract();
  trackEvent('entry_view', { mode: isStandaloneMode() ? 'pwa' : 'browser', directApp: APP_ENTRY });
  window.addEventListener('load', () => trackEvent('threshold_open'), { once: true });
  if (notifyReturnButton) {
    notifyReturnButton.addEventListener('click', () => {
      trackEvent('finale_action', { type: 'notify' });
      enableReturnNotification();
    });
  }
  if (shareSilenceButton) shareSilenceButton.addEventListener('click', shareSilence);
  if (finaleArtifact) {
    finaleArtifact.style.cursor = 'zoom-in';
    finaleArtifact.addEventListener('click', openArtLightbox);
  }
  if (artLightbox) {
    artLightbox.addEventListener('click', (event) => { if (event.target === artLightbox) closeArtLightbox(); });
    let artStartY = 0;
    artLightbox.addEventListener('touchstart', (event) => { artStartY = event.touches[0]?.clientY || 0; }, { passive: true });
    artLightbox.addEventListener('touchend', (event) => {
      const endY = event.changedTouches[0]?.clientY || 0;
      if (endY - artStartY > 70) closeArtLightbox();
    }, { passive: true });
  }
  if (artLightboxClose) artLightboxClose.addEventListener('click', closeArtLightbox);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && artLightbox && !artLightbox.hidden) closeArtLightbox(); });
  if (entryLock) {
    entryLock.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      entryLock.classList.add('is-revealed');
      window.clearTimeout(entryLockRevealTimer);
      entryLockRevealTimer = window.setTimeout(() => entryLock.classList.remove('is-revealed'), 4200);
    });
  }
  attachLockSwipe(entryGate, () => {
    if (!isSessionLocked()) return;
    clearSessionLock();
    unlockExperience();
  });
  attachLockSwipe(finaleEl, () => {
    if (!isSessionLocked()) return;
    startNewSessionAfterUnlock();
  });
  const environmentReady = Promise.race([
    loadEnvironment(),
    new Promise((resolve) => window.setTimeout(resolve, 1200)),
  ]);
  const startupTasks = [loadVideoCatalog(), environmentReady];
  Promise.allSettled(startupTasks).then(() => {
    try {
      const total = categories.reduce((sum, category) => sum + category.clips.length, 0);
      const music = categories.reduce((sum, category) => sum + category.musicTracks.length, 0);
      try {
        if (!buildSessionPlan()) appendFallbackPath(true);
      } catch (error) {
        console.error('[sanctuary] session plan failed:', error);
      }
      if (!pathPlan.length) {
        ensureFallbackCategories();
        try {
          buildSessionPlan();
        } catch (error) {
          console.error('[sanctuary] fallback session failed:', error);
        }
      }
      if (!pathPlan.length) {
        console.error('[sanctuary] no video clips available after all fallbacks');
        return;
      }
      try {
        preparePlaybackWindow(pathPlan[0], pathPlan[1]);
        const first = pathPlan[0];
        prefetchCaption(first.clip, first.category, behaviorContext(), first.stage);
      } catch (error) {
      }
      if (gateOpen && !pathStarted) {
        try {
          startPathFirst();
        } catch (error) {
          console.error('[sanctuary] first scene failed:', error);
        }
      }
    } catch (error) {
      console.error('[sanctuary] startup failed:', error);
    }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch((error) => {
      });
    });
  }
})();