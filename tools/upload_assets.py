#!/usr/bin/env python3
"""Upload every exported asset with Roblox Open Cloud and write AssetRegistry.

    export ROBLOX_API_KEY=...            # Open Cloud API key (asset:read, asset:write)
    export ROBLOX_CREATOR_ID=...         # user id (or group id with ROBLOX_CREATOR_TYPE=group)
    python3 tools/upload_assets.py [--dry-run]

Uploads:
  assets/export/*.fbx            -> Model assets   (AssetRegistry.Models[key])
  assets/renders/icons/*.png     -> Decal assets   (AssetRegistry.Images[key])
  assets/audio/*.ogg             -> Audio assets   (AssetRegistry.Sounds[key])
  assets/export/anims/*.rbxm     -> Animation      (AssetRegistry.Animations[key])
A cache (assets/upload_cache.json, keyed by file hash) skips unchanged files,
so re-running after an art change uploads only what changed.
"""
import hashlib
import json
import os
import re
import sys
import time
import urllib.request
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API = "https://apis.roblox.com/assets/v1"
REGISTRY = ROOT / "src" / "shared" / "AssetRegistry.luau"
CACHE = ROOT / "assets" / "upload_cache.json"

KINDS = [
    ("Models", "Model", ROOT / "assets" / "export", ".fbx", "model/fbx"),
    ("Images", "Decal", ROOT / "assets" / "renders" / "icons", ".png", "image/png"),
    ("Sounds", "Audio", ROOT / "assets" / "audio", ".ogg", "audio/ogg"),
    ("Animations", "Animation", ROOT / "assets" / "export" / "anims", ".rbxm", "model/x-rbxm"),
]


def multipart(fields, file_field, filename, content, mime):
    boundary = uuid.uuid4().hex
    body = bytearray()
    for name, value in fields.items():
        body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; filename=\"{filename}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
    body += content + f"\r\n--{boundary}--\r\n".encode()
    return bytes(body), f"multipart/form-data; boundary={boundary}"


def build_request(key, asset_type, path, mime, creator_id, creator_type):
    creator = {"groupId": str(creator_id)} if creator_type == "group" else {"userId": str(creator_id)}
    meta = {
        "assetType": asset_type,
        "displayName": f"KD {key}"[:50],
        "description": f"Keep Digging! asset {key}",
        "creationContext": {"creator": creator},
    }
    return multipart({"request": json.dumps(meta)}, "fileContent", path.name, path.read_bytes(), mime)


def call(method, url, api_key, body=None, content_type=None):
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("x-api-key", api_key)
    if content_type:
        req.add_header("Content-Type", content_type)
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode() or "{}")


def upload(key, asset_type, path, mime, api_key, creator_id, creator_type):
    body, ctype = build_request(key, asset_type, path, mime, creator_id, creator_type)
    op = call("POST", f"{API}/assets", api_key, body, ctype)
    name = op.get("path") or op.get("operationId")
    for _ in range(60):
        if op.get("done"):
            return int(op["response"]["assetId"])
        time.sleep(2)
        op = call("GET", f"{API}/{name}" if "/" in str(name) else f"{API}/operations/{name}", api_key)
    raise RuntimeError(f"upload of {key} did not finish")


def write_registry(tables):
    text = REGISTRY.read_text()

    def lua_table(d):
        if not d:
            return "{}"
        rows = ",\n".join(f'\t["{k}"] = {v}' for k, v in sorted(d.items()))
        return "{\n" + rows + ",\n}"

    block = (
        "-- BEGIN GENERATED (tools/upload_assets.py)\n"
        f"AssetRegistry.Models = {lua_table(tables['Models'])}\n"
        f"AssetRegistry.Images = {lua_table(tables['Images'])}\n"
        f"AssetRegistry.Sounds = {lua_table(tables['Sounds'])}\n"
        f"AssetRegistry.Animations = {lua_table(tables['Animations'])}\n"
        f"AssetRegistry.UploadedAt = {int(time.time())}\n"
        "-- END GENERATED"
    )
    text = re.sub(r"-- BEGIN GENERATED.*?-- END GENERATED", block, text, flags=re.S)
    REGISTRY.write_text(text)


def main():
    dry = "--dry-run" in sys.argv
    api_key = os.environ.get("ROBLOX_API_KEY")
    creator_id = os.environ.get("ROBLOX_CREATOR_ID")
    creator_type = os.environ.get("ROBLOX_CREATOR_TYPE", "user")
    if not dry and (not api_key or not creator_id):
        sys.exit("Set ROBLOX_API_KEY and ROBLOX_CREATOR_ID (see SETUP.md), or pass --dry-run.")
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    tables = {"Models": {}, "Images": {}, "Sounds": {}, "Animations": {}}
    for table, asset_type, folder, ext, mime in KINDS:
        if not folder.exists():
            continue
        for path in sorted(folder.glob(f"*{ext}")):
            key = path.stem
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            cached = cache.get(f"{table}/{key}")
            if cached and cached["hash"] == digest:
                tables[table][key] = cached["id"]
                continue
            if dry:
                body, _ = build_request(key, asset_type, path, mime, creator_id or "0", creator_type)
                print(f"[dry-run] {asset_type:9s} {key} ({len(body)} bytes)")
                continue
            asset_id = upload(key, asset_type, path, mime, api_key, creator_id, creator_type)
            print(f"uploaded {asset_type} {key} -> {asset_id}")
            tables[table][key] = asset_id
            cache[f"{table}/{key}"] = {"hash": digest, "id": asset_id}
            CACHE.write_text(json.dumps(cache, indent=1))
    if not dry:
        write_registry(tables)
        print(f"wrote {REGISTRY.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
