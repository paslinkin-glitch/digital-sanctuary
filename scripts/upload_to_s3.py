#!/usr/bin/env python3
"""Upload media_cdn/*.mp4 to Timeweb Cloud S3.

Credentials come from env:
  TIMEWEB_S3_ACCESS_KEY, TIMEWEB_S3_SECRET_KEY
Optional:
  TIMEWEB_S3_ENDPOINT (default https://twcstorage.ru)
  TIMEWEB_S3_BUCKET (default digital-sanctuary)
  TIMEWEB_S3_REGION (default ru-1)
"""

from __future__ import annotations

import concurrent.futures
import os
import sys
from pathlib import Path

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media_cdn"
ENDPOINT = os.environ.get("TIMEWEB_S3_ENDPOINT", "https://s3.twcstorage.ru")
BUCKET = os.environ.get("TIMEWEB_S3_BUCKET", "digital-sanctuary")
REGION = os.environ.get("TIMEWEB_S3_REGION", "ru-1")
ACCESS = os.environ.get("TIMEWEB_S3_ACCESS_KEY", "")
SECRET = os.environ.get("TIMEWEB_S3_SECRET_KEY", "")

CONFIG = TransferConfig(
    multipart_threshold=16 * 1024 * 1024,
    multipart_chunksize=8 * 1024 * 1024,
    max_concurrency=4,
    use_threads=True,
)


def client():
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        region_name=REGION,
        aws_access_key_id=ACCESS,
        aws_secret_access_key=SECRET,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"max_attempts": 4, "mode": "standard"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def upload_one(s3, path: Path) -> tuple[str, str]:
    extra = {
        "ACL": "public-read",
        "ContentType": "video/mp4",
        "CacheControl": "public, max-age=31536000, immutable",
    }
    try:
        s3.upload_file(str(path), BUCKET, path.name, ExtraArgs=extra, Config=CONFIG)
    except ClientError as error:
        code = error.response.get("Error", {}).get("Code", "")
        if code not in ("AccessControlListNotSupported", "InvalidArgument"):
            raise
        # Some S3-compatible buckets are public at bucket level and reject ACLs.
        extra.pop("ACL", None)
        s3.upload_file(str(path), BUCKET, path.name, ExtraArgs=extra, Config=CONFIG)
    return path.name, f"{ENDPOINT}/{BUCKET}/{path.name}"


def main() -> int:
    if not ACCESS or not SECRET:
        print("TIMEWEB_S3_ACCESS_KEY / TIMEWEB_S3_SECRET_KEY are missing")
        return 2
    files = sorted(MEDIA.glob("*.mp4"))
    if not files:
        print("no media files")
        return 3
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    if limit:
        files = files[:limit]
    print(f"uploading {len(files)} files to {ENDPOINT}/{BUCKET}", flush=True)
    s3 = client()
    done = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(upload_one, s3, path) for path in files]
        for future in concurrent.futures.as_completed(futures):
            name, url = future.result()
            done += 1
            print(f"[{done}/{len(files)}] {name} -> {url}", flush=True)
    print("UPLOAD COMPLETE", done, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
