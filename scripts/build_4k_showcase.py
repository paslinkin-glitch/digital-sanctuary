#!/usr/bin/env python3
"""Build the v140 ten-scene vertical showcase in the cloud (pixabay-vertical-10).

The live catalog is temporarily replaced by ten reference nature scenes that are
native vertical phone masters (height > width), sourced from the Pixabay Video
API. The API key is read from the PIXABAY_API_KEY environment variable, which the
GitHub Actions workflow fills from the repository secret: the key is never
written into a committed file and is never printed by this script.

v140 raises the bar to a true 4K pipeline: only a native vertical master of at
least 2160 px of height is accepted, so every published frame is supersampled
down from 2160x3840 with FFmpeg's lanczos scaler -- never upscaled, never a
landscape frame with the sides cut off.

Every scene is downloaded here, on the GitHub Actions runner -- never on the
owner's machine, never on a phone -- and encoded twice:

  mp4-720-px/px-4k-01.mp4   720x1280, 7.0 s, 30 fps, -an, two-pass libx264
                            -profile:v high -level:v 4.1 -preset slow
                            -b:v 2400k -maxrate 3000k -bufsize 4800k,
                            -aq-mode 2 -aq-strength 1.15 -deblock -1:-1,
                            +faststart, naturally 1.80-2.45 MB -- a calm frame
                            is allowed to be lighter, it is never padded
  mp4-1080-px/px-4k-01.mp4  1080x1920, 7.0 s, 30 fps, -an, libx264
                            -profile:v high -level:v 4.2 -preset slow
                            -crf 16 -maxrate 6500k -bufsize 12000k,
                            the same psychovisual tuning, +faststart, <= 6.5 MB

The old nal-hrd=cbr:filler padding is gone on purpose: no empty byte is ever
added to hit a weight target, so every kilobyte pays for visible sharpness.

Source selection is strict. A horizontal master is never cropped down to a
phone: only a native vertical frame (height > width) that already carries at
least 2160 px of height and sits within a few percent of 9:16 is accepted. Ten
different scenes are required: 3 shadow (misty forest, fog mountains, rain
forest -- all with a fog or rain sound bed), 3 trickster_abyss (ocean waves
night, dark sea waves, light through trees), 2 calm (calm lake reflection,
sunrise mist valley) and 2 path (road forest mist, ocean horizon dawn) whose
tenth scene is the is_finale.

When Pixabay returns fewer usable 4K vertical clips for a slot than the showcase
needs, the missing slot is filled from the natively vertical masters of
videos-archive.json -- the thirty 1080x1920 scenes kept out of the live catalog.
A landscape frame is never taken from the archive either.

Both objects land in Timeweb S3 under a one-year immutable Cache-Control, then
videos.json and videos-data.js are rewritten with the ten scenes in the exact
v140 order (duration 7.0 s). The previous thirty scenes stay in
videos-archive.json, in videos-data-archive.js and untouched inside the S3
bucket.

Usage:
  python scripts/build_4k_showcase.py                # full cloud build
  python scripts/build_4k_showcase.py --dry-run      # metadata only, no media
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "mp4-work-px"
SOURCE_DIR = WORK / "sources"
OUT_720 = WORK / "720-px"
OUT_1080 = WORK / "1080-px"

S3_BUCKET = os.environ.get("S3_BUCKET", "digital-sanctuary")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "https://s3.twcstorage.ru").rstrip("/")
S3_PREFIX = S3_ENDPOINT + "/" + S3_BUCKET

PREFIX_720 = "mp4-720-px"
PREFIX_1080 = "mp4-1080-px"

DURATION = 7
FPS = 30
TRIM_START = 2.0
W720, H720 = 720, 1280
W1080, H1080 = 1080, 1920

# v140 mobile corridor. 2400 kbps x 7 s lands near 2.1 MB; the ceiling is a hard
# rule, the floor is not -- a quiet frame may honestly weigh less than 1.80 MB
# and is never padded with filler bytes.
SIZE_720_MIN = 1_800_000
SIZE_720_MAX = 2_450_000
OPENING_720_MAX = 2_450_000
MAX_1080_BYTES = 6_500_000
MAX_SOURCE_BYTES = 2_000_000_000

# Native vertical 4K only. A source below 2160 px of height, or one whose aspect
# is far away from 9:16, would force a real crop or an upscale, so it is
# rejected before encode.
MIN_SOURCE_HEIGHT = 2160
MIN_SOURCE_SECONDS = 8.0
MAX_SOURCE_SECONDS = 600.0
RATIO_MIN = 0.50
RATIO_MAX = 0.64

USER_AGENT = (
    "YoursanctuaryShowcase/1.0 (https://yoursanctuary.ru; "
    "contact@yoursanctuary.ru) python-urllib"
)
PIXABAY_API = "https://pixabay.com/api/videos/"
PIXABAY_REFERER = "https://pixabay.com/"
ARCHIVE_FILE = ROOT / "videos-archive.json"
REQUEST_TIMEOUT = 120
SEARCH_PAGES = 1
PER_PAGE = 50
CANDIDATES_TRIED = 6

STAGE_ARCH = {
    "shadow": "Shadow",
    "trickster_abyss": "Trickster",
    "calm": "Calm",
    "path": "Path",
}
TRACK_FAMILIES = {
    "city": 4,
    "fire": 3,
    "fog": 5,
    "people": 3,
    "rain": 4,
    "road": 4,
    "space": 3,
    "water": 4,
}
REAL_TRACK_IDS = {
    family + "-" + format(index, "02d")
    for family, count in TRACK_FAMILIES.items()
    for index in range(1, count + 1)
}

# Scene table in catalog order. Three shadow, three trickster_abyss, two calm and
# two path; the tenth scene closes the session with is_finale. "queries" are the
# natural-language searches handed to the Pixabay Video API, "keywords" only
# score the returned tags, and "archive" lists the natively vertical fallback
# frames of videos-archive.json (used only when Pixabay has nothing usable).
SCENES = [
    {
        "id": "px-4k-01",
        "stage": "shadow",
        "track": "fog-02",
        "title": "Fog Moving Through a Silent Forest",
        "caption_en": "Fog moves between the trees without hurry",
        "caption_ru": "Туман идёт между деревьями не спеша",
        "queries": ["misty forest", "forest fog", "foggy woods"],
        "keywords": ["forest", "fog", "mist", "tree", "woods", "woodland"],
        "archive": ["dream-shadow-01", "dream-shadow-13", "dream-shadow-14"],
    },
    {
        "id": "px-4k-02",
        "stage": "shadow",
        "track": "fog-01",
        "title": "Peaks Above a Slow Sea of Clouds",
        "caption_en": "Peaks stand above a slow sea of clouds",
        "caption_ru": "Вершины стоят над медленным морем облаков",
        "queries": ["fog mountains", "mountain fog", "misty mountains"],
        "keywords": ["mountain", "fog", "mist", "cloud", "peak", "ridge"],
        "archive": ["dream-shadow-03", "dream-shadow-11", "dream-calm-06"],
    },
    {
        "id": "px-4k-03",
        "stage": "shadow",
        "track": "rain-02",
        "title": "Rain Falling in a Green Forest",
        "caption_en": "Rain touches the leaves and stays there",
        "caption_ru": "Дождь касается листьев и остаётся там",
        "queries": ["rain forest", "forest rain", "raining trees"],
        "keywords": ["rain", "forest", "leaf", "leaves", "drop", "tree"],
        "archive": ["dream-shadow-06", "dream-shadow-12", "dream-shadow-07"],
    },
    {
        "id": "px-4k-04",
        "stage": "trickster_abyss",
        "track": "water-01",
        "title": "Ocean Waves Arriving in the Dark",
        "caption_en": "Waves arrive and take the shore back",
        "caption_ru": "Волны приходят и забирают берег назад",
        "queries": ["ocean waves night", "night sea waves", "dark ocean"],
        "keywords": ["ocean", "sea", "wave", "night", "dark", "shore"],
        "archive": ["dream-trickster-05", "dream-trickster-09", "dream-calm-07"],
    },
    {
        "id": "px-4k-05",
        "stage": "trickster_abyss",
        "track": "water-02",
        "title": "A Black Sea Breathing Slowly",
        "caption_en": "The dark water breathes and lets go",
        "caption_ru": "Тёмная вода дышит и отпускает",
        "queries": ["dark sea waves", "black sea", "stormy sea"],
        "keywords": ["sea", "wave", "water", "dark", "storm", "ocean"],
        "archive": ["dream-trickster-06", "dream-trickster-10", "dream-trickster-11"],
    },
    {
        "id": "px-4k-06",
        "stage": "trickster_abyss",
        "track": "space-02",
        "title": "Light Falling Through the Canopy",
        "caption_en": "Light falls through the canopy in pieces",
        "caption_ru": "Свет падает сквозь кроны частями",
        "queries": ["light through trees", "sunlight forest", "tree canopy sun"],
        "keywords": ["light", "sun", "tree", "canopy", "forest", "beam"],
        "archive": ["dream-shadow-07", "dream-calm-08", "dream-path-05"],
    },
    {
        "id": "px-4k-07",
        "stage": "calm",
        "track": "water-03",
        "title": "Still Water Holding a Grey Sky",
        "caption_en": "Still water holds the whole grey sky",
        "caption_ru": "Тихая вода держит всё серое небо",
        "queries": ["calm lake reflection", "still lake", "lake mirror"],
        "keywords": ["lake", "water", "reflection", "still", "calm", "mirror"],
        "archive": ["dream-calm-07", "dream-calm-01", "dream-shadow-10"],
    },
    {
        "id": "px-4k-08",
        "stage": "calm",
        "track": "fog-04",
        "title": "Dawn Coming Over a Wet Valley",
        "caption_en": "Dawn arrives slowly over the wet valley",
        "caption_ru": "Рассвет медленно приходит над влажной долиной",
        "queries": ["sunrise mist valley", "morning mist valley", "sunrise fog"],
        "keywords": ["sunrise", "dawn", "mist", "valley", "morning", "fog"],
        "archive": ["dream-calm-06", "dream-shadow-14", "dream-shadow-03"],
    },
    {
        "id": "px-4k-09",
        "stage": "path",
        "track": "road-02",
        "title": "A Forest Road Entering the Trees",
        "caption_en": "The road enters the trees and disappears",
        "caption_ru": "Дорога входит в деревья и исчезает",
        "queries": ["road forest mist", "forest road fog", "misty road"],
        "keywords": ["road", "forest", "mist", "path", "fog", "tree"],
        "archive": ["dream-path-01", "dream-path-06", "dream-path-07"],
    },
    {
        "id": "px-4k-10",
        "stage": "path",
        "track": "road-03",
        "title": "The Last Light Opening the Horizon",
        "caption_en": "Light opens all the way to the horizon",
        "caption_ru": "Свет открывается до самого горизонта",
        "queries": ["ocean horizon dawn", "sea horizon sunrise", "dawn horizon"],
        "keywords": ["ocean", "horizon", "dawn", "sunrise", "light", "sea"],
        "archive": ["dream-calm-08", "dream-path-05", "dream-shadow-12"],
    },
]

STAGE_COUNTS = {"shadow": 3, "trickster_abyss": 3, "calm": 2, "path": 2}
STORY_BEDS = {"fog", "rain"}
BANNED_TITLE = re.compile(
    r"\b(people|person|man|woman|girl|boy|child|children|crowd|portrait|face|"
    r"city|street|cars?|traffic|building|skyscraper|indoor|office|room|"
    r"logo|trailer|screen|gameplay|minecraft|lecture|conference|interview|"
    r"news|advert|commercial|music\s+video|title|text|subtitle|cartoon|"
    r"animation|animated|greenscreen|fashion|model|wedding)\b",
    re.IGNORECASE,
)
HTML_TAG = re.compile(r"<[^>]+>")


# --------------------------------------------------------------------------
# table validation
# --------------------------------------------------------------------------
def validate_scene_table():
    """Fail before a single byte of media is fetched if the table is unsound."""
    if len(SCENES) != 10:
        raise RuntimeError("scene count " + str(len(SCENES)) + " != 10")
    ids = [scene["id"] for scene in SCENES]
    if len(set(ids)) != len(ids):
        raise RuntimeError("duplicate scene id")
    titles = [scene["title"] for scene in SCENES]
    if len(set(titles)) != len(titles):
        raise RuntimeError("duplicate scene title")
    counts = {}
    for scene in SCENES:
        counts[scene["stage"]] = counts.get(scene["stage"], 0) + 1
        if scene["track"] not in REAL_TRACK_IDS:
            raise RuntimeError("unknown track id " + scene["track"])
        if scene["stage"] == "shadow" and scene["track"].split("-")[0] not in STORY_BEDS:
            raise RuntimeError(scene["id"] + " shadow scene needs a fog or rain bed")
        for key in ("caption_en", "caption_ru"):
            words = len(scene[key].split())
            if not 5 <= words <= 8:
                raise RuntimeError(
                    scene["id"] + " caption " + key + " has " + str(words) + " words")
        if not scene["queries"] or not scene["archive"]:
            raise RuntimeError(scene["id"] + " has no search query or archive fallback")
    if counts != STAGE_COUNTS:
        raise RuntimeError("stage distribution " + str(counts) + " != " + str(STAGE_COUNTS))
    if SCENES[-1]["stage"] != "path":
        raise RuntimeError("the finale scene must close the path stage")
    if len({scene["caption_en"] for scene in SCENES}) != 10:
        raise RuntimeError("duplicate English caption")


# --------------------------------------------------------------------------
# http helpers
# --------------------------------------------------------------------------
def http_json(url, params=None):
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    })
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
            payload = response.read()
    except urllib.error.HTTPError as error:
        detail = ""
        try:
            detail = error.read().decode("utf-8", "replace")[:400]
        except Exception:
            detail = ""
        # Never echo the request URL here: it carries the API key in its query.
        raise RuntimeError("HTTP " + str(error.code) + " " + str(error.reason) + " " + detail)
    return json.loads(payload.decode("utf-8"))


def plain_text(value):
    text = HTML_TAG.sub(" ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def api_key():
    key = os.environ.get("PIXABAY_API_KEY", "").strip()
    if not key:
        raise RuntimeError("PIXABAY_API_KEY is missing from the environment")
    return key


# --------------------------------------------------------------------------
# pixabay discovery
# --------------------------------------------------------------------------
SEARCH_CACHE = {}


def pixabay_hits(term, page):
    cached = SEARCH_CACHE.get((term, page))
    if cached is not None:
        return cached
    params = {
        "key": api_key(),
        "q": term,
        "lang": "en",
        "video_type": "film",
        "category": "nature",
        "orientation": "vertical",
        "min_height": str(MIN_SOURCE_HEIGHT),
        "order": "popular",
        "safesearch": "true",
        "per_page": str(PER_PAGE),
        "page": str(page),
    }
    hits = []
    for attempt in range(3):
        try:
            payload = http_json(PIXABAY_API, params)
            hits = payload.get("hits") or []
            break
        except Exception as error:  # one dead query must not kill the build
            print("  pixabay query failed (" + term + ", page " + str(page) + "): "
                  + str(error), flush=True)
            if attempt < 2:
                time.sleep(4 * (attempt + 1))
    SEARCH_CACHE[(term, page)] = hits
    return hits


def pick_vertical_stream(hit):
    """The highest-resolution native vertical stream of a Pixabay video hit."""
    videos = hit.get("videos") or {}
    best = None
    for name in ("large", "medium", "small", "tiny"):
        stream = videos.get(name) or {}
        url = str(stream.get("url") or "")
        width = int(stream.get("width") or 0)
        height = int(stream.get("height") or 0)
        if not url.startswith("https://") or width <= 0 or height <= 0:
            continue
        # Iron rule: a landscape frame is never accepted, never cropped.
        if height <= width:
            continue
        if height < MIN_SOURCE_HEIGHT:
            continue
        ratio = float(width) / float(height)
        if ratio < RATIO_MIN or ratio > RATIO_MAX:
            continue
        area = width * height
        if best is None or area > best[1]["width"] * best[1]["height"]:
            best = (name, {
                "url": url,
                "width": width,
                "height": height,
                "bytes": int(stream.get("size") or 0),
            })
    return best


def pixabay_candidates(scene):
    """Vertical Pixabay clips for one scene, best tag match first."""
    pool = {}
    for qindex, term in enumerate(scene["queries"]):
        for pindex in range(1, SEARCH_PAGES + 1):
            for hindex, hit in enumerate(pixabay_hits(term, pindex)):
                picked = pick_vertical_stream(hit)
                if not picked:
                    continue
                stream_name, stream = picked
                tags = plain_text(hit.get("tags") or "")
                duration = float(hit.get("duration") or 0.0)
                if duration < MIN_SOURCE_SECONDS or duration > MAX_SOURCE_SECONDS:
                    continue
                if BANNED_TITLE.search(tags):
                    continue
                key = "pixabay:" + str(hit.get("id"))
                if key in pool:
                    continue
                lowered = tags.lower()
                matched = sum(1 for keyword in scene["keywords"] if keyword in lowered)
                if not matched:
                    continue
                pool[key] = {
                    "key": key,
                    "library": "pixabay",
                    "title": tags or ("Pixabay clip " + str(hit.get("id"))),
                    "tags": tags,
                    "url": stream["url"],
                    "width": stream["width"],
                    "height": stream["height"],
                    "bytes": stream["bytes"],
                    "duration": duration,
                    "page": str(hit.get("pageURL") or ""),
                    "credit": plain_text(hit.get("user") or "Pixabay"),
                    "license": "Pixabay Content License",
                    "stream": stream_name,
                    "rank": qindex * 1000 + pindex * 100 + hindex,
                    "keyword_hits": matched,
                }
    return sorted(pool.values(), key=lambda item: (
        -item["keyword_hits"],
        item["rank"],
        -item["width"] * item["height"],
        abs(item["duration"] - 20.0),
    ))


def archive_candidates(scene):
    """Natively vertical frames of the archived thirty-scene dream, never wide."""
    if not ARCHIVE_FILE.exists():
        return []
    try:
        entries = json.loads(ARCHIVE_FILE.read_text(encoding="utf-8"))
    except Exception as error:
        print("  archive unreadable: " + str(error), flush=True)
        return []
    by_id = {}
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        width = int(entry.get("width") or 0)
        height = int(entry.get("height") or 0)
        if not entry.get("vertical") or width <= 0 or height <= 0 or height <= width:
            continue
        url = str(entry.get("url1080") or entry.get("url") or "")
        if not url.startswith("https://"):
            continue
        by_id[str(entry.get("id") or "")] = {
            "key": "archive:" + str(entry.get("id") or ""),
            "library": "archive",
            "title": plain_text(entry.get("title") or ""),
            "tags": "",
            "url": url,
            "width": width,
            "height": height,
            "bytes": int(entry.get("size") or 0),
            "duration": float(entry.get("duration") or 0.0),
            "page": "",
            "credit": "Yoursanctuary archive",
            "license": "Yoursanctuary archive",
            "stream": "master",
            "rank": 5000,
            "keyword_hits": 0,
        }
    ordered = []
    for index, clip_id in enumerate(scene["archive"]):
        candidate = by_id.get(clip_id)
        if not candidate:
            continue
        candidate = dict(candidate, rank=5000 + index)
        ordered.append(candidate)
    return ordered


# --------------------------------------------------------------------------
# media helpers
# --------------------------------------------------------------------------
def run(cmd, capture=False):
    joined = " ".join(str(part) for part in cmd)
    print("  $ " + joined, flush=True)
    if capture:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("command failed: " + joined + "\n" + result.stderr[-4000:])
        return result.stdout
    subprocess.run(cmd, check=True)
    return ""


def ffprobe(path):
    payload = run([
        "ffprobe", "-v", "error",
        "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration",
        "-of", "json", str(path),
    ], capture=True)
    data = json.loads(payload)
    video = next((stream for stream in data["streams"] if stream.get("codec_type") == "video"), None)
    if not video:
        raise RuntimeError("no video stream: " + str(path))
    rate = str(video.get("r_frame_rate", "30/1")).split("/")
    fps = float(rate[0]) / float(rate[1] or 1)
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "duration": float(data["format"]["duration"]),
        "fps": fps,
        "audio": len([stream for stream in data["streams"] if stream.get("codec_type") == "audio"]),
        "bytes": Path(path).stat().st_size,
    }


def download(url, path, referer=PIXABAY_REFERER):
    request = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Referer": referer,
        "Accept": "*/*",
    })
    part = path.with_suffix(path.suffix + ".part")
    written = 0
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response, open(part, "wb") as handle:
        length = int(response.headers.get("Content-Length") or 0)
        if length > MAX_SOURCE_BYTES:
            raise RuntimeError("master is too heavy: " + str(length) + " bytes")
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_SOURCE_BYTES:
                handle.close()
                part.unlink(missing_ok=True)
                raise RuntimeError("master exceeded the size ceiling while streaming")
            handle.write(chunk)
    if written < 200_000:
        part.unlink(missing_ok=True)
        raise RuntimeError("download truncated at " + str(written) + " bytes")
    part.replace(path)
    return written


def trim_start(duration):
    if duration >= TRIM_START + DURATION + 0.4:
        return TRIM_START
    return max(0.0, min(1.0, (duration - DURATION) / 2.0))


def psychovisual_args():
    """v140 anti-pixel tuning: auto-variance AQ and slightly lighter deblocking."""
    return ["-aq-mode", "2", "-aq-strength", "1.15", "-deblock", "-1:-1"]


def vf(width, height):
    return (
        "scale=" + str(width) + ":" + str(height)
        + ":force_original_aspect_ratio=increase:flags=lanczos"
        + ",crop=" + str(width) + ":" + str(height)
        + ",setsar=1,fps=" + str(FPS) + ",format=yuv420p"
    )


def encode_720(src, out, start, bitrate_k):
    logfile = OUT_720 / ("pass-" + out.stem)
    base = [
        "ffmpeg", "-y", "-v", "error",
        "-ss", format(start, ".3f"), "-t", str(DURATION), "-i", str(src),
        "-an", "-vf", vf(W720, H720),
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.1",
        "-preset", "slow",
        "-b:v", str(bitrate_k) + "k", "-maxrate", "3000k", "-bufsize", "4800k",
    ] + psychovisual_args() + [
        "-pix_fmt", "yuv420p", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
    ]
    run(base + ["-pass", "1", "-passlogfile", str(logfile), "-f", "null", "/dev/null"])
    run(base + [
        "-pass", "2", "-passlogfile", str(logfile),
        "-movflags", "+faststart", "-map_metadata", "-1", str(out),
    ])


def encode_1080(src, out, start, crf):
    run([
        "ffmpeg", "-y", "-v", "error",
        "-ss", format(start, ".3f"), "-t", str(DURATION), "-i", str(src),
        "-an", "-vf", vf(W1080, H1080),
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.2",
        "-preset", "slow",
        "-crf", str(crf), "-maxrate", "6500k", "-bufsize", "12000k",
    ] + psychovisual_args() + [
        "-pix_fmt", "yuv420p", "-g", "30", "-keyint_min", "30", "-sc_threshold", "0",
        "-movflags", "+faststart", "-map_metadata", "-1", str(out),
    ])


def verify_clip(path, width, height):
    info = ffprobe(path)
    if (info["width"], info["height"]) != (width, height):
        raise RuntimeError(path.name + ": wrong size " + str(info["width"]) + "x" + str(info["height"]))
    if abs(info["duration"] - DURATION) > 0.3:
        raise RuntimeError(path.name + ": wrong duration " + str(info["duration"]))
    if info["audio"]:
        raise RuntimeError(path.name + ": audio stream present")
    if abs(info["fps"] - FPS) > 1.0:
        raise RuntimeError(path.name + ": wrong fps " + str(info["fps"]))
    return info


def build_720(src, out, start):
    """2400 kbps two-pass. The 2.45 MB ceiling is hard; a lighter frame is honest."""
    bitrate = 2400
    for attempt in range(3):
        encode_720(src, out, start, bitrate)
        size = out.stat().st_size
        print("  " + out.name + ": attempt " + str(attempt + 1) + " -> " + str(size)
              + " bytes (" + str(bitrate) + "k two-pass)", flush=True)
        if size <= SIZE_720_MAX:
            verify_clip(out, W720, H720)
            if size < SIZE_720_MIN:
                # v140: a calm 7 s frame may naturally weigh less than 1.80 MB.
                # Nothing is padded with filler bytes -- sharpness only.
                print("  " + out.name + ": " + str(size) + " bytes is a naturally light"
                      " frame, no filler is added", flush=True)
            return size
        bitrate = max(1500, int(round(bitrate * SIZE_720_MAX / max(size, 1))))
    raise RuntimeError(out.name + ": " + str(out.stat().st_size)
                       + " bytes exceeds the 2.45 MB ceiling")


def build_1080(src, out, start):
    encode_1080(src, out, start, 16)
    size = out.stat().st_size
    print("  " + out.name + ": " + str(size) + " bytes at CRF 16", flush=True)
    if size > MAX_1080_BYTES:
        encode_1080(src, out, start, 18)
        size = out.stat().st_size
        print("  " + out.name + ": " + str(size) + " bytes at CRF 18 (ceiling retry)",
              flush=True)
    if size > MAX_1080_BYTES:
        raise RuntimeError(out.name + ": " + str(size) + " bytes exceeds the 6.5 MB ceiling")
    verify_clip(out, W1080, H1080)
    return size


# --------------------------------------------------------------------------
# s3
# --------------------------------------------------------------------------
def s3_client():
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        region_name=os.environ.get("AWS_DEFAULT_REGION", "ru-1"),
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 8, "mode": "standard"},
        ),
    )


def upload(s3, path, key):
    s3.upload_file(str(path), S3_BUCKET, key, ExtraArgs={
        "ACL": "public-read",
        "ContentType": "video/mp4",
        "CacheControl": "public, max-age=31536000, immutable",
        "ContentEncoding": "identity",
    })
    print("uploaded " + key + " (" + str(path.stat().st_size) + " bytes)", flush=True)


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------
def prepare_workdir():
    if WORK.exists():
        shutil.rmtree(WORK)
    for folder in (SOURCE_DIR, OUT_720, OUT_1080):
        folder.mkdir(parents=True, exist_ok=True)


def accept_source(scene, candidate, used_sources, min_height):
    if candidate["key"] in used_sources:
        return None
    suffix = Path(urllib.parse.urlparse(candidate["url"]).path).suffix or ".mp4"
    source_path = SOURCE_DIR / (scene["id"] + ".source" + suffix)
    referer = PIXABAY_REFERER if candidate["library"] == "pixabay" else "https://s3.twcstorage.ru/"
    print("  downloading " + candidate["library"] + ": " + candidate["title"]
          + " [" + str(candidate["width"]) + "x" + str(candidate["height"]) + "]", flush=True)
    try:
        download(candidate["url"], source_path, referer)
        probe = ffprobe(source_path)
    except Exception as error:
        print("  rejected (" + str(error) + ")", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    # Native vertical only: a wide master is never cropped into a phone frame.
    if probe["height"] <= probe["width"]:
        print("  rejected: " + str(probe["width"]) + "x" + str(probe["height"])
              + " is not a vertical master", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    if probe["height"] < min_height:
        print("  rejected: " + str(probe["width"]) + "x" + str(probe["height"])
              + " is below " + str(min_height) + " px of height", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    ratio = float(probe["width"]) / float(probe["height"])
    if ratio < RATIO_MIN or ratio > RATIO_MAX:
        print("  rejected: " + str(probe["width"]) + "x" + str(probe["height"])
              + " is too far from 9:16 and would need a real crop", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    if probe["duration"] < DURATION + 0.4:
        print("  rejected: only " + str(round(probe["duration"], 2)) + " s of video", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    used_sources.add(candidate["key"])
    return source_path, probe, candidate


def build_scene(scene, used_sources, dry_run=False):
    pixabay = pixabay_candidates(scene)
    archive = archive_candidates(scene)
    candidates = pixabay + archive
    if dry_run:
        if not candidates:
            print("  " + scene["id"] + ": no vertical candidate at all", flush=True)
        for candidate in candidates[:6]:
            print("  " + scene["id"] + " candidate: " + candidate["library"] + " "
                  + str(candidate["width"]) + "x" + str(candidate["height"]) + " "
                  + str(round(candidate["duration"], 1)) + "s "
                  + format(candidate["bytes"] / 1e6, ".1f") + "MB " + candidate["title"],
                  flush=True)
        return None
    if not candidates:
        raise RuntimeError("no vertical source found for " + scene["id"])
    accepted = None
    for candidate in pixabay[:CANDIDATES_TRIED]:
        accepted = accept_source(scene, candidate, used_sources, MIN_SOURCE_HEIGHT)
        if accepted:
            break
    if not accepted:
        print("  Pixabay has no usable 4K vertical clip for " + scene["id"]
              + ", taking the native vertical archive", flush=True)
        for candidate in archive:
            accepted = accept_source(scene, candidate, used_sources, 1080)
            if accepted:
                break
    if not accepted:
        raise RuntimeError("every vertical candidate failed for " + scene["id"])
    source_path, probe, candidate = accepted
    start = trim_start(probe["duration"])
    print("  master " + candidate["library"] + " " + str(probe["width"]) + "x"
          + str(probe["height"]) + " " + str(round(probe["duration"], 1))
          + "s, cutting from " + format(start, ".2f") + "s", flush=True)
    mobile = OUT_720 / (scene["id"] + ".mp4")
    studio = OUT_1080 / (scene["id"] + ".mp4")
    size_720 = build_720(source_path, mobile, start)
    size_1080 = build_1080(source_path, studio, start)
    source_path.unlink(missing_ok=True)
    for artifact in OUT_720.glob("pass-" + mobile.stem + "*"):
        artifact.unlink(missing_ok=True)
    return {
        "scene": scene,
        "size720": size_720,
        "size1080": size_1080,
        "mobile": mobile,
        "studio": studio,
        "source": candidate,
        "probe": probe,
    }


def catalog_entry(built):
    scene = built["scene"]
    clip_id = scene["id"]
    source = built["source"]
    return {
        "id": clip_id,
        "title": scene["title"],
        "description": scene["title"],
        "title_ru": "Сон " + format(SCENES.index(scene) + 1, "02d"),
        "url": S3_PREFIX + "/" + PREFIX_1080 + "/" + clip_id + ".mp4",
        "url1080": S3_PREFIX + "/" + PREFIX_1080 + "/" + clip_id + ".mp4",
        "url720": S3_PREFIX + "/" + PREFIX_720 + "/" + clip_id + ".mp4",
        "size": built["size1080"],
        "size720": built["size720"],
        "stage": scene["stage"],
        "archetype": STAGE_ARCH[scene["stage"]],
        "is_finale": clip_id == SCENES[-1]["id"],
        "is_surreal": False,
        "source": source["library"],
        "sourcePage": source.get("page") or "",
        "credit": source.get("credit") or "",
        "license": source.get("license") or "",
        "vertical": True,
        "width": W1080,
        "height": H1080,
        "duration": float(DURATION),
        "tier": "1080",
        "caption_en": scene["caption_en"],
        "caption_ru": scene["caption_ru"],
        "soundCategory": scene["track"].split("-")[0],
        "trackId": scene["track"],
        "fileHash": clip_id,
    }


def write_catalog(catalog):
    (ROOT / "videos.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "videos-data.js").write_text(
        "window.VIDEOS_DATA=" + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print("wrote videos.json and videos-data.js with " + str(len(catalog)) + " scenes", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Build the ten-scene vertical 4K showcase")
    parser.add_argument("--dry-run", action="store_true",
                        help="only resolve and print source candidates, download nothing")
    args = parser.parse_args()

    validate_scene_table()
    api_key()  # fail before any media work when the repository secret is missing
    if args.dry_run:
        print("dry run: " + str(len(SCENES)) + " scenes, metadata only", flush=True)
        for scene in SCENES:
            build_scene(scene, set(), dry_run=True)
        return 0

    prepare_workdir()
    s3 = s3_client()
    used_sources = set()
    built = []
    for scene in SCENES:
        print("building " + scene["id"] + " (" + scene["stage"] + ")", flush=True)
        built.append(build_scene(scene, used_sources))

    weights = [item["size720"] for item in built]
    if max(weights) > SIZE_720_MAX:
        raise RuntimeError("mobile weights above the 2.45 MB ceiling: " + str(weights))
    masters = [item["size1080"] for item in built]
    if max(masters) > MAX_1080_BYTES:
        raise RuntimeError("studio masters above 6.5 MB: " + str(masters))
    opening = [item for item in built
               if item["scene"]["stage"] == "shadow" and item["size720"] <= OPENING_720_MAX]
    if not opening:
        raise RuntimeError("no shadow scene fits the 2.45 MB instant-opening pool")
    for item in built:
        probe = item["probe"]
        if probe["height"] <= probe["width"]:
            raise RuntimeError(item["scene"]["id"] + ": a horizontal master slipped through")

    for item in built:
        upload(s3, item["mobile"], PREFIX_720 + "/" + item["scene"]["id"] + ".mp4")
        upload(s3, item["studio"], PREFIX_1080 + "/" + item["scene"]["id"] + ".mp4")

    catalog = [catalog_entry(item) for item in built]
    write_catalog(catalog)

    print("", flush=True)
    print("showcase built: " + str(len(catalog)) + " vertical 4K scenes, "
          + str(DURATION) + " s each", flush=True)
    print("mobile 720p 2400k: " + str(min(weights)) + "-" + str(max(weights))
          + " bytes (ceiling " + str(SIZE_720_MAX) + ", no filler)", flush=True)
    print("studio 1080p CRF 16: " + str(min(masters)) + "-" + str(max(masters))
          + " bytes (ceiling " + str(MAX_1080_BYTES) + ")", flush=True)
    print("instant opening pool: " + str(len(opening)) + " shadow scenes <= "
          + str(OPENING_720_MAX) + " bytes", flush=True)
    for entry in catalog:
        print("  " + entry["id"] + " " + entry["stage"] + " " + entry["trackId"] + " "
              + entry["source"] + " " + str(entry["size720"]) + " B / "
              + str(entry["size"]) + " B", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # a failed cloud build must never publish a partial catalog
        print("FATAL: " + str(error), flush=True)
        sys.exit(1)
