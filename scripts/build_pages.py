"""Validate and stage only the files intended for the public website."""

from html.parser import HTMLParser
from pathlib import Path
import re
import json
import shutil
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist"
DESTINATION = ROOT / "_site"
PUBLIC_FILES = (
    "index.html",
    "thechristmasstory/index.html",
    "thechristmasstory/book-page.css",
    "thechristmasstory/book-film.js",
    "thechristmasstory/book-navigation.js",
    "styles.css",
    "theme.js",
    "logo.js",
    "book-reader.js",
    "book-reader.css",
    "rosarium-video.js",
    "assets/rosarium-demo-light-v6.mp4",
    "assets/rosarium-demo-dark-v6.mp4",
    "assets/rosarium-video-poster-light.png",
    "assets/rosarium-video-poster-dark.png",
    "assets/rosarium-app-icon.png",
    "assets/vendor/page-flip-2.0.7.js",
    "assets/vendor/page-flip-LICENSE.txt",
    "assets/book/152/manifest.json",
    "assets/book/film-152/light.mp4",
    "assets/book/film-152/dark.mp4",
    "assets/book/film-152/poster-light.jpg",
    "assets/book/film-152/poster-dark.jpg",
    "favicon.ico",
    "og.png",
    "CNAME",
    ".nojekyll",
    "assets/app-store-badge.svg",
    "assets/christmas-story-cover.png",
    "assets/company-logo-black.svg",
    "assets/company-logo-white.svg",
    "assets/company-logo-animated-black.svg",
    "assets/company-logo-animated-white.svg",
    "assets/logo-motion.js",
    "assets/dm-sans-regular.ttf",
    "assets/noto-serif-variable.ttf",
    "assets/favicon.svg",
    "assets/google-play-badge.svg",
)


BOOK_DIRECTORY = "assets/book/152/"
book_manifest = json.loads((SOURCE / BOOK_DIRECTORY / "manifest.json").read_text())
book_pages = book_manifest["pages"]
if book_manifest["edition"] != "Draft 152 — Canonical":
    raise ValueError("The reader must use the approved Canonical 152 edition.")
if len(book_pages) != 60 or book_manifest["titlePageIndex"] != 6:
    raise ValueError("The reader must include all 52 printed pages, six endpaper faces, and both covers.")
expected_book_order = [f"page-{i:03}.webp" for i in range(60)]
if [page["src"] for page in book_pages] != expected_book_order:
    raise ValueError("Book pages must retain the complete source reading order.")
if [page.get("printedPage") for page in book_pages[4:56]] != list(range(1, 53)):
    raise ValueError("All 52 printed pages must be present in sequence.")
if [page["index"] for page in book_pages if page["density"] == "hard"] != [0, 59]:
    raise ValueError("Only the front and back covers should be hard pages.")
book_assets = []
for page in book_pages:
    if not re.fullmatch(r"(?:page-\d{3}|blank-inside-back)\.webp", page["src"]):
        raise ValueError(f"Unexpected public book asset: {page['src']}")
    if not page.get("label") or page["width"] != 1600 or page["height"] != 1236:
        raise ValueError("Book pages must have labels and preserve the rendered page dimensions.")
    book_assets.append(BOOK_DIRECTORY + page["src"])
if len(set(book_assets)) != len(book_assets):
    raise ValueError("The reader must not repeat or omit source image files.")
PUBLIC_FILES += tuple(book_assets)

# Keep earlier editions' URLs valid for visitors with a reader already open.
for edition in (126, 137):
    directory = f"assets/book/{edition}/"
    previous_pages = json.loads((SOURCE / directory / "manifest.json").read_text())["pages"]
    PUBLIC_FILES += (directory + "manifest.json",) + tuple(directory + page["src"] for page in previous_pages)


class PageReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.ids = set()

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if "id" in attributes:
            self.ids.add(attributes["id"])
        for name in ("href", "src", "poster", "data-logo-src", "data-light-src", "data-dark-src", "data-light-poster", "data-dark-poster"):
            if attributes.get(name):
                self.references.append(attributes[name])
        if tag == "meta" and (attributes.get("property") or attributes.get("name")) in {
            "og:image", "og:image:secure_url", "twitter:image"
        }:
            if attributes.get("content"):
                self.references.append(attributes["content"])


def build():
    allowed = set(PUBLIC_FILES)
    for name in PUBLIC_FILES:
        file = SOURCE / name
        if not file.is_file() or file.is_symlink():
            raise ValueError(f"Missing file or unsupported symlink: {name}")
        if file.resolve() != file.absolute():
            raise ValueError(f"Public file must not use a symlinked directory: {name}")
        if file.suffix == ".pdf":
            raise ValueError("The book PDF must never be included in the website.")
        if file.suffix == ".svg":
            ET.parse(file)

    if (SOURCE / "CNAME").read_text().strip() != "artesnobiles.com":
        raise ValueError("The production domain must be artesnobiles.com.")

    documents = {}
    references = []
    for name in PUBLIC_FILES:
        if name.endswith(".html"):
            page = PageReferences()
            page.feed((SOURCE / name).read_text())
            documents[name] = page
            references.extend((name, reference) for reference in page.references)
        elif name.endswith(".css"):
            references.extend((name, reference) for reference in re.findall(
                r"url\(\s*['\"]?([^\s)'\"]+)", (SOURCE / name).read_text()
            ))

    for origin, reference in references:
        url = urlsplit(urljoin("https://artesnobiles.com/" + origin, reference))
        if url.scheme != "https" or url.netloc != "artesnobiles.com":
            continue
        name = unquote(url.path).lstrip("/")
        # GitHub Pages serves directory index routes with or without a trailing slash.
        if not name or name.endswith("/"):
            name += "index.html"
        elif name not in allowed and name + "/index.html" in allowed:
            name += "/index.html"
        if name not in allowed:
            raise ValueError(f"Referenced asset is not in PUBLIC_FILES: {origin}: {reference}")
        if url.fragment and name in documents and unquote(url.fragment) not in documents[name].ids:
            raise ValueError(f"Broken page anchor: {origin}: {reference}")

    if DESTINATION.is_symlink():
        raise ValueError("The staging directory must not be a symlink.")
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    DESTINATION.mkdir()
    for name in PUBLIC_FILES:
        target = DESTINATION / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SOURCE / name, target)
    total = sum((DESTINATION / name).stat().st_size for name in PUBLIC_FILES)
    print(f"Ready: {len(PUBLIC_FILES)} public files, {total:,} bytes, in {DESTINATION}")


if __name__ == "__main__":
    build()
