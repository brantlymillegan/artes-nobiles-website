"""Render the complete reader from the audited final-print Draft 254 sources.

Uses the same source manifest as the final-print videos. Source PDFs are read
only; cropped PDF intermediates and provenance stay in ignored output/.
Requires pypdf, Pillow, and pdftoppm (Poppler).
"""

from concurrent.futures import ThreadPoolExecutor, as_completed
from copy import copy, deepcopy
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ContentStream, FloatObject, NameObject, RectangleObject

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT = 1600, 1236
EDITION = "Draft 254 — Final print"


def sha(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def readable_text(page, folio=None):
    chunks = []
    removed = []

    def collect(text, current_matrix, text_matrix, _font, _size):
        x = text_matrix[4] * current_matrix[0] + text_matrix[5] * current_matrix[2] + current_matrix[4]
        y = text_matrix[4] * current_matrix[1] + text_matrix[5] * current_matrix[3] + current_matrix[5]
        trim = page.trimbox
        in_footer = float(trim.bottom) <= y < float(trim.bottom) + 60
        at_outer_edge = x < float(trim.left) + 60 or x > float(trim.right) - 60
        if folio is not None and text.strip() == str(folio) and in_footer and at_outer_edge:
            removed.append(text)
        else:
            chunks.append(text)

    page.extract_text(visitor_text=collect)
    assert len(removed) <= 1, "Only one printed page footer may be omitted."
    text = "".join(chunks)
    # InDesign represents each drop cap as a separate line in the PDF.
    text = re.sub(r"(?m)^([A-Z])\n(?=[a-z])", r"\1", text)
    text = re.sub(r"“\s+", "“", text)
    text = re.sub(r"\s+”", "”", text)
    text = re.sub(r"[ \t]+\n", "\n", text).strip()
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sequence", type=Path, default=ROOT / "output/book-animation/draft254-v1/assets/asset-sequence.json")
    parser.add_argument("--destination", type=Path, default=ROOT / "dist/assets/book/254")
    parser.add_argument("--review", type=Path, default=ROOT / "output/book-reader-assets-254/_private")
    args = parser.parse_args()
    args.destination.mkdir(parents=True, exist_ok=True)
    args.review.mkdir(parents=True, exist_ok=True)
    work = args.review / "render-work"
    work.mkdir(exist_ok=True)
    source = json.loads(args.sequence.read_text())
    assert source["revision"] == 254
    assert len(source["spreads"]) == 29
    source_hashes = {item["path"]: item["sha256"] for item in source["sources"]}
    for path, digest in source_hashes.items():
        assert sha(path) == digest, f"Final source changed: {path}"
    readers = {path: PdfReader(path) for path in source_hashes if path.endswith(".pdf")}
    faces = [source["cover"]]
    faces.extend(spread["sources_by_side"][side] for spread in source["spreads"] for side in ("left", "right"))
    faces.append(source["back_cover"])
    assert len(faces) == 60
    assert [face.get("folio") for face in faces[4:56]] == list(range(1, 53))

    # The public manifest retains the established accessible page labels and
    # physical reading order. Every transcript is extracted anew below.
    manifest = json.loads((ROOT / "dist/assets/book/152/manifest.json").read_text())
    manifest.update(edition=EDITION, approvedDate="2026-10-25", updatedDate="2026-11-12")
    titles = {
        13: "Annunciation with Saint Maxima (traditionally Margaret) and Saint Ansanus — Simone Martini and Lippo Memmi",
        30: "Glory to God in the Highest",
        36: "The Adoration of the Magi — Domenico Ghirlandaio",
    }
    native_colors = {
        (0.832, 0.575, 0.713, 0.193): (49, 89, 77),
        (0.233, 0.283, 0.549, 0): (206, 183, 126),
        (0.237, 0.682, 0.468, 0): (197, 107, 109),
        (0.378, 0.458, 0.727, 0): (175, 142, 84),
    }
    jobs = []
    for index, (entry, face) in enumerate(zip(manifest["pages"], faces)):
        assert entry["index"] == index
        reader = readers[face["source_pdf"]]
        original = reader.pages[face["source_pdf_page_1based"] - 1]
        page = copy(original)
        height = float(page.mediabox.height)
        x0, top, x1, bottom = face["crop_pt_from_top_left"]
        rect = RectangleObject([x0, height - bottom, x1, height - top])
        page.mediabox = rect
        page.cropbox = rect
        restored = 0
        if face.get("restore_native_rgb"):
            content = ContentStream(page.get_contents(), reader)
            for operation_index, (values, operation) in enumerate(content.operations):
                if operation not in (b"k", b"K"):
                    continue
                key = tuple(round(float(value), 3) for value in values)
                if key in native_colors:
                    content.operations[operation_index] = (
                        [FloatObject(value / 255) for value in native_colors[key]],
                        b"rg" if operation == b"k" else b"RG",
                    )
                    restored += 1
            assert restored == 9
            page[NameObject("/Contents")] = content
        entry["title"] = titles.get(index, entry["title"])
        entry["text"] = readable_text(original, face.get("folio"))
        entry.pop("pdfPage", None)
        entry["sourceDocument"] = "cover" if index in (0, 59) else "interior" if face.get("folio") else "endpapers"
        entry["sourcePage"] = face["source_pdf_page_1based"]
        entry["width"], entry["height"] = WIDTH, HEIGHT
        if face.get("plain_endpaper_rgb"):
            entry["text"] = ""
        intermediate = work / f"page-{index:03}.pdf"
        if not face.get("plain_endpaper_rgb"):
            writer = PdfWriter()
            writer.add_page(page)
            writer.write(intermediate)
            assert readable_text(PdfReader(intermediate).pages[0]) == readable_text(original)
        jobs.append({"entry": entry, "source": deepcopy(face), "pdf": intermediate, "paletteOperatorsRestored": restored})

    pdftoppm = shutil.which("pdftoppm") or "/opt/homebrew/bin/pdftoppm"

    def render(job):
        entry, face = job["entry"], job["source"]
        png = work / f"page-{entry['index']:03}.png"
        if face.get("plain_endpaper_rgb"):
            image = Image.new("RGB", (WIDTH, HEIGHT), tuple(face["plain_endpaper_rgb"]))
        else:
            subprocess.run([pdftoppm, "-png", "-singlefile", "-cropbox", "-scale-to-x", str(WIDTH), "-scale-to-y", str(HEIGHT), str(job["pdf"]), str(png.with_suffix(""))], check=True, capture_output=True)
            image = Image.open(png).convert("RGB")
        assert image.size == (WIDTH, HEIGHT)
        out = args.destination / entry["src"]
        lossless = entry["kind"] not in ("artwork", "cover")
        image.save(out, "WEBP", lossless=lossless, quality=100 if lossless else 92, method=6)
        with Image.open(out) as check:
            check.load()
            assert check.size == (WIDTH, HEIGHT)
        return {"index": entry["index"], "file": entry["src"], "sha256": sha(out), "bytes": out.stat().st_size, "lossless": lossless, "source": face, "paletteOperatorsRestored": job["paletteOperatorsRestored"]}

    completed = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        for future in as_completed(executor.submit(render, job) for job in jobs):
            completed.append(future.result())
            print(f"Rendered {len(completed)}/60: {completed[-1]['file']}", flush=True)
    completed.sort(key=lambda item: item["index"])
    for path, digest in source_hashes.items():
        assert sha(path) == digest, f"Source mutated: {path}"
    (args.destination / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    provenance = {"edition": EDITION, "sourceSequence": str(args.sequence), "sourceSequenceSha256": sha(args.sequence), "manifestSha256": sha(args.destination / "manifest.json"), "originalSourcesUnchanged": True, "uniqueInteriorFolios": list(range(1, 53)), "pageCount": 60, "pageDimensions": [WIDTH, HEIGHT], "sourceHashes": source_hashes, "pages": completed}
    (args.review / "provenance-and-checks.json").write_text(json.dumps(provenance, indent=2) + "\n")
    sheet = Image.new("RGB", (1500, 230 * 10), "#e6e4de")
    draw = ImageDraw.Draw(sheet)
    for entry in manifest["pages"]:
        x, y = (entry["index"] % 6) * 250, (entry["index"] // 6) * 230
        with Image.open(args.destination / entry["src"]) as image:
            image.thumbnail((240, 185))
            sheet.paste(image, (x + 5, y + 30))
        draw.text((x + 5, y + 8), f"{entry['index']:02}: {entry['label']}", fill="#202520")
    sheet.save(args.review / "all-pages-contact.jpg", quality=92)
    shutil.rmtree(work)
    print(json.dumps({"edition": EDITION, "pages": 60, "bytes": sum(item["bytes"] for item in completed), "destination": str(args.destination)}))


if __name__ == "__main__":
    main()
