#!/usr/bin/env python3
"""Export a public Douban movie collection for the static cinema wall.

The field selection follows UlyC/DouBanExport's MIT-licensed browser script,
updated for the current movie collection markup and a JSON-based static site.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "films.json"
POSTER_DIR = ROOT / "assets" / "posters"
# Douban's image CDN currently serves its browser-check script to some highly
# specific desktop UA strings; its generic browser UA returns the image.
USER_AGENT = "Mozilla/5.0"


def fetch(url: str, attempts: int = 4) -> bytes:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
        "Referer": "https://movie.douban.com/",
    }
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read()
        except (urllib.error.URLError, TimeoutError):
            if attempt == attempts - 1:
                raise
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def text(node) -> str:
    return node.get_text(" ", strip=True) if node else ""


def parse_page(html: bytes) -> tuple[list[dict], int]:
    soup = BeautifulSoup(html, "html.parser")
    count_text = text(soup.select_one(".subject-num"))
    count_match = re.search(r"/\s*(\d+)", count_text)
    total = int(count_match.group(1)) if count_match else 0
    films: list[dict] = []

    for card in soup.select(".grid-view .item"):
        link = card.select_one(".title a")
        href = link.get("href", "").strip() if link else ""
        subject_match = re.search(r"/subject/(\d+)", href)
        if not subject_match:
            continue

        subject_id = subject_match.group(1)
        primary_title = text(card.select_one(".title em"))
        full_title = text(link)
        title = (primary_title or full_title).split("/")[0].strip()
        poster = card.select_one(".pic img")
        poster_url = poster.get("src", "").strip() if poster else ""
        intro = text(card.select_one(".intro"))
        year_match = re.search(r"(?:^|\s)(19\d{2}|20\d{2})(?:[-/\s]|$)", intro)
        rating_node = card.select_one('[class*="rating"][class*="-t"]')
        rating_match = re.search(r"rating(\d)-t", " ".join(rating_node.get("class", []))) if rating_node else None

        films.append(
            {
                "id": subject_id,
                "title": title,
                "fullTitle": full_title,
                "year": int(year_match.group(1)) if year_match else None,
                "rating": int(rating_match.group(1)) if rating_match else None,
                "watchedAt": text(card.select_one(".date")).replace("-", "/"),
                "comment": text(card.select_one(".comment")),
                "intro": intro,
                "url": href,
                "posterSource": poster_url,
                "poster": f"./assets/posters/{subject_id}.webp" if poster_url else "",
            }
        )

    return films, total


def collection_url(user_id: str, start: int) -> str:
    return (
        f"https://movie.douban.com/people/{user_id}/collect"
        f"?start={start}&sort=time&rating=all&filter=all&mode=grid"
    )


def fetch_collection(user_id: str, workers: int) -> list[dict]:
    first_html = fetch(collection_url(user_id, 0))
    first, total = parse_page(first_html)
    if not first or not total:
        raise RuntimeError("Douban returned no public movie collection data")

    starts = list(range(15, total, 15))
    pages: dict[int, list[dict]] = {0: first}

    def get_page(start: int) -> tuple[int, list[dict]]:
        page, _ = parse_page(fetch(collection_url(user_id, start)))
        print(f"collection {min(start + len(page), total):>4}/{total}", flush=True)
        return start, page

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for start, page in pool.map(get_page, starts):
            pages[start] = page

    films = [film for start in sorted(pages) for film in pages[start]]
    unique = {film["id"]: film for film in films}
    films = [unique[film["id"]] for film in films if unique.get(film["id"]) is film]
    if len(films) != total:
        print(f"warning: expected {total} films, parsed {len(films)}", flush=True)
    return films


def download_poster(film: dict, ffmpeg: str) -> tuple[str, bool]:
    source = film.get("posterSource")
    if not source:
        return film["id"], False
    output = POSTER_DIR / f"{film['id']}.webp"
    if output.exists() and output.stat().st_size > 1024:
        return film["id"], True
    output.unlink(missing_ok=True)

    jpg = POSTER_DIR / f".{film['id']}.jpg"
    try:
        jpg.write_bytes(fetch(source))
        command = [
            ffmpeg,
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(jpg),
            "-vf",
            "scale='min(420,iw)':-2",
            "-frames:v",
            "1",
            "-c:v",
            "libwebp",
            "-quality",
            "78",
            str(output),
        ]
        result = subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        return film["id"], output.exists()
    except subprocess.CalledProcessError as error:
        output.unlink(missing_ok=True)
        detail = error.stderr.decode("utf-8", errors="replace").strip().splitlines()
        print(f"poster {film['id']} failed: {detail[-1] if detail else error}", flush=True)
        return film["id"], False
    except Exception as error:
        output.unlink(missing_ok=True)
        print(f"poster {film['id']} failed: {error}", flush=True)
        return film["id"], False
    finally:
        jpg.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("user", help="Douban user ID or profile URL")
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--poster-workers", type=int, default=6)
    parser.add_argument("--ffmpeg", default="ffmpeg")
    parser.add_argument("--skip-posters", action="store_true")
    parser.add_argument("--posters-only", action="store_true")
    args = parser.parse_args()

    user_match = re.search(r"/people/([^/?]+)", args.user)
    user_id = user_match.group(1) if user_match else args.user.strip()
    if args.posters_only:
        payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        films = payload["films"]
    else:
        films = fetch_collection(user_id, max(1, min(args.workers, 4)))

    for film in films:
        film["title"] = film["title"].split("/")[0].strip()

    POSTER_DIR.mkdir(parents=True, exist_ok=True)
    if not args.skip_posters:
        completed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.poster_workers)) as pool:
            futures = [pool.submit(download_poster, film, args.ffmpeg) for film in films]
            for future in concurrent.futures.as_completed(futures):
                _, ok = future.result()
                completed += int(ok)
                if completed and completed % 50 == 0:
                    print(f"posters {completed:>4}/{len(films)}", flush=True)

    available = {path.stem for path in POSTER_DIR.glob("*.webp") if path.stat().st_size > 1024}
    for film in films:
        if film["id"] not in available:
            film["poster"] = film["posterSource"]

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": f"https://movie.douban.com/people/{user_id}/collect",
        "userId": user_id,
        "count": len(films),
        "updatedAt": time.strftime("%Y-%m-%d"),
        "films": films,
    }
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(films)} films to {DATA_FILE}", flush=True)


if __name__ == "__main__":
    main()
