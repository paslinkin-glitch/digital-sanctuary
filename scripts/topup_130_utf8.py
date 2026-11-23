#!/usr/bin/env python3
"""v52: top the S3 catalog to 130 unique videos and repair UTF-8 labels."""

from __future__ import annotations

import json
import os
import re
import subprocess
from collections import Counter
from pathlib import Path

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config

import build_vertical_catalog as source

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media_cdn"
VIDEOS = ROOT / "videos.json"
DATA = ROOT / "videos-data.js"
ENDPOINT = "https://s3.twcstorage.ru"
BUCKET = "digital-sanctuary"
BASE = f"{ENDPOINT}/{BUCKET}/"
TARGET = 130
BAD = ("26717536", "13851559", "28276991", "soccer", "berries", "pinwheel", "temp", "2709106", "34767709", "gpt", "ai-generation", "concert", "dough", "lottery", "cricket")
FIX = {
    "РўРµРЅСЊ": "Тень",
    "РўСЂРёРєСЃС‚РµСЂ Рё Р‘РµР·РґРЅР°": "Трикстер и Бездна",
    "РџРѕРєРѕР№ / РђРЅРёРјР°": "Покой / Анима",
    "РџСѓС‚СЊ / РЎР°РјРѕСЃС‚СЊ": "Путь / Самость",
}
S3 = boto3.client(
    "s3", endpoint_url=ENDPOINT, region_name="ru-1",
    aws_access_key_id=os.environ["TIMEWEB_S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["TIMEWEB_S3_SECRET_KEY"],
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                  request_checksum_calculation="when_required",
                  response_checksum_validation="when_required"),
)
TRANSFER = TransferConfig(multipart_threshold=16 * 1024 * 1024, multipart_chunksize=8 * 1024 * 1024)


def clean_id(value: str) -> str:
    return (re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower() or "clip")[-52:]


def file_hash(name: str) -> str:
    stem = name[:-4] if name.endswith(".mp4") else name
    suffix = stem.split("_", 2)[-1]
    return re.sub(r"^\d+_", "", suffix)


def s3_total() -> int:
    total, token = 0, None
    while True:
        args = {"ContinuationToken": token} if token else {}
        page = S3.list_objects_v2(Bucket=BUCKET, **args)
        total += sum(x["Size"] for x in page.get("Contents", []))
        if not page.get("IsTruncated"):
            return total
        token = page.get("NextContinuationToken")


def download(url: str, path: Path) -> int | None:
    part = path.with_suffix(".part")
    try:
        result = subprocess.run(["curl", "-L", "-sS", "--max-time", "90", "-A", "Mozilla/5.0", "-o", str(part), url], capture_output=True)
        if result.returncode != 0 or not part.exists():
            return None
        size = part.stat().st_size
        if not (3_500_000 <= size <= 9_000_000):
            part.unlink(missing_ok=True)
            return None
        part.replace(path)
        return size
    except Exception:
        part.unlink(missing_ok=True)
        return None


def upload(path: Path, name: str) -> None:
    S3.upload_file(str(path), BUCKET, name, ExtraArgs={
        "ACL": "public-read", "ContentType": "video/mp4",
        "CacheControl": "public, max-age=31536000, immutable",
        "ContentEncoding": "identity",
    }, Config=TRANSFER)


def record(item_id: str, title: str, stage: str, size: int, index: int, name: str) -> dict:
    return {
        "id": item_id, "fileHash": file_hash(name), "title": title,
        "description": title[:220], "url": BASE + name, "stage": stage,
        "archetype": {"shadow": "Тень", "trickster_abyss": "Трикстер и Бездна", "calm": "Покой / Анима", "path": "Путь / Самость"}[stage],
        "is_finale": False, "source": "s3", "vertical": True,
        "width": 1080, "height": 1920, "duration": 10.0, "size": size,
        "title_ru": f"{ {'shadow':'Тень','trickster_abyss':'Трикстер','calm':'Покой','path':'Путь'}[stage] } {index:02d}",
    }


def main() -> int:
    data = json.loads(VIDEOS.read_text(encoding="utf-8"))
    for item in data:
        for key, value in FIX.items():
            if item.get("archetype") == key:
                item["archetype"] = value
            item["title"] = item.get("title", "").replace(key, value)
        item["description"] = item.get("description", "").replace("РўРµРЅСЊ", "Тень")
        item["id"] = item.get("fileHash") or item["id"]
    # Unique by file hash and URL.
    unique, hashes, urls = [], set(), set()
    for item in data:
        h = item.get("fileHash") or file_hash(item["url"].split("/")[-1])
        if h in hashes or item["url"] in urls:
            continue
        hashes.add(h)
        urls.add(item["url"])
        item["fileHash"] = h
        item["id"] = h
        unique.append(item)
    data = unique
    print("base", len(data), dict(Counter(x["stage"] for x in data)), flush=True)

    # Reuse clean unique objects already in S3.
    objects = S3.list_objects_v2(Bucket=BUCKET).get("Contents", [])
    for obj in objects:
        if len(data) >= TARGET:
            break
        name = obj["Key"]
        if not name.endswith(".mp4") or obj["Size"] < 3_500_000 or obj["Size"] > 9_000_000:
            continue
        if any(b in name.lower() for b in BAD):
            continue
        h = file_hash(name)
        if h in hashes or BASE + name in urls:
            continue
        stage = next((s for s in ("shadow", "trickster_abyss", "calm", "path") if name.startswith(s + "_")), "")
        if not stage:
            continue
        index = max([int(m.group(1)) for x in data if x["stage"] == stage for m in [re.search(rf"^{stage}_(\d+)_", x["url"].split('/')[-1])] if m] or [0]) + 1
        data.append(record(h, f"Cinematic {stage.replace('_', ' ')} film", stage, obj["Size"], index, name))
        hashes.add(h)
        urls.add(BASE + name)
    print("after reuse", len(data), flush=True)

    # Download/upload remaining clean atmospheric originals.
    terms = ["rain", "fog", "clouds", "evening", "night", "storm", "lake", "water"]
    for term in terms:
        if len(data) >= TARGET:
            break
        for page in range(1, 10):
            if len(data) >= TARGET:
                break
            try:
                candidates = source.parse_vecteezy_category(term, page)
            except Exception:
                continue
            for candidate in candidates:
                if len(data) >= TARGET:
                    break
                title = candidate["title"]
                if any(b in title.lower() for b in BAD):
                    continue
                item_id = f"vecteezy:{candidate['id']}"
                h = file_hash(f"x_x_{candidate['id']}.mp4")
                if h in hashes or item_id in hashes:
                    continue
                if s3_total() + 9_000_000 > 940 * 1024 * 1024:
                    break
                stage = source.classify_stage(title)
                if stage not in ("shadow", "trickster_abyss", "calm", "path"):
                    continue
                index = max([int(m.group(1)) for x in data if x["stage"] == stage for m in [re.search(rf"^{stage}_(\d+)_", x["url"].split('/')[-1])] if m] or [0]) + 1
                name = f"{stage}_{index:02d}_{clean_id(item_id)}.mp4"
                path = MEDIA / name
                size = download(candidate["url"], path)
                if not size:
                    continue
                try:
                    upload(path, name)
                except Exception as error:
                    print("upload failed", name, error, flush=True)
                    continue
                r = record(item_id, title, stage, size, index, name)
                r["fileHash"] = h
                data.append(r)
                hashes.add(h)
                urls.add(BASE + name)
                print("+", len(data), stage, title[:45], flush=True)
    counts = Counter(x["stage"] for x in data)
    print("FINAL", len(data), dict(counts), "S3", round(s3_total() / 1e6, 1), flush=True)
    if len(data) != TARGET or len({x["fileHash"] for x in data}) != TARGET or s3_total() > 940 * 1024 * 1024:
        print("not written")
        return 2
    VIDEOS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DATA.write_text("/* v52 UTF-8 unique catalog. */\nwindow.VIDEOS_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print("WROTE 130", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
