#!/usr/bin/env python3
"""Finish the cached media pool without re-crawling.

Selects 30 videos per Jungian stage from media_pool.json, downloads the
original MP4 files in two threads, and writes jsDelivr URLs into the app.
"""

from __future__ import annotations

import concurrent.futures
import json
import re
import shutil
from collections import Counter
from pathlib import Path

import build_github_media as media

ROOT = Path(__file__).resolve().parents[1]
POOL = ROOT / "media_pool.json"
VIDEOS = ROOT / "videos.json"
DATA = ROOT / "videos-data.js"
MEDIA = ROOT / "media_cdn"

SHADOW_WORDS = re.compile(r"night|dark|rain|fog|mist|shadow|silhouette|reflect|street|city|window|tower|subway|smoke|storm", re.I)
PATH_WORDS = re.compile(r"ocean|sea|beach|shore|horizon|sunrise|dawn|mountain|road|bird|cloud|sky|forest|field", re.I)


def score_for(item: dict, stage: str) -> int:
    text = f"{item.get('title', '')} {item.get('description', '')}"
    score = 0
    if stage == "shadow" and SHADOW_WORDS.search(text):
        score += 20
    if stage == "path" and PATH_WORDS.search(text):
        score += 20
    if stage == "trickster_abyss" and re.search(r"fire|flame|spark|smoke|ocean|wave|sea|storm|underwater|rain|water", text, re.I):
        score += 20
    if stage == "calm" and re.search(r"forest|lake|rain|cloud|sun|leaf|tree|flower|mist|river|meadow|snow|horse|sheep", text, re.I):
        score += 20
    return score


def main() -> int:
    pool = json.loads(POOL.read_text(encoding="utf-8"))
    selected = []
    used_ids = set()
    used_urls = set()

    def take(item: dict) -> None:
        selected.append(item)
        used_ids.add(item["id"])
        used_urls.add(item["url"])

    # Start with all current shadow/path/calm/trick candidates, then source
    # missing shadow/path frames from the most atmospherically relevant surplus.
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        rows = [x for x in pool if x["stage"] == stage]
        rows.sort(key=lambda x: (-score_for(x, stage), x["size"]))
        for item in rows[:30]:
            take(item)

    counts = Counter(item["stage"] for item in selected)
    print("initial", dict(counts))

    for target, donors in (("shadow", ("trickster_abyss", "calm")), ("path", ("calm", "trickster_abyss"))):
        while counts[target] < 30:
            rows = [x for x in pool if x["stage"] in donors and x["id"] not in used_ids and x["url"] not in used_urls]
            rows.sort(key=lambda x: (-score_for(x, target), x["size"]))
            donor = rows[0] if rows else None
            if not donor:
                break
            donor = dict(donor)
            donor["stage"] = target
            donor["is_finale"] = False
            take(donor)
            counts[target] += 1
            print("reclassified", target, donor["title"][:60])

    counts = Counter(item["stage"] for item in selected)
    print("selected", len(selected), dict(counts), "MB", round(sum(x["size"] for x in selected) / 1e6, 1))
    if any(counts[s] < 30 for s in ("shadow", "trickster_abyss", "calm", "path")):
        print("insufficient stage pool")
        return 2
    if len(selected) != 120:
        print("selection count", len(selected))
        return 3

    # Path gets 25 finale frames; add indices.
    path = [x for x in selected if x["stage"] == "path"]
    for item in path[:25]:
        item["is_finale"] = True
    for item in selected:
        if item["stage"] != "path":
            item["is_finale"] = False
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        index = 1
        for item in selected:
            if item["stage"] == stage:
                item["index"] = index
                index += 1

    MEDIA.mkdir(exist_ok=True)
    for stale in MEDIA.glob("*.mp4"):
        stale.unlink()
    for stale in MEDIA.glob("*.part"):
        stale.unlink()

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(media.download_one, item) for item in selected]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            if result:
                results.append(result)
            if index % 10 == 0:
                print("downloaded", index, "/", len(selected))
    if len(results) != 120:
        print("download failures", 120 - len(results))
        return 4

    for item in results:
        item["archetype"] = {
            "shadow": "Тень",
            "trickster_abyss": "Трикстер и Бездна",
            "calm": "Покой / Анима",
            "path": "Путь / Самость",
        }[item["stage"]]
        item["title_ru"] = f"{ {'shadow':'Тень','trickster_abyss':'Трикстер','calm':'Покой','path':'Путь'}[item['stage']] } {int(item.get('index', 1)):02d}"

    # Stable stage order.
    results.sort(key=lambda x: (("shadow", "trickster_abyss", "calm", "path").index(x["stage"]), x.get("index", 0)))
    VIDEOS.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DATA.write_text(
        "/* Generated by scripts/build_github_media.py; jsDelivr media CDN. */\n"
        "window.VIDEOS_DATA = " + json.dumps(results, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    total = sum(x["size"] for x in results)
    print("FINAL", len(results), dict(Counter(x["stage"] for x in results)))
    print("MB", round(total / 1e6, 1), "FINALE", sum(1 for x in results if x["is_finale"]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
