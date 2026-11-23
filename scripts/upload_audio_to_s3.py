#!/usr/bin/env python3
"""Download MUSIC_CATALOG MP3s and publish them under audio/ in Timeweb S3."""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
AUDIO = ROOT / "audio_cache"
AUDIO.mkdir(exist_ok=True)
ENDPOINT = "https://s3.twcstorage.ru"
BUCKET = "digital-sanctuary"
PUBLIC = f"{ENDPOINT}/{BUCKET}/audio/"

S3 = boto3.client(
    "s3", endpoint_url=ENDPOINT, region_name="ru-1",
    aws_access_key_id=os.environ["TIMEWEB_S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["TIMEWEB_S3_SECRET_KEY"],
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                  request_checksum_calculation="when_required",
                  response_checksum_validation="when_required"),
)


def slug(title: str, file_id: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "track"
    return f"{base}-{file_id}.mp3"


def main() -> int:
    text = APP.read_text(encoding="utf-8")
    block = text[text.index("const MUSIC_CATALOG ="):text.index("/* ------------------------------------------------------------------ DOM */")]
    tracks = {}
    for match in re.finditer(r"\{ id: '([^']+)', title: '([^']+)', url: '([^']+)' \}", block):
        file_id, title, url = match.groups()
        tracks.setdefault(file_id, (title, url))
    print("unique tracks", len(tracks), flush=True)
    mapping = {}
    for file_id, (title, url) in tracks.items():
        name = slug(title, file_id)
        path = AUDIO / name
        if not path.exists() or path.stat().st_size < 100_000:
            result = subprocess.run(["curl", "-L", "-sS", "--max-time", "90", "-A", "Mozilla/5.0", "-o", str(path), url], capture_output=True)
            if result.returncode != 0 or not path.exists():
                print("download failed", file_id, url, flush=True)
                return 2
        if path.stat().st_size < 100_000:
            print("audio too small", name, path.stat().st_size, flush=True)
            return 3
        S3.upload_file(str(path), BUCKET, "audio/" + name, ExtraArgs={
            "ACL": "public-read", "ContentType": "audio/mpeg",
            "CacheControl": "public, max-age=31536000, immutable",
        }, Config=TransferConfig(multipart_threshold=16 * 1024 * 1024, multipart_chunksize=8 * 1024 * 1024))
        mapping[file_id] = PUBLIC + name
        print("uploaded", name, path.stat().st_size, flush=True)

    updated = block
    for file_id, url in mapping.items():
        updated = re.sub(
            r"(\{ id: '" + re.escape(file_id) + r"', title: '[^']+', url: ')[^']+(' \})",
            lambda m: m.group(1) + url + m.group(2),
            updated,
        )
    APP.write_text(text.replace(block, updated), encoding="utf-8")
    print("MUSIC_CATALOG updated", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
