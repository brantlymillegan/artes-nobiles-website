"""Validate and stage only the files intended for the public website."""

from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "dist"
DESTINATION = ROOT / "_site"
PUBLIC_FILES = (
    "index.html",
    "styles.css",
    "theme.js",
    "logo.js",
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
    "assets/galaxy-s26-front.png",
    "assets/google-play-badge.svg",
    "assets/rosarium-home-light.png",
    "assets/rosarium-home-dark.png",
)


class PageReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.references = []
        self.ids = set()

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if "id" in attributes:
            self.ids.add(attributes["id"])
        for name in ("href", "src", "data-logo-src"):
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

    page = PageReferences()
    page.feed((SOURCE / "index.html").read_text())
    references = page.references + re.findall(
        r"url\(\s*['\"]?([^\s)'\"]+)", (SOURCE / "styles.css").read_text()
    )
    for reference in references:
        url = urlsplit(reference)
        if url.scheme or url.netloc:
            if url.scheme == "https" and url.netloc == "artesnobiles.com":
                name = unquote(url.path).lstrip("/") or "index.html"
                if name not in allowed:
                    raise ValueError(f"Referenced site file is not in PUBLIC_FILES: {reference}")
            continue
        if url.path:
            name = unquote(url.path)
            if name not in allowed:
                raise ValueError(f"Referenced asset is not in PUBLIC_FILES: {reference}")
        elif url.fragment and unquote(url.fragment) not in page.ids:
            raise ValueError(f"Broken page anchor: {reference}")

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
