"""Offline same-source comparison using Slay-the-Heavens' contour fitter."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import Polygon

NAMES = ("turtle", "rabbit", "cat", "penguin", "giraffe", "whale")
EYES = ((440, 240), (865, 214), (1387, 178), (314, 611), (844, 519), (1334, 753))
SIZE = 88


def load_module(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def crop_source(sheet, cell):
    column, row = cell % 3, cell // 3
    left, right = column * sheet.width // 3, (column + 1) * sheet.width // 3
    if cell == 5:
        left = round(sheet.width * 970 / 1536)
    cut = round(sheet.height * 438 / 1024)
    top, bottom = (0, cut) if row == 0 else (cut, sheet.height)
    image = sheet.crop((left, top, right, bottom)).convert("RGB")
    pixels = np.asarray(image, dtype=np.int16)
    foreground = (pixels.min(axis=2) < 155) | (np.ptp(pixels, axis=2) > 42)
    contours, _ = cv2.findContours(foreground.astype("uint8"), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    outline = max(contours, key=cv2.contourArea)
    mask = np.zeros(foreground.shape, dtype="uint8")
    cv2.drawContours(mask, [outline], 0, 255, cv2.FILLED)
    image.putalpha(Image.fromarray(mask))
    bounds = image.getbbox()
    image = image.crop(bounds)
    width, height = image.size
    image.thumbnail((SIZE - 8, SIZE - 8), Image.Resampling.LANCZOS)
    x = (SIZE - image.width) // 2
    y = (SIZE - image.height) // 2
    source = Image.new("RGBA", (SIZE, SIZE))
    source.alpha_composite(image, (x, y))
    eye_x, eye_y = EYES[cell]
    eye = ((eye_x * sheet.width / 1536 - left - bounds[0]) * image.width / width + x,
           (eye_y * sheet.height / 1024 - top - bounds[1]) * image.height / height + y)
    return source, eye


def packed_fit(fitter, placement, parts, budget):
    lower, upper = 0.08, 65
    chosen = []
    for _ in range(12):
        epsilon = (lower + upper) / 2
        shapes = fitter.geometry(parts, epsilon, SIZE, SIZE, placement.place)
        if sum(shape["cost"] for shape in shapes) > budget:
            lower = epsilon
        else:
            upper, chosen = epsilon, shapes
    return chosen, upper


def fit(fitter, placement, source, eye, output, budgets, common):
    matte = Image.new("RGBA", source.size, "#f5f2e8")
    reference = Image.alpha_composite(matte, source).convert("RGB")
    mask = np.asarray(source.getchannel("A")) >= 128
    contours, _ = cv2.findContours(mask.astype("uint8"), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    polygon = Polygon(max(contours, key=cv2.contourArea)[:, 0, :]).buffer(0)
    outline = max(fitter.polygons(polygon), key=lambda part: part.area)
    pixels = np.asarray(reference)[mask]
    base_colour = np.median(pixels, axis=0).astype(int).tolist()
    segmentation = np.asarray(reference).copy()
    segmentation[~mask] = [255, 0, 255]
    parts = []
    for polygon, colour in fitter.regions(segmentation, colors=18, minimum_area=2, spatial=4, color_range=13):
        red, green, blue = colour
        if red > 230 and green < 30 and blue > 230:
            continue
        for part in fitter.polygons(polygon.intersection(outline)):
            if part.area >= 2:
                parts.append((part, colour))
    output.mkdir(parents=True, exist_ok=True)
    source.save(output / "source.png")
    x, y = eye
    face = [dict(type="ellipse", box=[x - 3.4, y - 2.4, 6.8, 4.8], colour="#fff1d3", cost=1),
            dict(type="ellipse", box=[x - 0.6, y - 2.6, 3.6, 4.2], colour="#4b2632", cost=1)]
    for budget in budgets:
        base, outline_epsilon = packed_fit(fitter, placement, [(outline, base_colour)], budget * 2 // 5)
        detail_budget = budget - len(face) - sum(shape["cost"] for shape in base)
        details, region_epsilon = packed_fit(fitter, placement, parts, detail_budget)
        chosen = base + details + face
        assert chosen, f"No native shapes for {output.name} at {budget}"
        preview = Image.new("RGBA", source.size)
        canvas = ImageDraw.Draw(preview)
        for shape in chosen:
            if shape["type"] in ("rect", "ellipse"):
                x, y, w, h = shape["box"]
                draw = canvas.ellipse if shape["type"] == "ellipse" else canvas.rectangle
                draw((x, y, x + w, y + h), fill=shape["colour"])
            else:
                canvas.polygon([tuple(point) for point in shape["points"]], fill=shape["colour"])
        result = Image.alpha_composite(matte, preview).convert("RGB")
        result.save(output / f"fit-{budget}.png")
        error = np.abs(np.asarray(result, dtype=float) - np.asarray(reference, dtype=float))
        pack = dict(common, width=SIZE, height=SIZE, budget=budget,
                    nativeImages=sum(shape["cost"] for shape in chosen),
                    outlineEpsilon=outline_epsilon, regionEpsilon=region_epsilon,
                    foregroundRgbMeanAbsoluteError=round(float(error[mask].mean()), 3),
                    shapes=chosen)
        (output / f"fit-{budget}.json").write_text(json.dumps(pack) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slay", type=Path)
    parser.add_argument("sheet", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    fitter = load_module(args.slay / "scripts/art/segment-lowpoly.py")
    placement = load_module(args.slay / "scripts/art/native-triangle-placement.py")
    common = dict(sheetSha256=digest(args.sheet), fitterSha256=digest(Path(fitter.__file__)),
                  placementSha256=digest(Path(placement.__file__)))
    sheet = Image.open(args.sheet)
    for index, name in enumerate(NAMES):
        source, eye = crop_source(sheet, index)
        fit(fitter, placement, source, eye, args.output / name, (24, 40, 64), common)


if __name__ == "__main__":
    main()
