#!/usr/bin/env python3
"""Fetch the studio 3D assets for the Dali threshold scene (v141).

Everything here runs on the GitHub Actions runner, never on a visitor's
machine and never in a local browser:

  * assets/three.min.js        Three.js r160 UMD bundle (unpkg, no key)
  * assets/stone-normal.jpg    Poly Haven seamless stone normal map, 512x512
  * assets/stone-roughness.jpg Poly Haven seamless stone roughness map, 512x512

Poly Haven serves its library without an API key under CC0. The script asks the
public files API for the 1k JPEG previews, crops them to a square and re-encodes
them at 512x512 (Pillow, progressive JPEG, ~60-95 KB) so the page keeps a light
mobile weight. Textures are data maps: the normal map must stay linear (no sRGB
conversion), the roughness map is read from its green channel.

Idempotent by design: a valid existing asset is kept unless --force is passed.
All writes are atomic, so a broken download can never overwrite a good file.
"""

from __future__ import annotations

import argparse
import io
import json
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
# Coastal / mountain stone first. The first asset that exposes both a GL normal
# map and a roughness map at 1k wins, so a retired asset can never break the run.
STONE_CANDIDATES = (
    "rock_wall_02",
    "rocks_ground_06",
    "coast_sand_rocks_02",
    "dark_rock",
    "rock_wall_08",
)
POLYHAVEN_MAP_KEYS = {"normal": "nor_gl", "roughness": "Rough"}
RESOLUTION = "1k"
TEXTURE_SIZE = 512
JPEG_MIN_BYTES = 55_000
JPEG_MAX_BYTES = 90_000
USER_AGENT = (
    "yoursanctuary-studio-assets/1.0 "
    "(+https://yoursanctuary.ru; asset preparation for the static PWA)"
)


def log(message: str) -> None:
    print(f"[fetch-3d] {message}", flush=True)


def http_get(url: str, *, attempts: int = 4, timeout: int = 90) -> bytes:
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
    """Return (asset id, {'normal': url, 'roughness': url}) for the first match."""
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
        if urls.get("normal") and urls.get("roughness"):
            log(f"Poly Haven asset selected: {asset}")
            return asset, urls
        problems.append(f"{asset}: missing nor_gl/Rough at {RESOLUTION}")
    raise RuntimeError("no Poly Haven stone asset exposed the needed maps: " + "; ".join(problems))


def resize_square(image: Image.Image) -> Image.Image:
    image = image.convert("RGB")
    width, height = image.size
    if width != height:
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
    return image.resize((TEXTURE_SIZE, TEXTURE_SIZE), Image.LANCZOS)


def encode_jpeg(image: Image.Image, *, chroma_subsampling: int = 2) -> bytes:
    """Pick the highest quality whose JPEG lands in the budget.

    Some Pillow builds abort the *progressive* encoder with "Suspension not
    allowed here" on very detailed 512 px normal maps at high quality. That is
    an encoder quirk, not a bad image: skip that quality and keep trying, then
    fall back to a baseline scan if progressive never produced a file.
    """
    best: bytes | None = None
    for progressive in (True, False):
        for quality in (92, 89, 86, 83, 80, 76, 72, 68, 64, 60, 55, 50, 46, 42, 38, 34, 30):
            buffer = io.BytesIO()
            try:
                image.save(
                    buffer,
                    format="JPEG",
                    quality=quality,
                    optimize=True,
                    progressive=progressive,
                    subsampling=chroma_subsampling,
                )
            except Exception:  # noqa: BLE001 - try the next quality/scan
                continue
            payload = buffer.getvalue()
            if JPEG_MIN_BYTES <= len(payload) <= JPEG_MAX_BYTES:
                return payload
            # Keep the closest candidate in case no quality fits the window.
            if best is None or abs(len(payload) - JPEG_MAX_BYTES) < abs(len(best) - JPEG_MAX_BYTES):
                best = payload
    if best is None:
        raise RuntimeError("could not encode the texture")
    return best


def fetch_stone_map(kind: str, url: str, target: Path) -> None:
    log(f"downloading {kind} map ({url.rsplit('/', 1)[-1]})")
    payload = http_get(url)
    try:
        with Image.open(io.BytesIO(payload)) as source:
            source.load()
            image = resize_square(source)
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(f"could not decode {kind} map: {error}") from error
    if kind == "roughness":
        # Keep three channels: the shader reads green, and the extra chroma keeps
        # the progressive JPEG inside the same weight window as the normal map.
        image = image.convert("RGB")
    # Normal maps are vector data, so keep full chroma; the roughness map is
    # effectively grayscale and tolerates 4:2:0.
    subsampling = 0 if kind == "normal" else 2
    encoded = encode_jpeg(image, chroma_subsampling=subsampling)
    atomic_write(target, encoded)
    log(f"saved assets/{target.name} ({len(encoded)} bytes, {TEXTURE_SIZE}x{TEXTURE_SIZE})")


def stone_assets_are_valid() -> bool:
    for name in ("stone-normal.jpg", "stone-roughness.jpg"):
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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="re-download every asset")
    args = parser.parse_args()

    ASSETS.mkdir(parents=True, exist_ok=True)

    fetch_three(args.force)

    if not args.force and stone_assets_are_valid():
        log("stone normal/roughness maps already present")
    else:
        asset, urls = pick_stone_asset()
        fetch_stone_map("normal", urls["normal"], ASSETS / "stone-normal.jpg")
        fetch_stone_map("roughness", urls["roughness"], ASSETS / "stone-roughness.jpg")
        log(f"stone textures sourced from Poly Haven '{asset}' (CC0)")

    if not three_bundle_is_valid(ASSETS / "three.min.js"):
        raise RuntimeError("three.min.js failed its final validation")
    if not stone_assets_are_valid():
        raise RuntimeError("stone maps failed their final validation")

    log("studio 3D assets are ready")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:  # noqa: BLE001 - fail the workflow loudly
        print(f"[fetch-3d] ERROR: {error}", file=sys.stderr, flush=True)
        sys.exit(1)
