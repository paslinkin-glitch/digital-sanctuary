/* Digital Sanctuary — MVP 3: curated individuation catalog.
 *
 * Zero-UI vertical feed built on the Jungian path from concept.md:
 * Shadow -> Trickster & Abyss -> Calm -> Path. The 80-film catalog is loaded
 * from videos.json, shuffled inside each stage, and filtered by the IDs the
 * viewer has already seen. Coverr API calls are intentionally disabled.
 * Behaviour (view time, swipe speed, hold) remains invisible; optical layers
 * and the DeepSeek caption rhythm answer it without buttons or counters.
 */
(() => {
  'use strict';

  if (window.SANCTUARY_MAINTENANCE) {
    document.documentElement.dataset.maintenance = 'true';
    const screen = document.getElementById('maintenance-screen');
    if (screen) screen.hidden = false;
    return;
  }

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
  const HAPTIC_COOLDOWN_MS = 180;
  const SWIPE_HAPTIC_COOLDOWN_MS = 600;
  const HOLD_HEARTBEAT_MS = 1800;
  const HAPTIC_PATTERNS = {
    fire: { frame: [32, 45, 48], hold: [42, 85, 58], interval: 1400 },
    water: { frame: [20, 55, 36, 70, 54], hold: [52, 160, 72], interval: 2200 },
    fog: { frame: [46, 110, 28], hold: [58, 130, 34], interval: 2000 },
    space: { frame: [34, 65, 34], hold: [44, 180, 44], interval: 2400 },
  };
  const PORTRAIT_TIMEOUT_MS = 1500;

  // Demo key from the brief. A static prototype must expose it; for production
  // this call belongs behind a tiny server-side proxy.
  const API_KEY = 'b1155018766256bd1ea645df7d64e178';
  const API_ENDPOINT = 'https://api.coverr.co/videos';
  const DEEPSEEK_PROXY_ENDPOINT = '/api/deepseek';
  const CAPTION_START_DELAY_MS = 1200;
  const CAPTION_MIN_WORDS = 4;
  const CAPTION_MAX_WORDS = 6;
  const CAPTION_MAX_RATIO = 0.45;
  const EARLY_SWIPE_RATIO = 0.55;
  const CAPTION_LINGER_MS = 3500;
  const CAPTION_HOLD_REVEAL_MS = 1100;
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
  const MUSIC_GAIN = 0.42;
  const NOISE_GAIN = 0.22;

  const LANG_STORAGE_KEY = 'sanctuary-lang';
  const I18N = {
    ru: {
      docTitle: 'Digital Sanctuary — интерактивное убежище',
      entryAria: 'Вход в убежище',
      entryKicker: 'ЦИФРОВОЕ УБЕЖИЩЕ',
      entryTitle: 'Закрытое пространство<br>тишины и созерцания',
      entrySub: 'Без слов, оценок и попыток<br>тебя исправить',
      enter: 'Войти',
      nav: 'Листай вверх как сон · Задержи палец, если кадр отзывается',
      installApp: 'Установить приложение на экран',
      installHint: 'Нажмите «Поделиться» → «На экран Домой»',
      installCardTitle: 'Сохранить убежище',
      install: 'Добавить на экран',
      iosKicker: 'СОХРАНИТЬ УБЕЖИЩЕ',
      iosSafari1: 'Нажмите «Поделиться» на нижней панели',
      iosSafari2: 'Выберите «На экран Домой»',
      iosInapp1: 'Откройте эту страницу в Safari',
      iosInapp2: 'Затем нажмите «Поделиться» → «На экран Домой»',
      close: 'Закрыть',
      swipe: 'Потяни вверх · Удерживай, чтобы замедлить',
      finaleKicker: 'ТИШИНА',
      finaleTitle: 'Сон завершён',
      finaleSub: 'ПРОСТРАНСТВО РЯДОМ',
      finaleBody1: 'Здесь ничего не нужно объяснять или исправлять.',
      finaleBody2: 'Тишина просто побыла рядом — ты можешь остаться в ней или вернуться в любой момент.',
      loading: 'СОБИРАЕМ РАЗБОР...',
      back: 'Ещё один сон',
      cycle1: 'Первый круг завершён. Теперь сон опускается глубже',
      cycleKicker: 'КРУГ I // ПРОЙДЕН',
      cycle2: 'Второй круг пройден. Тишина остаётся рядом.',
      cycle3: 'Круг сна завершён. Дыхание продолжается.',
      lockLabel: 'ПРОДОЛЖЕНИЕ',
      lockedPrefix: 'Продолжение через',
      notificationBody: 'Продолжение открыто. Вернись, чтобы узнать, что дальше.',
      notify: 'Уведомить через 2 часа',
      notifySet: 'Уведомление поставлено',
      notifyOff: 'Уведомления отключены',
      notifyUnavailable: 'Уведомления недоступны',
      captionFallback: 'В этот час лучше просто дышать.',
      saveFrame: 'Сохранить образ сна',
      saveUnavailable: 'Образ пока недоступен',
    },
    en: {
      docTitle: 'Digital Sanctuary — an interactive sanctuary',
      entryAria: 'Entrance to the sanctuary',
      entryKicker: 'DIGITAL SANCTUARY',
      entryTitle: 'A private space<br>of silence and stillness',
      entrySub: 'No words, no judgments,<br>no attempts to fix you',
      enter: 'Enter',
      nav: 'Swipe up like a dream · Hold when a frame resonates',
      installApp: 'Add the app to your screen',
      installHint: 'Tap Share → Add to Home Screen',
      installCardTitle: 'Keep the sanctuary',
      install: 'Add to screen',
      iosKicker: 'SAVE THE SANCTUARY',
      iosSafari1: 'Tap Share in the bottom bar',
      iosSafari2: 'Select «Add to Home Screen»',
      iosInapp1: 'Open this page in Safari',
      iosInapp2: 'Then tap Share → Add to Home Screen',
      close: 'Close',
      swipe: 'Swipe up · Hold to sink deeper',
      finaleKicker: 'SILENCE',
      finaleTitle: 'The dream is complete',
      finaleSub: 'THE SPACE BESIDE YOU',
      finaleBody1: 'Nothing here needs to be explained or repaired.',
      finaleBody2: 'Silence simply stayed beside you — you can remain in it or return at any moment.',
      loading: 'BUILDING YOUR VERDICT...',
      back: 'One more dream',
      cycle1: 'First cycle complete. The dream now descends deeper',
      cycleKicker: 'CYCLE I // COMPLETE',
      cycle2: 'Second cycle passed. Silence remains beside you.',
      cycle3: 'Dream cycle complete. Breathing continues.',
      lockLabel: 'CONTINUATION',
      lockedPrefix: 'Continues in',
      notificationBody: 'The next chapter is open. Come back and see what it holds.',
      notify: 'Notify me in 2 hours',
      notifySet: 'Notification set',
      notifyOff: 'Notifications off',
      notifyUnavailable: 'Notifications unavailable',
      captionFallback: 'Right now, it is enough to breathe.',
      saveFrame: 'Save dream frame',
      saveUnavailable: 'Frame is not available yet',
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
      /* localStorage может быть недоступен */
    }
    // International launch defaults to English until the visitor explicitly
    // chooses Russian in the language switch.
    return 'en';
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
        /* sensor permission is optional */
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
      /* quiet fallback: clear weather */
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
      if (window.umami && typeof window.umami.track === 'function') {
        window.umami.track(eventName, props);
      }
    } catch (_) {
      /* аналитика не должна влиять на работу сцены */
    }
  }

  /* ------------------------------------------------------ клипы на случай,
     если API недоступен: те же ролики Coverr, уже проверенные по API. */

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

  /* ------------------------------------------------------ путь индивидуации */

  const STAGES = [
    {
      id: 1,
      name: 'Тень',
      archetype: 'Тень',
      categories: ['Shadow'],
      tone: 'напряжение, маска, первое честное признание',
      tags: ['silhouette shadow', 'dark corridor', 'smoke dark', 'night window rain', 'alone dark'],
    },
    {
      id: 2,
      name: 'Слом и Бездна',
      archetype: 'Трикстер и Бездна',
      categories: ['Trickster', 'Abyss'],
      tone: 'провокация, парадокс, потеря прежней опоры',
      tags: ['crowd blur night', 'reflection glass dark', 'deep underwater dark', 'black waves ocean', 'fire sparks dark'],
      shadowTags: ['crowd blur night', 'reflection glass dark', 'fire sparks dark'],
      abyssTags: ['deep underwater dark', 'black waves ocean'],
    },
    {
      id: 3,
      name: 'Тишина',
      archetype: 'Покой / Анима',
      categories: ['Calm'],
      tone: 'замедление, дыхание, мягкость без слов',
      tags: ['dust light beam', 'candle flame dark', 'fog forest dark', 'moonlight water', 'slow clouds night'],
    },
    {
      id: 4,
      name: 'Выход и Путь',
      archetype: 'Путь / Самость',
      categories: ['Path'],
      tone: 'свет, движение, ясность и право идти дальше',
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

  // /music из брифа отдаёт 404; официальный эндпоинт Coverr — /audios.
  // Ниже 25 уникальных preview.mp3 из ответов /audios: по пять треков на
  // категорию. Ссылки зафиксированы, чтобы музыка не зависела от лимита
  // поисковых запросов API, и чередуются под каждый новый кадр.
  const MUSIC_CATALOG = {
    Shadow: [
      { id: 'HDgXJpCNph', title: 'Whisper Canyon', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/whisper-canyon-HDgXJpCNph.mp3' },
      { id: 'DoetucQLKg', title: 'Monolith', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/monolith-DoetucQLKg.mp3' },
      { id: '2v8dZRPll8', title: 'inner world', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/inner-world-2v8dZRPll8.mp3' },
      { id: 'mvh5rImd1R', title: 'clouds', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/clouds-mvh5rImd1R.mp3' },
    ],
    Calm: [
      { id: 'HTzsyicaIT', title: 'crystal rain', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/crystal-rain-HTzsyicaIT.mp3' },
      { id: 'WUzwP3T0HC', title: 'tokio rain', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/tokio-rain-WUzwP3T0HC.mp3' },
      { id: '2v8dZRPll8', title: 'inner world', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/inner-world-2v8dZRPll8.mp3' },
      { id: 'mvh5rImd1R', title: 'clouds', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/clouds-mvh5rImd1R.mp3' },
    ],
    Abyss: [
      { id: '5nxzquf11g', title: 'The Color of Space', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/the-color-of-space-5nxzquf11g.mp3' },
      { id: 'AeWsKx2z16', title: 'A Look At The Sky', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/a-look-at-the-sky-AeWsKx2z16.mp3' },
      { id: 'sGPevMbGzP', title: 'Deep Meditation', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/deep-meditation-sGPevMbGzP.mp3' },
      { id: 'mvh5rImd1R', title: 'clouds', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/clouds-mvh5rImd1R.mp3' },
    ],
    Trickster: [
      { id: 'EX6e6IkDGx', title: 'A Piano For Travel', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/a-piano-for-travel-EX6e6IkDGx.mp3' },
      { id: 'aUHfXkgixI', title: 'Cinematic Visions', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/cinematic-visions-aUHfXkgixI.mp3' },
      { id: 'yutSfOSE7l', title: 'Lotus Flower', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/lotus-flower-yutSfOSE7l.mp3' },
      { id: 'p2sexNoWO6', title: 'horizons', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/horizons-p2sexNoWO6.mp3' },
    ],
    Path: [
      { id: 'EX6e6IkDGx', title: 'A Piano For Travel', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/a-piano-for-travel-EX6e6IkDGx.mp3' },
      { id: 'aUHfXkgixI', title: 'Cinematic Visions', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/cinematic-visions-aUHfXkgixI.mp3' },
      { id: 'yutSfOSE7l', title: 'Lotus Flower', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/lotus-flower-yutSfOSE7l.mp3' },
      { id: 'p2sexNoWO6', title: 'horizons', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/horizons-p2sexNoWO6.mp3' },
      { id: 'Ou9ZrAwafj', title: 'Through The Looking Glass', url: 'https://s3.twcstorage.ru/digital-sanctuary/audio/through-the-looking-glass-Ou9ZrAwafj.mp3' },
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
  const stageLabelEl = document.getElementById('stage-label');
  let swipeHint = document.getElementById('swipe-hint');
  const entryTrigger = document.getElementById('entry-trigger');
  const entryInstallButton = document.getElementById('entry-install');
  const entryInstallHint = document.getElementById('entry-install-hint');
  const installCard = document.getElementById('install-card');
  const installCardInstall = document.getElementById('install-card-install');
  const installCardLater = document.getElementById('install-card-later');
  const installCardHint = document.getElementById('install-card-hint');
  const iosInstallCard = document.getElementById('ios-install-card');
  const iosInstallClose = document.getElementById('ios-install-close');
  const iosInstallKicker = document.getElementById('ios-install-kicker');
  const iosStepsSafari = document.getElementById('ios-steps-safari');
  const iosStepsInapp = document.getElementById('ios-steps-inapp');
  const iosSafari1 = document.getElementById('ios-safari-1');
  const iosSafari2 = document.getElementById('ios-safari-2');
  const iosInapp1 = document.getElementById('ios-inapp-1');
  const iosInapp2 = document.getElementById('ios-inapp-2');
  const finaleEl = document.getElementById('finale');
  const finaleSessionVideo = document.getElementById('finale-session-video');
  const finalePortraitEl = document.getElementById('finale-portrait');
  const finaleCountdownEl = document.getElementById('finale-countdown');
  const finaleReflectionEl = document.getElementById('finale-reflection');
  const finaleLockInlineEl = document.getElementById('finale-lock-inline');
  const finaleLockLabel = document.getElementById('finale-lock-label');
  const copySnapshotButton = document.getElementById('copy-snapshot');
  const notifyReturnButton = document.getElementById('notify-return');
  const saveDreamFrameButton = document.getElementById('save-dream-frame');
  const backToStartButton = document.getElementById('back-to-start');
  const langSwitch = document.getElementById('lang-switch');
  const langButtons = Array.from(document.querySelectorAll('.lang-switch-btn'));



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
    setText('.entry-nav-hint', 'nav');
    setText('.install-card-title', 'installCardTitle');
    setText('.finale-kicker', 'finaleKicker');
    setText('.finale-title', 'finaleTitle');
    setText('.finale-sub', 'finaleSub');
    const finaleBody = document.querySelectorAll('.finale-portrait p');
    if (finaleBody[0]) finaleBody[0].textContent = tr('finaleBody1');
    if (finaleBody[1]) finaleBody[1].textContent = tr('finaleBody2');
    setText('.swipe-hint-label', 'swipe');

    if (entryGate) entryGate.setAttribute('aria-label', tr('entryAria'));
    if (entryTrigger) {
      entryTrigger.textContent = isSessionLocked()
        ? `${tr('lockedPrefix')} ${formatSessionCountdown(Math.max(0, sessionLockAt - Date.now()))}`
        : tr('enter');
    }
    if (entryInstallButton) entryInstallButton.textContent = tr('installApp');
    if (entryInstallHint) entryInstallHint.textContent = tr('installHint');
    if (installCardInstall) installCardInstall.textContent = tr('install');
    if (installCardHint) installCardHint.textContent = tr('installHint');
    if (iosInstallKicker) iosInstallKicker.textContent = tr('iosKicker');
    if (iosSafari1) iosSafari1.textContent = tr('iosSafari1');
    if (iosSafari2) iosSafari2.textContent = tr('iosSafari2');
    if (iosInapp1) iosInapp1.textContent = tr('iosInapp1');
    if (iosInapp2) iosInapp2.textContent = tr('iosInapp2');
    if (installCardLater) installCardLater.setAttribute('aria-label', tr('close'));
    if (copySnapshotButton) copySnapshotButton.textContent = tr('copy');
    if (notifyReturnButton) notifyReturnButton.textContent = tr('notify');
    if (saveDreamFrameButton) saveDreamFrameButton.textContent = tr('saveFrame');
    if (backToStartButton) backToStartButton.textContent = tr('back');

    const loading = finalePortraitEl && finalePortraitEl.querySelector('.finale-loading');
    if (loading) loading.textContent = tr('loading');

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
      /* localStorage может быть недоступен */
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

  const VIEWED_STORAGE_KEY = 'sanctuary-viewed-video-ids-v1';
  const VIEWED_ALL_KEY = 'sanctuary-viewed-all-v1';
  const MAX_VIEWED_IDS = 100;

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
        ? parsed.filter((id) => typeof id === 'string' && id)
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
      /* localStorage может быть недоступен */
    }
  }

  function persistAllViewedVideoIds() {
    try {
      localStorage.setItem(VIEWED_ALL_KEY, JSON.stringify([...allViewedVideoIds]));
    } catch (_) {
      /* localStorage может быть недоступен */
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
      /* localStorage может быть недоступен */
    }
    return true;
  }

  function markVideoViewed(id) {
    if (!id) return;

    sessionUsedVideoIds.add(id);
    allViewedVideoIds.add(id);
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
  let swipeHintTimer = 0;
  let hasSwiped = false;
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
  let sceneOrdinal = 0;
  let captionAllow = false;
  let captionSuppressed = false;
  let captionHoldReady = false;
  let captionHasText = false;
  let captionRevealed = false;
  let currentCaption = null;
  let captionMemoryTimer = 0;
  let captionRevealTimer = 0;
  let captionAcceptedCount = 0;
  let captionYouStartCount = 0;
  let resonanceMemoryVersion = 0;
  const resonanceMemory = [];
  const captionCache = new Map();
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
  let firstHintTimer = 0;
  let activeHapticStage = 0;
  let holdPulseTimer = 0;
  let lastHapticAt = 0;
  let sessionLockAt = 0;
  let lockTicker = 0;
  let returnAfterLock = false;
  let lastTrackedStage = 0;
  let lastHoldTrackedFrame = -1;
  let portraitText = '';
  let portraitRequestId = 0;
  let returnNotificationTimer = 0;
  let deferredPrompt = null;
  let installHintTimer = 0;
  let installNudgeTimer = 0;
  let installCardDismissed = false;
  const INSTALL_SESSION_KEY = 'sanctuary_install_skipped';
  const INSTALLED_KEY = 'sanctuary_installed';

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
        /* вибрация не критична */
      }
    }
  }

  function hapticPatternForCurrent() {
    return HAPTIC_PATTERNS[currentOpticElement] || HAPTIC_PATTERNS.fog;
  }

  function startHoldPulse() {
    stopHoldPulse();
    const pattern = hapticPatternForCurrent();
    safeVibrate(pattern.hold, 0);
    holdPulseTimer = window.setInterval(() => {
      if (gesture && gesture.holding) {
        safeVibrate(pattern.hold, pattern.interval - 220);
      }
    }, pattern.interval);
  }

  function stopHoldPulse() {
    const wasHolding = Boolean(holdPulseTimer);
    window.clearInterval(holdPulseTimer);
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
    setElementalNoise(element);
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

    if (/(архетип|персон|либидо|юнгиан|психоанализ|archetype|persona|libido|jungian)/iu.test(text)) return false;
    if (/(тень|трикстер|бездна|архетип|персон|либидо|слой|глубин|shadow|trickster|abyss|archetype|persona|libido)/iu.test(text)) return false;
    if (/(сделай|поверь|должен|нужно|попробуй|стань|обещай|you should|you must|try to|promise me)/iu.test(text)) return false;

    return true;
  }

  function memoryPrompt() {
    if (!resonanceMemory.length) return '';

    const events = resonanceMemory
      .map((event, index) => `${index + 1}. ${event.category}; образ: «${event.image}»; фраза: «${event.phrase}»`)
      .join('\n');

    return `\n\nПамять последних резонансных событий (от старого к новому):\n${events}\nНовая фраза должна логически или ассоциативно развивать, углублять либо парадоксально откликаться на последнюю мысль из этой памяти через визуал нового видео. Не повторяй прошлые формулировки.`;
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
        `Архетип: ${archetype}.`,
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
    if (location.protocol === 'file:') return null;
    if (location.hostname === 'yoursanctuary.ru' || location.hostname.endsWith('.github.io') || location.hostname === 's3.twcstorage.ru') return null;
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
    const next = pathPlan[pathPos + 1];
    if (next) {
      prefetchCaption(next.clip, next.category, behavior, next.stage);
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

  function registerCaptionFrame() {
    sessionTextFrames = Math.min(
      Math.max(1, Math.floor(CYCLE_LENGTH * CAPTION_MAX_RATIO)),
      sessionTextFrames + 1
    );
    quietSinceText = 0;
    quietRequired = 1 + Math.floor(Math.random() * 2);
  }

  function captionAllowedForScene(context) {
    if (cycleCaptionBlocked) {
      cycleCaptionBlocked = false;
      quietSinceText = 0;
      return false;
    }

    const cap = Math.max(1, Math.floor(CYCLE_LENGTH * CAPTION_MAX_RATIO));
    if (context && context.held) return true;
    if (sceneOrdinal <= 1) return true;
    if (sessionTextFrames >= cap) return false;

    if (quietSinceText < quietRequired) {
      quietSinceText += 1;
      return false;
    }

    registerCaptionFrame();
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
    prefetchNextCaptions(behaviorContext());
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
      captionEl.classList.add('is-visible');
      captionRevealed = true;
      if (currentCaption) {
        currentCaption.revealed = true;
        if (!currentCaption.haptic) {
          currentCaption.haptic = true;
          safeVibrate([10, 60, 10], 4000);
        }
      }
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
    captionEl.classList.add('is-visible');
    captionRevealed = true;
    if (currentCaption) {
      currentCaption.revealed = true;
      if (!currentCaption.haptic) {
        currentCaption.haptic = true;
        safeVibrate([10, 60, 10], 4000);
      }
    }
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

    captionEl.classList.remove('is-visible');
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
    const fallbackFirst = () => {
      applyText(pickFallbackCaption(category.tag));
    };

    if (captionAllow || hiddenEligible) {
      if (cached) {
        applyText(cached);
      } else {
        requestCaption(clip, category, behavior, stage)
          .then((text) => {
            if (text) applyText(text);
            else fallbackFirst();
          })
          .catch(() => fallbackFirst());
      }
    }

    prefetchNextCaptions(behavior);

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

  const ELEMENTAL_NOISE = {
    water: { highpass: 90, lowpass: 1450, gain: 0.24, wind: 0.06, depth: 170 },
    fire: { highpass: 180, lowpass: 2100, gain: 0.20, wind: 0.14, depth: 360 },
    fog: { highpass: 120, lowpass: 950, gain: 0.17, wind: 0.05, depth: 280 },
    space: { highpass: 160, lowpass: 1800, gain: 0.13, wind: 0.03, depth: 210 },
  };

  function setElementalNoise(element = currentOpticElement) {
    if (!sound || !sound.noiseGain) return;
    const weather = envContext.weatherType;
    const key = weather === 'rain' ? 'water' : element;
    const profile = ELEMENTAL_NOISE[key] || ELEMENTAL_NOISE.fog;
    const now = sound.ctx.currentTime;
    const held = Boolean(sound.held);
    const targetGain = held
      ? Math.max(0.06, profile.gain * 0.55)
      : (sound.activeType === 'music' ? Math.max(0.025, profile.gain * 0.22) : profile.gain);
    sound.elementalGain = profile.gain;
    sound.noiseBaseGain = targetGain;
    sound.noiseCut.frequency.cancelScheduledValues(now);
    sound.noiseCut.frequency.setValueAtTime(sound.noiseCut.frequency.value, now);
    sound.noiseCut.frequency.linearRampToValueAtTime(profile.highpass, now + 0.6);
    sound.noiseTone.frequency.cancelScheduledValues(now);
    sound.noiseTone.frequency.setValueAtTime(sound.noiseTone.frequency.value, now);
    sound.noiseTone.frequency.linearRampToValueAtTime(held ? Math.min(profile.lowpass, 700) : profile.lowpass, now + 0.6);
    sound.noiseGain.gain.cancelScheduledValues(now);
    sound.noiseGain.gain.setValueAtTime(sound.noiseGain.gain.value, now);
    sound.noiseGain.gain.linearRampToValueAtTime(targetGain, now + 0.6);
    if (sound.wind) sound.wind.frequency.linearRampToValueAtTime(profile.wind, now + 0.8);
    if (sound.windDepth) sound.windDepth.gain.linearRampToValueAtTime(profile.depth, now + 0.8);
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
        wind,
        windDepth,
        elementalGain: NOISE_GAIN,
        bank: soundBank,
        channels: new Map(),
        activeTrackId: null,
        activeTrack: null,
        activeType: null,
        held: false,
        fadeToken: 0,
      };

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      setElementalNoise(currentOpticElement);

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
    sound.noiseGain.gain.linearRampToValueAtTime(
      channel ? Math.max(0.025, (sound.elementalGain || NOISE_GAIN) * 0.22) : (sound.noiseBaseGain || NOISE_GAIN),
      now + duration
    );

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
    setElementalNoise();
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

  // 720p — тот же ролик Coverr, но легче для мобильного автозапуска.
  // Если варианта нет, обработчик ошибки вернётся к исходному 1080p.
  function playbackUrl(url) {
    return url;
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
        video.playbackRate = stage.classList.contains('is-held') ? SLOW_RATE : 1;
        if (video.readyState >= 1) video.currentTime = 0;
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

  function navigateTo(targetIndex, direction, fadeMs, forcedClipId, sceneContext) {
    if (targetIndex === null || targetIndex === undefined) return;
    if (!slides[targetIndex]) return;

    maybeRecordResonance();
    markInteraction();
    setBreath(0);
    stopOptics();
    window.clearTimeout(captionRevealTimer);

    const fromIndex = state.index;
    const from = slides[fromIndex];
    const to = slides[targetIndex];
    const duration = fadeMs || SLOW_FADE_MS;

    // Меняем длительность до классов: CSS-переход подхватывает новое значение.
    stage.style.setProperty('--fade-duration', `${duration}ms`);

    stage.classList.remove('is-held');
    stopHoldPulse();
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

    // Новый кадр и его персональный трек стартуют в одном тике.
    const planned = pathPlan[pathPos];
    if (!forcedClipId && planned && planned.category === category) {
      const plannedIndex = category.clips.findIndex((clip) => clip.id === planned.clip.id);
      if (plannedIndex >= 0) category.freshIndex = plannedIndex;
    }
    preparePlaybackWindow(planned, pathPlan[pathPos + 1]);

    playCategory(category);
    setSceneElement(activeClip());
    safeVibrate(hapticPatternForCurrent().frame, HAPTIC_COOLDOWN_MS);
    activateCaption(category, activeClip(), behavior, allowed, sceneStage);
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
    console.info('[sanctuary] first two frames were fast; Shadow softened to two frames');
  }

  function go(direction, speed) {
    if (!gateOpen || sessionComplete) return;
    hideCycleWhisper();
    markFirstSwipe();
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
        /* fall through to a playable scene */
      }

      forceNextAvailableScene(direction);
      return;
    }

    recordSessionEvent(record);

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
      showInstallCard(true, false);
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
      if (lastHoldTrackedFrame !== sceneOrdinal) {
        lastHoldTrackedFrame = sceneOrdinal;
        trackEvent('deep_hold', { frame: sceneOrdinal, stage: sessionStage });
      }
    }

    if (currentCaption) currentCaption.held = true;
    stage.classList.add('is-held');
    setActivePlaybackRate(SLOW_RATE);
    setSoundDepth(true);
    startHoldPulse();
    maybeRecordResonance();
  }

  function stopHold() {
    if (!gesture || !gesture.holding) return;

    gesture.holding = false;
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

  /* -------------------------------------------------------------- свайпы */

  function swipeThreshold() {
    return Math.max(44, stage.clientHeight * SWIPE_MIN_RATIO);
  }

  function endGesture(event) {
    if (!gesture || event.pointerId !== gesture.id) return;

    window.clearTimeout(holdTimer);
    window.clearTimeout(resonanceTimer);
    window.clearTimeout(captionRevealTimer);
    holdTimer = 0;
    resonanceTimer = 0;
    captionRevealTimer = 0;
    const wasHolding = Boolean(gesture && gesture.holding);
    stopHold();

    const g = gesture;
    gesture = null;
    stopHoldPulse();

    setActivePlaybackRate(1);
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

    const isLongEnough = distance >= (wasHolding ? 85 : SWIPE_MIN_PX);
    const isFlick = !wasHolding && distance >= FLICK_MIN_PX && velocity >= FLICK_MIN_SPEED;

    if (isLongEnough || isFlick) {
      go(dy < 0 ? 'up' : 'down', velocity);
    } else {
      state.nervousStreak = 0;
    }
  }

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    enableSoundscape();
    wakePlayback();

    if (sound && gateOpen && !sound.activeTrack) {
      const category = activeCategory();
      const track = nextTrackFor(category);
      switchSoundtrack(track, SLOW_FADE_MS);
      preloadNextTrack(category);
    }

    if (gesture) {
      if (gesture.id === event.pointerId) return;
      abortGesture();
    }
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    if (gateOpen) {
      markInteraction();
      setSceneElement(activeClip());
      startOptics(event);
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
      thresholdFelt: false,
      peakSpeed: 0,
    };

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

    if (gesture.holding && distance > 30) {
      stopHold();
    }

    if (!gesture.thresholdFelt && distance >= SWIPE_MIN_PX) {
      gesture.thresholdFelt = true;
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

  stage.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      touchOrigin = null;
      return;
    }
    const touch = event.touches[0];
    if (gesture) abortGesture();
    enableSoundscape();
    wakePlayback();
    gesture = {
      id: 'touch',
      x0: touch.clientX,
      y0: touch.clientY,
      xPrev: touch.clientX,
      yPrev: touch.clientY,
      t0: now(),
      tPrev: now(),
      moved: false,
      holding: false,
      holdStart: 0,
      holdCounted: false,
      thresholdFelt: false,
      peakSpeed: 0,
    };
    touchOrigin = {
      x: touch.clientX,
      y: touch.clientY,
      lastY: touch.clientY,
      t: now(),
      lastT: now(),
    };
    if (gateOpen) {
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
    }
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  stage.addEventListener('touchmove', (event) => {
    if (!touchOrigin || !gesture || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - touchOrigin.x;
    const dy = touch.clientY - touchOrigin.y;
    if (Math.abs(dy) > 10 && event.cancelable) event.preventDefault();
    if (gateOpen) {
      updateOptics(touch);
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
        setBreath(clamp(-dy / 140, -1, 1));
      }
    }
    if (Math.hypot(dx, dy) > 12 && !gesture.moved) {
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

  stage.addEventListener('touchend', (event) => {
    if (!touchOrigin) return;
    const changed = event.changedTouches && event.changedTouches[0];
    const origin = touchOrigin;
    touchOrigin = null;
    if (!changed) {
      abortGesture();
      return;
    }
    const dx = changed.clientX - origin.x;
    const dy = changed.clientY - origin.y;
    const elapsed = Math.max(1, now() - origin.t);
    const velocity = Math.abs(dy) / elapsed;
    const held = Boolean(gesture && gesture.holding);
    if (held) stopHold();
    setActivePlaybackRate(1);
    setBreath(0);
    abortGesture();
    if (dy < -36 && Math.abs(dy) > Math.abs(dx)) {
      go('up', velocity);
    }
  }, { passive: false });

  stage.addEventListener('touchcancel', () => {
    if (gesture && gesture.holding) stopHold();
    touchOrigin = null;
    setActivePlaybackRate(1);
    setBreath(0);
    abortGesture();
  }, { passive: true });

  stage.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  window.addEventListener('blur', abortGesture);

  /* ------------------------------- колесо мыши как свайп на десктопе */

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

  /* ------------------------------------ пауза, когда вкладка скрыта */

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

  function isStandaloneMode() {
    try {
      if (localStorage.getItem(INSTALLED_KEY) === '1') return true;
    } catch (_) {}
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function installChoiceMade() {
    try {
      return sessionStorage.getItem(INSTALL_SESSION_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function rememberInstallChoice() {
    try { sessionStorage.setItem(INSTALL_SESSION_KEY, '1'); } catch (_) {}
  }

  function rememberInstalled() {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (_) {}
    installCardDismissed = true;
    hideInstallCard();
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isInAppBrowser() {
    return /Telegram|Instagram|FBAN|FBAV|VK|VKApp|Snapchat/i.test(navigator.userAgent);
  }

  function syncIosInstallCard() {
    if (!iosInstallCard) return;
    const inApp = isInAppBrowser();
    if (iosStepsSafari) iosStepsSafari.hidden = inApp;
    if (iosStepsInapp) iosStepsInapp.hidden = !inApp;
  }

  function syncInstallButton() {
    if (!entryInstallButton) return;
    const available = !isStandaloneMode() && (Boolean(deferredPrompt) || isIos());
    const cardVisible = Boolean(
      (installCard && !installCard.hidden) || (iosInstallCard && !iosInstallCard.hidden)
    );
    entryInstallButton.hidden = !available || cardVisible;
    if (!available && entryInstallHint) {
      entryInstallHint.hidden = true;
    }
  }

  function showInstallCard(force = false, finalContext = false) {
    if (isStandaloneMode() || installChoiceMade()) return;
    if (!force && (installCardDismissed || gateOpen)) return;
    if (isIos() && iosInstallCard) {
      if (installCard) { installCard.hidden = true; installCard.classList.remove('is-visible'); }
      iosInstallCard.hidden = false;
      iosInstallCard.classList.add('is-visible');
      iosInstallCard.classList.toggle('install-card--final', Boolean(finalContext));
      syncIosInstallCard();
      syncEntryInstallOffset(true, iosInstallCard);
      syncInstallButton();
      return;
    }
    if (iosInstallCard) { iosInstallCard.hidden = true; iosInstallCard.classList.remove('is-visible'); }
    if (!installCard) return;
    installCard.classList.toggle('install-card--final', Boolean(finalContext));
    installCard.classList.add('is-visible');
    installCard.hidden = false;
    syncEntryInstallOffset(true, installCard);
    syncInstallButton();
  }

  function syncEntryInstallOffset(visible, card) {
    const entry = document.getElementById('entry');
    if (!entry) return;
    entry.classList.toggle('has-install-card', Boolean(visible));
    if (!visible) {
      entry.style.removeProperty('--install-offset');
      return;
    }
    window.requestAnimationFrame(() => {
      const height = (card && card.offsetHeight) || 80;
      entry.style.setProperty('--install-offset', `${Math.round(height + 38)}px`);
    });
  }

  function hideInstallCard() {
    if (installCard) {
      installCard.hidden = true;
      installCard.classList.remove('install-card--final', 'is-visible');
    }
    if (iosInstallCard) {
      iosInstallCard.hidden = true;
      iosInstallCard.classList.remove('install-card--final', 'is-visible');
    }
    if (installCardHint) installCardHint.hidden = true;
    syncEntryInstallOffset(false);
    syncInstallButton();
  }

  function nudgeInstallCard(delay = 3500, finalContext = false) {
    window.clearTimeout(installNudgeTimer);
    installNudgeTimer = window.setTimeout(() => {
      if (!isStandaloneMode() && !gateOpen) showInstallCard(true, finalContext);
    }, delay);
  }

  function showIosInstallHint() {
    const target = installCard && !installCard.hidden
      ? installCardHint
      : entryInstallHint;
    if (!target) return;

    window.clearTimeout(installHintTimer);
    target.hidden = false;
    installHintTimer = window.setTimeout(() => {
      target.hidden = true;
    }, 4000);
  }

  async function handleInstallClick(event) {
    event.preventDefault();
    event.stopPropagation();
    trackEvent('install_prompt_accepted');

    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          if (entryInstallButton) entryInstallButton.hidden = true;
          hideInstallCard();
          installCardDismissed = true;
        }
      } catch (_) {
        /* установка может быть отменена системой */
      }
      if (!isIos()) hideInstallCard();
      syncInstallButton();
      return;
    }

    if (isIos()) showIosInstallHint();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallCard();
  });

  deferredPrompt = window.__deferredInstallPrompt || deferredPrompt;

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    rememberInstalled();
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

  if (installCardInstall) installCardInstall.addEventListener('click', handleInstallClick);
  function closeInstallPrompt(event) {
    event.preventDefault();
    event.stopPropagation();
    rememberInstallChoice();
    installCardDismissed = true;
    hideInstallCard();
  }

  for (const button of [installCardLater, iosInstallClose]) {
    if (!button) continue;
    button.addEventListener('pointerdown', closeInstallPrompt);
    button.addEventListener('click', closeInstallPrompt);
  }

  if (isStandaloneMode()) {
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch (_) {}
  }
  if (!isStandaloneMode() && !installChoiceMade()) showInstallCard(true);
  syncInstallButton();

  function unlockExperience() {
    if (gateOpen) return;
    isTransitioning = false;
    window.setTimeout(() => { isTransitioning = false; }, 1000);
    if (isSessionLocked()) {
      updateSessionLockUI();
      return;
    }
    gateOpen = true;
    isTransitioning = false;
    rememberInstallChoice();
    requestWakeLock();
    trackEvent('session_start', { local_hour: new Date().getHours() });
    if (returnAfterLock) {
      trackEvent('session_return');
      returnAfterLock = false;
    }
    hideInstallCard();
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
    entryGate.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      unlockExperience();
    }, { passive: false });
  } else {
    gateOpen = true;
  }

  sessionLockAt = readSessionLock();
  returnAfterLock = Boolean(sessionLockAt && sessionLockAt <= Date.now());
  startSessionLockTicker();
  applyLanguage();
  window.addEventListener('load', () => trackEvent('threshold_open'), { once: true });

  if (copySnapshotButton) {
    copySnapshotButton.addEventListener('click', copySessionPortrait);
  }

  if (notifyReturnButton) {
    notifyReturnButton.addEventListener('click', enableReturnNotification);
  }

  if (saveDreamFrameButton) {
    saveDreamFrameButton.addEventListener('click', saveDreamFrame);
  }

  if (backToStartButton) {
    backToStartButton.addEventListener('click', returnToStart);
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

  const startupTasks = [loadVideoCatalog()];
  loadEnvironment();

  Promise.allSettled(startupTasks).then(() => {
    try {
      const total = categories.reduce((sum, category) => sum + category.clips.length, 0);
      const music = categories.reduce((sum, category) => sum + category.musicTracks.length, 0);
      console.info('[sanctuary] video feed ready:', {
        clips: total,
        music,
        categories: categories.map((category) => `${category.tag}: ${category.clips.length}`),
      });

      try {
        if (!buildSessionPlan()) appendFallbackPath(true);
      } catch (error) {
        console.error('[sanctuary] session plan failed:', error);
      }

      if (!pathPlan.length) {
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
        const first = pathPlan[0];
        prefetchCaption(first.clip, first.category, behaviorContext(), first.stage);
      } catch (error) {
        console.warn('[sanctuary] caption prefetch failed:', error);
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
        console.warn('[sanctuary] service worker registration failed', error);
      });
    });
  }
})();
