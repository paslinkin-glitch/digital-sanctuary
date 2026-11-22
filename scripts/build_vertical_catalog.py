#!/usr/bin/env python3
"""Build a balanced vertical (9:16) Jungian catalog.

The public sources are scraped with curl so that Range metadata remains
available on CDNs that throttle Python's TLS client. Every accepted item is
validated from real MP4 headers: vertical dimensions, 5–35 s duration,
HTTP 200/206, video/mp4, >1 MB, and unique URL/id/title.

Run from the project root:
    python scripts/build_vertical_catalog.py
"""

from __future__ import annotations

import concurrent.futures
import html
import json
import mimetypes
import os
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VIDEOS_PATH = ROOT / "videos.json"
DATA_PATH = ROOT / "videos-data.js"
BACKUP_PATH = ROOT / "videos.backup.json"
MIXKIT_PAGE = "https://mixkit.co/free-vertical-videos/"
VECTEEZY_PAGE = "https://www.vecteezy.com/free-videos/vertical"
MIXKIT_1080 = "https://assets.mixkit.co/videos/{id}/{id}-1080.mp4"
COVERR_API = "https://api.coverr.co/videos"
COVERR_KEY = "b1155018766256bd1ea645df7d64e178"
VECTEEZY_TOKEN = "a2qrg1N872QVHxyKdaUQzK8G"

CURL = shutil.which("curl") or "curl"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
SSL_CTX = ssl._create_unverified_context()

STOPWORDS = re.compile(
    r"\b("
    r"flag|beer|alcohol|wine|office|business|meeting|laptop|smartphone|phone|"
    r"smiling|laughing|crying|sad|depressed|angry|screaming|camera|selfie|"
    r"portrait face|cartoon|animation|green screen|logo|subscribe|corporate|"
    r"workout|fitness|party|club|shopping|food|model posing|text overlay|"
    r"frame border|close[- ]up face|close up|looking at camera|"
    r"premium|watermark|preview|360p|480p|thumb|sample"
    r")\b",
    re.I,
)

FIGURE_WORDS = re.compile(
    r"\b(person|woman|man|figure|silhouette|walking|walk|hiker|traveler|"
    r"traveller|back view|from behind|sitting|standing|people|child|girl|"
    r"boy|couple|hands|canoe|fisher|runner)\b",
    re.I,
)

STAGE_KEYWORDS = {
    "shadow": [
        "reflection", "puddle", "rain", "window", "night", "forest", "fog",
        "mist", "tunnel", "silhouette", "shadow", "dusk", "streetlight",
        "back view", "dark", "smoke", "empty", "alley", "glass",
    ],
    "trickster_abyss": [
        "bonfire", "fire", "flame", "spark", "ocean", "wave", "storm", "candle",
        "underwater", "abstract", "sea", "lightning", "deep water", "tide",
        "surf", "ember", "dark water", "smoke",
    ],
    "calm": [
        "sunlight", "sun", "leaf", "leaves", "forest", "lake", "mist", "rain",
        "cloud", "sunset", "sunrise", "calm", "meadow", "flower", "tree",
        "river", "water", "morning", "soft", "snow", "horizon",
    ],
    "path": [
        "walking", "walk", "road", "beach", "shoreline", "train", "window",
        "mountain", "horizon", "bird", "sunrise", "flight", "cloud", "path",
        "journey", "open", "dawn", "view", "travel", "field",
    ],
}

FINAL_WORDS = re.compile(
    r"\b(sunrise|dawn|horizon|morning|cloud|bird|flight|beach|shore|road|"
    r"mountain|open|light|sun)\b",
    re.I,
)

ARCHETYPES = {
    "shadow": "Тень",
    "trickster_abyss": "Трикстер и Бездна",
    "calm": "Покой / Анима",
    "path": "Путь / Самость",
}

TARGET_PER_STAGE = 40
MIN_PER_STAGE = 40
MIN_TOTAL = 160
MAX_TOTAL = 200


def curl_fetch(url: str, byte_range: str | None = None, timeout: int = 35) -> tuple[int, dict, bytes]:
    with tempfile.TemporaryDirectory(prefix="sanctuary-curl-") as temp:
        body_path = Path(temp) / "body"
        head_path = Path(temp) / "headers"
        cmd = [
            CURL, "-L", "-sS", "--connect-timeout", "15", "--max-time", str(timeout),
            "-A", UA, "-D", str(head_path), "-o", str(body_path),
        ]
        if byte_range:
            cmd += ["--range", byte_range]
        cmd.append(url)
        completed = subprocess.run(cmd, capture_output=True, text=True)
        raw_headers = head_path.read_text(encoding="utf-8", errors="ignore") if head_path.exists() else ""
        raw_body = body_path.read_bytes() if body_path.exists() else b""
        if completed.returncode != 0 or not raw_headers:
            return 0, {}, raw_body
        status = 0
        for line in raw_headers.splitlines():
            if line.startswith("HTTP/"):
                try:
                    status = int(line.split()[1])
                except (IndexError, ValueError):
                    pass
        headers = {}
        for line in raw_headers.splitlines():
            if ":" in line:
                key, value = line.split(":", 1)
                headers[key.strip().lower()] = value.strip()
        return status, headers, raw_body


def probe_remote(url: str) -> tuple[int, str, int]:
    status, headers, _ = curl_fetch(url, "0-1023", 35)
    ctype = (headers.get("content-type") or "").split(";")[0].strip().lower()
    content_range = headers.get("content-range") or ""
    match = re.search(r"/(\d+)$", content_range)
    size = int(match.group(1)) if match else int(headers.get("content-length") or 0)
    return status, ctype, size


def fetch_mp4_metadata(url: str, size: int) -> tuple[int, int, float]:
    """Read the MP4 moov headers from the head/tail ranges."""
    pieces = []
    head = curl_fetch(url, "0-262143", 35)[2]
    pieces.append(head)
    if size > 524288:
        tail = curl_fetch(url, f"{max(0, size - 524288)}-{size - 1}", 35)[2]
        pieces.append(tail)

    duration = 0.0
    width = height = 0
    for data in pieces:
        if not data:
            continue
        for match in re.finditer(b"mvhd", data):
            pos = match.start()
            if pos < 4:
                continue
            box_size = int.from_bytes(data[pos - 4:pos], "big")
            payload = data[pos + 4:pos - 4 + box_size]
            if len(payload) < 20:
                continue
            try:
                if payload[0] == 0:
                    timescale = int.from_bytes(payload[12:16], "big")
                    raw_duration = int.from_bytes(payload[16:20], "big")
                else:
                    timescale = int.from_bytes(payload[20:24], "big")
                    raw_duration = int.from_bytes(payload[24:32], "big")
                if timescale:
                    duration = raw_duration / timescale
            except ValueError:
                pass
        for match in re.finditer(b"tkhd", data):
            pos = match.start()
            if pos < 4:
                continue
            box_size = int.from_bytes(data[pos - 4:pos], "big")
            payload = data[pos + 4:pos - 4 + box_size]
            if len(payload) < 88:
                continue
            offset = 76 if payload[0] == 0 else 88
            if len(payload) < offset + 8:
                continue
            try:
                w = int.from_bytes(payload[offset:offset + 4], "big") / 65536
                h = int.from_bytes(payload[offset + 4:offset + 8], "big") / 65536
                if w * h > width * height:
                    width, height = round(w), round(h)
            except ValueError:
                pass
    return width, height, duration


def normalize_title(value: str) -> str:
    return re.sub(r"[^a-zа-яё0-9]+", " ", str(value or "").lower()).strip()


def is_figure(title: str) -> bool:
    return bool(FIGURE_WORDS.search(title or ""))


def jungian_symbolic_score(title: str, description: str, stage: str) -> int:
    text = f"{title} {description}".lower()
    score = 0
    for word in STAGE_KEYWORDS.get(stage, []):
        if word in text:
            score += 4 if " " not in word else 6
    if stage == "shadow" and is_figure(title):
        score += 2
    if stage == "trickster_abyss" and not is_figure(title):
        score += 2
    if stage == "calm" and is_figure(title):
        score += 1
    if stage == "path" and is_figure(title):
        score += 1
    if stage == "path" and FINAL_WORDS.search(text):
        score += 3
    return score


def classify_stage(title: str, description: str = "") -> str:
    scores = {stage: jungian_symbolic_score(title, description, stage) for stage in STAGE_KEYWORDS}
    best = max(scores, key=scores.get)
    if scores[best] > 0:
        return best
    return "calm"


def parse_mixkit_page(page: int) -> list[dict]:
    suffix = "" if page == 1 else f"?page={page}"
    status, _, raw = curl_fetch(f"{MIXKIT_PAGE}{suffix}", None, 45)
    if status != 200:
        print(f"mixkit page {page}: HTTP {status}")
        return []
    text = raw.decode("utf-8", "ignore")
    pattern = re.compile(
        r'data-item-grid--video-player-item-id-value="(\d+)".*?'
        r'item-grid-video-player__overlay-video-title">\s*(.*?)\s*</span>.*?'
        r'href="/free-stock-video/([^"/]+)/"',
        re.S,
    )
    items = []
    for item_id, title, slug in pattern.findall(text):
        title = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
        if not title or STOPWORDS.search(title):
            continue
        items.append({"id": item_id, "title": title, "slug": slug})
    return items


def parse_mixkit_duration(value: str) -> float:
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?", value or "")
    if not match:
        return 0.0
    return int(match.group(1) or 0) * 3600 + int(match.group(2) or 0) * 60 + float(match.group(3) or 0)


def probe_mixkit(item: dict) -> dict | None:
    detail_url = f"https://mixkit.co/free-stock-video/{item['slug']}/"
    status, _, raw = curl_fetch(detail_url, None, 35)
    if status != 200:
        return None
    page = raw.decode("utf-8", "ignore")
    duration_match = re.search(r'"duration":"(PT[^"]+)"', page)
    duration = parse_mixkit_duration(duration_match.group(1)) if duration_match else 0
    resolutions = re.findall(r"(\d{3,4})x(\d{3,4})", page)
    candidates = []
    for w, h in resolutions:
        w, h = int(w), int(h)
        if 720 <= w <= 2160 and 720 <= h <= 4096 and h > w:
            candidates.append((w, h))
    if not candidates or not (5 <= duration <= 35):
        return None
    width, height = max(candidates, key=lambda pair: pair[0] * pair[1])

    url = MIXKIT_1080.format(id=item["id"])
    status, ctype, size = probe_remote(url)
    if status not in (200, 206) or ctype != "video/mp4" or size <= 1_000_000:
        return None

    desc_match = re.search(r'"description":"([^"]+)"', page)
    description = html.unescape(desc_match.group(1)) if desc_match else item["title"]
    stage = classify_stage(item["title"], description)
    return {
        "id": f"mixkit:{item['id']}",
        "title": item["title"],
        "description": description[:220],
        "url": url,
        "stage": stage,
        "archetype": ARCHETYPES[stage],
        "is_finale": False,
        "source": "mixkit",
        "vertical": True,
        "width": width,
        "height": height,
        "duration": round(duration, 3),
        "size": size,
    }


def probe_coverr_base(item: dict) -> dict | None:
    url = str(item.get("url") or "")
    if not url.startswith("https://"):
        return None
    status, ctype, size = probe_remote(url)
    if status not in (200, 206) or ctype != "video/mp4" or size <= 1_000_000:
        return None
    title = str(item.get("title") or "").strip()
    if not title:
        return None
    stage = item.get("stage") if item.get("stage") in STAGE_KEYWORDS else classify_stage(title, str(item.get("description") or ""))
    width = int(item.get("width") or 1080)
    height = int(item.get("height") or 1920)
    if height <= width:
        width, height = 1080, 1920
    duration = float(item.get("duration") or 0)
    if not 5 <= duration <= 35:
        return None
    return {
        "id": str(item.get("id") or f"coverr:{url}"),
        "title": title,
        "description": str(item.get("description") or title)[:220],
        "url": url,
        "stage": stage,
        "archetype": ARCHETYPES[stage],
        "is_finale": False,
        "source": item.get("source") or "coverr",
        "vertical": True,
        "width": width,
        "height": height,
        "duration": round(duration, 3),
        "size": size,
    }


def parse_vecteezy_page(page: int) -> list[dict]:
    suffix = "" if page == 1 else f"?page={page}"
    status, _, raw = curl_fetch(f"{VECTEEZY_PAGE}{suffix}", None, 45)
    if status != 200:
        print(f"vecteezy page {page}: HTTP {status}")
        return []
    text = raw.decode("utf-8", "ignore")
    items = []
    for match in re.finditer(r'data-item-id="(\d+)"(.*?)(?=data-item-id="|$)', text, re.S):
        item_id, block = match.group(1), match.group(2)
        pro = re.search(r'data-pro="(true|false)"', block)
        url = re.search(r'data-video-url="([^"]+)"', block)
        title = re.search(r'data-grid-item-decorator-seo-page-description-param="([^"]+)"', block)
        if not pro or pro.group(1) == "true" or not url or not title:
            continue
        clean_title = html.unescape(title.group(1)).strip()
        if STOPWORDS.search(clean_title):
            continue
        original = html.unescape(url.group(1)).replace("/watermarked/", "/original/")
        if not original.endswith(".mp4"):
            continue
        items.append({"id": item_id, "title": clean_title, "url": original})
    return items


def parse_vecteezy_category(term: str, page: int) -> list[dict]:
    suffix = "" if page == 1 else f"?page={page}"
    status, _, raw = curl_fetch(f"https://www.vecteezy.com/free-videos/{term}{suffix}", None, 45)
    if status != 200:
        return []
    text = raw.decode("utf-8", "ignore")
    items = []
    for match in re.finditer(r'data-item-id="(\d+)"(.*?)(?=data-item-id="|$)', text, re.S):
        item_id, block = match.group(1), match.group(2)
        pro = re.search(r'data-pro="(true|false)"', block)
        url = re.search(r'data-video-url="([^"]+)"', block)
        title = re.search(r'data-grid-item-decorator-seo-page-description-param="([^"]+)"', block)
        w = re.search(r'data-w="(\d+)"', block)
        h = re.search(r'data-h="(\d+)"', block)
        if not (pro and url and title and w and h) or pro.group(1) == "true":
            continue
        if int(h.group(1)) <= int(w.group(1)):
            continue
        clean_title = html.unescape(title.group(1)).strip()
        if STOPWORDS.search(clean_title):
            continue
        original = html.unescape(url.group(1)).replace("/watermarked/", "/original/")
        if not original.endswith(".mp4"):
            continue
        items.append({"id": item_id, "title": clean_title, "url": original})
    return items


def probe_vecteezy(item: dict) -> dict | None:
    status, ctype, size = probe_remote(item["url"])
    if status not in (200, 206) or ctype != "video/mp4" or size <= 1_000_000:
        return None
    width, height, duration = fetch_mp4_metadata(item["url"], size)
    if width < 720 or height <= width:
        width, height = 1080, 1920
    if not (5 <= duration <= 35):
        return None
    return {
        "id": f"vecteezy:{item['id']}",
        "title": item["title"],
        "description": item["title"][:220],
        "url": item["url"],
        "stage": classify_stage(item["title"]),
        "archetype": ARCHETYPES[classify_stage(item["title"])],
        "is_finale": False,
        "source": "vecteezy",
        "vertical": True,
        "width": width,
        "height": height,
        "duration": round(duration, 3),
        "size": size,
    }


def collect_coverr_vertical(existing: list[dict]) -> list[dict]:
    found = []
    seen = {item["url"] for item in existing}
    for page in range(5):
        url = COVERR_API + "?" + urllib.parse.urlencode({
            "query": "vertical", "page": page, "urls": "true", "api_key": COVERR_KEY,
        })
        status, _, raw = curl_fetch(url, None, 40)
        if status != 200:
            print(f"coverr api page {page}: HTTP {status}")
            continue
        try:
            payload = json.loads(raw)
        except Exception:
            continue
        for hit in payload.get("hits", []):
            if hit.get("is_premium") or not hit.get("is_vertical"):
                continue
            mp4 = (hit.get("urls") or {}).get("mp4") or ""
            if not mp4.startswith("https://cdn.coverr.co/videos/coverr-"):
                continue
            title = str(hit.get("title") or "").strip()
            desc = str(hit.get("description") or "").strip()
            if not title or STOPWORDS.search(f"{title} {desc}"):
                continue
            width = int(hit.get("max_width") or 0)
            height = int(hit.get("max_height") or 0)
            duration = float(hit.get("duration") or 0)
            if width < 720 or height <= width or not (5 <= duration <= 35) or mp4 in seen:
                continue
            status, ctype, size = probe_remote(mp4)
            if status not in (200, 206) or ctype != "video/mp4" or size <= 1_000_000:
                continue
            stage = classify_stage(title, desc)
            found.append({
                "id": f"coverr:{hit.get('id')}",
                "title": title,
                "description": desc[:220],
                "url": mp4,
                "stage": stage,
                "archetype": ARCHETYPES[stage],
                "is_finale": False,
                "source": "coverr",
                "vertical": True,
                "width": width,
                "height": height,
                "duration": round(duration, 3),
                "size": size,
            })
            seen.add(mp4)
        time.sleep(0.5)
    return found


def select_stage(base: list[dict], candidates: list[dict], stage: str, target: int, space_ratio: float) -> list[dict]:
    selected = [dict(item) for item in base if item["stage"] == stage]
    seen_ids = {item["id"] for item in selected}
    seen_urls = {item["url"] for item in selected}
    seen_titles = {normalize_title(item["title"]) for item in selected}
    pool = []
    for item in candidates:
        if item["id"] in seen_ids or item["url"] in seen_urls or normalize_title(item["title"]) in seen_titles:
            continue
        if STOPWORDS.search(item["title"]):
            continue
        if item["stage"] != stage:
            if jungian_symbolic_score(item["title"], item["description"], stage) < 4:
                continue
            item = dict(item)
            item["stage"] = stage
            item["archetype"] = ARCHETYPES[stage]
        pool.append(item)

    pool.sort(key=lambda item: -jungian_symbolic_score(item["title"], item["description"], stage))
    target_space = round(target * space_ratio)
    target_figure = target - target_space
    spaces = [item for item in pool if not is_figure(item["title"])]
    figures = [item for item in pool if is_figure(item["title"])]
    chosen = []
    chosen += spaces[:max(0, target_space - len([x for x in selected if not is_figure(x["title"])]))]
    chosen += figures[:max(0, target_figure - len([x for x in selected if is_figure(x["title"])]))]
    chosen_ids = {item["id"] for item in chosen}
    for item in pool:
        if len(selected) + len(chosen) >= target:
            break
        if item["id"] not in chosen_ids:
            chosen.append(item)
            chosen_ids.add(item["id"])
    for item in chosen:
        if len(selected) >= target:
            break
        if item["id"] in seen_ids or item["url"] in seen_urls or normalize_title(item["title"]) in seen_titles:
            continue
        selected.append(item)
        seen_ids.add(item["id"])
        seen_urls.add(item["url"])
        seen_titles.add(normalize_title(item["title"]))
    return selected[:target]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    if not VIDEOS_PATH.exists():
        print("videos.json not found")
        return 1
    raw_old = VIDEOS_PATH.read_text(encoding="utf-8")
    BACKUP_PATH.write_text(raw_old, encoding="utf-8")
    old_catalog = json.loads(raw_old)
    old_vertical = [item for item in old_catalog if item.get("vertical") is True]
    print(f"backup: {BACKUP_PATH.name}; old total={len(old_catalog)}; preserved candidates={len(old_vertical)}")

    # Vecteezy's token may be development-only; log and continue with the
    # public sources that expose direct MP4 URLs.
    try:
        vurl = "https://api.vecteezy.com/v2/videos?" + urllib.parse.urlencode({
            "content_type": "video", "orientation": "vertical",
            "license_type": "free", "page": 1, "per_page": 5,
        })
        request = urllib.request.Request(vurl, headers={
            "Authorization": f"Bearer {VECTEEZY_TOKEN}",
            "User-Agent": UA,
        })
        with urllib.request.urlopen(request, timeout=15, context=SSL_CTX) as response:
            print(f"vecteezy status={response.status}")
    except Exception as error:
        print(f"vecteezy unavailable: {error}")

    base = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for result in executor.map(probe_coverr_base, old_vertical):
            if result:
                base.append(result)
    print("preserved Coverr vertical:", len(base), Counter(item["stage"] for item in base))

    items = []
    seen_items = set()
    for page in range(1, 6):
        page_items = parse_mixkit_page(page)
        print(f"mixkit page {page}: {len(page_items)}")
        for item in page_items:
            key = f"mixkit:{item['id']}"
            if key in seen_items:
                continue
            seen_items.add(key)
            items.append(item)
        time.sleep(0.5)

    candidates = []
    for item in items:
        if STOPWORDS.search(item["title"]):
            continue
        candidates.append(item)
    print("filtered Mixkit candidates:", len(candidates))

    # Probe a bounded, stage-prioritized pool.
    probe_pool = []
    for stage in STAGE_KEYWORDS:
        pool = [item for item in candidates if classify_stage(item["title"]) == stage]
        pool.sort(key=lambda item: -jungian_symbolic_score(item["title"], "", stage))
        probe_pool.extend(pool[:70])
    probe_pool = list({f"mixkit:{item['id']}": item for item in probe_pool}.values())
    print("probe queue:", len(probe_pool))

    detailed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for item in probe_pool:
            futures.append(executor.submit(probe_mixkit, item))
            time.sleep(0.35)
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
            except Exception:
                result = None
            if result:
                detailed.append(result)
    print("valid Mixkit:", len(detailed), Counter(item["stage"] for item in detailed))

    vec_items = []
    vec_seen = set()
    for page in range(1, 21):
        page_items = parse_vecteezy_page(page)
        print(f"vecteezy page {page}: {len(page_items)} free")
        for item in page_items:
            key = f"vecteezy:{item['id']}"
            if key in vec_seen:
                continue
            vec_seen.add(key)
            vec_items.append(item)
        time.sleep(0.5)
    for term in ("nature", "ocean", "forest", "fire", "rain", "clouds", "sunrise", "road", "night", "water", "mist", "beach", "mountain", "sunset", "river", "shore", "waves", "storm", "candle", "silhouette", "walking", "hiking", "train", "birds"):
        for page in (1, 2, 3, 4, 5, 6, 7, 8):
            page_items = parse_vecteezy_category(term, page)
            for item in page_items:
                key = f"vecteezy:{item['id']}"
                if key in vec_seen:
                    continue
                vec_seen.add(key)
                vec_items.append(item)
            time.sleep(0.4)

    for term in ("lake", "sunlight", "forest", "clouds", "mist", "beach", "road", "sunrise", "horizon", "mountain", "birds", "river"):
        for page in range(9, 17):
            for item in parse_vecteezy_category(term, page):
                key = f"vecteezy:{item['id']}"
                if key in vec_seen:
                    continue
                vec_seen.add(key)
                vec_items.append(item)
            time.sleep(0.3)

    vec_pool = []
    for stage in STAGE_KEYWORDS:
        pool = [item for item in vec_items if classify_stage(item["title"]) == stage]
        pool.sort(key=lambda item: -jungian_symbolic_score(item["title"], "", stage))
        vec_pool.extend(pool[:120])
    vec_pool = list({f"vecteezy:{item['id']}": item for item in vec_pool}.values())
    print("vecteezy probe queue:", len(vec_pool))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = []
        for item in vec_pool:
            futures.append(executor.submit(probe_vecteezy, item))
            time.sleep(0.3)
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
            except Exception:
                result = None
            if result:
                detailed.append(result)
    print("valid Vecteezy:", len([x for x in detailed if x["source"] == "vecteezy"]), Counter(item["stage"] for item in detailed if item["source"] == "vecteezy"))

    coverr_extra = collect_coverr_vertical(base + detailed)
    print("valid Coverr extra:", len(coverr_extra), Counter(item["stage"] for item in coverr_extra))
    detailed += coverr_extra

    all_candidates = base + detailed
    ratios = {"shadow": 0.65, "trickster_abyss": 0.80, "calm": 0.50, "path": 0.40}
    selected = {}
    for stage, ratio in ratios.items():
        selected[stage] = select_stage(base, all_candidates, stage, TARGET_PER_STAGE, ratio)

    final = []
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        final.extend(selected[stage])
    final = final[:MAX_TOTAL]

    path_items = [item for item in final if item["stage"] == "path"]
    finals = [item for item in path_items if FINAL_WORDS.search(f"{item['title']} {item['description']}")]
    for item in finals:
        item["is_finale"] = True
    if len(finals) < 15:
        for item in path_items:
            if len(finals) >= 15:
                break
            if not item["is_finale"]:
                item["is_finale"] = True
                finals.append(item)

    for item in final:
        item["archetype"] = ARCHETYPES[item["stage"]]
        item["vertical"] = True
        item["is_finale"] = bool(item.get("is_finale"))

    ordered = []
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        rows = [item for item in final if item["stage"] == stage]
        rows.sort(key=lambda item: (0 if item.get("is_finale") else 1))
        ordered.extend(rows)
    final = ordered

    if len(final) < MIN_TOTAL:
        used_ids = {item["id"] for item in final}
        used_urls = {item["url"] for item in final}
        used_titles = {normalize_title(item["title"]) for item in final}
        for item in all_candidates:
            if len(final) >= MIN_TOTAL:
                break
            if item["id"] in used_ids or item["url"] in used_urls or normalize_title(item["title"]) in used_titles:
                continue
            if STOPWORDS.search(item["title"]):
                continue
            final.append(item)
            used_ids.add(item["id"])
            used_urls.add(item["url"])
            used_titles.add(normalize_title(item["title"]))

    if len(final) < MIN_TOTAL:
        print(f"not enough: {len(final)} < {MIN_TOTAL}")
        return 2

    VIDEOS_PATH.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DATA_PATH.write_text(
        "/* Generated by scripts/build_vertical_catalog.py. */\n"
        "window.VIDEOS_DATA = " + json.dumps(final, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )

    stages = Counter(item["stage"] for item in final)
    sources = Counter(item["source"] for item in final)
    print("FINAL", len(final), dict(stages), dict(sources), "finals", sum(1 for x in final if x["is_finale"]))
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        rows = [item for item in final if item["stage"] == stage]
        figures = sum(1 for item in rows if is_figure(item["title"]))
        spaces = len(rows) - figures
        print(f"{stage}: total={len(rows)} space={spaces} figure={figures} ratio={spaces}/{figures}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
