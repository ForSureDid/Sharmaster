#!/usr/bin/env python3
"""
Scrape BK (БиКей/ProDecor) latex balloon photos from микрос.рф
Output: BK_<product name>_<article>.jpg in ./mikros_bk_photos/
"""

import os
import re
import json
import time
import html
import unicodedata
import urllib.request
import urllib.error

BASE_URL = "https://xn--h1aeekjh.xn--p1ai"
CATALOG_PATH = "/catalog/balls/apply/marka-is-767ff65d-46b2-11e7-891d-001517a211ff/"
TOTAL_PAGES = 8
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "mikros_bk_photos")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}


def clean_filename(s: str) -> str:
    s = html.unescape(s)
    s = unicodedata.normalize("NFC", s)
    # Replace chars not safe in filenames
    s = re.sub(r'[\\/*?:"<>|]', "", s)
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("/", "-").replace("\\", "-")
    # Trim to reasonable length
    return s[:120]


def fetch_page(page: int) -> str:
    url = BASE_URL + CATALOG_PATH
    if page > 1:
        url += f"?PAGEN_1={page}"
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_products(html_text: str) -> list[dict]:
    m = re.search(r"const catalogProducts = (\[.*?\]);\s*\n", html_text, re.S)
    if not m:
        return []
    try:
        arr = json.loads(m.group(1))  # outer JS array of JSON strings
    except json.JSONDecodeError:
        return []
    products = []
    for raw_str in arr:
        try:
            obj = json.loads(raw_str)
        except json.JSONDecodeError:
            continue
        props = obj.get("PROPERTYS", {}) or {}
        article = props.get("CML2_ARTICLE") or ""
        name = html.unescape(obj.get("NAME", ""))
        img_path = obj.get("DETAIL_PICTURE", "")
        if img_path:
            products.append({
                "name": name,
                "article": article,
                "img_url": BASE_URL + img_path,
                "img_ext": os.path.splitext(img_path)[1] or ".jpg",
            })
    return products


def download_image(url: str, dest_path: str) -> bool:
    if os.path.exists(dest_path):
        print(f"  SKIP (exists): {os.path.basename(dest_path)}")
        return False
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = resp.read()
        with open(dest_path, "wb") as f:
            f.write(data)
        return True
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code} for {url}")
        return False
    except Exception as e:
        print(f"  ERROR {e} for {url}")
        return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    all_products = []

    for page in range(1, TOTAL_PAGES + 1):
        print(f"Fetching page {page}/{TOTAL_PAGES}...")
        try:
            page_html = fetch_page(page)
        except Exception as e:
            print(f"  Failed to fetch page {page}: {e}")
            continue
        products = parse_products(page_html)
        print(f"  Found {len(products)} products")
        all_products.extend(products)
        if page < TOTAL_PAGES:
            time.sleep(1.0)

    print(f"\nTotal products: {len(all_products)}")
    print(f"Downloading to: {OUT_DIR}\n")

    downloaded = 0
    skipped = 0
    errors = 0

    for i, p in enumerate(all_products, 1):
        name_clean = clean_filename(p["name"])
        article_clean = clean_filename(p["article"]) if p["article"] else "no-article"
        filename = f"BK_{name_clean}_{article_clean}{p['img_ext']}"
        dest = os.path.join(OUT_DIR, filename)
        print(f"[{i}/{len(all_products)}] {filename}")
        ok = download_image(p["img_url"], dest)
        if ok:
            downloaded += 1
        elif os.path.exists(dest):
            skipped += 1
        else:
            errors += 1
        time.sleep(0.3)

    print(f"\nDone: {downloaded} downloaded, {skipped} skipped, {errors} errors")
    print(f"Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
