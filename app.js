
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
  const MUSIC_GAIN = 0.42;
  const NOISE_GAIN = 0.22;

  const LANG_STORAGE_KEY = 'sanctuary-lang';
  const I18N = {
    ru: {
      docTitle: 'Digital Sanctuary — интерактивное убежище',
      entryAria: 'Вход в убежище',
      entryKicker: 'ЦИФРОВОЕ УБЕЖИЩЕ',
      appKicker: 'ПОРОГ ТИШИНЫ',
      appTitle: 'Оставь шум снаружи.<br>Войди в сон без слов',
      guideSwipe: 'Потяни вверх — чтобы войти и листать',
      guideHold: 'Удерживай — чтобы замедлить время',
      entryTitle: 'Закрытое пространство<br>тишины и созерцания',
      entrySub: 'Без слов, оценок и попыток<br>тебя исправить',
      enter: 'Войти',
      nav: 'Листай вверх как сон · Задержи палец, если кадр отзывается',
      installApp: 'Установить приложение на экран',
      installHint: 'Нажмите «Поделиться» → «На экран Домой»',
      installCardTitle: 'Сохранить убежище',
      install: 'Установить приложение',
      tapToBegin: 'Нажмите, чтобы начать',
      installedNote: 'Убежище установлено. Закройте браузер и откройте иконку с экрана телефона',
      installInApp: 'Откройте в Chrome (⋮ → Открыть в браузере), чтобы установить приложение',
      installHelp: 'Как установить',
      installManual: 'Меню браузера ⋮ → Установить приложение / На экран Домой',
      iosKicker: 'СОХРАНИТЬ УБЕЖИЩЕ',
      iosSafari1: 'Нажмите «Поделиться» на нижней панели',
      iosSafari2: 'Выберите «На экран Домой»',
      iosInapp1: 'Откройте эту страницу в Safari',
      iosInapp2: 'Затем нажмите «Поделиться» → «На экран Домой»',
      close: 'Закрыть',
      copy: 'Скопировать',
      copied: 'Скопировано',
      swipe: 'Потяни вверх · Удерживай, чтобы замедлить',
      finaleKicker: 'ТИШИНА',
      finaleTitle: 'Сон завершён',
      finaleSub: 'ПРОСТРАНСТВО РЯДОМ',
      finaleBody1: 'Здесь ничего не нужно объяснять или исправлять.',
      finaleBody2: 'Тишина просто побыла рядом — ты можешь остаться в ней или вернуться в любой момент.',
      loading: 'ТИШИНА...',
      back: 'Ещё один сон',
      cycle1: 'Первый круг завершён. Теперь сон опускается глубже',
      cycleKicker: 'КРУГ I // ПРОЙДЕН',
      cycle2: 'Второй круг пройден. Тишина остаётся рядом.',
      cycle3: 'Круг сна завершён. Дыхание продолжается.',
      lockLabel: 'ПРОДОЛЖЕНИЕ',
      lockedPrefix: 'Продолжение через',
      lockEntryKicker: 'ДВЕРЬ ЗАКРЫТА',
      lockEntryHint: 'Тишина ещё длится',
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
      appKicker: 'THRESHOLD OF STILLNESS',
      appTitle: 'Leave the noise outside.<br>Enter a dream without words',
      guideSwipe: 'Swipe up — to enter and shift',
      guideHold: 'Hold — to slow down time',
      entryTitle: 'A private space<br>of silence and stillness',
      entrySub: 'No words, no judgments,<br>no attempts to fix you',
      enter: 'Enter',
      nav: 'Swipe up like a dream · Hold when a frame resonates',
      installApp: 'Add the app to your screen',
      installHint: 'Tap Share → Add to Home Screen',
      installCardTitle: 'Keep the sanctuary',
      install: 'Install app',
      tapToBegin: 'Tap to begin',
      installedNote: 'Sanctuary installed. Close the browser and open it from your home screen',
      installInApp: 'Open in Chrome (⋮ → Open in browser) to install',
      installHelp: 'How to install',
      installManual: 'Browser menu ⋮ → Install app / Add to Home Screen',
      iosKicker: 'SAVE THE SANCTUARY',
      iosSafari1: 'Tap Share in the bottom bar',
      iosSafari2: 'Select «Add to Home Screen»',
      iosInapp1: 'Open this page in Safari',
      iosInapp2: 'Then tap Share → Add to Home Screen',
      close: 'Close',
      copy: 'Copy',
      copied: 'Copied',
      swipe: 'Swipe up · Hold to sink deeper',
      finaleKicker: 'SILENCE',
      finaleTitle: 'The dream is complete',
      finaleSub: 'THE SPACE BESIDE YOU',
      finaleBody1: 'Nothing here needs to be explained or repaired.',
      finaleBody2: 'Silence simply stayed beside you — you can remain in it or return at any moment.',
      loading: 'LISTENING...',
      back: 'One more dream',
      cycle1: 'First cycle complete. The dream now descends deeper',
      cycleKicker: 'CYCLE I // COMPLETE',
      cycle2: 'Second cycle passed. Silence remains beside you.',
      cycle3: 'Dream cycle complete. Breathing continues.',
      lockLabel: 'CONTINUATION',
      lockedPrefix: 'Continues in',
      lockEntryKicker: 'THE DOOR IS CLOSED',
      lockEntryHint: 'The silence is still here',
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
      
    }
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
      if (window.umami && typeof window.umami.track === 'function') {
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
  const stageLabelEl = document.getElementById('stage-label');
  let swipeHint = document.getElementById('swipe-hint');
  const entryTrigger = document.getElementById('entry-trigger');
  const entryInstallButton = document.getElementById('entry-install');
  const entryTapPrompt = document.getElementById('entry-tap-prompt');
  const entryLock = document.getElementById('entry-lock');
  const entryLockKicker = document.getElementById('entry-lock-kicker');
  const entryLockTime = document.getElementById('entry-lock-time');
  const entryLockHint = document.getElementById('entry-lock-hint');
  const entryLockLight = document.getElementById('entry-lock-light');
  const guideLine1 = document.getElementById('guide-line-1');
  const guideLine2 = document.getElementById('guide-line-2');
  const entryInstalledNote = document.getElementById('entry-installed-note');
  const entryInstallHint = document.getElementById('entry-install-hint');
  const installCard = document.getElementById('install-card');
  const installCardInstall = document.getElementById('install-card-install');
  const installCardLater = document.getElementById('install-card-later');
  const installCardHint = document.getElementById('install-card-hint');
  const installCardInfo = document.getElementById('install-card-info');
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
  if (SCREEN_TIER === 'low' && finaleSessionVideo) finaleSessionVideo.remove();
  const finalePortraitEl = document.getElementById('finale-portrait');
  const finaleCountdownEl = document.getElementById('finale-countdown');
  const finaleReflectionEl = document.getElementById('finale-reflection');
  const finaleLockInlineEl = document.getElementById('finale-lock-inline');
  const finaleLockLabel = document.getElementById('finale-lock-label');
  const copySnapshotButton = document.getElementById('copy-snapshot');
  const notifyReturnButton = document.getElementById('notify-return');
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
    const appMode = isStandaloneMode();
    setText('.entry-kicker', appMode ? 'appKicker' : 'entryKicker');
    setHtml('.entry-title', appMode ? 'appTitle' : 'entryTitle');
    if (guideLine1) guideLine1.textContent = tr('guideSwipe');
    if (guideLine2) guideLine2.textContent = tr('guideHold');
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
    if (entryTapPrompt) entryTapPrompt.textContent = tr('tapToBegin');
    if (entryLockKicker) entryLockKicker.textContent = tr('lockEntryKicker');
    if (entryLockHint) entryLockHint.textContent = tr('lockEntryHint');
    if (entryInstalledNote) entryInstalledNote.textContent = tr('installedNote');
    if (installCardHint) installCardHint.textContent = tr('installHint');
    if (installCardInfo) installCardInfo.textContent = tr('installInApp');
    if (iosInstallKicker) iosInstallKicker.textContent = tr('iosKicker');
    if (iosSafari1) iosSafari1.textContent = tr('iosSafari1');
    if (iosSafari2) iosSafari2.textContent = tr('iosSafari2');
    if (iosInapp1) iosInapp1.textContent = tr('iosInapp1');
    if (iosInapp2) iosInapp2.textContent = tr('iosInapp2');
    if (installCardLater) installCardLater.setAttribute('aria-label', tr('close'));
    if (copySnapshotButton) copySnapshotButton.textContent = tr('copy');
    if (notifyReturnButton) notifyReturnButton.textContent = tr('notify');
    if (finaleLockLabel) finaleLockLabel.textContent = tr('lockLabel');
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
  let recentTrackIds = [];
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
  let captionZeroTimer = 0;
  let captionWakeTimer = 0;
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
  let firstHintTimer = 0;
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
    if (location.protocol === 'file:') return null;
    if (location.hostname === 'yoursanctuary.ru' || location.hostname.endsWith('.github.io') || location.hostname === 's3.twcstorage.ru' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return null;
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
      prefetchNextCaptions(behavior);
      captionMemoryTimer = window.setTimeout(() => {
        if (token === captionSceneToken) maybeRecordResonance();
      }, CAPTION_LINGER_MS);
      return;
    }

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

    audio.volume = 0;
    const channel = { track, audio, fadeRaf: 0 };
    sound.channels.set(track.id, channel);
    return channel;
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
    const targetGain = sound.activeType === 'music'
      ? (held ? 0.018 : 0)
      : (held ? Math.max(0.06, profile.gain * 0.55) : profile.gain);
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

  function setStageOvertone(stageId) {
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
      master.gain.value = 0.72;

      bus.connect(rumbleCut);
      rumbleCut.connect(depth);
      depth.connect(breath);
      breath.connect(compressor);
      compressor.connect(breathPulse);
      breathPulse.connect(master);
      master.connect(ctx.destination);

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
      overtone.type = 'sine';
      overtone.frequency.value = 110;
      const overtoneGain = ctx.createGain();
      overtoneGain.gain.value = 0.008;
      overtone.connect(overtoneGain);
      overtoneGain.connect(bus);
      overtone.start();

      const subBass = ctx.createOscillator();
      subBass.type = 'sine';
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

      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      setElementalNoise(currentOpticElement);
      setStageOvertone(sessionStage);
      setStageSubBass(sessionStage);

      preloadFirstTracks();
    } catch (_) {
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
      channel.audio.playbackRate = SCREEN_TIER === 'low' ? 1 : (sound.held ? SLOW_RATE : 1);
      return;
    }

    channel.audio.playbackRate = SCREEN_TIER === 'low' ? 1 : (sound.held ? SLOW_RATE : 1);
    channel.audio.preload = 'auto';
    startSoundCrossfade(channel, duration);
  }

  function startSoundCrossfade(channel, fadeMs) {
    if (!sound) return;

    const duration = Math.max(120, fadeMs || SLOW_FADE_MS);
    const targetId = channel ? channel.track.id : null;
    const fadeToken = ++sound.fadeToken;

    sound.activeTrackId = targetId;
    sound.activeTrack = channel ? channel.track : null;
    sound.activeType = channel ? 'music' : 'noise';
    if (channel && channel.track) {
      recentTrackIds.push(channel.track.id);
      recentTrackIds = recentTrackIds.slice(-18);
    }

    for (const [id, item] of sound.channels) {
      if (channel && id === targetId) {
        item.audio.volume = 0;
        fadeChannelVolume(item, 0, duration);
      } else {
        fadeChannelVolume(item, 0, duration);
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
      channel.audio.playbackRate = SCREEN_TIER === 'low' ? 1 : (sound.held ? SLOW_RATE : 1);
      channel.audio.volume = 0;
      window.setTimeout(() => {
        if (!sound || fadeToken !== sound.fadeToken) return;
        const promise = channel.audio.play();
        if (promise && typeof promise.catch === 'function') {
          promise.catch(() => {
            if (!sound || sound.activeTrackId !== targetId) return;
            startSoundCrossfade(null, fadeMs);
          });
        }
        fadeChannelVolume(channel, MUSIC_GAIN, duration);
      }, 120);
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
    const now = sound.ctx.currentTime;
    const cutoff = deep ? (SCREEN_TIER === 'low' ? 650 : 750) : 18000;

    sound.depth.frequency.cancelScheduledValues(now);
    sound.depth.frequency.setValueAtTime(sound.depth.frequency.value, now);
    sound.depth.frequency.exponentialRampToValueAtTime(cutoff, now + 0.45);

    sound.master.gain.cancelScheduledValues(now);
    sound.master.gain.setValueAtTime(sound.master.gain.value, now);
    sound.master.gain.linearRampToValueAtTime(deep ? 0.58 : 0.72, now + 0.4);

    for (const channel of sound.channels.values()) {
      channel.audio.playbackRate = SCREEN_TIER === 'low' ? 1 : (deep ? SLOW_RATE : 1);
      fadeChannelVolume(channel, deep ? MUSIC_GAIN * 0.55 : MUSIC_GAIN, 420);
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

  

  function playbackUrl(url) {
    return url;
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

  function stageLabelFor(stageId) {
    if (stageId === 1) return '01 // НАЧАЛО';
    if (stageId === 2) return '02 // ГЛУБИНА';
    if (stageId === 3) return '03 // ТИШИНА';
    return '04 // ВЫХОД';
  }

  function updateStageLabel(stageId) {
    sessionStage = stageId || sessionStage;
    setStageOvertone(sessionStage);
    setStageSubBass(sessionStage);
    if (stageLabelEl) stageLabelEl.textContent = stageLabelFor(sessionStage);
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
    portraitText = '';
    portraitRequestId += 1;

    if (copySnapshotButton) copySnapshotButton.textContent = tr('copy');
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
    if (finaleLockInlineEl) finaleLockInlineEl.textContent = text;
    if (entryLock) {
      entryLock.hidden = !showEntryLock;
      if (entryLockTime) entryLockTime.textContent = text;
      if (entryLockLight) entryLockLight.style.width = `${Math.max(0, Math.min(100, (remaining / SESSION_LOCK_MS) * 100))}%`;
      if (entryGate) entryGate.classList.toggle('is-locked', showEntryLock);
    }

    if (!gateOpen) {
      if (remaining > 0) {
        if (entryTrigger) {
          entryTrigger.disabled = true;
          entryTrigger.textContent = `${tr('lockedPrefix')} ${text}`;
        }
      } else {
        if (entryTrigger) {
          entryTrigger.disabled = false;
          entryTrigger.textContent = tr('enter');
        }
      }
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

  function finaleFallbackReflection() {
    const held = (state.totalHolds || 0) > 0
      || sessionEvents.some((event) => event.held || event.heldMs > 0);
    if (currentLang === 'en') {
      return held
        ? 'You lingered where the gaze usually slips past. The space remembered that response — the door will open again in two hours, when the silence settles.'
        : 'You moved through the frames faster than a breath, trying not to linger. The door closes for two hours — return when you are ready to look more slowly.';
    }
    if (held) {
      return 'Ты замирал там, где взгляд обычно скользит мимо. Пространство запомнило этот отклик — продолжение откроется через два часа, когда тишина уляжется.';
    }
    return 'Ты шёл сквозь кадры быстрее, чем успевал выдохнуть, стараясь не задерживаться. Дверь закрывается на два часа — возвращайся, когда будешь готов смотреть медленнее.';
  }

  function finaleReflectionIsValid(text) {
    if (!text) return false;
    if (currentLang === 'en') {
      if (!/[A-Za-z]/.test(text) || /[А-Яа-яЁё]/.test(text)) return false;
    } else if (!/[А-Яа-яЁё]/.test(text) || /[A-Za-z]/.test(text)) {
      return false;
    }
    const sentences = text.match(/[^.!?…]+[.!?…]+/g) || [];
    return sentences.length === 2;
  }

  async function requestFinaleReflection() {
    const fallback = finaleFallbackReflection();
    if (finaleReflectionEl) finaleReflectionEl.textContent = fallback;
    if (location.protocol === 'file:') return;
    if (location.hostname === 'yoursanctuary.ru' || location.hostname.endsWith('.github.io') || location.hostname === 's3.twcstorage.ru' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;

    const heldFrames = sessionEvents.filter((event) => event.held || event.heldMs > 0).length;
    const fastFrames = sessionEvents.filter((event) => event.fast || event.early).length;
    const pauses = sessionEvents.filter((event) => event.lingered).length;
    const user = currentLang === 'en'
      ? `Across 30 frames: holds — ${heldFrames}, fast swipes — ${fastFrames}, pauses — ${pauses}. Total holds — ${state.totalHolds || 0}.
Write exactly 2 short English sentences. No numbers, jargon, video titles, or advice.`
      : `За 30 кадров: удержаний — ${heldFrames}, быстрых свайпов — ${fastFrames}, пауз — ${pauses}. Всего удержаний за сессию — ${state.totalHolds || 0}.
Напиши ровно 2 коротких предложения на русском. Без цифр, терминов, названий роликов, англицизмов и советов.`;

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FINALE_TIMEOUT_MS);
    try {
      const response = await fetch(DEEPSEEK_PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: currentLang === 'en'
                ? 'You are a quiet, perceptive observer of dreams. From the rhythm of viewing and holds, write 2 short, intriguing English sentences without jargon, anglicisms, or moralizing. Create the feeling that the space noticed a hidden reaction, and gently close the door for 2 hours so that what was seen can settle.'
                : 'Ты — тихий, проницательный наблюдатель сна. На основе ритма просмотров и удержаний напиши 2 коротких, интригующих предложения на русском языке без терминов, англицизмов и морали. Создай ощущение, что пространство заметило скрытую реакцию пользователя, и мягко закрой дверь на 2 часа, чтобы увиденное улеглось.',
            },
            { role: 'user', content: user },
          ],
          temperature: 0.8,
          max_tokens: 120,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json();
      const raw = payload
        && payload.choices
        && payload.choices[0]
        && payload.choices[0].message
        && payload.choices[0].message.content;
      const text = String(raw || '').replace(/^["«»“”]+|["«»“”]+$/g, '').replace(/\s+/g, ' ').trim();
      if (finaleReflectionIsValid(text) && finaleReflectionEl) finaleReflectionEl.textContent = text;
    } catch (_) {
      
    } finally {
      window.clearTimeout(timer);
    }
  }

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

  function finishSession() {
    if (sessionComplete) return;

    window.clearTimeout(sessionFinalTimer);
    sessionFinalTimer = 0;
    sessionComplete = true;
    trackEvent('session_complete', { total_holds: state.totalHolds });
    stopHoldPulse();
    if (gesture) stopHold();

    const category = activeCategory();
    if (category) pauseCategory(category);
    pauseSound();

    stage.classList.add('is-finalizing');
    releaseWakeLock();
    showInstallCard(true, true);
    if (stageLabelEl) stageLabelEl.textContent = '30 // ТИШИНА';
    setSessionLock();
    updateSessionProgress();
    updateSessionLockUI();
    requestFinaleReflection();

    if (finaleEl) {
      finaleEl.hidden = false;
      finaleEl.setAttribute('aria-hidden', 'false');
      syncFinaleSessionVideo();
      window.requestAnimationFrame(() => finaleEl.classList.add('is-visible'));
    }

  }

  function returnToStart() {
    stopFinaleSessionVideo();
    if (finaleEl) {
      finaleEl.hidden = true;
      finaleEl.classList.remove('is-visible');
      finaleEl.setAttribute('aria-hidden', 'true');
    }
    stage.classList.remove('is-finalizing');
    gateOpen = false;
    pathStarted = false;
    pathPos = -1;
    pathPlan = [];
    pathPicked = new Set();
    if (entryGate) {
      entryGate.hidden = false;
      entryGate.classList.remove('is-open');
      entryGate.setAttribute('aria-hidden', 'false');
    }
    hideInstallCard();
    beginSession();
    if (!buildSessionPlan()) appendFallbackPath(true);
    updateSessionLockUI();
  }

  function stageNameFor(stageId) {
    return stageFor(stageId).name;
  }

  function countedSessionEvents() {
    const counted = sessionEvents.filter((event) => event.counted);
    return counted.length ? counted : sessionEvents;
  }

  function sessionTopMoment(events) {
    return events
      .slice()
      .sort((a, b) => (b.heldMs || 0) - (a.heldMs || 0) || (b.viewedMs || 0) - (a.viewedMs || 0))[0];
  }

  function sessionAverageSeconds(events) {
    if (!events.length) return 0;
    const total = events.reduce((sum, event) => sum + (event.viewedMs || 0), 0);
    return Math.max(0.1, total / events.length / 1000);
  }

  function topTitlesForStage(events, stageId, limit = 2) {
    return events
      .filter((event) => Number(event.stage) === Number(stageId))
      .slice()
      .sort((a, b) => (b.heldMs || 0) - (a.heldMs || 0) || (b.viewedMs || 0) - (a.viewedMs || 0))
      .slice(0, limit)
      .map((event) => String(event.title || '').split(/\s+/).slice(0, 5).join(' '))
      .filter(Boolean);
  }

  function fallbackSessionPortrait() {
    const events = countedSessionEvents();
    const shadowTitle = topTitlesForStage(events, 1, 1)[0];
    const trickTitle = topTitlesForStage(events, 2, 1)[0];
    const calmTitle = topTitlesForStage(events, 3, 1)[0];
    const pathTitle = topTitlesForStage(events, 4, 1)[0];

    if (currentLang === 'en') {
      const shadow = shadowTitle || 'the dark frame';
      const trick = trickTitle || 'the edge of intensity';
      const calm = calmTitle || 'the quiet frame';
      const path = pathTitle || 'the open horizon';
      return [
        `Shadow: attention stayed with “${shadow}”; something there is usually kept just outside the light.`,
        `Trickster and Abyss: “${trick}” held both attraction and the urge not to look directly.`,
        `Calm / Anima: “${calm}” brought breath back; not an answer, more a place to be without proving anything.`,
        `Path / Self: “${path}” points somewhere, though the direction has not yet become a choice.`,
        'Which part of this movement are you still not ready to call yours?',
      ];
    }

    const shadow = shadowTitle || 'тёмном кадре';
    const trick = trickTitle || 'краю интенсивности';
    const calm = calmTitle || 'тихом кадре';
    const path = pathTitle || 'открытом горизонте';
    return [
      `Внимание дольше оставалось на «${shadow}»; там проступает то, что обычно держат вне света.`,
      `«${trick}» удерживает и притяжение, и желание не смотреть прямо.`,
      `«${calm}» возвращает дыхание; это не ответ, скорее место, где можно быть без доказательств.`,
      `«${path}» намечает направление, хотя оно ещё не стало выбором.`,
      'Какую часть этого движения ты пока не готов назвать своей?',
    ];
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
    hideInstallCard();
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

  function dismissSwipeHint(removeElement = false) {
    window.clearTimeout(swipeHintTimer);
    swipeHintTimer = 0;
    if (!swipeHint) return;

    swipeHint.classList.remove('is-visible');
    if (removeElement) {
      swipeHint.remove();
      swipeHint = null;
    } else {
      swipeHint.hidden = true;
    }
  }

  function armSwipeHint() {
    if (!swipeHint || hasSwiped) return;

    let firstVisit = false;
    try {
      firstVisit = !localStorage.getItem('sanctuary-first-hint-seen');
    } catch (_) {
      firstVisit = true;
    }
    const delay = firstVisit ? 6000 : 1200;

    window.clearTimeout(firstHintTimer);
    window.clearTimeout(swipeHintTimer);
    swipeHint.hidden = false;
    swipeHint.classList.remove('is-visible');
    firstHintTimer = window.setTimeout(() => {
      if (!swipeHint || hasSwiped) return;
      swipeHint.classList.add('is-visible');
      try { localStorage.setItem('sanctuary-first-hint-seen', '1'); } catch (_) {}
      window.clearTimeout(swipeHintTimer);
      swipeHintTimer = window.setTimeout(() => {
        if (swipeHint && !hasSwiped) swipeHint.classList.remove('is-visible');
      }, 5200);
    }, delay);
  }

  function markFirstSwipe() {
    if (hasSwiped) return;
    hasSwiped = true;
    try { localStorage.setItem('sanctuary-first-hint-seen', '1'); } catch (_) {}
    dismissSwipeHint(true);
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
    preloadNextTrack(category);
    armSwipeHint();
    return true;
  }

  function attachVideo(category, clip, index) {
    const media = category.el.querySelector('.media');
    if (!media) return null;

    const video = document.createElement('video');
    const playUrl = clip.playUrl || playbackUrl(clip.url);

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

    video.addEventListener('loadedmetadata', () => {
      if (video.videoWidth > 0 && video.videoHeight > video.videoWidth) {
        video.classList.add('is-ready');
      }
    });

    video.addEventListener('canplay', () => video.classList.add('is-ready'));
    video.addEventListener('playing', () => video.classList.add('is-ready'));
    video.addEventListener('timeupdate', () => handleLoop(category, index, video));
    let fallbackCursor = 0;
    video.addEventListener('error', () => {
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

    video.crossOrigin = 'anonymous';
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
    const windowEntries = (SCREEN_TIER === 'low'
      ? [currentEntry || pathPlan[base], nextEntry || pathPlan[base + 1]]
      : [currentEntry || pathPlan[base], nextEntry || pathPlan[base + 1], pathPlan[base + 2]]).filter(Boolean);
    const keep = new Set();
    for (const entry of windowEntries) {
      if (!entry || !entry.clip) continue;
      keep.add(entry.clip.id);
      ensureClipVideo(entry.category, entry.clip);
      if (entry.clip.el) {
        entry.clip.el.preload = 'auto';
        if (entry.clip.el.readyState === 0) entry.clip.el.load();
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
    let catalog = embedded;

    if (location.protocol !== 'file:') {
      try {
        const response = await fetch('./videos.json', { cache: 'no-store' });
        if (response.ok) {
          const remoteCatalog = await response.json();
          if (Array.isArray(remoteCatalog) && remoteCatalog.length) {
            catalog = remoteCatalog;
          }
        }
      } catch (error) {
        if (!catalog) throw error;
      }
    }

    if (!Array.isArray(catalog) || !catalog.length) {
      throw new Error('videos.json / videos-data.js is empty or malformed');
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
        url: item.url,
        duration: Number.isFinite(Number(item.duration)) ? Number(item.duration) : 10,
        description: archetype,
        tags: [stageKey, archetype],
        vertical: Boolean(item.vertical),
        is_finale: Boolean(item.is_finale),
        element: elementForClip(title, [stageKey, archetype], tag, archetype),
        archetype,
        stage: stageKey,
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
      throw new Error('videos.json contains no playable entries');
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



  function fadeDurationFor(viewedMs, speed) {
    const impulsive = speed >= IMPULSIVE_SPEED;
    return viewedMs < QUICK_VIEW_MS || impulsive ? QUICK_FADE_MS : SLOW_FADE_MS;
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
    preparePlaybackWindow(planned, pathPlan[pathPos + 1]);

    playCategory(category);
    setSceneElement(activeClip());
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

  

  try {
    prepareSoundLibrary();
  } catch (error) {

  }

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

  function isAndroidInApp() {
    return /Android/i.test(navigator.userAgent)
      && /(wv|Telegram|Instagram|FBAN|FBAV|VK)/i.test(navigator.userAgent);
  }

  function showAndroidInfoCard() {
    if (isStandaloneMode() || installChoiceMade() || !installCard) return;
    if (iosInstallCard) { iosInstallCard.hidden = true; iosInstallCard.style.display = 'none'; }
    installCard.classList.add('install-card--info');
    if (installCardInfo) {
      installCardInfo.textContent = tr('installInApp');
      installCardInfo.hidden = false;
    }
    if (installCardHint) installCardHint.hidden = true;
    if (installCardInstall) installCardInstall.hidden = true;
    installCard.hidden = false;
    installCard.classList.add('is-visible');
    syncInstallButton();
  }

  function showAndroidFallbackCard() {
    if (isStandaloneMode() || installChoiceMade() || !installCard) return;
    if (iosInstallCard) { iosInstallCard.hidden = true; iosInstallCard.style.display = 'none'; }
    installCard.classList.remove('install-card--info');
    if (installCardInfo) installCardInfo.hidden = true;
    if (installCardHint) installCardHint.hidden = true;
    if (installCardInstall) {
      installCardInstall.hidden = false;
      installCardInstall.textContent = tr('installHelp');
    }
    installCard.hidden = false;
    installCard.classList.add('is-visible');
    syncInstallButton();
  }

  function showInstallCard(force = false, finalContext = false) {
    if (isStandaloneMode() || installChoiceMade()) return;
    if (!isIos() && !deferredPrompt) return;
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
    installCard.classList.remove('install-card--info');
    if (installCardInfo) installCardInfo.hidden = true;
    if (installCardInstall) installCardInstall.hidden = false;
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
          installCardDismissed = true;
          showInstalledState();
          try { window.close(); window.blur(); } catch (_) {}
        }
      } catch (_) {
        
      }
      if (!isIos()) hideInstallCard();
      syncInstallButton();
      return;
    }

    if (isIos()) {
      showIosInstallHint();
      return;
    }

    if (installCard && !installCard.hidden) {
      if (installCardInfo) {
        installCardInfo.textContent = tr('installManual');
        installCardInfo.hidden = false;
      }
      if (installCardHint) installCardHint.hidden = true;
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (installCard) installCard.classList.remove('install-card--info');
    if (installCardInfo) installCardInfo.hidden = true;
    if (installCardInstall) installCardInstall.hidden = false;
    showInstallCard(true);
  });

  deferredPrompt = window.__deferredInstallPrompt || deferredPrompt;

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showInstalledState();
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

  for (const card of [installCard, iosInstallCard]) {
    if (!card) continue;
    card.addEventListener('pointerdown', (event) => event.stopPropagation());
    card.addEventListener('click', (event) => event.stopPropagation());
  }

  if (installCardInstall) installCardInstall.addEventListener('click', handleInstallClick);

  function showInstalledState() {
    hideInstallCard();
    for (const card of [installCard, iosInstallCard]) {
      if (!card) continue;
      card.hidden = true;
      card.style.setProperty('display', 'none', 'important');
    }
    if (entryGate) entryGate.classList.add('is-installed');
    if (entryTapPrompt) entryTapPrompt.hidden = true;
    if (entryInstalledNote) entryInstalledNote.hidden = false;
  }

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

  if (installCardInstall) installCardInstall.hidden = true;
  if (entryGate) {
    entryGate.classList.toggle('is-standalone', isStandaloneMode());
    entryGate.classList.toggle('is-browser', !isStandaloneMode());
    entryGate.classList.toggle('entry-app-mode', isStandaloneMode());
    entryGate.classList.toggle('entry-browser-mode', !isStandaloneMode());
  }
  if (isStandaloneMode()) {
    hideInstallCard();
    if (entryTapPrompt) entryTapPrompt.hidden = false;
    if (entryInstalledNote) entryInstalledNote.hidden = true;
  } else if (!installChoiceMade()) {
    if (isIos()) showInstallCard(true);
    else if (isAndroidInApp()) showAndroidInfoCard();
    else showAndroidFallbackCard();
  }
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

  if (entryGate && isStandaloneMode()) {
    let entryStart = null;
    entryGate.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1 || event.target.closest('.lang-switch, .install-card, .install-card--ios')) {
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
  window.addEventListener('load', () => trackEvent('threshold_open'), { once: true });


  if (notifyReturnButton) {
    notifyReturnButton.addEventListener('click', enableReturnNotification);
  }

  if (backToStartButton) {
    backToStartButton.addEventListener('click', returnToStart);
  }

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