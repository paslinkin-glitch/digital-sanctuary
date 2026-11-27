#!/usr/bin/env python3
"""Build 20 light studio-quality vertical dream scenes and publish the catalog.

v119: the catalog is capped at 20 scenes, each one a 10-second 1080x1920
H.264 High MP4 at studio quality (CRF 16, preset slow, +faststart) that must
never exceed the hard 12 MB (12_000_000 bytes) ceiling. A larger file is
re-encoded once with -maxrate 8500k -bufsize 17000k and, if it still does not
fit, refused before it can reach S3. The ten scenes above 12 MB were removed
in v119, so the 30-frame session is assembled from these 20 frames (15 unique
per cycle; the second cycle repeats some and uses every scene).
Files live at digital-sanctuary/mp4-1080/<clip_id>.mp4 and are streamed
natively by slotA / slotB via +faststart: no Blob prefetch and no hidden
fetch() keeping the browser loading bar alive. Old digital-sanctuary/hls/
objects are removed; the digital-sanctuary/audio/ library is never touched.
"""
import json
import os
import shutil
import subprocess
from pathlib import Path

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "mp4-work"
OUT = WORK / "clips"
S3_BUCKET = os.environ.get("S3_BUCKET", "digital-sanctuary")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "https://s3.twcstorage.ru").rstrip("/")
S3_PREFIX = S3_ENDPOINT + "/" + S3_BUCKET
MP4_PREFIX = "mp4-1080"
DURATION = 10
WIDTH = 1080
HEIGHT = 1920
FPS = 30
# The light 20-scene catalog starts at 4.1 MB, so the floor follows it.
SIZE_MIN = 4_000_000
# Hard per-file ceiling (v119). Nothing heavier may ever be published.
MAX_FILE_BYTES = 12_000_000
SIZE_MAX = MAX_FILE_BYTES
BUFSIZE = "17000k"
FALLBACK_MAXRATE = "8500k"

# Curated from the Coverr sitemap: only unused dreamlike nature/water/sky/fog
# sources, no people, crowds, streets, vehicles, buildings, logos or animals
# in close-up. The workflow still downloads every original itself.
# v119: the ten sources whose CRF 16 render exceeded 12 MB are gone, so only
# these 20 light scenes (4.1-11.7 MB) are ever built and published again.
SCENES = [
    ("dream-shadow-01", "Misty Mountains in Sao Vicente", "https://cdn.coverr.co/videos/coverr-misty-mountains-in-sao-vicente-portugal-3617/1080p.mp4", "shadow", "fog-01", False, False),
    ("dream-shadow-03", "Glade in Fanal", "https://cdn.coverr.co/videos/coverr-glade-in-fanal-madeira-island-8331/1080p.mp4", "shadow", "fog-03", False, False),
    ("dream-shadow-05", "Fast-Flowing River", "https://cdn.coverr.co/videos/coverr-fast-flowing-river-7623/1080p.mp4", "shadow", "fog-05", False, False),
    ("dream-shadow-06", "Forest in Geres", "https://cdn.coverr.co/videos/coverr-forest-in-ger-s-national-park-8003/1080p.mp4", "shadow", "rain-01", False, False),
    ("dream-shadow-07", "A Lake Near a Forest", "https://cdn.coverr.co/videos/coverr-a-lake-near-a-forest-6426/1080p.mp4", "shadow", "rain-02", False, False),
    ("dream-shadow-08", "Cloudy Day in Fanal", "https://cdn.coverr.co/videos/coverr-cloudy-day-in-fanal-madeira-island-3143/1080p.mp4", "shadow", "rain-03", False, False),
    ("dream-shadow-10", "Mountain Tops", "https://cdn.coverr.co/videos/coverr-mountain-tops-9327/1080p.mp4", "shadow", "water-01", False, False),
    ("dream-trickster-01", "Blurry Sunset", "https://cdn.coverr.co/videos/coverr-blurry-sunset-2693/1080p.mp4", "trickster_abyss", "fire-01", True, False),
    ("dream-trickster-02", "Rock Formation in the Sea", "https://cdn.coverr.co/videos/coverr-premium-rock-formation-in-the-sea-1789/1080p.mp4", "trickster_abyss", "fire-02", True, False),
    ("dream-trickster-05", "Calm Waves in a Gulf", "https://cdn.coverr.co/videos/coverr-calm-waves-in-an-ocean-gulf-4513/1080p.mp4", "trickster_abyss", "water-03", False, False),
    ("dream-trickster-06", "A Tide of Foamy Waves", "https://cdn.coverr.co/videos/coverr-a-tide-of-foamy-waves-4378/1080p.mp4", "trickster_abyss", "water-04", False, False),
    ("dream-trickster-07", "Bioluminescent Waves", "https://cdn.coverr.co/videos/coverr-bioluminescent-plankton-illuminate-the-waves-on-a-tropical-beach/1080p.mp4", "trickster_abyss", "space-01", True, False),
    ("dream-trickster-08", "Sunset over the Atlantic", "https://cdn.coverr.co/videos/coverr-sunset-over-the-atlantic-ocean-1409/1080p.mp4", "trickster_abyss", "city-01", True, False),
    ("dream-calm-01", "Sunset in Costa Rica", "https://cdn.coverr.co/videos/coverr-sunset-in-costa-rica-5323/1080p.mp4", "calm", "city-02", False, False),
    ("dream-calm-03", "A View of the Lake", "https://cdn.coverr.co/videos/coverr-a-view-of-the-lake-2273/1080p.mp4", "calm", "city-04", False, False),
    ("dream-calm-04", "Lake Landscape in Salta", "https://cdn.coverr.co/videos/coverr-lake-landscape-in-salta-argentina-9045/1080p.mp4", "calm", "people-01", False, False),
    ("dream-calm-05", "Lago di Braies Reflection", "https://cdn.coverr.co/videos/coverr-lago-di-braies-reflection-1734/1080p.mp4", "calm", "people-02", False, False),
    ("dream-path-01", "The Endless Horizon", "https://cdn.coverr.co/videos/coverr-a-spectacular-view-of-the-endless-horizon-4469/1080p.mp4", "path", "road-01", False, True),
    ("dream-path-04", "Island in the Sea", "https://cdn.coverr.co/videos/coverr-island-in-the-sea-5236/1080p.mp4", "path", "road-04", False, True),
    ("dream-path-05", "A Pier in the Ocean", "https://cdn.coverr.co/videos/coverr-a-pier-in-the-ocean-5436/1080p.mp4", "path", "space-03", False, False),
]

# Hand-written live captions, one pair per scene, in SCENES order. Each line
# describes what actually happens in that shot, in plain human language.
CAPTIONS = [
    ("Cloud slides down the green ridges and stops above the valley. Nothing in this weather asks you to decide.",
     "Облако сползает по зелёным хребтам и замирает над долиной. В такую погоду решать нечего."),
    ("Laurel trees close around a small clearing and the moss holds the damp air. Some places in a person are this old and this green.",
     "Лавры смыкаются вокруг маленькой поляны, мох держит влажный воздух. Есть в человеке места такие же древние и зелёные."),
    ("Cold water runs over the stones without pausing to explain itself. It only moves.",
     "Холодная вода бежит по камням и не пытается ничего объяснить. Она просто движется."),
    ("Trunks stand close together and the path between them narrows. The forest does not ask you to be quick.",
     "Стволы стоят близко, тропа между ними сужается. Лес не просит тебя торопиться."),
    ("Still water holds a second forest, darker than the first. The reflection knows more than it says.",
     "Тихая вода держит второй лес, темнее первого. Отражение знает больше, чем говорит."),
    ("Low cloud drifts between the trees and softens every edge. Even the sharp things breathe here.",
     "Низкое облако идёт между деревьями и смягчает все края. Даже острое здесь дышит."),
    ("Peaks stand above the cloud layer in the early light. From this height the worry looks small.",
     "Вершины стоят над облаками в раннем свете. С этой высоты тревога кажется маленькой."),
    ("The sun blurs into the horizon and the whole frame forgets its edges. Let the day dissolve a little too.",
     "Солнце расплывается у горизонта, и весь кадр забывает свои края. Дай и дню немного раствориться."),
    ("A dark stone stands in the surf while the water keeps changing shape around it. Some things survive by staying still.",
     "Тёмный камень стоит в прибое, вода снова и снова меняет форму вокруг него. Иное выживает, оставаясь на месте."),
    ("Small waves arrive one after another and each one is slightly different. Stillness keeps moving.",
     "Небольшие волны приходят одна за другой, и каждая чуть другая. Покой продолжает двигаться."),
    ("Foam slides up the shore and the sea takes it back almost at once. Everything here is brief.",
     "Пена поднимается по берегу, и море почти сразу забирает её назад. Всё здесь ненадолго."),
    ("Blue light burns along the breaking waves in the dark and vanishes behind them. Something glows only where it breaks.",
     "Синий свет горит по гребням волн в темноте и гаснет за ними. Иное светится только там, где сломалось."),
    ("The sky turns copper and the whole ocean carries the colour for a moment. Then the light gives itself to the water.",
     "Небо становится медным, и весь океан на миг удерживает этот цвет. Потом свет отдаёт себя воде."),
    ("Warm light settles on the water and the day stops asking for anything. You can put the weight down here.",
     "Тёплый свет ложится на воду, и день перестаёт чего-то требовать. Здесь можно опустить груз."),
    ("The water is so still that the far shore doubles itself. Nothing needs to be added to this.",
     "Вода так тиха, что дальний берег удваивается. К этому ничего не нужно добавлять."),
    ("Clouds and mountains share the surface of the lake without arguing. Both of them are held.",
     "Облака и горы делят поверхность озера без спора. Оба удержаны."),
    ("Wooden boats rest on green water and the peaks lean into it exactly. Mountains look gentler when they mirror.",
     "Деревянные лодки стоят на зелёной воде, вершины наклоняются в неё точно так же. Горы выглядят мягче, когда отражаются."),
    ("A long line of light opens all the way to the edge of sight. You do not need a map for this.",
     "Длинная полоса света открывается до самого края зрения. Карта здесь не нужна."),
    ("A small island holds its ground while the whole ocean moves past. You do not have to follow every wave.",
     "Маленький остров держится, пока мимо идёт целый океан. Не обязательно идти за каждой волной."),
    ("The pier reaches into open water and ends there, still pointing forward. Not every road has to arrive.",
     "Причал уходит в открытую воду и заканчивается там, всё ещё указывая вперёд. Не каждая дорога должна привести к цели."),
]

TRACK_CATEGORY = {
    "fog": "fog", "rain": "rain", "water": "water", "fire": "fire",
    "space": "space", "city": "city", "people": "people", "road": "road",
}
STAGE_ARCH = {"shadow": "Shadow", "trickster_abyss": "Trickster", "calm": "Calm", "path": "Path"}


def caption_id(index):
    return SCENES[index][0]


def validate_captions():
    if len(CAPTIONS) != len(SCENES):
        raise RuntimeError(f"caption count {len(CAPTIONS)} != scene count {len(SCENES)}")
    seen_en = set()
    seen_ru = set()
    for en, ru in CAPTIONS:
        if len(en) < 60 or len(ru) < 60:
            raise RuntimeError(f"caption too short: {en} | {ru}")
        if "In the quiet" in en or "В тишине" in ru:
            raise RuntimeError(f"template caption leaked: {en} | {ru}")
        if en in seen_en or ru in seen_ru:
            raise RuntimeError(f"duplicate caption: {en} | {ru}")
        seen_en.add(en)
        seen_ru.add(ru)


def run(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def ffprobe(path):
    r = subprocess.run([
        "ffprobe", "-v", "error",
        "-show_entries", "stream=codec_type,width,height,r_frame_rate:format=duration",
        "-of", "json", str(path),
    ], capture_output=True, text=True, check=True)
    data = json.loads(r.stdout)
    video = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
    audio = [s for s in data["streams"] if s.get("codec_type") == "audio"]
    if not video:
        raise RuntimeError(f"no video stream: {path}")
    fr = str(video.get("r_frame_rate", "30/1")).split("/")
    fps = float(fr[0]) / float(fr[1] or 1)
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "duration": float(data["format"]["duration"]),
        "fps": fps,
        "audio": len(audio),
    }


def download(url, path):
    run(["curl", "-L", "-sS", "-A", "Mozilla/5.0", "-e", "https://coverr.co/",
         "--max-time", "240", "--retry", "3", "-o", str(path), url])


def encode_mp4(source, out, crf=16, maxrate=None):
    """Studio 1080p pass: CRF 16, slow preset, optional VBV ceiling.

    The first pass deliberately has no -maxrate / -bufsize: CRF 16 spends
    7.0-9.5 Mbps wherever the frame needs it, which is what keeps water, fog
    and foliage sharp. The ceiling exists only as the v119 safety re-encode
    for a file that still lands above the hard 12 MB limit.
    """
    extra = []
    if maxrate:
        extra = ["-maxrate", maxrate, "-bufsize", BUFSIZE]
    run([
        "ffmpeg", "-y", "-v", "error", "-i", str(source),
        "-t", str(DURATION), "-an",
        "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT},fps={FPS},setsar=1",
        "-r", str(FPS),
        "-c:v", "libx264", "-profile:v", "high", "-level:v", "4.2", "-preset", "slow",
        "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-g", "60", "-keyint_min", "30", "-sc_threshold", "0",
        *extra,
        "-movflags", "+faststart", "-map_metadata", "-1", str(out),
    ])


def verify_mp4(path):
    size = path.stat().st_size
    if size > MAX_FILE_BYTES:
        raise RuntimeError(f"{path.name}: {size} bytes exceeds hard {MAX_FILE_BYTES} byte limit")
    info = ffprobe(path)
    if (info["width"], info["height"]) != (WIDTH, HEIGHT):
        raise RuntimeError(f"{path.name}: wrong size {info['width']}x{info['height']}")
    if abs(info["duration"] - DURATION) > 0.25:
        raise RuntimeError(f"{path.name}: wrong duration {info['duration']}")
    if info["audio"]:
        raise RuntimeError(f"{path.name}: audio stream present")
    if abs(info["fps"] - FPS) > 1.0:
        raise RuntimeError(f"{path.name}: wrong fps {info['fps']}")
    return info


def build_clip_mp4(source, out):
    """One studio CRF 16 pass plus the v119 hard 12 MB guarantee.

    A 10-second 1080x1920 CRF 16 slow file usually lands around 4-12 MB.
    If it comes out heavier than MAX_FILE_BYTES the clip is re-encoded once
    with -maxrate 8500k -bufsize 17000k; if it still does not fit it is
    refused here, before any upload, so S3 can never receive a heavy scene.
    """
    encode_mp4(source, out, 16)
    size = out.stat().st_size
    if size > MAX_FILE_BYTES:
        print(f"  {out.name} is {size} bytes > {MAX_FILE_BYTES}; "
              f"re-encoding with -maxrate {FALLBACK_MAXRATE} -bufsize {BUFSIZE}", flush=True)
        encode_mp4(source, out, 16, maxrate=FALLBACK_MAXRATE)
        size = out.stat().st_size
        if size > MAX_FILE_BYTES:
            raise RuntimeError(
                f"{out.name}: {size} bytes still exceeds the hard "
                f"{MAX_FILE_BYTES} byte limit; refusing to publish")
    if not SIZE_MIN <= size <= SIZE_MAX:
        print(f"  WARNING: {out.name} is {size} bytes, outside {SIZE_MIN}-{SIZE_MAX}", flush=True)
    verify_mp4(out)
    return size


def s3_client():
    return boto3.client(
        "s3", endpoint_url=S3_ENDPOINT, region_name=os.environ.get("AWS_DEFAULT_REGION", "ru-1"),
        aws_access_key_id=os.environ["S3_ACCESS_KEY"],
        aws_secret_access_key=os.environ["S3_SECRET_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"},
                      retries={"max_attempts": 8, "mode": "standard"}),
    )


def list_keys(s3, prefix=""):
    keys = []
    token = None
    while True:
        kw = {"Bucket": S3_BUCKET}
        if prefix:
            kw["Prefix"] = prefix
        if token:
            kw["ContinuationToken"] = token
        page = s3.list_objects_v2(**kw)
        for obj in page.get("Contents", []):
            keys.append({"Key": obj["Key"], "Size": int(obj.get("Size", 0))})
        if not page.get("IsTruncated"):
            break
        token = page["NextContinuationToken"]
    return keys


def delete_keys(s3, keys):
    for i in range(0, len(keys), 500):
        batch = [{"Key": k["Key"]} for k in keys[i:i + 500]]
        s3.delete_objects(Bucket=S3_BUCKET, Delete={"Objects": batch, "Quiet": True})


def clean_old_hls(s3, keep_ids):
    hls_keys = [k for k in list_keys(s3, "hls/")]
    delete_keys(s3, hls_keys)
    print(f"deleted legacy HLS objects: {len(hls_keys)}", flush=True)
    stale = [k for k in list_keys(s3, MP4_PREFIX + "/")
             if k["Key"].rsplit("/", 1)[-1].removesuffix(".mp4") not in keep_ids]
    delete_keys(s3, stale)
    if stale:
        print(f"deleted stale mp4 objects: {len(stale)}", flush=True)
    audio_keys = list_keys(s3, "audio/")
    print(f"audio objects preserved: {len(audio_keys)}", flush=True)


def upload_mp4(s3, path, key):
    s3.upload_file(str(path), S3_BUCKET, key, ExtraArgs={
        "ACL": "public-read",
        "ContentType": "video/mp4",
        "CacheControl": "public, max-age=31536000, immutable",
        "ContentEncoding": "identity",
    })


def main():
    validate_captions()
    if WORK.exists():
        shutil.rmtree(WORK)
    OUT.mkdir(parents=True)
    s3 = s3_client()
    built = []
    total_bytes = 0
    for idx, (clip_id, title, url, stage, track_id, surreal, finale) in enumerate(SCENES):
        if clip_id != caption_id(idx):
            raise RuntimeError(f"scene order mismatch at {idx}")
        src = OUT / f"{clip_id}.source.mp4"
        download(url, src)
        source_duration = ffprobe(src)["duration"]
        if source_duration < DURATION:
            raise RuntimeError(f"source shorter than {DURATION}s: {clip_id} {source_duration}")
        out = OUT / f"{clip_id}.mp4"
        size = build_clip_mp4(src, out)
        total_bytes += size
        caption_en, caption_ru = CAPTIONS[idx]
        track_cat = TRACK_CATEGORY[track_id.split("-")[0]]
        built.append({
            "id": clip_id,
            "title": title,
            "description": title,
            "title_ru": f"Сон {idx + 1:02d}",
            "url": f"{S3_PREFIX}/{MP4_PREFIX}/{clip_id}.mp4",
            "stage": stage,
            "archetype": STAGE_ARCH[stage],
            "is_finale": bool(finale),
            "is_surreal": bool(surreal),
            "source": "coverr",
            "vertical": True,
            "width": WIDTH,
            "height": HEIGHT,
            "duration": float(DURATION),
            "size": size,
            "tier": "1080",
            "caption_en": caption_en,
            "caption_ru": caption_ru,
            "soundCategory": track_cat,
            "trackId": track_id,
            "fileHash": clip_id,
        })
        src.unlink(missing_ok=True)
        print(f"built {clip_id}: {size} bytes ({size / 1e6:.2f} MB), source {source_duration:.1f}s", flush=True)
    # Every file is verified locally. Only now replace the old S3 video set.
    clean_old_hls(s3, {item["id"] for item in built})
    for item in built:
        upload_mp4(s3, OUT / f"{item['id']}.mp4", f"{MP4_PREFIX}/{item['id']}.mp4")
        print(f"uploaded {MP4_PREFIX}/{item['id']}.mp4", flush=True)
    (ROOT / "videos.json").write_text(
        json.dumps(built, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "videos-data.js").write_text(
        "window.VIDEOS_DATA=" + json.dumps(built, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    bucket_bytes = sum(k["Size"] for k in list_keys(s3))
    smallest = min(i["size"] for i in built)
    largest = max(i["size"] for i in built)
    if largest > MAX_FILE_BYTES:
        raise RuntimeError(f"published clip exceeds {MAX_FILE_BYTES} bytes")
    print(f"built {len(built)} clips, mp4 bytes {total_bytes}, bucket bytes {bucket_bytes} "
          f"({bucket_bytes / 1e9:.3f} GB), clip size {smallest}-{largest} "
          f"(hard max {MAX_FILE_BYTES})", flush=True)
    if bucket_bytes > 1_500_000_000:
        raise RuntimeError("bucket exceeds 1.5 GB")


if __name__ == "__main__":
    main()
