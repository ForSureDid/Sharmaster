#!/usr/bin/env python3
"""
Scrapes Betalic foil balloon products from new.sharik.ru.
URL: https://new.sharik.ru/tovary-dly-prazdnika-cat/folgirovannye-shary/?properties=49040

Saves as: Betalic_<full name>_<code>.<ext>
Run: python3 scripts/scrape-sharik-betalic.py
"""

import os
import re
import json
import time
import requests
from urllib.parse import urljoin

BASE_URL = "https://new.sharik.ru"
CATEGORY_URL = (
    BASE_URL
    + "/tovary-dly-prazdnika-cat/folgirovannye-shary/"
    "?properties=49040&page={page}"
)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "scraped-sharik-betalic")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}


def clean_filename(s: str) -> str:
    s = re.sub(r'[\\/*?:"<>|]', "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("/", "-")
    return s[:120]


def fetch_products(page: int) -> tuple[list[dict], int]:
    url = CATEGORY_URL.format(page=page)
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.text

    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.S)
    for s in scripts:
        if "__INITIAL_STATE__" not in s:
            continue
        m = re.search(r"window\.__INITIAL_STATE__\s*=\s*", s)
        if not m:
            continue
        raw = s[m.end():].strip()
        decoder = json.JSONDecoder()
        obj, _ = decoder.raw_decode(raw)
        prod_data = obj["product"]["products"]
        return prod_data["items"], prod_data["count"]

    return [], 0


def download_image(url: str, dest_path: str) -> bool:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code == 200:
            with open(dest_path, "wb") as f:
                f.write(resp.content)
            return True
        print(f"  HTTP {resp.status_code} for {url}")
    except Exception as e:
        print(f"  Error: {e}")
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    print("Fetching page 1 to determine total...")
    items, total = fetch_products(1)
    per_page = len(items)
    if per_page == 0:
        print("No products found on page 1. Exiting.")
        return

    total_pages = (total + per_page - 1) // per_page
    print(f"Total products: {total}, per page: {per_page}, pages: {total_pages}")
    print()

    all_items = list(items)

    for page in range(2, total_pages + 1):
        print(f"Fetching page {page}/{total_pages}...")
        try:
            items, _ = fetch_products(page)
            all_items.extend(items)
            print(f"  Got {len(items)} products")
        except Exception as e:
            print(f"  Failed: {e}")
        time.sleep(0.5)

    print(f"\nTotal items collected: {len(all_items)}")
    print(f"Downloading to: {OUT_DIR}\n")

    downloaded = 0
    skipped = 0
    errors = 0

    for i, item in enumerate(all_items, 1):
        name = item.get("name", "").strip()
        code = item.get("code", "").strip()
        images = item.get("images", [])

        base_img = next((img for img in images if img.get("is_base")), None)
        if not base_img and images:
            base_img = images[0]

        if not base_img:
            print(f"[{i}] SKIP (no image): {name}")
            errors += 1
            continue

        img_path = base_img.get("image", "")
        if not img_path:
            print(f"[{i}] SKIP (no image path): {name}")
            errors += 1
            continue

        img_url = urljoin(BASE_URL, img_path)
        ext = os.path.splitext(img_path.split("?")[0])[-1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"

        name_clean = clean_filename(name)
        code_clean = clean_filename(code) if code else "no-code"
        filename = f"Betalic_{name_clean}_{code_clean}{ext}"
        dest = os.path.join(OUT_DIR, filename)

        print(f"[{i}/{len(all_items)}] {filename}")

        if os.path.exists(dest):
            print(f"  SKIP (exists)")
            skipped += 1
            continue

        if download_image(img_url, dest):
            downloaded += 1
        else:
            errors += 1

        time.sleep(0.2)

    print(f"\nDone: {downloaded} downloaded, {skipped} skipped, {errors} errors")
    print(f"Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
