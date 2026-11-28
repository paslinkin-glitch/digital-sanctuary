#!/usr/bin/env python3
"""Fetch the photoreal studio 3D assets for the Dali threshold scene (v142).

Everything here runs on the GitHub Actions runner, never on a visitor's
machine and never in a local browser:

  * assets/three.min.js        Three.js r160 UMD bundle (unpkg, no key)
  * assets/bay-env.jpg         Poly Haven coastal panorama, 2048x1024 JPEG
  * assets/stone-color.jpg     Poly Haven stone diffuse map, 512x512
  * assets/stone-normal.jpg    Poly Haven stone normal map, 512x512
  * assets/stone-roughness.jpg Poly Haven stone roughness map, 512x512
  * assets/water-normal.jpg    seamless multi-octave sea-ripple normal map

Poly Haven serves its library without an API key under CC0. The panorama is
the public tonemapped JPEG preview of a coastal HDRI (Cape Hill: a low sun over
the ocean, rocky headland and wispy clouds); it is centre-cropped to the 2:1
equirectangular ratio and re-encoded at 2048x1024. The stone maps come from one
single Poly Haven material so colour, normal and roughness describe the same
weathered limestone. The water normal map is generated locally on the runner
from a seamless sum of integer-frequency waves (numpy), because Poly Haven has
no dedicated water-ripple normal texture.

Idempotent by design: a valid existing asset is kept unless --force is passed.
All writes are atomic, so a broken download can never overwrite a good file.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

THREE_URL = "https://unpkg.com/three@0.160.0/build/three.min.js"
THREE_MIN_BYTES = 400_000
THREE_MAX_BYTES = 1_600_000

FILES_API = "https://api.polyhaven.com/files/{asset}"

# A low sun over the ocean, a rocky headland and real clouds: the closest
# public coastal panorama to the Port Lligat storm light of the scene. The
# remaining candidates are only fallbacks if Poly Haven retires an asset.
PANORAMA_CANDIDATES = (
    "cape_hill",
    "kloppenheim_06",
    "kloofendal_48d_partly_cloudy",
)
PANORAMA_SIZE = (2048, 1024)
PANORAMA_MIN_BYTES = 150_000
PANORAMA_MAX_BYTES = 340_000
PANORAMA_TARGET_BYTES = 245_000

# Coastal / mountain stone first. The first asset that exposes a diffuse map,
# a GL normal map and a roughness map at 1k wins, so a retired asset can never
# break the run. Colour, normal and roughness always come from one material.
STONE_CANDIDATES = (
    "rock_wall_02",
    "rocks_ground_06",
    "coast_sand_rocks_02",
    "dark_rock",
    "rock_wall_08",
)
POLYHAVEN_MAP_KEYS = {"color": "Diffuse", "normal": "nor_gl", "roughness": "Rough"}
RESOLUTION = "1k"
TEXTURE_SIZE = 512
TEXTURE_MIN_BYTES = 45_000
TEXTURE_MAX_BYTES = 95_000
WATER_NORMAL_MIN_BYTES = 40_000
WATER_NORMAL_MAX_BYTES = 110_000
WATER_NORMAL_TARGET_BYTES = 75_000
USER_AGENT = (
    "yoursanctuary-studio-assets/1.1 "
    "(+https://yoursanctuary.ru; asset preparation for the static PWA)"
)


def log(message: str) -> None:
    print(f"[fetch-3d] {message}", flush=True)


def http_get(url: str, *, attempts: int = 4, timeout: int = 120) -> bytes:
    """Download a URL with a browser-ish UA and small exponential backoff."""
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "*/*",
                "Accept-Encoding": "identity",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status} for {url}")
                return response.read()
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as error:
            last_error = error
            if attempt == attempts:
                break
            wait = 2 ** (attempt - 1)
            log(f"retry {attempt}/{attempts - 1} in {wait}s: {error}")
            time.sleep(wait)
    raise RuntimeError(f"could not download {url}: {last_error}")


def atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    temporary.write_bytes(payload)
    os.replace(temporary, path)


def three_bundle_is_valid(path: Path) -> bool:
    if not path.is_file():
        return False
    size = path.stat().st_size
    if not THREE_MIN_BYTES <= size <= THREE_MAX_BYTES:
        return False
    try:
        body = path.read_bytes()
    except OSError:
        return False
    return b"THREE" in body or b"threejs.org/license" in body


def fetch_three(force: bool) -> None:
    target = ASSETS / "three.min.js"
    if not force and three_bundle_is_valid(target):
        log(f"three.min.js already present ({target.stat().st_size} bytes)")
        return
    log("downloading Three.js r160 UMD bundle from unpkg")
    payload = http_get(THREE_URL)
    if not THREE_MIN_BYTES <= len(payload) <= THREE_MAX_BYTES:
        raise RuntimeError(
            f"unexpected three.min.js size: {len(payload)} bytes "
            f"(expected {THREE_MIN_BYTES}-{THREE_MAX_BYTES})"
        )
    if b"THREE" not in payload and b"threejs.org/license" not in payload:
        raise RuntimeError("downloaded bundle does not look like Three.js")
    atomic_write(target, payload)
    log(f"saved assets/three.min.js ({len(payload)} bytes)")


def pick_stone_asset() -> tuple[str, dict]:
    """Return (asset id, {'color': url, 'normal': url, 'roughness': url})."""
    problems: list[str] = []
    for asset in STONE_CANDIDATES:
        try:
            raw = http_get(FILES_API.format(asset=asset))
            files = json.loads(raw.decode("utf-8"))
        except Exception as error:  # noqa: BLE001 - keep trying the next asset
            problems.append(f"{asset}: {error}")
            continue
        urls: dict[str, str] = {}
        for kind, key in POLYHAVEN_MAP_KEYS.items():
            try:
                urls[kind] = files[key][RESOLUTION]["jpg"]["url"]
            except (KeyError, TypeError):
                urls = {}
                break
        if all(urls.get(kind) for kind in POLYHAVEN_MAP_KEYS):
            log(f"Poly Haven stone asset selected: {asset}")
            return asset, urls
        problems.append(f"{asset}: missing Diffuse/nor_gl/Rough at {RESOLUTION}")
    raise RuntimeError("no Poly Haven stone asset exposed the needed maps: " + "; ".join(problems))


def pick_panorama() -> tuple[str, str]:
    """Return (asset id, tonemapped JPEG URL) for the first coastal panorama."""
    problems: list[str] = []
    for asset in PANORAMA_CANDIDATES:
        try:
            raw = http_get(FILES_API.format(asset=asset))
            files = json.loads(raw.decode("utf-8"))
            url = files["tonemapped"]["url"]
            if not url:
                raise KeyError("empty tonemapped url")
        except Exception as error:  # noqa: BLE001 - keep trying the next asset
            problems.append(f"{asset}: {error}")
            continue
        log(f"Poly Haven panorama selected: {asset}")
        return asset, url
    raise RuntimeError("no Poly Haven panorama exposed a tonemapped JPEG: " + "; ".join(problems))


def decode_image(payload: bytes, label: str) -> Image.Image:
    try:
        with Image.open(io.BytesIO(payload)) as source:
            source.load()
            return source.copy()
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"could not decode {label}: {error}") from error


def resize_cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Scale to cover the target and centre-crop (no stretching)."""
    image = image.convert("RGB")
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized_w = max(target_w, round(image.width * scale))
    resized_h = max(target_h, round(image.height * scale))
    image = image.resize((resized_w, resized_h), Image.LANCZOS)
    left = (resized_w - target_w) // 2
    top = (resized_h - target_h) // 2
    return image.crop((left, top, left + target_w, top + target_h))


def resize_square(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    width, height = image.size
    if width != height:
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
    return image.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.LANCZOS)


def jpeg_bytes(image: Image.Image, *, quality: int, subsampling: int) -> bytes | None:
    """Encode one JPEG quality; tolerate the Pillow progressive-encoder quirk."""
    for progressive in (True, False):
        buffer = io.BytesIO()
        try:
            image.save(
                buffer,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=progressive,
                subsampling=subsampling,
            )
        except Exception:  # noqa: BLE001 - try the next scan/quality
            continue
        payload = buffer.getvalue()
        if payload:
            return payload
    return None


def encode_to_budget(
    image: Image.Image,
    *,
    min_bytes: int,
    max_bytes: int,
    target_bytes: int,
    subsampling: int = 2,
    qualities: range = range(92, 29, -3),
) -> bytes:
    """Pick the quality whose JPEG is closest to the target inside the window."""
    best: bytes | None = None
    best_distance: int | None = None
    for quality in qualities:
        payload = jpeg_bytes(image, quality=quality, subsampling=subsampling)
        if not payload:
            continue
        if min_bytes <= len(payload) <= max_bytes:
            return payload
        distance = abs(len(payload) - target_bytes)
        if best_distance is None or distance < best_distance:
            best = payload
            best_distance = distance
    if best is None:
        raise RuntimeError("could not encode the image")
    if not min_bytes <= len(best) <= max_bytes:
        log(
            f"warning: encoded image is {len(best)} bytes, outside the "
            f"{min_bytes}-{max_bytes} byte window"
        )
    return best


def panorama_is_valid(path: Path) -> bool:
    if not path.is_file():
        return False
    size = path.stat().st_size
    if not PANORAMA_MIN_BYTES <= size <= PANORAMA_MAX_BYTES:
        return False
    try:
        with Image.open(path) as image:
            return image.size == PANORAMA_SIZE
    except Exception:  # noqa: BLE001
        return False


def fetch_panorama(force: bool) -> None:
    target = ASSETS / "bay-env.jpg"
    if not force and panorama_is_valid(target):
        log(f"bay-env.jpg already present ({target.stat().st_size} bytes)")
        return
    asset, url = pick_panorama()
    log(f"downloading coastal panorama from Poly Haven '{asset}' ({url.rsplit('/', 1)[-1]})")
    payload = http_get(url)
    image = resize_cover(decode_image(payload, "panorama"), PANORAMA_SIZE)
    encoded = encode_to_budget(
        image,
        min_bytes=PANORAMA_MIN_BYTES,
        max_bytes=PANORAMA_MAX_BYTES,
        target_bytes=PANORAMA_TARGET_BYTES,
        subsampling=2,
        qualities=range(90, 39, -2),
    )
    atomic_write(target, encoded)
    log(f"saved assets/bay-env.jpg ({len(encoded)} bytes, {PANORAMA_SIZE[0]}x{PANORAMA_SIZE[1]})")


def fetch_stone_map(kind: str, url: str, target: Path) -> None:
    log(f"downloading {kind} map ({url.rsplit('/', 1)[-1]})")
    payload = http_get(url)
    image = resize_square(decode_image(payload, f"{kind} map"))
    if kind == "roughness":
        # Keep three channels: the shader reads green, and the extra chroma keeps
        # the progressive JPEG inside the same weight window as the normal map.
        image = image.convert("RGB")
    # The normal map is vector data, so keep full chroma; colour and roughness
    # tolerate 4:2:0.
    subsampling = 0 if kind == "normal" else 2
    encoded = encode_to_budget(
        image,
        min_bytes=TEXTURE_MIN_BYTES,
        max_bytes=TEXTURE_MAX_BYTES,
        target_bytes=78_000,
        subsampling=subsampling,
        qualities=range(92, 34, -3),
    )
    atomic_write(target, encoded)
    log(f"saved assets/{target.name} ({len(encoded)} bytes, {TEXTURE_SIZE}x{TEXTURE_SIZE})")


def stone_assets_are_valid() -> bool:
    for name in ("stone-color.jpg", "stone-normal.jpg", "stone-roughness.jpg"):
        path = ASSETS / name
        if not path.is_file():
            return False
        try:
            with Image.open(path) as image:
                if image.size != (TEXTURE_SIZE, TEXTURE_SIZE):
                    return False
        except Exception:  # noqa: BLE001
            return False
    return True


def fetch_stone_maps(force: bool) -> None:
    if not force and stone_assets_are_valid():
        total = sum((ASSETS / name).stat().st_size for name in (
            "stone-color.jpg", "stone-normal.jpg", "stone-roughness.jpg"
        ))
        log(f"stone colour/normal/roughness maps already present ({total} bytes)")
        return
    asset, urls = pick_stone_asset()
    for kind in ("color", "normal", "roughness"):
        fetch_stone_map(kind, urls[kind], ASSETS / f"stone-{kind}.jpg")
    log(f"stone textures sourced from Poly Haven '{asset}' (CC0)")


def build_water_normal(force: bool) -> None:
    target = ASSETS / "water-normal.jpg"
    if not force and target.is_file() and WATER_NORMAL_MIN_BYTES <= target.stat().st_size <= WATER_NORMAL_MAX_BYTES:
        try:
            with Image.open(target) as image:
                if image.size == (TEXTURE_SIZE, TEXTURE_SIZE):
                    log(f"water-normal.jpg already present ({target.stat().st_size} bytes)")
                    return
        except Exception:  # noqa: BLE001
            pass

    try:
        import numpy as np
    except Exception as error:  # noqa: BLE001
        raise RuntimeError("numpy is required to generate the water normal map") from error

    log("generating a seamless multi-octave water-ripple normal map")
    rng = np.random.default_rng(142)
    size = TEXTURE_SIZE
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / float(size)
    height = np.zeros((size, size), dtype=np.float32)
    # Integer wave vectors make the field exactly periodic, so the texture tiles
    # without a seam; the frequencies cover broad swell down to fine chop.
    waves = 26
    for _ in range(waves):
        kx = int(rng.integers(-34, 35))
        ky = int(rng.integers(-34, 35))
        if kx == 0 and ky == 0:
            kx = 1
        frequency = math.hypot(kx, ky)
        amplitude = 1.0 / (frequency ** 0.82)
        phase = float(rng.uniform(0.0, math.tau))
        height += amplitude * np.sin(math.tau * (kx * xx + ky * yy) + phase)
    height -= float(height.mean())
    deviation = float(height.std()) or 1.0
    height /= deviation
    # A gentle large swell under the chop, also periodic.
    height += 0.32 * np.sin(math.tau * (3 * xx + 2 * yy) + 0.7)
    height += 0.22 * np.sin(math.tau * (-2 * xx + 5 * yy) + 2.1)

    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    strength = 1.15
    nx = -dx * strength
    ny = -dy * strength
    nz = np.ones_like(nx)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx /= length
    ny /= length
    nz /= length
    rgb = np.stack(((nx * 0.5 + 0.5) * 255.0, (ny * 0.5 + 0.5) * 255.0, (nz * 0.5 + 0.5) * 255.0), axis=-1)
    image = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), mode="RGB")
    encoded = encode_to_budget(
        image,
        min_bytes=WATER_NORMAL_MIN_BYTES,
        max_bytes=WATER_NORMAL_MAX_BYTES,
        target_bytes=WATER_NORMAL_TARGET_BYTES,
        subsampling=0,
        qualities=range(94, 34, -3),
    )
    atomic_write(target, encoded)
    log(f"saved assets/water-normal.jpg ({len(encoded)} bytes, {size}x{size})")


def report_weight() -> None:
    names = (
        "bay-env.jpg",
        "stone-color.jpg",
        "stone-normal.jpg",
        "stone-roughness.jpg",
        "water-normal.jpg",
    )
    total = sum((ASSETS / name).stat().st_size for name in names if (ASSETS / name).is_file())
    log(f"texture payload: {total} bytes across {len(names)} maps")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download every asset")
    args = parser.parse_args()

    ASSETS.mkdir(parents=True, exist_ok=True)

    fetch_three(args.force)
    fetch_panorama(args.force)
    fetch_stone_maps(args.force)
    build_water_normal(args.force)

    if not three_bundle_is_valid(ASSETS / "three.min.js"):
        raise RuntimeError("three.min.js failed its final validation")
    if not panorama_is_valid(ASSETS / "bay-env.jpg"):
        raise RuntimeError("bay-env.jpg failed its final validation")
    if not stone_assets_are_valid():
        raise RuntimeError("stone colour/normal/roughness maps failed their final validation")
    if not (ASSETS / "water-normal.jpg").is_file():
        raise RuntimeError("water-normal.jpg is missing")
    with Image.open(ASSETS / "water-normal.jpg") as water:
        if water.size != (TEXTURE_SIZE, TEXTURE_SIZE):
            raise RuntimeError("water-normal.jpg failed its final validation")

    report_weight()
    log("photoreal studio 3D assets are ready")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001 - fail the workflow loudly
        print(f"[fetch-3d] ERROR: {error}", file=sys.stderr, flush=True)
        sys.exit(1)
