"""
Scrapes product images from new.starparty.kz category page.
Saves as: {article}_{name}_{qty}.{ext}
Run: python3 scripts/scrape-starparty.py
"""
import os, re, time, requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "https://new.starparty.kz"
CATEGORY_URL = f"{BASE_URL}/index.php?route=product/category&path=119&page={{page}}"
OUT_DIR = os.path.join(os.path.dirname(__file__), "../scraped-starparty")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def slugify(text: str) -> str:
    text = text.replace("/", "_")
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^\wЀ-ӿ._-]", "", text)
    text = re.sub(r"_+", "_", text)
    return text.strip("_")


def get_original_url(thumb_url: str) -> str:
    # /image/cache/catalog/UUID_830-350x350.jpg → /image/catalog/UUID_830.jpg
    url = thumb_url.replace("/image/cache/", "/image/")
    url = re.sub(r"-\d+x\d+(\.\w+)$", r"\1", url)
    return url


def parse_page(page: int) -> list[dict]:
    url = CATEGORY_URL.format(page=page)
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    products = []
    for card in soup.select(".catalog__card"):
        # Name from img alt (most reliable)
        img_el = card.select_one("img.owl-lazy")
        name = img_el.get("alt", "").strip() if img_el else ""
        if not name:
            title_el = card.select_one(".card__title a")
            name = title_el.get_text(strip=True) if title_el else ""

        # Article from span inside .card__article
        article = ""
        art_el = card.select_one(".card__article span")
        if art_el:
            article = art_el.get_text(strip=True)

        # Package quantity from .card__count
        qty = ""
        count_el = card.select_one(".card__count")
        if count_el:
            m = re.search(r"(\d+)\s*шт", count_el.get_text())
            if m:
                qty = m.group(1) + "шт"

        if not name or not img_el:
            continue

        thumb_url = img_el.get("src", "")
        if thumb_url and not thumb_url.startswith("http"):
            thumb_url = urljoin(BASE_URL, thumb_url)

        products.append({
            "name": name,
            "article": article,
            "qty": qty,
            "thumb_url": thumb_url,
            "orig_url": get_original_url(thumb_url) if thumb_url else "",
        })

    return products


def download_image(url: str, dest_path: str) -> bool:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            with open(dest_path, "wb") as f:
                f.write(resp.content)
            return True
    except Exception as e:
        print(f"  Error: {e}")
    return False


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Detect total pages
    resp = requests.get(CATEGORY_URL.format(page=1), headers=HEADERS, timeout=15)
    soup = BeautifulSoup(resp.text, "html.parser")
    last_page = 1
    for a in soup.select(".pagination a, .pagination li a"):
        text = a.get_text(strip=True)
        if text.isdigit():
            last_page = max(last_page, int(text))
    # Fallback: check link rel=next up to page 99
    for link in soup.select("link[rel='next']"):
        m = re.search(r"page=(\d+)", link.get("href", ""))
        if m:
            # If there's a next page from page 1, scan a bit further
            pass

    print(f"Found {last_page} pages")

    total_downloaded = 0
    total_skipped = 0
    total_failed = 0

    for page in range(1, last_page + 1):
        print(f"\n--- Page {page}/{last_page} ---")
        try:
            products = parse_page(page)
        except Exception as e:
            print(f"  Failed to parse page {page}: {e}")
            continue

        if not products:
            print("  No products found — stopping early")
            break

        for p in products:
            parts = [p["article"], slugify(p["name"]), p["qty"]]
            parts = [x for x in parts if x]
            filename_base = "_".join(parts)

            ext = os.path.splitext(p["orig_url"].split("?")[0])[-1].lower()
            if ext not in (".jpg", ".jpeg", ".png", ".webp"):
                ext = ".jpg"

            dest = os.path.join(OUT_DIR, filename_base + ext)

            if os.path.exists(dest):
                print(f"  SKIP {filename_base + ext}")
                total_skipped += 1
                continue

            # Try original size first, fall back to thumbnail
            downloaded = False
            for url in [p["orig_url"], p["thumb_url"]]:
                if url and download_image(url, dest):
                    print(f"  OK   {filename_base + ext}")
                    downloaded = True
                    total_downloaded += 1
                    break

            if not downloaded:
                print(f"  FAIL {p['name']}")
                total_failed += 1

            time.sleep(0.15)

    print(f"\nDone. Downloaded: {total_downloaded}, Skipped: {total_skipped}, Failed: {total_failed}")
    print(f"Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
