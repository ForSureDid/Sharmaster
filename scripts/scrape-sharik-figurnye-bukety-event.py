#!/usr/bin/env python3
"""
Backfills the "Событие" (occasion) property for all 1625 products already scraped
into scraped-sharik-figurnye-bukety/raw.jsonl by scrape-sharik-figurnye-bukety.py.

The original scraper's extract_raw() only pulled a fixed set of columns from
window.__INITIAL_STATE__["product"]["product"]["properties"] and did not keep
"Событие" (nor the full raw properties list), so this field must be re-fetched
from each product's detail page. Confirmed present on window.__INITIAL_STATE__
under the same properties array as Коллекция/Цвет фольга, e.g.:
  Событие = "Я родился"  (on "Р ФИГУРА С РОЖДЕНИЕМ ДОЧКИ Коляска")
  Событие = "Праздник"   (on "К ФИГУРА Торт кремовый С ДНЕМ РОЖДЕНИЯ")
Absent (blank) on many generic figures — that's real, not a bug.

URL pattern reused from raw.jsonl's "Ссылка" column (already-known product URLs;
no re-crawl of listing pages needed).

Two-phase, resumable:
  - Reads product URLs + ids from scraped-sharik-figurnye-bukety/raw.jsonl
  - Fetches each detail page -> extracts "Событие" from properties
  - Checkpoint: scraped-sharik-figurnye-bukety/event.jsonl (append-only,
    one {"id":..., "Событие":...} per line). Re-running skips ids already present.

Run: python3 scripts/scrape-sharik-figurnye-bukety-event.py
Then: python3 scripts/build-sharik-figurnye-bukety-xlsx.py   (merges into final xlsx)
"""

import os
import re
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "scraped-sharik-figurnye-bukety")
RAW_FILE = os.path.join(OUT_DIR, "raw.jsonl")
EVENT_FILE = os.path.join(OUT_DIR, "event.jsonl")
EVENT_ERRORS_FILE = os.path.join(OUT_DIR, "event_errors.jsonl")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}

INITIAL_STATE_RE = re.compile(r"window\.__INITIAL_STATE__\s*=\s*")


def fetch_initial_state(url: str) -> dict:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    html = resp.text
    for s in re.findall(r"<script[^>]*>(.*?)</script>", html, re.S):
        if "__INITIAL_STATE__" not in s:
            continue
        m = INITIAL_STATE_RE.search(s)
        if not m:
            continue
        raw = s[m.end():].strip()
        decoder = json.JSONDecoder()
        obj, _ = decoder.raw_decode(raw)
        return obj
    raise ValueError(f"__INITIAL_STATE__ not found on {url}")


def fetch_with_retry(url: str, tries: int = 4, delay: float = 1.5) -> dict:
    last_err = None
    for i in range(tries):
        try:
            return fetch_initial_state(url)
        except Exception as e:
            last_err = e
            time.sleep(delay * (i + 1))
    raise last_err


def load_targets():
    targets = []
    seen = set()
    with open(RAW_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            if row["id"] in seen:
                continue
            seen.add(row["id"])
            targets.append({"id": row["id"], "url": row["Ссылка"]})
    return targets


def load_done_ids() -> set:
    ids = set()
    if os.path.exists(EVENT_FILE):
        with open(EVENT_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    ids.add(json.loads(line)["id"])
                except Exception:
                    pass
    return ids


def scrape_one(item: dict):
    obj = fetch_with_retry(item["url"])
    product = obj["product"]["product"]
    if not product:
        raise ValueError("empty product state")
    props = {p["name"]: p["value"] for p in product.get("properties", [])}
    return {"id": item["id"], "Событие": props.get("Событие", "")}


def main():
    targets = load_targets()
    print(f"{len(targets)} products in raw.jsonl.")
    done_ids = load_done_ids()
    todo = [t for t in targets if t["id"] not in done_ids]
    print(f"{len(done_ids)} already have Событие scraped, {len(todo)} remaining.")

    if not todo:
        print("Nothing to do.")
        return

    # verification sample: first 3
    print("\nVerification sample (first 3):")
    for item in todo[:3]:
        row = scrape_one(item)
        print(f"  id={row['id']} Событие={row['Событие']!r} url={item['url']}")
        done_ids.add(row["id"])
        with open(EVENT_FILE, "a", encoding="utf-8") as out_f:
            out_f.write(json.dumps(row, ensure_ascii=False) + "\n")
    todo = [t for t in todo if t["id"] not in done_ids]

    if not todo:
        print("Done (sample covered everything remaining).")
        return

    written = 0
    failed = 0
    with open(EVENT_FILE, "a", encoding="utf-8") as out_f, open(EVENT_ERRORS_FILE, "a", encoding="utf-8") as err_f:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(scrape_one, it): it for it in todo}
            done_count = 0
            for fut in as_completed(futures):
                it = futures[fut]
                done_count += 1
                try:
                    row = fut.result()
                    out_f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    out_f.flush()
                    written += 1
                except Exception as e:
                    print(f"  ERROR id={it['id']}: {e}")
                    err_f.write(json.dumps({"id": it["id"], "url": it["url"], "error": str(e)}, ensure_ascii=False) + "\n")
                    err_f.flush()
                    failed += 1
                if done_count % 100 == 0:
                    print(f"  {done_count}/{len(todo)} processed ({written} ok, {failed} failed)")

    print(f"\nDone. Wrote {written} new rows to {EVENT_FILE} ({failed} failed, see {EVENT_ERRORS_FILE})")


if __name__ == "__main__":
    main()
