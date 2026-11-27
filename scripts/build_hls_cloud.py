#!/usr/bin/env python3
"""Build 30 new dream scenes into adaptive HLS and publish catalog."""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "hls-work"
OUT = WORK / "clips"
S3_BUCKET = os.environ.get("S3_BUCKET", "digital-sanctuary")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "https://s3.twcstorage.ru").rstrip("/")
S3_PREFIX = S3_ENDPOINT + "/" + S3_BUCKET

# Curated from the Coverr sitemap: only unused dreamlike nature/water/sky/fog
# sources, no people, crowds, streets, vehicles, buildings, logos or animals
# in close-up. The workflow still downloads every original itself.
SCENES = [
    ("dream-shadow-01", "Misty Mountains in Sao Vicente", "https://cdn.coverr.co/videos/coverr-misty-mountains-in-sao-vicente-portugal-3617/1080p.mp4", "shadow", "fog-01", False, False),
    ("dream-shadow-02", "Mountains Covered with Fog", "https://cdn.coverr.co/videos/coverr-mountains-covered-with-fog-in-fanal-madeira-island-6170/1080p.mp4", "shadow", "fog-02", False, False),
    ("dream-shadow-03", "Glade in Fanal", "https://cdn.coverr.co/videos/coverr-glade-in-fanal-madeira-island-8331/1080p.mp4", "shadow", "fog-03", False, False),
    ("dream-shadow-04", "The Misty Mountains", "https://cdn.coverr.co/videos/coverr-the-misty-mountains-7980/1080p.mp4", "shadow", "fog-04", False, False),
    ("dream-shadow-05", "Fast-Flowing River", "https://cdn.coverr.co/videos/coverr-fast-flowing-river-7623/1080p.mp4", "shadow", "fog-05", False, False),
    ("dream-shadow-06", "Forest in Geres", "https://cdn.coverr.co/videos/coverr-forest-in-ger-s-national-park-8003/1080p.mp4", "shadow", "rain-01", False, False),
    ("dream-shadow-07", "A Lake Near a Forest", "https://cdn.coverr.co/videos/coverr-a-lake-near-a-forest-6426/1080p.mp4", "shadow", "rain-02", False, False),
    ("dream-shadow-08", "Cloudy Day in Fanal", "https://cdn.coverr.co/videos/coverr-cloudy-day-in-fanal-madeira-island-3143/1080p.mp4", "shadow", "rain-03", False, False),
    ("dream-shadow-09", "A Beautiful Green Field", "https://cdn.coverr.co/videos/coverr-a-beautiful-green-field-6427/1080p.mp4", "shadow", "rain-04", False, False),
    ("dream-shadow-10", "Mountain Tops", "https://cdn.coverr.co/videos/coverr-mountain-tops-9327/1080p.mp4", "shadow", "water-01", False, False),
    ("dream-trickster-01", "Blurry Sunset", "https://cdn.coverr.co/videos/coverr-blurry-sunset-2693/1080p.mp4", "trickster_abyss", "fire-01", True, False),
    ("dream-trickster-02", "Rock Formation in the Sea", "https://cdn.coverr.co/videos/coverr-premium-rock-formation-in-the-sea-1789/1080p.mp4", "trickster_abyss", "fire-02", True, False),
    ("dream-trickster-03", "Clear Ocean Water", "https://cdn.coverr.co/videos/coverr-clear-ocean-water-5446/1080p.mp4", "trickster_abyss", "fire-03", False, False),
    ("dream-trickster-04", "Water Splashing Against Rocks", "https://cdn.coverr.co/videos/coverr-premium-water-splashing-against-rocks-7043/1080p.mp4", "trickster_abyss", "water-02", False, False),
    ("dream-trickster-05", "Calm Waves in a Gulf", "https://cdn.coverr.co/videos/coverr-calm-waves-in-an-ocean-gulf-4513/1080p.mp4", "trickster_abyss", "water-03", False, False),
    ("dream-trickster-06", "A Tide of Foamy Waves", "https://cdn.coverr.co/videos/coverr-a-tide-of-foamy-waves-4378/1080p.mp4", "trickster_abyss", "water-04", False, False),
    ("dream-trickster-07", "Bioluminescent Waves", "https://cdn.coverr.co/videos/coverr-bioluminescent-plankton-illuminate-the-waves-on-a-tropical-beach/1080p.mp4", "trickster_abyss", "space-01", True, False),
    ("dream-trickster-08", "Sunset over the Atlantic", "https://cdn.coverr.co/videos/coverr-sunset-over-the-atlantic-ocean-1409/1080p.mp4", "trickster_abyss", "city-01", True, False),
    ("dream-calm-01", "Sunset in Costa Rica", "https://cdn.coverr.co/videos/coverr-sunset-in-costa-rica-5323/1080p.mp4", "calm", "city-02", False, False),
    ("dream-calm-02", "Beach Landscape", "https://cdn.coverr.co/videos/coverr-beach-landscape-3248/1080p.mp4", "calm", "city-03", False, False),
    ("dream-calm-03", "A View of the Lake", "https://cdn.coverr.co/videos/coverr-a-view-of-the-lake-2273/1080p.mp4", "calm", "city-04", False, False),
    ("dream-calm-04", "Lake Landscape in Salta", "https://cdn.coverr.co/videos/coverr-lake-landscape-in-salta-argentina-9045/1080p.mp4", "calm", "people-01", False, False),
    ("dream-calm-05", "Lago di Braies Reflection", "https://cdn.coverr.co/videos/coverr-lago-di-braies-reflection-1734/1080p.mp4", "calm", "people-02", False, False),
    ("dream-calm-06", "Sunset by the Ocean", "https://cdn.coverr.co/videos/coverr-sunset-by-the-ocean-809/1080p.mp4", "calm", "space-02", False, False),
    ("dream-path-01", "The Endless Horizon", "https://cdn.coverr.co/videos/coverr-a-spectacular-view-of-the-endless-horizon-4469/1080p.mp4", "path", "road-01", False, True),
    ("dream-path-02", "Mountains in Senja", "https://cdn.coverr.co/videos/coverr-mountains-in-senja-9544/1080p.mp4", "path", "road-02", False, True),
    ("dream-path-03", "Sunset over the Sea", "https://cdn.coverr.co/videos/coverr-sunset-over-the-sea-7345/1080p.mp4", "path", "road-03", False, True),
    ("dream-path-04", "Island in the Sea", "https://cdn.coverr.co/videos/coverr-island-in-the-sea-5236/1080p.mp4", "path", "road-04", False, True),
    ("dream-path-05", "A Pier in the Ocean", "https://cdn.coverr.co/videos/coverr-a-pier-in-the-ocean-5436/1080p.mp4", "path", "space-03", False, False),
    ("dream-path-06", "Meadow at Sunset", "https://cdn.coverr.co/videos/coverr-meadow-at-sunset-2723/1080p.mp4", "path", "people-03", False, False),
]
SUBJECTS = [
    ("mountain", "гора"), ("fog", "туман"), ("glade", "поляна"), ("ridge", "хребет"),
    ("river", "река"), ("forest", "лес"), ("lake", "озеро"), ("clouds", "облака"),
    ("field", "поле"), ("peak", "вершина"), ("sunset", "закат"), ("rock", "скала"),
    ("water", "вода"), ("shore", "берег"), ("waves", "волны"), ("tide", "прилив"),
    ("blue light", "синий свет"), ("evening", "вечер"), ("sun", "солнце"), ("beach", "пляж"),
    ("still lake", "тихое озеро"), ("far lake", "дальнее озеро"), ("cold lake", "холодное озеро"),
    ("sea", "море"), ("horizon", "горизонт"), ("northern ridge", "северный хребет"),
    ("open sea", "открытое море"), ("island", "остров"), ("pier", "причал"), ("meadow", "луг"),
]
OPEN_EN = ["In the quiet, the {S} — a quiet dream", "In the quiet, the {S} — a soft dream",
           "In the quiet, the {S} — a sleeping dream", "In the quiet, the {S} — a gentle dream",
           "In the quiet, the {S} — a still dream", "In the quiet, the {S} — a deep dream"]
OPEN_RU = ["В тишине {S} — тихий сон", "В тишине {S} — мягкий сон", "В тишине {S} — спящий сон",
           "В тишине {S} — нежный сон", "В тишине {S} — неподвижный сон", "В тишине {S} — глубокий сон"]
CLOSE_EN = ["and you can breathe a little slower.", "and nothing needs an answer.",
            "and you can stay here a while.", "and your shoulders come down.",
            "and the dream grows quiet.", "and you can let the day go."]
CLOSE_RU = ["и ты можешь дышать чуть медленнее.", "и ничего не нужно отвечать.",
            "и ты можешь побыть здесь.", "и плечи опускаются.",
            "и сон становится тише.", "и ты можешь отпустить день."]
CAPTIONS = []
for i, (en_subject, ru_subject) in enumerate(SUBJECTS):
    for k in range(6):
        en = OPEN_EN[(i + k) % 6].format(S=en_subject) + ", " + CLOSE_EN[(i + k) % 6]
        ru = OPEN_RU[(i + k) % 6].format(S=ru_subject) + ", " + CLOSE_RU[(i + k) % 6]
        if 55 <= len(en) <= 95 and 55 <= len(ru) <= 95:
            CAPTIONS.append((en, ru))
            break
    else:
        raise RuntimeError(f"caption too short for {i}")
if len(CAPTIONS) != 30 or len(set(CAPTIONS)) != 30:
    raise RuntimeError("captions are not unique")

TRACK_CATEGORY = {
    "fog": "fog", "rain": "rain", "water": "water", "fire": "fire",
    "space": "space", "city": "city", "people": "people", "road": "road",
}
STAGE_ARCH = {"shadow": "Shadow", "trickster_abyss": "Trickster", "calm": "Calm", "path": "Path"}


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def ffprobe(path):
    r = subprocess.run([
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate:format=duration",
        "-of", "json", str(path),
    ], capture_output=True, text=True, check=True)
    data = json.loads(r.stdout)
    stream = data["streams"][0]
    fr = stream.get("r_frame_rate", "30/1").split("/")
    return int(stream["width"]), int(stream["height"]), float(data["format"]["duration"]), float(fr[0]) / float(fr[1] or 1)


def download(url, path):
    run(["curl", "-L", "-sS", "-A", "Mozilla/5.0", "-e", "https://coverr.co/", "--max-time", "180", "-o", str(path), url])


def encode_hls(source, clip_dir, variant, height, bitrate):
    playlist = clip_dir / variant / "index.m3u8"
    seg_dir = clip_dir / variant
    seg_dir.mkdir(parents=True, exist_ok=True)
    width = 1080 if height == 1920 else 720
    out_h = 1920 if height == 1920 else 1280
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(source), "-t", "12",
        "-vf", f"scale={width}:{out_h}:force_original_aspect_ratio=increase,crop={width}:{out_h},fps=30",
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-bf", "0",
        "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
        "-b:v", f"{bitrate}k", "-maxrate", f"{bitrate}k", "-bufsize", f"{bitrate * 2}k",
        "-pix_fmt", "yuv420p", "-hls_time", "2", "-hls_playlist_type", "vod",
        "-hls_flags", "independent_segments", "-hls_segment_type", "mpegts",
        "-hls_segment_filename", str(seg_dir / "seg_%03d.ts"), str(playlist),
    ])


def build_poster(source, out):
    for quality in (45, 40, 35, 30, 25, 20, 15, 12, 10, 8, 6, 5, 4, 3, 2):
        run([
            "ffmpeg", "-y", "-v", "error", "-ss", "0.8", "-i", str(source), "-frames:v", "1",
            "-vf", "scale=540:960:flags=lanczos", "-c:v", "libwebp", "-quality", str(quality), str(out),
        ])
        if 15000 <= out.stat().st_size <= 25000:
            return
    raise RuntimeError(f"poster size out of range: {out}")


def s3_client():
    return boto3.client(
        "s3", endpoint_url=S3_ENDPOINT, region_name=os.environ.get("AWS_DEFAULT_REGION", "ru-1"),
        aws_access_key_id=os.environ["S3_ACCESS_KEY"], aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, retries={"max_attempts": 8, "mode": "standard"}),
    )


def clean_old_videos(s3):
    token = None
    keys = []
    while True:
        kw = {"Bucket": S3_BUCKET}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        for obj in page.get("Contents", []):
            if not obj["Key"].startswith("audio/"):
                keys.append({"Key": obj["Key"]})
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]
    for i in range(0, len(keys), 500):
        s3.delete_objects(Bucket=S3_BUCKET, Delete={"Objects": keys[i:i + 500], "Quiet": True})
    print(f"deleted old non-audio objects: {len(keys)}", flush=True)


def upload_dir(s3, directory, prefix):
    for path in sorted(directory.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(directory).as_posix()
        key = f"{prefix}/{rel}"
        if path.suffix == ".m3u8":
            ctype = "application/vnd.apple.mpegurl"
        elif path.suffix == ".ts":
            ctype = "video/mp2t"
        elif path.suffix == ".webp":
            ctype = "image/webp"
        else:
            ctype = "application/octet-stream"
        s3.upload_file(str(path), S3_BUCKET, key, ExtraArgs={
            "ACL": "public-read", "ContentType": ctype,
            "CacheControl": "public, max-age=31536000, immutable", "ContentEncoding": "identity",
        })


def main():
    if WORK.exists():
        shutil.rmtree(WORK)
    OUT.mkdir(parents=True)
    old = json.loads((ROOT / "videos.json").read_text(encoding="utf-8"))
    old_urls = {x.get("url", "") for x in old}
    old_titles = {str(x.get("title", "")).strip().lower() for x in old}
    s3 = s3_client()
    built = []
    total_bytes = 0
    for idx, (clip_id, title, url, stage, track_id, surreal, finale) in enumerate(SCENES):
        if url in old_urls or title.strip().lower() in old_titles:
            raise RuntimeError(f"source is not new: {title}")
        src = OUT / f"{clip_id}.source.mp4"
        download(url, src)
        w, h, source_duration, fps = ffprobe(src)
        if source_duration < 10:
            raise RuntimeError(f"source shorter than 10s: {clip_id} {source_duration}")
        clip_dir = OUT / clip_id
        clip_dir.mkdir()
        encode_hls(src, clip_dir, "1080", 1920, 5000)
        encode_hls(src, clip_dir, "720", 1280, 2500)
        master = clip_dir / "master.m3u8"
        master.write_text(
            "#EXTM3U\n"
            "#EXT-X-VERSION:3\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=5200000,RESOLUTION=1080x1920,CODECS=\"avc1.4d401f\"\n"
            "1080/index.m3u8\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=2700000,RESOLUTION=720x1280,CODECS=\"avc1.4d401f\"\n"
            "720/index.m3u8\n",
            encoding="utf-8",
        )
        poster = clip_dir / "poster.webp"
        build_poster(src, poster)
        size = sum(p.stat().st_size for p in clip_dir.rglob("*") if p.is_file())
        total_bytes += size
        duration = min(12.0, source_duration)
        caption_en, caption_ru = CAPTIONS[idx]
        track_cat = TRACK_CATEGORY[track_id.split("-")[0]]
        built.append({
            "id": clip_id,
            "title": title,
            "description": title,
            "title_ru": f"Сон {idx + 1:02d}",
            "url": f"{S3_PREFIX}/hls/{clip_id}/master.m3u8",
            "urlHls": f"{S3_PREFIX}/hls/{clip_id}/master.m3u8",
            "urlPoster": f"{S3_PREFIX}/hls/{clip_id}/poster.webp",
            "stage": stage,
            "archetype": STAGE_ARCH[stage],
            "is_finale": bool(finale),
            "is_surreal": bool(surreal),
            "source": "coverr",
            "vertical": True,
            "width": 1080,
            "height": 1920,
            "duration": round(duration, 3),
            "size": size,
            "tier": "hls",
            "hls": True,
            "posterSize": poster.stat().st_size,
            "caption_en": caption_en,
            "caption_ru": caption_ru,
            "soundCategory": track_cat,
            "trackId": track_id,
            "fileHash": clip_id,
        })
        print(f"built {clip_id} {source_duration:.1f}s -> {size} bytes, poster {poster.stat().st_size}", flush=True)
    # All 30 prepared locally. Only now replace the old S3 video set.
    clean_old_videos(s3)
    for item in built:
        upload_dir(s3, OUT / item["id"], f"hls/{item['id']}")
    (ROOT / "videos.json").write_text(json.dumps(built, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "videos-data.js").write_text(
        "window.VIDEOS_DATA=" + json.dumps(built, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    counted = 0
    token = None
    while True:
        kw = {"Bucket": S3_BUCKET}
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        counted += sum(int(o["Size"]) for o in page.get("Contents", []))
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]
    print(f"built {len(built)} clips, HLS bytes {total_bytes}, bucket bytes {counted} ({counted / 1e9:.3f} GB)", flush=True)
    if counted > 1_500_000_000:
        raise RuntimeError("bucket exceeds 1.5 GB")


if __name__ == "__main__":
    main()
