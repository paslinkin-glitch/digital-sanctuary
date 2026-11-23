#!/usr/bin/env python3
"""Generate 11 deep ambient MP3s, upload them, and write a unique MUSIC_CATALOG."""

from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path

import boto3
import lameenc
import numpy as np
from boto3.s3.transfer import TransferConfig
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
CACHE = ROOT / "audio_cache"
CACHE.mkdir(exist_ok=True)
ENDPOINT = "https://s3.twcstorage.ru"
BUCKET = "digital-sanctuary"
BASE = f"{ENDPOINT}/{BUCKET}/audio/"
SAMPLE = 44100
S3 = boto3.client(
    "s3", endpoint_url=ENDPOINT, region_name="ru-1",
    aws_access_key_id=os.environ["TIMEWEB_S3_ACCESS_KEY"],
    aws_secret_access_key=os.environ["TIMEWEB_S3_SECRET_KEY"],
    config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                  request_checksum_calculation="when_required",
                  response_checksum_validation="when_required"),
)

NEW = [
    ("ash-garden", "Ash Garden", [55, 82.41, 110], "shadow"),
    ("still-water", "Still Water", [65.41, 98, 130.81], "calm"),
    ("distant-rain", "Distant Rain", [73.42, 110, 146.83], "calm"),
    ("deep-green", "Deep Green", [49, 73.42, 98], "calm"),
    ("night-current", "Night Current", [43.65, 65.41, 87.31], "abyss"),
    ("long-exposure", "Long Exposure", [36.71, 55, 73.42], "abyss"),
    ("ember-breath", "Ember Breath", [58.27, 87.31, 116.54], "trickster"),
    ("pale-horizon", "Pale Horizon", [82.41, 123.47, 164.81], "path"),
    ("low-tide", "Low Tide", [61.74, 92.5, 123.47], "path"),
    ("quiet-ember", "Quiet Ember", [69.3, 103.83, 138.59], "path"),
    ("open-sky", "Open Sky", [87.31, 130.81, 174.61], "path"),
]


def synth(freqs: list[float], seconds: int = 32) -> bytes:
    n = SAMPLE * seconds
    t = np.arange(n, dtype=np.float64) / SAMPLE
    signal = np.zeros(n, dtype=np.float64)
    for i, freq in enumerate(freqs):
        lfo = 0.55 + 0.45 * np.sin(2 * math.pi * (0.013 + i * 0.004) * t + i)
        signal += (0.11 / (i + 1)) * np.sin(2 * math.pi * freq * t + i * 0.7) * lfo
        signal += (0.035 / (i + 1)) * np.sin(2 * math.pi * freq * 2.003 * t + i)
    # Soft filtered noise bed: wind and room tone, no percussion.
    rng = np.random.default_rng(abs(hash(tuple(freqs))) % (2**32))
    noise = rng.normal(0, 1, n)
    for _ in range(2):
        noise = np.convolve(noise, np.ones(128) / 128, mode="same")
    signal += noise * 0.05
    fade = int(SAMPLE * 4)
    signal[:fade] *= np.linspace(0, 1, fade)
    signal[-fade:] *= np.linspace(1, 0, fade)
    signal = np.clip(signal / max(0.001, np.max(np.abs(signal))) * 0.72, -1, 1)
    pcm = (signal * 32767).astype(np.int16)
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(128)
    encoder.set_in_sample_rate(SAMPLE)
    encoder.set_channels(1)
    encoder.set_quality(2)
    return encoder.encode(pcm.tobytes()) + encoder.flush()


def main() -> int:
    existing = {}
    text = APP.read_text(encoding="utf-8")
    block = text[text.index("const MUSIC_CATALOG ="):text.index("/* ------------------------------------------------------------------ DOM */")]
    for match in re.finditer(r"\{ id: '([^']+)', title: '([^']+)', url: '([^']+)' \}", block):
        file_id, title, url = match.groups()
        existing[file_id] = (title, url)
    urls = {}
    for slug, title, freqs, stage in NEW:
        name = f"{slug}.mp3"
        path = CACHE / name
        if not path.exists() or path.stat().st_size < 100_000:
            path.write_bytes(synth(freqs))
        S3.upload_file(str(path), BUCKET, "audio/" + name, ExtraArgs={
            "ACL": "public-read", "ContentType": "audio/mpeg",
            "CacheControl": "public, max-age=31536000, immutable",
        }, Config=TransferConfig(multipart_threshold=16 * 1024 * 1024, multipart_chunksize=8 * 1024 * 1024))
        urls[slug] = BASE + name
        print("uploaded", name, path.stat().st_size, flush=True)

    def old(file_id: str) -> str:
        return existing.get(file_id, (file_id, BASE + file_id + ".mp3"))[1]

    catalog = {
        "Shadow": [
            ("HDgXJpCNph", "Whisper Canyon", old("HDgXJpCNph")),
            ("DoetucQLKg", "Monolith", old("DoetucQLKg")),
            ("2v8dZRPll8", "inner world", old("2v8dZRPll8")),
            ("mvh5rImd1R", "clouds", old("mvh5rImd1R")),
            ("ash-garden", "Ash Garden", urls["ash-garden"]),
        ],
        "Calm": [
            ("HTzsyicaIT", "crystal rain", old("HTzsyicaIT")),
            ("WUzwP3T0HC", "tokio rain", old("WUzwP3T0HC")),
            ("still-water", "Still Water", urls["still-water"]),
            ("distant-rain", "Distant Rain", urls["distant-rain"]),
            ("deep-green", "Deep Green", urls["deep-green"]),
        ],
        "Abyss": [
            ("5nxzquf11g", "The Color of Space", old("5nxzquf11g")),
            ("AeWsKx2z16", "A Look At The Sky", old("AeWsKx2z16")),
            ("sGPevMbGzP", "Deep Meditation", old("sGPevMbGzP")),
            ("night-current", "Night Current", urls["night-current"]),
            ("long-exposure", "Long Exposure", urls["long-exposure"]),
        ],
        "Trickster": [
            ("EX6e6IkDGx", "A Piano For Travel", old("EX6e6IkDGx")),
            ("aUHfXkgixI", "Cinematic Visions", old("aUHfXkgixI")),
            ("yutSfOSE7l", "Lotus Flower", old("yutSfOSE7l")),
            ("p2sexNoWO6", "horizons", old("p2sexNoWO6")),
            ("ember-breath", "Ember Breath", urls["ember-breath"]),
        ],
        "Path": [
            ("Ou9ZrAwafj", "Through The Looking Glass", old("Ou9ZrAwafj")),
            ("pale-horizon", "Pale Horizon", urls["pale-horizon"]),
            ("low-tide", "Low Tide", urls["low-tide"]),
            ("quiet-ember", "Quiet Ember", urls["quiet-ember"]),
            ("open-sky", "Open Sky", urls["open-sky"]),
        ],
    }
    lines = ["  const MUSIC_CATALOG = {"]
    for stage_name, tracks in catalog.items():
        lines.append(f"    {stage_name}: [")
        for file_id, title, url in tracks:
            lines.append(f"      {{ id: '{file_id}', title: '{title}', url: '{url}' }},")
        lines.append("    ],")
    lines.append("  };\n")
    replacement = "\n".join(lines)
    APP.write_text(text.replace(block, replacement), encoding="utf-8")
    print("catalog unique tracks", sum(len(v) for v in catalog.values()), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
