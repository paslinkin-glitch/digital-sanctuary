#!/usr/bin/env python3
"""Build the v138 ten-scene 4K showcase in the cloud (mode: showcase-4k-10).

The live catalog is temporarily replaced by ten reference nature scenes taken
from open, key-free sources: Wikimedia Commons is the primary library (its
upload API needs no key at all) and the open Coverr catalog is the reserve. No
paid API key is used anywhere.

Every scene starts as a real 4K master (>= 2160 px on at least one side) that is
downloaded here, on the GitHub Actions runner -- never on the owner's machine,
never on a phone -- trimmed to the stable 2.0-12.0 s window and supersampled
twice with FFmpeg's lanczos scaler:

  mp4-720-4k/<id>.mp4   720x1280, 10.0 s, 30 fps, -an, two-pass libx264
                        -b:v 1250k -maxrate 1550k -bufsize 2500k, +faststart,
                        strictly 1.40-1.85 MB of mobile weight
  mp4-1080-4k/<id>.mp4  1080x1920, 10.0 s, 30 fps, -an, libx264 CRF 18
                        -maxrate 5500k -bufsize 11000k, +faststart, <= 7 MB

Both objects land in Timeweb S3 under a one-year immutable Cache-Control, then
videos.json and videos-data.js are rewritten with the ten scenes in the exact
v138 order: 3 shadow / 3 trickster_abyss / 2 calm / 2 path, the tenth being
is_finale. The previous thirty scenes stay in videos-archive.json, in
videos-data-archive.js and untouched inside the S3 bucket.

Source resolution is API-driven, not hardcoded: every scene declares a few
natural-language queries (misty forest, mountains in clouds, ocean waves, rain,
sunrise, still water, road, light through the canopy) plus the Commons titles
that the open catalog already proved to be clean 4K nature masters. The script
asks the Commons search API, keeps only video files that report a 4K frame and
at least twelve seconds, ranks them by title relevance and duration, and only
then downloads the first master that survives ffprobe. When Commons returns
nothing usable for a slot, the Coverr open catalog is queried as the reserve.

Usage:
  python scripts/build_4k_showcase.py                # full cloud build
  python scripts/build_4k_showcase.py --dry-run      # metadata only, no media
"""
import argparse
import html
import json
import os
import random
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "mp4-work-4k"
SOURCE_DIR = WORK / "sources"
OUT_720 = WORK / "720-4k"
OUT_1080 = WORK / "1080-4k"

S3_BUCKET = os.environ.get("S3_BUCKET", "digital-sanctuary")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "https://s3.twcstorage.ru").rstrip("/")
S3_PREFIX = S3_ENDPOINT + "/" + S3_BUCKET

PREFIX_720 = "mp4-720-4k"
PREFIX_1080 = "mp4-1080-4k"

DURATION = 10
FPS = 30
TRIM_START = 2.0
W720, H720 = 720, 1280
W1080, H1080 = 1080, 1920

# The mobile showcase weight: strictly 1.40-1.85 MB, aimed at the middle so the
# published frame also stays under the 1.65 MB instant-opening rule of v137.
SIZE_720_MIN = 1_400_000
SIZE_720_MAX = 1_850_000
SIZE_720_TARGET = 1_575_000
OPENING_720_MAX = 1_650_000
MAX_1080_BYTES = 7_000_000
MAX_SOURCE_BYTES = 2_000_000_000

USER_AGENT = (
    "YoursanctuaryShowcase/1.0 (https://yoursanctuary.ru; "
    "contact@yoursanctuary.ru) python-urllib"
)
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
REQUEST_TIMEOUT = 120

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
# natural-language searches handed to the Commons API, "prefer" are the clean 4K
# masters the open catalog already knows about (they are still resolved live
# through the API, never hardcoded to a file URL), "keywords" only score a title.
SCENES = [
    {
        "id": "showcase-4k-01",
        "stage": "shadow",
        "track": "fog-02",
        "title": "Fog Moving Through a Silent Forest",
        "caption_en": "Fog moves between the trees without hurry",
        "caption_ru": "Туман идёт между деревьями не спеша",
        "queries": ["4K forest fog", "4K misty forest", "4K fog", "4K mist", "4K forest"],
        "prefer": [
            "Drone video of foggy Vetla village in Estonia",
            "Zeitraffer im Wald bei Hof",
            "Aerial views of a forest in Belarus",
        ],
        "keywords": ["fog", "mist", "forest", "tree", "wood", "walt", "nebel"],
    },
    {
        "id": "showcase-4k-02",
        "stage": "shadow",
        "track": "fog-01",
        "title": "Peaks Above a Slow Sea of Clouds",
        "caption_en": "Peaks stand above a slow sea of clouds",
        "caption_ru": "Вершины стоят над медленным морем облаков",
        "queries": ["4K mountain clouds", "4K mountains", "4K clouds", "4K alps"],
        "prefer": [
            "El Hornocal, Humahuaca, Jujuy, Argentina",
            "Clouds above Japan",
            "Quebrada de las Señoritas",
        ],
        "keywords": ["mountain", "cloud", "peak", "ridge", "hornocal", "quebrada"],
    },
    {
        "id": "showcase-4k-03",
        "stage": "shadow",
        "track": "rain-02",
        "title": "Rain Falling in a Green Forest",
        "caption_en": "Rain touches the leaves and stays there",
        "caption_ru": "Дождь касается листьев и остаётся там",
        "queries": ["4K rain forest", "4K rain", "4K rainstorm", "4K rainfall"],
        "prefer": [
            "Sunshowers - Oze National Park",
            "October 2021 California rainstorm",
            "Fife Creek - January 2023",
        ],
        "keywords": ["rain", "forest", "leaf", "leaves", "drop", "sunshower", "creek"],
    },
    {
        "id": "showcase-4k-04",
        "stage": "trickster_abyss",
        "track": "water-01",
        "title": "Ocean Waves Arriving on a Shore",
        "caption_en": "Waves arrive and take the shore back",
        "caption_ru": "Волны приходят и забирают берег назад",
        "queries": ["4K ocean waves", "4K sea waves", "4K beach", "4K waves"],
        "prefer": [
            "Seaside Beach - October 2022 - Sarah Stierch 05",
            "Une plage à Miami Beach",
            "20240812 Midnight Oceanscape",
        ],
        "keywords": ["wave", "ocean", "sea", "shore", "beach", "surf", "coast"],
    },
    {
        "id": "showcase-4k-05",
        "stage": "trickster_abyss",
        "track": "space-02",
        "title": "Light Falling Through the Canopy",
        "caption_en": "Light falls through the canopy in pieces",
        "caption_ru": "Свет падает сквозь кроны частями",
        "queries": ["4K sunlight forest", "4K forest light", "4K tree canopy", "4K sunbeam"],
        "prefer": [
            "One Year. One Tree. One Drone",
            "4K Drone Flight over Ephraim Harbor",
            "Recovering from the 2003 wildfire",
        ],
        "keywords": ["light", "sun", "canopy", "forest", "tree", "beam", "autumn", "fall"],
    },
    {
        "id": "showcase-4k-06",
        "stage": "trickster_abyss",
        "track": "water-03",
        "title": "A Waterfall Turning the Air Silver",
        "caption_en": "Water falls and the air turns silver",
        "caption_ru": "Вода падает, и воздух становится серебряным",
        "queries": ["4K waterfall", "4K cascade", "4K falls"],
        "prefer": [
            "Athirapally falls",
            "Black grouse waterfall in Lagodekhi",
            "Rheinfall (Rhine Falls)",
        ],
        "keywords": ["waterfall", "cascade", "fall", "water", "river", "falls"],
    },
    {
        "id": "showcase-4k-07",
        "stage": "calm",
        "track": "water-04",
        "title": "Still Water Holding a Grey Sky",
        "caption_en": "Still water holds the whole grey sky",
        "caption_ru": "Тихая вода держит всё серое небо",
        "queries": ["4K still lake", "4K lake reflection", "4K lake", "4K calm water"],
        "prefer": [
            "Lake Miyagase 2024 July 28",
            "East Lake Tohopekaliga May 2023",
            "Koayu river - summer day",
        ],
        "keywords": ["lake", "still", "reflection", "water", "mirror", "miyagase"],
    },
    {
        "id": "showcase-4k-08",
        "stage": "calm",
        "track": "fog-04",
        "title": "Dawn Coming Over a Wet Valley",
        "caption_en": "Dawn arrives slowly over the wet valley",
        "caption_ru": "Рассвет медленно приходит над влажной долиной",
        "queries": ["4K sunrise", "4K dawn", "4K morning mist", "4K sunrise valley"],
        "prefer": [
            "Another Sunrise Time Lapse in 4K",
            "Sunrise atLake Bled",
            "Cape Town under the clouds",
        ],
        "keywords": ["sunrise", "dawn", "morning", "valley", "mist", "sun", "bled"],
    },
    {
        "id": "showcase-4k-09",
        "stage": "path",
        "track": "road-02",
        "title": "A Forest Road Entering the Trees",
        "caption_en": "The road enters the trees and disappears",
        "caption_ru": "Дорога входит в деревья и исчезает",
        "queries": ["4K forest road", "4K country road", "4K dirt road", "4K road"],
        "prefer": [
            "Hatfield Forest road Hatfield Broad Oak Essex England",
            "Aerial views of a car driving in snow through a forest",
            "Nairobi National Park (August 2025) Dirt road fast",
        ],
        "keywords": ["road", "path", "forest", "track", "lane", "hatfield"],
    },
    {
        "id": "showcase-4k-10",
        "stage": "path",
        "track": "road-03",
        "title": "The Last Light Opening the Horizon",
        "caption_en": "Light opens all the way to the horizon",
        "caption_ru": "Свет открывается до самого горизонта",
        "queries": ["4K road sunrise", "4K empty road", "4K sunset", "4K horizon"],
        "prefer": [
            "Nairobi National Park (August 2025) Dirt road fast",
            "Algonquin Sunset 4k",
            "Vintgar szoros, Szlovénia 4K",
            "Time Lapse Sunset 4K 4096x2304",
        ],
        "keywords": ["road", "sunset", "sunrise", "light", "horizon", "gorge", "vintgar"],
    },
]

STAGE_COUNTS = {"shadow": 3, "trickster_abyss": 3, "calm": 2, "path": 2}
BANNED_TITLE = re.compile(
    r"\b(nasa|svs|esa|iss|noaa|nesdis|space|rocket|satellite|astronaut|animation|"
    r"animated|logo|trailer|screen|gameplay|minecraft|lecture|conference|interview|"
    r"news|advert|commercial|music\s+video|title\s+card|test\s+video|demo\s+reel|"
    r"greenscreen|city\s+tour|walking\s+in)\b",
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
        for key in ("caption_en", "caption_ru"):
            words = len(scene[key].split())
            if not 5 <= words <= 8:
                raise RuntimeError(
                    scene["id"] + " caption " + key + " has " + str(words) + " words")
        if not scene["queries"] or not scene["prefer"]:
            raise RuntimeError(scene["id"] + " has no search query or preferred master")
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
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        payload = response.read()
    return json.loads(payload.decode("utf-8"))


def plain_text(value):
    text = HTML_TAG.sub(" ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def extmeta(info, key):
    block = (info.get("extmetadata") or {}).get(key) or {}
    return plain_text(block.get("value"))


# --------------------------------------------------------------------------
# source discovery
# --------------------------------------------------------------------------
SEARCH_CACHE = {}


def commons_search(term, limit=50):
    cached = SEARCH_CACHE.get(term)
    if cached is not None:
        return cached
    params = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "generator": "search",
        "gsrsearch": "filetype:video " + term,
        "gsrnamespace": "6",
        "gsrlimit": str(limit),
        "prop": "videoinfo",
        "viprop": "url|size|mime|duration|extmetadata",
    }
    try:
        payload = http_json(COMMONS_API, params)
    except Exception as error:  # a single dead query must not kill the build
        print("  commons query failed (" + term + "): " + str(error), flush=True)
        SEARCH_CACHE[term] = []
        return []
    pages = ((payload.get("query") or {}).get("pages") or [])
    results = []
    for page in pages:
        info = (page.get("videoinfo") or [{}])[0]
        url = info.get("url") or ""
        if not url.startswith("https://"):
            continue
        raw_size = info.get("size")
        results.append({
            "key": "commons:" + str(page.get("pageid") or page.get("title")),
            "library": "wikimedia",
            "title": plain_text(page.get("title") or "").replace("File:", ""),
            "url": url,
            "width": int(info.get("width") or 0),
            "height": int(info.get("height") or 0),
            "duration": float(info.get("duration") or 0.0),
            "bytes": int(raw_size) if str(raw_size or "").isdigit() else 0,
            "mime": str(info.get("mime") or ""),
            "credit": extmeta(info, "Artist"),
            "license": extmeta(info, "LicenseShortName"),
            "page": str(info.get("descriptionurl") or ""),
        })
    SEARCH_CACHE[term] = results
    return results


def collect_mp4_urls(node, found):
    if isinstance(node, dict):
        for value in node.values():
            collect_mp4_urls(value, found)
    elif isinstance(node, list):
        for value in node:
            collect_mp4_urls(value, found)
    elif isinstance(node, str):
        low = node.lower()
        if low.startswith("https://") and ".mp4" in low and "coverr" in low:
            if "4k" in low or "2160" in low or "uhd" in low:
                found.add(node)


def coverr_search(term):
    """Open Coverr catalog as the reserve library; never fatal when it is down."""
    endpoints = (
        "https://coverr.co/api/videos?page=1&per_page=24&query=" + urllib.parse.quote(term),
        "https://coverr.co/api/videos?query=" + urllib.parse.quote(term),
    )
    for endpoint in endpoints:
        try:
            payload = http_json(endpoint)
        except Exception:
            continue
        urls = set()
        collect_mp4_urls(payload, urls)
        if not urls:
            continue
        return [{
            "key": "coverr:" + url,
            "library": "coverr",
            "title": "Coverr nature clip",
            "url": url,
            "width": 0,
            "height": 0,
            "duration": 0.0,
            "bytes": 0,
            "mime": "video/mp4",
            "credit": "Coverr",
            "license": "Coverr free license",
            "page": "https://coverr.co/",
        } for url in sorted(urls)]
    return []


def is_probably_video(candidate):
    if candidate["mime"].startswith("video/"):
        return True
    return candidate["url"].lower().split("?")[0].endswith((".webm", ".ogv", ".ogg", ".mp4", ".mov"))


def is_4k_candidate(candidate):
    return candidate["width"] >= 2160 or candidate["height"] >= 2160


def acceptable(candidate):
    if not is_probably_video(candidate):
        return False
    if not is_4k_candidate(candidate):
        return False
    if candidate["duration"] < 12.0 or candidate["duration"] > 900.0:
        return False
    if BANNED_TITLE.search(candidate["title"]):
        return False
    if candidate["bytes"] and candidate["bytes"] > MAX_SOURCE_BYTES:
        return False
    return True


def gather_candidates(scene):
    """Preferred 4K masters first, then live keyword queries, best first."""
    pool = {}
    prefer = scene["prefer"]
    for rank, fragment in enumerate(prefer):
        matches = [item for item in commons_search(fragment) if acceptable(item)]
        exact = [item for item in matches if fragment.lower() in item["title"].lower()]
        for candidate in (exact or matches):
            pool.setdefault(candidate["key"], dict(candidate, rank=rank))
    generic_start = len(prefer)
    for rank, term in enumerate(scene["queries"]):
        for candidate in commons_search(term):
            if not acceptable(candidate):
                continue
            if candidate["key"] in pool:
                continue
            hits = sum(1 for keyword in scene["keywords"] if keyword in candidate["title"].lower())
            if not hits:
                continue
            pool[candidate["key"]] = dict(candidate, rank=generic_start + rank)
    ordered = sorted(pool.values(), key=lambda item: (
        item["rank"],
        -sum(1 for keyword in scene["keywords"] if keyword in item["title"].lower()),
        -min(item["width"], item["height"]),
        abs(item["duration"] - 70.0),
        item["bytes"],
    ))
    return ordered


def reserve_candidates(scene):
    """Coverr fallback, only when Commons has nothing usable for this scene."""
    pool = {}
    for term in scene["queries"][:2]:
        for candidate in coverr_search(term):
            pool[candidate["key"]] = candidate
    ordered = list(pool.values())
    random.Random(scene["id"]).shuffle(ordered)
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


def download(url, path, referer="https://commons.wikimedia.org/"):
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


def rate_args(bitrate_k, cbr):
    maxrate = bitrate_k if cbr else max(1550, int(round(bitrate_k * 1.24)))
    bufsize = max(2500, int(round(bitrate_k * 2)))
    args = ["-b:v", str(bitrate_k) + "k", "-maxrate", str(maxrate) + "k", "-bufsize", str(bufsize) + "k"]
    if cbr:
        args += ["-minrate", str(bitrate_k) + "k"]
    return args


def vf(width, height):
    return (
        "scale=" + str(width) + ":" + str(height)
        + ":force_original_aspect_ratio=increase:flags=lanczos"
        + ",crop=" + str(width) + ":" + str(height)
        + ",setsar=1,fps=" + str(FPS) + ",format=yuv420p"
    )


def encode_720(src, out, start, bitrate_k, cbr, filler=False):
    logfile = OUT_720 / ("pass-" + out.stem)
    base = [
        "ffmpeg", "-y", "-v", "error",
        "-ss", format(start, ".3f"), "-t", str(DURATION), "-i", str(src),
        "-an", "-vf", vf(W720, H720),
        "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
    ] + rate_args(bitrate_k, cbr) + (
        ["-x264-params", "nal-hrd=cbr:filler=1"] if filler else []
    ) + [
        "-pix_fmt", "yuv420p", "-g", "60", "-keyint_min", "30", "-sc_threshold", "0",
    ]
    run(base + ["-pass", "1", "-passlogfile", str(logfile), "-f", "null", "/dev/null"])
    run(base + [
        "-pass", "2", "-passlogfile", str(logfile),
        "-movflags", "+faststart", "-map_metadata", "-1", str(out),
    ])


def encode_1080(src, out, start, crf, maxrate, bufsize):
    run([
        "ffmpeg", "-y", "-v", "error",
        "-ss", format(start, ".3f"), "-t", str(DURATION), "-i", str(src),
        "-an", "-vf", vf(W1080, H1080),
        "-c:v", "libx264", "-profile:v", "high", "-preset", "medium",
        "-crf", str(crf), "-maxrate", maxrate, "-bufsize", bufsize,
        "-pix_fmt", "yuv420p", "-g", "60", "-keyint_min", "30", "-sc_threshold", "0",
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
    """Two-pass 1250k first, then walk the bitrate into the 1.40-1.85 MB band."""
    bitrate = 1250
    cbr = False
    best = None
    for attempt in range(4):
        encode_720(src, out, start, bitrate, cbr)
        size = out.stat().st_size
        print("  " + out.name + ": attempt " + str(attempt + 1) + " -> " + str(size)
              + " bytes (" + str(bitrate) + "k" + (", cbr)" if cbr else ")"), flush=True)
        if SIZE_720_MIN <= size <= SIZE_720_MAX:
            verify_clip(out, W720, H720)
            return size
        if best is None or abs(size - SIZE_720_TARGET) < abs(best[0] - SIZE_720_TARGET):
            best = (size, bitrate, cbr)
        next_bitrate = int(round(bitrate * SIZE_720_TARGET / max(size, 1)))
        next_bitrate = max(900, min(1800, next_bitrate))
        if size < SIZE_720_MIN:
            # A near-static frame undershoots ABR: pin minrate so the clip reaches
            # the mobile weight band instead of shipping a starved 1.1 MB file.
            cbr = True
            next_bitrate = max(next_bitrate, 1260)
        if next_bitrate == bitrate and attempt >= 1:
            # The rate control has saturated and still misses the band (a locked
            # sunset or a still lake compresses far below the mobile target).
            break
        bitrate = next_bitrate
    # Last resort: a real CBR stream with x264 filler pads the frame to the exact
    # mobile weight. Nothing visual is added or removed — the floor of the band is
    # honoured instead of publishing an unexpectedly light 1.0 MB clip.
    encode_720(src, out, start, 1260, True, filler=True)
    size = out.stat().st_size
    print("  " + out.name + ": attempt 5 -> " + str(size) + " bytes (1260k, cbr+filler)",
          flush=True)
    if SIZE_720_MIN <= size <= SIZE_720_MAX:
        verify_clip(out, W720, H720)
        return size
    raise RuntimeError(out.name + ": could not reach 1.40-1.85 MB (best " + str(best)
                       + ", filler " + str(size) + ")")


def build_1080(src, out, start):
    encode_1080(src, out, start, 18, "5500k", "11000k")
    size = out.stat().st_size
    print("  " + out.name + ": " + str(size) + " bytes at CRF 18", flush=True)
    if size > MAX_1080_BYTES:
        encode_1080(src, out, start, 20, "5000k", "10000k")
        size = out.stat().st_size
        print("  " + out.name + ": " + str(size) + " bytes at CRF 20 (ceiling retry)", flush=True)
        if size > MAX_1080_BYTES:
            raise RuntimeError(out.name + ": " + str(size) + " bytes exceeds the 7 MB ceiling")
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


def accept_source(scene, candidate, used_sources):
    if candidate["key"] in used_sources:
        return None
    suffix = Path(urllib.parse.urlparse(candidate["url"]).path).suffix or ".mp4"
    source_path = SOURCE_DIR / (scene["id"] + ".source" + suffix)
    referer = "https://coverr.co/" if candidate["library"] == "coverr" else "https://commons.wikimedia.org/"
    print("  downloading " + candidate["library"] + ": " + candidate["title"], flush=True)
    try:
        download(candidate["url"], source_path, referer)
        probe = ffprobe(source_path)
    except Exception as error:
        print("  rejected (" + str(error) + ")", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    if probe["duration"] < DURATION + 0.4:
        print("  rejected: only " + str(round(probe["duration"], 2)) + " s of video", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    if probe["width"] < 2160 and probe["height"] < 2160:
        print("  rejected: " + str(probe["width"]) + "x" + str(probe["height"])
              + " is not a 4K master", flush=True)
        source_path.unlink(missing_ok=True)
        return None
    if probe["width"] * probe["height"] < 2560 * 1440:
        print("  warning: below 1440p, keeping " + str(probe["width"]) + "x" + str(probe["height"]), flush=True)
    used_sources.add(candidate["key"])
    return source_path, probe, candidate


def build_scene(scene, used_sources, s3, dry_run=False):
    candidates = gather_candidates(scene)
    if not candidates:
        print("  no Commons 4K result for " + scene["id"] + ", asking the Coverr reserve", flush=True)
        candidates = reserve_candidates(scene)
    if not candidates:
        raise RuntimeError("no 4K source found for " + scene["id"])
    if dry_run:
        for candidate in candidates[:4]:
            print("  " + scene["id"] + " candidate: " + str(candidate["width"]) + "x"
                  + str(candidate["height"]) + " " + str(round(candidate["duration"], 1)) + "s "
                  + format(candidate["bytes"] / 1e6, ".0f") + "MB "
                  + candidate["title"], flush=True)
        return None
    accepted = None
    for candidate in candidates[:8]:
        accepted = accept_source(scene, candidate, used_sources)
        if accepted:
            break
    if not accepted:
        raise RuntimeError("every candidate failed for " + scene["id"])
    source_path, probe, candidate = accepted
    start = trim_start(probe["duration"])
    print("  master " + str(probe["width"]) + "x" + str(probe["height"]) + " "
          + str(round(probe["duration"], 1)) + "s, cutting from " + format(start, ".2f") + "s", flush=True)
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
    parser = argparse.ArgumentParser(description="Build the ten-scene 4K showcase")
    parser.add_argument("--dry-run", action="store_true",
                        help="only resolve and print source candidates, download nothing")
    args = parser.parse_args()

    validate_scene_table()
    if args.dry_run:
        print("dry run: " + str(len(SCENES)) + " scenes, metadata only", flush=True)
        used = set()
        for scene in SCENES:
            build_scene(scene, used, None, dry_run=True)
        return 0

    prepare_workdir()
    s3 = s3_client()
    used_sources = set()
    built = []
    for scene in SCENES:
        print("building " + scene["id"] + " (" + scene["stage"] + ")", flush=True)
        built.append(build_scene(scene, used_sources, s3))

    weights = [item["size720"] for item in built]
    if min(weights) < SIZE_720_MIN or max(weights) > SIZE_720_MAX:
        raise RuntimeError("mobile weights outside 1.40-1.85 MB: " + str(weights))
    opening = [item for item in built
               if item["scene"]["stage"] == "shadow" and item["size720"] <= OPENING_720_MAX]
    if not opening:
        raise RuntimeError("no shadow scene fits the 1.65 MB instant-opening pool")

    for item in built:
        upload(s3, item["mobile"], PREFIX_720 + "/" + item["scene"]["id"] + ".mp4")
        upload(s3, item["studio"], PREFIX_1080 + "/" + item["scene"]["id"] + ".mp4")

    catalog = [catalog_entry(item) for item in built]
    write_catalog(catalog)

    print("", flush=True)
    print("showcase built: " + str(len(catalog)) + " scenes", flush=True)
    print("mobile 720p: " + str(min(weights)) + "-" + str(max(weights)) + " bytes", flush=True)
    masters = [item["size1080"] for item in built]
    print("studio 1080p: " + str(min(masters)) + "-" + str(max(masters)) + " bytes", flush=True)
    print("instant opening pool: " + str(len(opening)) + " shadow scenes <= "
          + str(OPENING_720_MAX) + " bytes", flush=True)
    for entry in catalog:
        print("  " + entry["id"] + " " + entry["stage"] + " " + entry["trackId"] + " "
              + str(entry["size720"]) + " B / " + str(entry["size"]) + " B", flush=True)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # a failed cloud build must never publish a partial catalog
        print("FATAL: " + str(error), flush=True)
        sys.exit(1)
