#!/usr/bin/env python3
"""Rebuild the v43 catalog from the clean 130 objects in Timeweb S3."""

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
BAD = ("26717536", "13851559", "28276991", "soccer", "berries", "pinwheel", "temp", "2709106", "34767709", "gpt", "ai-generation")
JUNK = re.compile(r"temp|abstract|matrix|3d |technical|colorful|pinwheel|gpt|ai generation|visualization|studio banner|concert|kids|party|food|soccer|berries|ice cream|dough|lottery|cricket", re.I)
LIVING = re.compile(r"fire|flame|spark|ember|ocean|wave|sea|storm|smoke|underwater|rain|water|waterfall", re.I)
S3 = boto3.client(
    "s3", endpoint_url=ENDPOINT, region_name="ru-1",
    aws_access_key_id=os.environ["TIMEWEB_S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["TIMEWEB_S3_SECRET_KEY"],
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                  request_checksum_calculation="when_required",
                  response_checksum_validation="when_required"),
)
TRANSFER = TransferConfig(multipart_threshold=16 * 1024 * 1024, multipart_chunksize=8 * 1024 * 1024, max_concurrency=4)


def clean_id(value: str) -> str:
    return (re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower() or "clip")[-52:]


def s3_total() -> int:
    total, token = 0, None
    while True:
        args = {"ContinuationToken": token} if token else {}
        page = S3.list_objects_v2(Bucket=BUCKET, **args)
        total += sum(x["Size"] for x in page.get("Contents", []))
        if not page.get("IsTruncated"):
            return total
        token = page["NextContinuationToken"]


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


def title_for(name: str, stage: str) -> str:
    known = {
        "calm_31_vecteezy-17202055.mp4": "Mustard flower in soft light",
        "calm_32_vecteezy-11733811.mp4": "Clear turquoise mountain lake",
        "path_30_vecteezy-48665208.mp4": "Breathtaking aerial view of mountains",
        "path_31_vecteezy-24955868.mp4": "Snow scene in mountain peaks",
        "path_32_vecteezy-47104840.mp4": "Fog in the mountain at Gorontalo",
        "shadow_32_vecteezy-36195382.mp4": "Fisherman silhouette on his boat",
        "trickster_abyss_32_vecteezy-25413582.mp4": "Fire flame in darkness",
        "trickster_abyss_33_vecteezy-46285849.mp4": "Behind a massive waterfall",
        "trickster_abyss_34_vecteezy-26744510.mp4": "Klong Lan waterfall",
    }
    return known.get(name, f"Cinematic {stage.replace('_', ' ')} film")


def add_one_trick() -> bool:
    existing = {o["Key"] for o in S3.list_objects_v2(Bucket=BUCKET).get("Contents", [])}
    for term in ("fire", "ocean", "storm", "smoke", "waterfall"):
        for page in range(1, 8):
            try:
                candidates = source.parse_vecteezy_category(term, page)
            except Exception:
                continue
            for c in candidates:
                title = c["title"]
                key_id = f"vecteezy:{c['id']}"
                name = f"trickster_abyss_46_{clean_id(key_id)}.mp4"
                if name in existing or JUNK.search(title) or not LIVING.search(title):
                    continue
                path = MEDIA / name
                size = download(c["url"], path)
                if not size:
                    continue
                upload(path, name)
                print("added final trick", title, name, size, flush=True)
                return True
    return False


def main() -> int:
    objects = [o for o in S3.list_objects_v2(Bucket=BUCKET).get("Contents", []) if o["Key"].endswith(".mp4")]
    clean = [o for o in objects if not any(b in o["Key"].lower() for b in BAD)]
    if len(clean) < 130:
        if not add_one_trick():
            print("cannot add final trick")
            return 2
        objects = [o for o in S3.list_objects_v2(Bucket=BUCKET).get("Contents", []) if o["Key"].endswith(".mp4")]
        clean = [o for o in objects if not any(b in o["Key"].lower() for b in BAD)]
    print("clean objects", len(clean), "S3 MB", round(s3_total() / 1e6, 1), flush=True)
    old = json.loads(VIDEOS.read_text(encoding="utf-8"))
    old_by_name = {x["url"].split("/")[-1]: x for x in old}
    # Keep exactly the 130 clean, unique object keys.
    clean = clean[:130]
    counts = Counter(o["Key"].split("_")[0] for o in clean)
    if len(clean) != 130:
        print("not 130 clean", len(clean))
        return 3
    data = []
    path_index = 0
    for stage in ("shadow", "trickster_abyss", "calm", "path"):
        rows = [o for o in clean if o["Key"].startswith(stage + "_")]
        rows.sort(key=lambda o: o["Key"])
        for index, obj in enumerate(rows, 1):
            name = obj["Key"]
            prior = old_by_name.get(name)
            title = prior["title"] if prior else title_for(name, stage)
            data.append({
                "id": "s3:" + name[:-4],
                "title": title,
                "description": title[:220],
                "url": BASE + name,
                "stage": stage,
                "archetype": {"shadow": "Тень", "trickster_abyss": "Трикстер и Бездна", "calm": "Покой / Анима", "path": "Путь / Самость"}[stage],
                "is_finale": stage == "path" and index <= 25,
                "source": "s3",
                "vertical": True,
                "width": 1080,
                "height": 1920,
                "duration": float(prior.get("duration", 10)) if prior else 10.0,
                "size": obj["Size"],
                "title_ru": f"{ {'shadow':'Тень','trickster_abyss':'Трикстер','calm':'Покой','path':'Путь'}[stage] } {index:02d}",
            })
    counts = Counter(x["stage"] for x in data)
    print("FINAL", len(data), dict(counts), "S3", round(s3_total() / 1e6, 1), flush=True)
    if len(data) != 130 or set(counts.values()) - {32, 33}:
        print("stage mismatch", dict(counts))
        return 4
    VIDEOS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DATA.write_text("/* Generated for v43; Timeweb S3 cinematic catalog. */\nwindow.VIDEOS_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print("WROTE 130", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
