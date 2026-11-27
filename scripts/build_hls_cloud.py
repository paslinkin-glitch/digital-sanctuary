#!/usr/bin/env python3
"""Build the 30-scene Quiet Luxury video catalog in the cloud (v124).

The catalog is exactly 30 unique vertical dream scenes, grouped as
10 shadow / 8 trickster_abyss (4 of them surreal) / 6 calm / 6 path (4 of them
finale). Sixteen of them already live in S3 as 1080p masters and are never
re-encoded or overwritten: only their 720p twin and their WebP poster are
derived from the published master. The other fourteen are downloaded from free,
watermark-free Coverr files, cropped to 1080x1920 and encoded here.

Every scene ends up as three objects:

  digital-sanctuary/mp4-1080/<id>.mp4  1080x1920, 10 s, 30 fps, -an, CRF 18,
                                        -maxrate 7500k -bufsize 15000k,
                                        +faststart, at most 11.5 MB
  digital-sanctuary/mp4-720/<id>.mp4   720x1280, 10 s, 30 fps, -an, CRF 22,
                                        -maxrate 1700k -bufsize 3400k,
                                        +faststart, targeted at 1.4-2.3 MB
                                        and never above 2.3 MB
  digital-sanctuary/posters/<id>.webp   frame at 0.2 s, 480x854, quality 68,
                                        targeted at 20-35 KB and never above it
                                        (a smooth gradient frame weighs less)

The four rejected scenes (a coverr+ watermark, a bright riverside thicket and
two blown-out daytime skies) are deleted from S3 and from the catalog. Old
digital-sanctuary/hls/ objects are removed; the digital-sanctuary/audio/
library is never touched. videos-data.js and videos.json are rewritten with
url1080, url720, size720, poster and the legacy url field.
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "mp4-work"
SOURCE_DIR = WORK / "sources"
OUT_1080 = WORK / "1080"
OUT_720 = WORK / "720"
OUT_POSTER = WORK / "posters"

S3_BUCKET = os.environ.get("S3_BUCKET", "digital-sanctuary")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "https://s3.twcstorage.ru").rstrip("/")
S3_PREFIX = S3_ENDPOINT + "/" + S3_BUCKET

PREFIX_1080 = "mp4-1080"
PREFIX_720 = "mp4-720"
PREFIX_POSTER = "posters"

DURATION = 10
FPS = 30
W1080, H1080 = 1080, 1920
W720, H720 = 720, 1280
WPOSTER, HPOSTER = 480, 854

MAX_1080_BYTES = 11_500_000
SIZE_720_MIN = 1_400_000
SIZE_720_MAX = 2_300_000
POSTER_MIN = 20_000
POSTER_MAX = 35_000
POSTER_QUALITY = 68

# v124: these four frames are gone for good — one carries the coverr+ watermark,
# one is a bright daytime river thicket and two are flat midday blue skies.
REJECTED_IDS = (
    "dream-trickster-02",
    "dream-shadow-05",
    "dream-calm-03",
    "dream-path-04",
)
# No premium, plus, watermarked or preview file may ever be downloaded.
FORBIDDEN_URL_TOKENS = ("coverr+", "premium", "watermark", "preview", "/plus", "plus-")

STAGE_COUNTS = {"shadow": 10, "trickster_abyss": 8, "calm": 6, "path": 6}
STAGE_ARCH = {"shadow": "Shadow", "trickster_abyss": "Trickster", "calm": "Calm", "path": "Path"}
TRACK_CATEGORY = {
    "fog": "fog", "rain": "rain", "water": "water", "fire": "fire",
    "space": "space", "city": "city", "people": "people", "road": "road",
}

# (id, title, free source url or "" when the 1080 master already lives in S3,
#  stage, track id, is_surreal, is_finale, published 1080 size, caption_en,
#  caption_ru) — in catalog order.
SCENES = [
    ("dream-shadow-01", "Misty Mountains in Sao Vicente", "", "shadow", "fog-01", False, False, 5549780, "Cloud slides down the green ridges and stops above the valley. Nothing in this weather asks you to decide.", "Облако сползает по зелёным хребтам и замирает над долиной. В такую погоду решать нечего."),
    ("dream-shadow-03", "Glade in Fanal", "", "shadow", "fog-03", False, False, 10654112, "Laurel trees close around a small clearing and the moss holds the damp air. Some places in a person are this old and this green.", "Лавры смыкаются вокруг маленькой поляны, мох держит влажный воздух. Есть в человеке места такие же древние и зелёные."),
    ("dream-shadow-06", "Forest in Geres", "", "shadow", "rain-01", False, False, 9406561, "Trunks stand close together and the path between them narrows. The forest does not ask you to be quick.", "Стволы стоят близко, тропа между ними сужается. Лес не просит тебя торопиться."),
    ("dream-shadow-07", "A Lake Near a Forest", "", "shadow", "rain-02", False, False, 8334140, "Still water holds a second forest, darker than the first. The reflection knows more than it says.", "Тихая вода держит второй лес, темнее первого. Отражение знает больше, чем говорит."),
    ("dream-shadow-08", "Cloudy Day in Fanal", "", "shadow", "rain-03", False, False, 9791360, "Low cloud drifts between the trees and softens every edge. Even the sharp things breathe here.", "Низкое облако идёт между деревьями и смягчает все края. Даже острое здесь дышит."),
    ("dream-shadow-10", "Mountain Tops", "", "shadow", "water-01", False, False, 7219737, "Peaks stand above the cloud layer in the early light. From this height the worry looks small.", "Вершины стоят над облаками в раннем свете. С этой высоты тревога кажется маленькой."),
    ("dream-trickster-01", "Blurry Sunset", "", "trickster_abyss", "fire-01", True, False, 7097670, "The sun blurs into the horizon and the whole frame forgets its edges. Let the day dissolve a little too.", "Солнце расплывается у горизонта, и весь кадр забывает свои края. Дай и дню немного раствориться."),
    ("dream-trickster-05", "Calm Waves in a Gulf", "", "trickster_abyss", "water-03", False, False, 11728153, "Small waves arrive one after another and each one is slightly different. Stillness keeps moving.", "Небольшие волны приходят одна за другой, и каждая чуть другая. Покой продолжает двигаться."),
    ("dream-trickster-06", "A Tide of Foamy Waves", "", "trickster_abyss", "water-04", False, False, 10603905, "Foam slides up the shore and the sea takes it back almost at once. Everything here is brief.", "Пена поднимается по берегу, и море почти сразу забирает её назад. Всё здесь ненадолго."),
    ("dream-trickster-07", "Bioluminescent Waves", "", "trickster_abyss", "space-01", True, False, 11118678, "Blue light burns along the breaking waves in the dark and vanishes behind them. Something glows only where it breaks.", "Синий свет горит по гребням волн в темноте и гаснет за ними. Иное светится только там, где сломалось."),
    ("dream-trickster-08", "Sunset over the Atlantic", "", "trickster_abyss", "city-01", True, False, 8994648, "The sky turns copper and the whole ocean carries the colour for a moment. Then the light gives itself to the water.", "Небо становится медным, и весь океан на миг удерживает этот цвет. Потом свет отдаёт себя воде."),
    ("dream-calm-01", "Sunset in Costa Rica", "", "calm", "city-02", False, False, 9221751, "Warm light settles on the water and the day stops asking for anything. You can put the weight down here.", "Тёплый свет ложится на воду, и день перестаёт чего-то требовать. Здесь можно опустить груз."),
    ("dream-calm-04", "Lake Landscape in Salta", "", "calm", "people-01", False, False, 7802994, "Clouds and mountains share the surface of the lake without arguing. Both of them are held.", "Облака и горы делят поверхность озера без спора. Оба удержаны."),
    ("dream-calm-05", "Lago di Braies Reflection", "", "calm", "people-02", False, False, 7736194, "Wooden boats rest on green water and the peaks lean into it exactly. Mountains look gentler when they mirror.", "Деревянные лодки стоят на зелёной воде, вершины наклоняются в неё точно так же. Горы выглядят мягче, когда отражаются."),
    ("dream-path-01", "The Endless Horizon", "", "path", "road-01", False, True, 4168594, "A long line of light opens all the way to the edge of sight. You do not need a map for this.", "Длинная полоса света открывается до самого края зрения. Карта здесь не нужна."),
    ("dream-path-05", "A Pier in the Ocean", "", "path", "space-03", False, False, 4399847, "The pier reaches into open water and ends there, still pointing forward. Not every road has to arrive.", "Причал уходит в открытую воду и заканчивается там, всё ещё указывая вперёд. Не каждая дорога должна привести к цели."),
    ("dream-shadow-11", "Trees in the Misty Forest", "https://cdn.coverr.co/videos/coverr-trees-in-the-misty-forest-442/1080p.mp4", "shadow", "fog-06", False, False, 0, "Trunks fade one into the next and the fog keeps the distance soft. Nothing here is in a hurry to be seen.", "Стволы переходят один в другой, и туман держит расстояние мягким. Ничто здесь не спешит быть увиденным."),
    ("dream-shadow-12", "Rain Falling in the Forest", "https://cdn.coverr.co/videos/coverr-rain-falling-in-the-forest-9275/1080p.mp4", "shadow", "rain-05", False, False, 0, "Rain touches every leaf at once and the forest answers with one low sound. You can let the weather do the talking.", "Дождь касается каждого листа сразу, и лес отвечает одним низким звуком. Позволь погоде говорить вместо тебя."),
    ("dream-shadow-13", "Mountains Covered with Fog", "https://cdn.coverr.co/videos/coverr-mountains-covered-with-fog-1363/1080p.mp4", "shadow", "fog-07", False, False, 0, "Fog takes the ridges one by one until only the nearest slope is left. Distance becomes a kindness.", "Туман забирает хребет за хребтом, пока не остаётся только ближний склон. Даль становится милостью."),
    ("dream-shadow-14", "Tree in the Mist", "https://cdn.coverr.co/videos/coverr-tree-in-the-mist-4598/1080p.mp4", "shadow", "fog-08", False, False, 0, "A single tree stands in the mist and does not try to look like anything else. It is enough exactly as it is.", "Одно дерево стоит в тумане и не пытается быть чем-то другим. Его достаточно ровно таким, какое есть."),
    ("dream-trickster-09", "Foamy Ocean Waves at Night", "https://cdn.coverr.co/videos/coverr-foamy-ocean-waves-at-night-2122/1080p.mp4", "trickster_abyss", "water-05", True, False, 0, "Pale foam keeps arriving out of the dark and the sea never explains where it goes. Something in you moves the same way.", "Бледная пена приходит из темноты снова и снова, и море не объясняет, куда уходит. Что-то в тебе движется так же."),
    ("dream-trickster-10", "Sumatra at Night", "https://cdn.coverr.co/videos/coverr-sumatra-at-night-6603/1080p.mp4", "trickster_abyss", "water-06", False, False, 0, "Night settles on the water and the far shapes lose their names. What is left is only weight and breath.", "Ночь ложится на воду, и дальние силуэты теряют имена. Остаются только вес и дыхание."),
    ("dream-trickster-11", "Slow Waves at Dusk", "https://cdn.coverr.co/videos/coverr-slow-waves-9578/1080p.mp4", "trickster_abyss", "water-07", False, False, 0, "The water lifts and puts itself back down without a sound. Rest can look exactly like this.", "Вода поднимается и опускается обратно беззвучно. Покой может выглядеть ровно так."),
    ("dream-calm-06", "The Ocean in the Evening", "https://cdn.coverr.co/videos/coverr-the-ocean-in-the-evening-3606/1080p.mp4", "calm", "fog-09", False, False, 0, "Evening colour drains into the sea and the horizon stops asking for attention. You can breathe out here.", "Вечерний цвет стекает в море, и горизонт перестаёт требовать внимания. Здесь можно выдохнуть."),
    ("dream-calm-07", "Slow Motion Rippling Water", "https://cdn.coverr.co/videos/coverr-slow-motion-rippling-water-1418/1080p.mp4", "calm", "water-08", False, False, 0, "Rings widen across still water and vanish before they reach the edge. Thoughts do the same when you stop pushing them.", "Круги расходятся по тихой воде и исчезают, не дойдя до края. Мысли делают так же, когда их не подгоняешь."),
    ("dream-calm-08", "Rain on a Puddle", "https://cdn.coverr.co/videos/coverr-rain-on-a-puddle-4247/1080p.mp4", "calm", "rain-06", False, False, 0, "Rain writes small circles on a puddle and erases them at once. Nothing has to stay to have mattered.", "Дождь пишет маленькие круги на луже и сразу стирает их. Необязательно оставаться, чтобы иметь значение."),
    ("dream-path-06", "Road in the Mountains", "https://cdn.coverr.co/videos/coverr-road-in-the-mountains-7132/1080p.mp4", "path", "road-05", False, True, 0, "The road bends out of sight and the mountains keep their patience. You do not need to see the whole way.", "Дорога уходит за поворот, и горы сохраняют терпение. Не нужно видеть весь путь целиком."),
    ("dream-path-07", "A Road That Leads to the Sea", "https://cdn.coverr.co/videos/coverr-a-road-that-leads-to-the-sea-7953/1080p.mp4", "path", "road-06", False, True, 0, "The road drops toward water and ends where the light begins. Somewhere ahead the evening is already waiting.", "Дорога спускается к воде и заканчивается там, где начинается свет. Где-то впереди вечер уже ждёт."),
    ("dream-path-08", "Clouds Above a Road", "https://cdn.coverr.co/videos/coverr-clouds-above-a-road-8760/1080p.mp4", "path", "space-04", False, True, 0, "Cloud sits low over the empty road and the way ahead turns soft. Go slowly; the evening is not going anywhere.", "Облако лежит низко над пустой дорогой, и путь впереди становится мягким. Иди медленно: вечер никуда не денется."),
    ("dream-path-09", "Palm Trees at Twilight", "https://cdn.coverr.co/videos/coverr-palm-trees-at-twilight-8442/1080p.mp4", "path", "space-05", False, False, 0, "Palm silhouettes hold the last of the light and let the rest go. The day closes without a single word.", "Силуэты пальм держат последний свет и отпускают остальное. День закрывается без единого слова."),
]

CAPTIONS = [(scene[8], scene[9]) for scene in SCENES]

def validate_scene_table():
    """Fail before a single byte is downloaded if the catalog is unsound."""
    if len(SCENES) != 30:
        raise RuntimeError("scene count " + str(len(SCENES)) + " != 30")
    ids = [scene[0] for scene in SCENES]
    if len(set(ids)) != len(ids):
        raise RuntimeError("duplicate scene id in SCENES")
    titles = [scene[1] for scene in SCENES]
    if len(set(titles)) != len(titles):
        raise RuntimeError("duplicate scene title in SCENES")
    for rejected in REJECTED_IDS:
        if rejected in ids:
            raise RuntimeError("rejected scene still in the table: " + rejected)
    counts = {}
    for scene in SCENES:
        counts[scene[3]] = counts.get(scene[3], 0) + 1
    if counts != STAGE_COUNTS:
        raise RuntimeError("stage distribution " + str(counts) + " != " + str(STAGE_COUNTS))
    surreal = [scene[0] for scene in SCENES if scene[5]]
    finale = [scene[0] for scene in SCENES if scene[6]]
    if len(surreal) != 4:
        raise RuntimeError("expected 4 surreal scenes, got " + str(len(surreal)))
    if len(finale) != 4:
        raise RuntimeError("expected 4 finale scenes, got " + str(len(finale)))
    for scene in SCENES:
        if scene[5] and scene[3] != "trickster_abyss":
            raise RuntimeError("surreal flag outside trickster_abyss: " + scene[0])
        if scene[6] and scene[3] != "path":
            raise RuntimeError("finale flag outside path: " + scene[0])
        source = scene[2]
        if not source:
            continue
        if not source.startswith("https://"):
            raise RuntimeError("source is not https: " + source)
        low = source.lower()
        for token in FORBIDDEN_URL_TOKENS:
            if token in low:
                raise RuntimeError("forbidden source token " + token + " in " + source)
    validate_captions()


def validate_captions():
    if len(CAPTIONS) != len(SCENES):
        raise RuntimeError("caption count " + str(len(CAPTIONS)) + " != scene count")
    seen_en = set()
    seen_ru = set()
    for en, ru in CAPTIONS:
        if len(en) < 60 or len(ru) < 60:
            raise RuntimeError("caption too short: " + en + " | " + ru)
        if "In the quiet" in en or "В тишине" in ru:
            raise RuntimeError("template caption leaked: " + en + " | " + ru)
        if en in seen_en or ru in seen_ru:
            raise RuntimeError("duplicate caption: " + en + " | " + ru)
        seen_en.add(en)
        seen_ru.add(ru)


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def ffprobe(path):
    result = subprocess.run([
        "ffprobe", "-v", "error",
        "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration",
        "-of", "json", str(path),
    ], capture_output=True, text=True, check=True)
    payload = json.loads(result.stdout)
    video = next((s for s in payload["streams"] if s.get("codec_type") == "video"), None)
    audio = [s for s in payload["streams"] if s.get("codec_type") == "audio"]
    if not video:
        raise RuntimeError("no video stream: " + str(path))
    rate = str(video.get("r_frame_rate", "30/1")).split("/")
    fps = float(rate[0]) / float(rate[1] or 1)
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "duration": float(payload["format"]["duration"]),
        "fps": fps,
        "audio": len(audio),
        "bytes": Path(path).stat().st_size,
    }


def download(url, path, referer="https://coverr.co/"):
    run(["curl", "-L", "-sS", "-A", "Mozilla/5.0", "-e", referer,
         "--max-time", "300", "--retry", "3", "--retry-delay", "2",
         "-o", str(path), url])
    if not path.exists() or path.stat().st_size < 100_000:
        raise RuntimeError("download failed or truncated: " + url)


def encode(source, out, width, height, crf, maxrate, bufsize, level):
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-t", str(DURATION), "-an",
        "-vf", "scale=" + str(width) + ":" + str(height)
        + ":force_original_aspect_ratio=increase,crop=" + str(width) + ":" + str(height)
        + ",fps=" + str(FPS) + ",setsar=1",
        "-r", str(FPS),
        "-c:v", "libx264", "-profile:v", "high", "-level:v", level, "-preset", "slow",
        "-crf", str(crf), "-maxrate", maxrate, "-bufsize", bufsize,
        "-pix_fmt", "yuv420p", "-g", "60", "-keyint_min", "30", "-sc_threshold", "0",
        "-movflags", "+faststart", "-map_metadata", "-1", str(out),
    ])


def verify_mp4(path, width, height):
    info = ffprobe(path)
    if (info["width"], info["height"]) != (width, height):
        raise RuntimeError(path.name + ": wrong size " + str(info["width"]) + "x" + str(info["height"]))
    if abs(info["duration"] - DURATION) > 0.25:
        raise RuntimeError(path.name + ": wrong duration " + str(info["duration"]))
    if info["audio"]:
        raise RuntimeError(path.name + ": audio stream present")
    if abs(info["fps"] - FPS) > 1.0:
        raise RuntimeError(path.name + ": wrong fps " + str(info["fps"]))
    return info


def build_1080(source, out):
    """One CRF 18 pass capped at 7500k, with one cheaper retry under 11.5 MB."""
    encode(source, out, W1080, H1080, 18, "7500k", "15000k", "4.2")
    size = out.stat().st_size
    if size > MAX_1080_BYTES:
        print("  " + out.name + " is " + str(size) + " bytes, re-encoding under the 11.5 MB ceiling", flush=True)
        encode(source, out, W1080, H1080, 20, "6000k", "12000k", "4.2")
        size = out.stat().st_size
        if size > MAX_1080_BYTES:
            raise RuntimeError(out.name + ": " + str(size) + " bytes exceeds 11.5 MB")
    verify_mp4(out, W1080, H1080)
    return size


# crf -> (maxrate, bufsize): the cap always follows the quality rung.
RATE_720 = {
    17: ("2300k", "4600k"),
    18: ("2200k", "4400k"),
    19: ("2100k", "4200k"),
    20: ("2000k", "4000k"),
    22: ("1700k", "3400k"),
    24: ("1400k", "2800k"),
    26: ("1200k", "2400k"),
}


def build_720(source, out):
    """CRF 22 / 1700k first, then walk towards the 1.4-2.3 MB band.

    A busy frame lands in the band at CRF 22. A near-empty frame (a flat
    horizon, a still lake) can stay under 1.4 MB even at CRF 18, so the walk
    goes up in quality until the band is met and, failing that, keeps the
    best render that still sits under the 2.3 MB ceiling: lighter is never a
    defect, heavier is. Every render is measured in a candidate file, so the
    published object is always one that was actually checked.
    """
    candidate = OUT_720 / (out.stem + ".candidate.mp4")

    def render(crf):
        maxrate, bufsize = RATE_720[crf]
        encode(source, candidate, W720, H720, crf, maxrate, bufsize, "3.1")
        return candidate.stat().st_size

    def publish():
        shutil.move(str(candidate), str(out))
        verify_mp4(out, W720, H720)

    size = render(22)
    if SIZE_720_MIN <= size <= SIZE_720_MAX:
        publish()
        return size

    accepted = None
    if size > SIZE_720_MAX:
        # Too heavy: trade quality away until it fits under the ceiling.
        walk = [24, 26]
    else:
        # Too light: spend quality (and bytes) until the target floor is met.
        accepted = (22, size)
        walk = [20, 19, 18, 17]
    print("  " + out.name + " landed at " + str(size) + " bytes with CRF 22, walking on",
          flush=True)
    for crf in walk:
        size = render(crf)
        if SIZE_720_MIN <= size <= SIZE_720_MAX:
            publish()
            return size
        if size <= SIZE_720_MAX and (accepted is None or size > accepted[1]):
            accepted = (crf, size)
        print("  " + out.name + " landed at " + str(size) + " bytes with CRF "
              + str(crf), flush=True)
        if size > SIZE_720_MAX:
            break
    if accepted is None:
        raise RuntimeError(out.name + ": every CRF rung is above the "
                           + str(SIZE_720_MAX) + " byte ceiling")
    crf, size = accepted
    render(crf)
    publish()
    print("  " + out.name + ": " + str(size) + " bytes at CRF " + str(crf)
          + " is a smooth frame under the " + str(SIZE_720_MIN) + " byte target, keeping it",
          flush=True)
    return size


def render_poster(source, out, quality):
    run([
        "ffmpeg", "-y", "-v", "error", "-ss", "0.2", "-i", str(source),
        "-frames:v", "1", "-an",
        "-vf", "scale=" + str(WPOSTER) + ":" + str(HPOSTER)
        + ":force_original_aspect_ratio=increase,crop=" + str(WPOSTER) + ":" + str(HPOSTER)
        + ",setsar=1",
        "-c:v", "libwebp", "-quality", str(quality), "-compression_level", "6",
        "-map_metadata", "-1", str(out),
    ])
    return out.stat().st_size


def build_poster(source, out):
    """A 480x854 WebP still from 0.2 s, tuned towards the 20-35 KB band.

    Quality 68 is the target. A frame that comes out heavier is re-rendered
    downward until it fits under 35 KB. A very smooth frame (a blurred sunset,
    a flat fog bank) simply cannot pass 20 KB at this size — WebP wins there —
    so the lightest still is kept instead of being padded up: a 13 KB poster
    is a better poster, and the band is a ceiling we never want to cross.
    """
    size = render_poster(source, out, POSTER_QUALITY)
    if POSTER_MIN <= size <= POSTER_MAX:
        return size
    if size > POSTER_MAX:
        for quality in (56, 48, 40, 32):
            size = render_poster(source, out, quality)
            if POSTER_MIN <= size <= POSTER_MAX:
                return size
            if size < POSTER_MIN:
                print("  " + out.name + ": " + str(size) + " bytes after quality "
                      + str(quality) + ", keeping it lighter", flush=True)
                return size
        raise RuntimeError(out.name + ": " + str(size) + " bytes is still above "
                           + str(POSTER_MAX) + " bytes")
    best = size
    for quality in (82, 94, 100):
        size = render_poster(source, out, quality)
        if POSTER_MIN <= size <= POSTER_MAX:
            return size
        if size > POSTER_MAX:
            render_poster(source, out, POSTER_QUALITY)
            return best
        best = size
    print("  " + out.name + ": " + str(best) + " bytes is a smooth frame under the "
          + str(POSTER_MIN) + " byte target, keeping the lighter still", flush=True)
    return best


def s3_client():
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3", endpoint_url=S3_ENDPOINT, region_name=os.environ.get("AWS_DEFAULT_REGION", "ru-1"),
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                      retries={"max_attempts": 8, "mode": "standard"}),
    )


def list_keys(s3, prefix=""):
    keys = []
    token = None
    while True:
        kwargs = {"Bucket": S3_BUCKET}
        if prefix:
            kwargs["Prefix"] = prefix
        if token:
            kwargs["ContinuationToken"] = token
        page = s3.list_objects_v2(**kwargs)
        for obj in page.get("Contents", []):
            keys.append({"Key": obj["Key"], "Size": int(obj.get("Size", 0))})
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]
    return keys


def delete_keys(s3, keys):
    for start in range(0, len(keys), 500):
        batch = [{"Key": key["Key"]} for key in keys[start:start + 500]]
        s3.delete_objects(Bucket=S3_BUCKET, Delete={"Objects": batch, "Quiet": True})


def object_id(key):
    return key.rsplit("/", 1)[-1].rsplit(".", 1)[0]


def purge_removed(s3, keep_ids):
    """Delete the four rejected scenes and anything else outside the 30 ids."""
    legacy = list_keys(s3, "hls/")
    if legacy:
        delete_keys(s3, legacy)
        print("deleted legacy HLS objects: " + str(len(legacy)), flush=True)
    for prefix in (PREFIX_1080, PREFIX_720, PREFIX_POSTER):
        keys = list_keys(s3, prefix + "/")
        stale = [key for key in keys if object_id(key["Key"]) not in keep_ids]
        if stale:
            delete_keys(s3, stale)
            print("deleted stale " + prefix + " objects: " + str(len(stale)), flush=True)
    for rejected in REJECTED_IDS:
        if rejected not in keep_ids:
            print("removed rejected scene from S3: " + rejected, flush=True)
    print("audio objects preserved: " + str(len(list_keys(s3, "audio/"))), flush=True)


def upload(s3, path, key, content_type):
    s3.upload_file(str(path), S3_BUCKET, key, ExtraArgs={
        "ACL": "public-read",
        "ContentType": content_type,
        "CacheControl": "public, max-age=31536000, immutable",
        "ContentEncoding": "identity",
    })


def prepare_workdir():
    if WORK.exists():
        shutil.rmtree(WORK)
    for folder in (SOURCE_DIR, OUT_1080, OUT_720, OUT_POSTER):
        folder.mkdir(parents=True, exist_ok=True)


def main():
    validate_scene_table()
    prepare_workdir()
    s3 = s3_client()
    built = []
    total_1080 = 0
    total_720 = 0
    for index, scene in enumerate(SCENES):
        (clip_id, title, source_url, stage, track_id, surreal, finale,
         published_size, caption_en, caption_ru) = scene
        fresh = bool(source_url)
        source_path = SOURCE_DIR / (clip_id + ".source.mp4")
        if fresh:
            download(source_url, source_path)
        else:
            download(S3_PREFIX + "/" + PREFIX_1080 + "/" + clip_id + ".mp4", source_path)
        probe = ffprobe(source_path)
        if probe["duration"] < DURATION:
            raise RuntimeError("source shorter than " + str(DURATION) + "s: " + clip_id)
        if fresh:
            master = OUT_1080 / (clip_id + ".mp4")
            size_1080 = build_1080(source_path, master)
        else:
            master = source_path
            size_1080 = published_size or probe["bytes"]
        size_720 = build_720(master, OUT_720 / (clip_id + ".mp4"))
        poster_size = build_poster(master, OUT_POSTER / (clip_id + ".webp"))
        total_1080 += size_1080
        total_720 += size_720
        source_path.unlink(missing_ok=True)
        built.append({
            "id": clip_id,
            "title": title,
            "description": title,
            "title_ru": "Сон " + format(index + 1, "02d"),
            "url": S3_PREFIX + "/" + PREFIX_1080 + "/" + clip_id + ".mp4",
            "url1080": S3_PREFIX + "/" + PREFIX_1080 + "/" + clip_id + ".mp4",
            "url720": S3_PREFIX + "/" + PREFIX_720 + "/" + clip_id + ".mp4",
            "poster": S3_PREFIX + "/" + PREFIX_POSTER + "/" + clip_id + ".webp",
            "size": size_1080,
            "size720": size_720,
            "posterSize": poster_size,
            "stage": stage,
            "archetype": STAGE_ARCH[stage],
            "is_finale": bool(finale),
            "is_surreal": bool(surreal),
            "source": "coverr",
            "vertical": True,
            "width": W1080,
            "height": H1080,
            "duration": float(DURATION),
            "tier": "1080",
            "caption_en": caption_en,
            "caption_ru": caption_ru,
            "soundCategory": TRACK_CATEGORY[track_id.split("-")[0]],
            "trackId": track_id,
            "fileHash": clip_id,
            "rebuilt1080": fresh,
        })
        print("built " + clip_id + ": 1080 " + str(size_1080) + " B, 720 " + str(size_720)
              + " B, poster " + str(poster_size) + " B", flush=True)

    keep_ids = {item["id"] for item in built}
    purge_removed(s3, keep_ids)

    for item in built:
        clip_id = item["id"]
        if item["rebuilt1080"]:
            upload(s3, OUT_1080 / (clip_id + ".mp4"),
                   PREFIX_1080 + "/" + clip_id + ".mp4", "video/mp4")
            print("uploaded " + PREFIX_1080 + "/" + clip_id + ".mp4", flush=True)
        upload(s3, OUT_720 / (clip_id + ".mp4"),
               PREFIX_720 + "/" + clip_id + ".mp4", "video/mp4")
        upload(s3, OUT_POSTER / (clip_id + ".webp"),
               PREFIX_POSTER + "/" + clip_id + ".webp", "image/webp")
        print("uploaded " + PREFIX_720 + "/" + clip_id + ".mp4 and "
              + PREFIX_POSTER + "/" + clip_id + ".webp", flush=True)

    for item in built:
        item.pop("rebuilt1080", None)
        item.pop("posterSize", None)

    (ROOT / "videos.json").write_text(
        json.dumps(built, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "videos-data.js").write_text(
        "window.VIDEOS_DATA=" + json.dumps(built, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    bucket_bytes = sum(key["Size"] for key in list_keys(s3))
    smallest_1080 = min(item["size"] for item in built)
    largest_1080 = max(item["size"] for item in built)
    smallest_720 = min(item["size720"] for item in built)
    largest_720 = max(item["size720"] for item in built)
    if largest_1080 > MAX_1080_BYTES:
        raise RuntimeError("published 1080 clip exceeds 11.5 MB")
    if largest_720 > SIZE_720_MAX:
        raise RuntimeError("published 720 clip is above the 2.3 MB ceiling")
    under = [item["id"] for item in built if item["size720"] < SIZE_720_MIN]
    if under:
        print("720 clips under the 1.4 MB target (smooth frames, kept lighter): "
              + ", ".join(under), flush=True)
    print("built " + str(len(built)) + " scenes, 1080 bytes " + str(total_1080)
          + " (" + str(smallest_1080) + "-" + str(largest_1080) + "), 720 bytes "
          + str(total_720) + " (" + str(smallest_720) + "-" + str(largest_720) + ")", flush=True)
    print("bucket bytes " + str(bucket_bytes) + " (" + format(bucket_bytes / 1e9, ".3f") + " GB)", flush=True)
    if bucket_bytes > 1_500_000_000:
        raise RuntimeError("bucket exceeds 1.5 GB")


if __name__ == "__main__":
    main()
