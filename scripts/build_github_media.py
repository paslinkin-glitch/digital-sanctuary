#!/usr/bin/env python3
"""Build the self-hosted 1080x1920 media catalog on GitHub/jsDelivr.

Downloads original MP4 files only (no ffmpeg/transcoding), validates byte size,
and writes a new media_cdn/ folder plus CDN URLs for the app. The media repo is
kept separate from the application repo so the app stays lightweight.
"""

from __future__ import annotations

import concurrent.futures
import html
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
from collections import Counter
from pathlib import Path

import build_vertical_catalog as source

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media_cdn"
VIDEOS = ROOT / "videos.json"
DATA = ROOT / "videos-data.js"
PER_STAGE = 30
MIN_SIZE = 3_500_000
MAX_SIZE = 10_500_000
MAX_TOTAL = 920 * 1024 * 1024
CDN = "https://cdn.jsdelivr.net/gh/paslinkin-glitch/digital-sanctuary-media@main/media_cdn/"

CITY = re.compile(
    r"\b(city|avenue|cars?|skyscraper|subway|highway|tower|nyc|building|apartment|street|traffic|carriage)\b",
    re.I,
)


def good(item: dict) -> bool:
    return (
        int(item.get("width") or 0) == 1080
        and int(item.get("height") or 0) == 1920
        and MIN_SIZE <= int(item.get("size") or 0) <= MAX_SIZE
        and int(item.get("size") or 0) * 8 / max(1, float(item.get("duration") or 0)) >= 2_500_000
    )


def clean_id(value: str) -> str:
    key = re.sub(r"[^a-zA-Z0-9_-]+", "-", str(value)).strip("-").lower()
    return (key or "clip")[-52:]


def stage_for_title(title: str, fallback: str = "calm") -> str:
    stage = source.classify_stage(title, "")
    if stage in ("calm", "path") and CITY.search(title):
        return ""
    return stage


def current_candidates() -> list[dict]:
    items = json.loads(VIDEOS.read_text(encoding="utf-8"))
    out = []
    for item in items:
        if not good(item):
            continue
        title = str(item.get("title") or "").strip()
        raw_stage = item.get("stage")
        stage = raw_stage if raw_stage in ("shadow", "trickster_abyss", "calm", "path") else stage_for_title(title, "calm")
        if stage in ("calm", "path") and CITY.search(title):
            continue
        out.append({
            "id": str(item.get("id")),
            "title": title,
            "description": str(item.get("description") or title)[:220],
            "url": str(item.get("url")),
            "stage": stage,
            "duration": float(item.get("duration") or 10),
            "size": int(item.get("size") or 0),
        })
    return out


def vecteezy_candidates(existing_urls: set[str]) -> list[dict]:
    out = []
    for page in range(1, 21):
        try:
            page_items = source.parse_vecteezy_page(page)
        except Exception as error:
            print("vecteezy page", page, error)
            continue
        for item in page_items:
            if item["url"] in existing_urls:
                continue
            title = item["title"]
            stage = stage_for_title(title, "calm")
            if not stage:
                continue
            try:
                status, ctype, size = source.probe_remote(item["url"])
            except Exception:
                continue
            if status not in (200, 206) or ctype != "video/mp4":
                continue
            if not (MIN_SIZE <= size <= MAX_SIZE):
                continue
            out.append({
                "id": f"vecteezy:{item['id']}",
                "title": title,
                "description": title[:220],
                "url": item["url"],
                "stage": stage,
                "duration": 10.0,
                "size": size,
            })
        print(f"vecteezy page {page}: candidates={len(out)}")
        time.sleep(0.25)

    for term in (
        "nature", "ocean", "forest", "fire", "rain", "clouds", "sunrise", "beach",
        "road", "mountain", "night", "fog", "smoke", "water", "dark", "reflection",
        "window", "urban", "street", "city", "tunnel", "lake", "river", "shore",
        "horizon", "dawn", "morning", "sunset", "grass", "meadow", "snow", "sparks",
        "storm", "underwater", "candle", "sea",
    ):
        for page in range(1, 7):
            try:
                page_items = source.parse_vecteezy_category(term, page)
            except Exception:
                continue
            for item in page_items:
                if item["url"] in existing_urls:
                    continue
                title = item["title"]
                stage = stage_for_title(title, "calm")
                if not stage:
                    continue
                try:
                    status, ctype, size = source.probe_remote(item["url"])
                except Exception:
                    continue
                if status not in (200, 206) or ctype != "video/mp4":
                    continue
                if not (MIN_SIZE <= size <= MAX_SIZE):
                    continue
                out.append({
                    "id": f"vecteezy:{item['id']}",
                    "title": title,
                    "description": title[:220],
                    "url": item["url"],
                    "stage": stage,
                    "duration": 10.0,
                    "size": size,
                })
                existing_urls.add(item["url"])
            time.sleep(0.15)
    return out


def coverr_page_candidates(existing_urls: set[str]) -> list[dict]:
    out = []
    try:
        status, _, raw = source.curl_fetch("https://coverr.co/stock-video-footage/vertical", None, 45)
    except Exception:
        return out
    if status != 200:
        return out
    text = raw.decode("utf-8", "ignore")
    urls = list(dict.fromkeys(re.findall(
        r"https://cdn\.coverr\.co/videos/coverr-[^\"'\s]+/1080p\.mp4", text
    )))
    for url in urls:
        if url in existing_urls:
            continue
        slug = url.split("/videos/")[-1].split("/")[0]
        title = re.sub(r"[-_]+", " ", slug.replace("coverr-", "")).strip()
        title = re.sub(r"\d+$", "", title).strip() or "Quiet frame"
        stage = stage_for_title(title, "calm")
        if not stage:
            continue
        try:
            status, ctype, size = source.probe_remote(url)
        except Exception:
            continue
        if status not in (200, 206) or ctype != "video/mp4" or not (MIN_SIZE <= size <= MAX_SIZE):
            continue
        out.append({
            "id": f"coverr:{slug}",
            "title": title.title(),
            "description": title.title(),
            "url": url,
            "stage": stage,
            "duration": 10.0,
            "size": size,
        })
        existing_urls.add(url)
    print("coverr page candidates", len(out))
    return out

def download_one(item: dict) -> dict | None:
    name = f"{item['stage']}_{int(item['index']):02d}_{clean_id(item['id'])}.mp4"
    target = MEDIA / name
    temporary = target.with_suffix(".part")
    try:
        completed = subprocess.run(
            [
                shutil.which("curl") or "curl", "-L", "-sS", "--max-time", "120",
                "-A", "Mozilla/5.0", "-o", str(temporary), item["url"],
            ],
            capture_output=True,
        )
        if completed.returncode != 0 or not temporary.exists():
            return None
        size = temporary.stat().st_size
        if not (MIN_SIZE <= size <= MAX_SIZE):
            temporary.unlink(missing_ok=True)
            return None
        temporary.replace(target)
        return {
            "id": item["id"],
            "title": item["title"],
            "description": item["description"],
            "url": CDN + urllib.parse.quote(name),
            "stage": item["stage"],
            "archetype": "Тень" if item["stage"] == "shadow" else
                         "Трикстер и Бездна" if item["stage"] == "trickster_abyss" else
                         "Покой / Анима" if item["stage"] == "calm" else "Путь / Самость",
            "is_finale": False,
            "source": "jsdelivr",
            "vertical": True,
            "width": 1080,
            "height": 1920,
            "duration": item["duration"],
            "size": size,
            "title_ru": item["title"][:60],
        }
    except Exception as error:
        print("download failed", item["id"], error)
        return None
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def main() -> int:
    MEDIA.mkdir(exist_ok=True)
    current = current_candidates()
    urls = {item["url"] for item in current}
    vecteezy = vecteezy_candidates(urls)
    coverr = coverr_page_candidates(urls)
    pool = current + vecteezy + coverr
    (ROOT / "media_pool.json").write_text(json.dumps(pool, ensure_ascii=False, indent=2), encoding="utf-8")
    print("pool", len(pool), Counter(item["stage"] for item in pool))

    # smallest-first keeps total under 920 MB while preserving stage quotas.
    pool.sort(key=lambda item: (item["size"], item["id"]))
    per_stage: dict[str, list[dict]] = {stage: [] for stage in ("shadow", "trickster_abyss", "calm", "path")}
    seen_ids = set()
    seen_urls = set()
    for item in pool:
        stage = item["stage"]
        if len(per_stage[stage]) >= PER_STAGE:
            continue
        if item["id"] in seen_ids or item["url"] in seen_urls:
            continue
        seen_ids.add(item["id"])
        seen_urls.add(item["url"])
        item["index"] = len(per_stage[stage]) + 1
        per_stage[stage].append(item)

    for stage in per_stage:
        print(stage, len(per_stage[stage]))

    selected = []
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        selected.extend(per_stage[stage])
    selected.sort(key=lambda item: (item["stage"], item["index"]))

    if any(len(per_stage[s]) < PER_STAGE for s in per_stage):
        print("insufficient candidates; media folder left untouched")
        return 2

    total = sum(item["size"] for item in selected)
    if total > MAX_TOTAL:
        print("candidate total too large", total)
        return 3

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(download_one, item) for item in selected]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            if result:
                results.append(result)
            if index % 10 == 0:
                print("downloaded", index, "of", len(selected))

    if len(results) < len(selected):
        print("download failures", len(selected) - len(results))
        return 4

    results.sort(key=lambda item: (item["stage"], item["url"]))
    totals = sum(item["size"] for item in results)
    if totals > MAX_TOTAL:
        print("downloaded total too large", totals)
        return 5

    # 25 finale frames are required in path.
    path = [item for item in results if item["stage"] == "path"]
    for item in path[:25]:
        item["is_finale"] = True

    VIDEOS.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DATA.write_text(
        "/* Generated by scripts/build_github_media.py; jsDelivr media CDN. */\n"
        "window.VIDEOS_DATA = " + json.dumps(results, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    print("FINAL", len(results), dict(Counter(item["stage"] for item in results)))
    print("BYTES", totals, "MB", round(totals / 1e6, 1))
    print("FINALE", sum(1 for item in results if item["is_finale"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
