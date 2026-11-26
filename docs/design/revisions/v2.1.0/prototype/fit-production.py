"""Fit six original animal concepts to bounded, mask-free Miliastra controls."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw
import shapely
from shapely.geometry import Polygon

SIZE = 88
COLUMNS = 3
MATTE = "#f5f2e8"


def poly(colour, *points):
    return ("polygon", colour, points)


def oval(colour, x, y, w, h):
    return ("ellipse", colour, (x - w / 2, y - h / 2, w, h))


# Large colour masses and individual landmarks are registered to the original
# transparent 88-pixel contact crops. Positions below are in source Y-down units.
ART = {
    "turtle": {
        "fill": "#8f895b",
        "contours": [
            poly("#385f52", (13, 44), (19, 33), (29, 25), (41, 22), (51, 24), (63, 32),
                 (59, 42), (46, 47), (29, 48)),
            poly("#849d73", (19, 34), (30, 26), (43, 22), (54, 26), (45, 31), (33, 33), (27, 37)),
            poly("#b7ad73", (9, 48), (17, 44), (28, 48), (45, 48), (61, 41), (55, 49),
                 (43, 53), (27, 54), (15, 51)),
            oval("#d7b975", 34, 55, 13, 8),
            oval("#5b6b4e", 51, 58, 6, 8),
            oval("#657451", 14, 57, 7, 4),
            oval("#e7ad53", 68, 39, 5, 3.5),
            oval("#fff0cb", 72, 34, 7, 6),
            oval("#512c34", 74, 34, 4, 5),
            oval("#5b3434", 80, 34, 2.3, 1.7),
        ],
    },
    "rabbit": {
        "fill": "#b18465",
        "contours": [
            oval("#f2d7a1", 33, 51, 51, 31),
            oval("#d6aa7a", 24, 59, 24, 20),
            oval("#ebcd9e", 10, 58, 7.6, 10.7),
            oval("#f6dfb6", 51, 45, 35, 41),
            oval("#f8e3bd", 66, 32, 29, 31),
            poly("#875749", (53, 27), (47, 43), (39, 56), (33, 60), (30, 56),
                 (32, 46), (42, 34)),
            poly("#d98f71", (51, 28), (46, 41), (39, 52), (33, 57), (33, 50), (40, 38)),
            oval("#f5dfb9", 39, 67, 27, 7),
            oval("#e5c395", 60, 65, 12, 8),
            oval("#fff0cd", 77.8, 39, 10, 9.2),
            oval("#754944", 76.5, 41.0, 5.7, 2.5),
            oval("#92574f", 81.1, 35.2, 3.4, 3.0),
            oval("#f9e9ca", 67.2, 30.5, 6.3, 5.7),
            oval("#4b292d", 68.6, 30.5, 4.5, 5.4),
            oval("#f4c5a1", 73, 39.5, 4.2, 2.7),
        ],
    },
    "cat": {
        "fill": "#8d4f3d",
        "contours": [
            oval("#d88b45", 33, 53, 45, 31),
            oval("#d88b45", 62, 41, 33, 30),
            poly("#cd763a", (19, 35), (10, 32), (7, 23), (9, 16), (15, 11), (22, 12),
                 (18, 18), (15, 24), (18, 32)),
            oval("#f7deae", 26, 15, 12, 10),
            poly("#f2ac7d", (49, 21), (57, 27), (50, 32)),
            poly("#efb081", (63, 24), (67, 17), (70, 27)),
            oval("#f7dba4", 63, 54, 22, 26),
            oval("#f8dfae", 72, 43, 12, 12),
            oval("#f5d9a5", 67, 73, 14, 5.5),
            oval("#f5d9a5", 24, 73, 11, 5.5),
            poly("#8e4d38", (22, 42), (29, 38), (25, 53)),
            poly("#8e4d38", (35, 37), (42, 38), (35, 51)),
            oval("#fbe7bc", 64.0, 33.5, 8, 7),
            oval("#4a272d", 65.8, 33.6, 5.5, 6.5),
            oval("#63382f", 74.6, 36.9, 3.9, 2.6),
            oval("#99614a", 76.0, 41.0, 3.4, 2),
        ],
    },
    "penguin": {
        "fill": "#433c50",
        "contours": [
            oval("#4b5c72", 38, 50, 30, 44),
            poly("#ecb445", (36, 19), (41, 12), (46, 20), (55, 21), (59, 24), (49, 31),
                 (44, 26), (38, 26)),
            oval("#f4dfb4", 52, 53, 29, 49),
            poly("#4b5d72", (36, 34), (43, 38), (43, 50), (39, 65), (34, 71), (30, 68), (30, 55)),
            poly("#e9924e", (59, 13), (67, 9.4), (65, 12.5), (60, 15.7)),
            oval("#4c5264", 38, 79, 15, 4.5),
            oval("#4c5264", 56, 78, 11, 4.4),
            oval("#f6dfb8", 51, 13, 7.2, 6.4),
            oval("#39252f", 52.7, 12.9, 4.8, 6.1),
        ],
    },
    "giraffe": {
        "fill": "#92543b",
        "body": [(18, 56), (22, 55), (25, 50), (35, 46), (43, 38), (47, 19),
                 (43, 13), (48, 10), (51, 11), (50, 5), (53, 5), (55, 10),
                 (58, 10), (57, 4), (59, 4), (60, 10), (70, 16), (70, 19),
                 (65, 21), (57, 21), (54, 42), (56, 52), (51, 60), (37, 62),
                 (29, 61), (23, 66), (18, 70), (16, 67)],
        "contours": [
            # The two front legs and the nearest hind leg stay separated all
            # the way to their hooves. Far legs read as darker silhouettes.
            poly("#98583b", (30, 57), (37, 58), (34, 69), (38, 81), (32, 82), (29, 72)),
            poly("#a9633f", (47, 55), (52, 56), (50, 69), (54, 82), (46, 82), (44, 69)),
            poly("#e7a354", (25, 55), (42, 58), (32, 65), (27, 72), (26, 81), (20, 81),
                 (23, 70)),
            poly("#f0b467", (43, 55), (47, 56), (45, 68), (45, 78), (47, 81), (41, 81),
                 (41, 64)),
            poly("#eba754", (24, 54), (32, 49), (41, 45), (45, 38), (49, 20), (53, 13),
                 (60, 11), (66, 17), (57, 20), (55, 31), (54, 44), (55, 54), (48, 59),
                 (39, 60), (32, 59)),
            oval("#f8ca71", 61, 16.4, 18.5, 8.6),
            oval("#f4bc75", 48.5, 13, 9, 4.3),
            oval("#d0773b", 48, 39, 5.5, 7.8),
            oval("#cf7838", 41, 49, 6.2, 7.4),
            oval("#d0773b", 33, 54, 5.4, 6.2),
            oval("#d0773b", 51, 27, 4.8, 6.0),
            oval("#fbe3a8", 58.6, 15.3, 5.6, 4.8),
            oval("#49312d", 60.1, 15.2, 3.7, 4.8),
            oval("#623a36", 23, 81.8, 7.0, 2.8),
            oval("#623a36", 44, 81.7, 7.9, 2.8),
        ],
    },
    "whale": {
        "fill": "#496681",
        "contours": [
            poly("#85a9b4", (5, 13), (10, 16), (17, 16), (21, 22), (25, 18), (31, 17),
                 (32, 23), (28, 27), (18, 27), (15, 37), (12, 27), (8, 24)),
            poly("#f4ddb2", (14, 56), (26, 60), (37, 61), (50, 56), (61, 51), (69, 38),
                 (73, 34), (81, 30), (81, 41), (78, 51), (69, 62), (62, 67), (48, 70),
                 (37, 69), (28, 67), (20, 63)),
            poly("#7ba2b0", (23, 72), (38, 57), (46, 53), (44, 61), (38, 70), (29, 75)),
            oval("#f2d8a5", 45, 41, 11, 4.7),
            oval("#f9e5be", 57.3, 42.6, 6.5, 6.2),
            oval("#492c38", 58.7, 41.2, 4.4, 5.1),
            oval("#8f6657", 77.3, 38.8, 1.8, 2.8),
        ],
    },
}


def load_module(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def polygon_parts(geometry):
    if geometry.geom_type == "Polygon":
        yield geometry
    elif hasattr(geometry, "geoms"):
        for child in geometry.geoms:
            yield from polygon_parts(child)


def triangles(polygon, colour, placement, minimum=0.8):
    shapes = []
    for part in polygon_parts(shapely.make_valid(polygon)):
        for triangle in shapely.constrained_delaunay_triangles(part).geoms:
            if triangle.area < minimum:
                continue
            vertices = list(triangle.exterior.coords)[:-1]
            try:
                native = placement.place(vertices, SIZE)
            except placement.PlacementUnavailable:
                return None
            for points, transform in native:
                shapes.append(dict(type="nativeTriangle", points=points, placement=transform,
                                   colour=colour, cost=1))
    return shapes


def bounded_contour(polygon, colour, placement, allowance, tolerance=0.4):
    kept = []
    for epsilon in np.geomspace(tolerance, 28, 36):
        contour = polygon.simplify(epsilon, preserve_topology=True)
        candidate = triangles(contour, colour, placement)
        if candidate and len(candidate) <= allowance:
            kept = candidate
            break
    return kept


def make_shapes(source, figure, placement, budget):
    mask = np.asarray(source.getchannel("A")) >= 128
    contours, _ = cv2.findContours(mask.astype("uint8"), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boundary = Polygon(max(contours, key=cv2.contourArea)[:, 0, :]).buffer(0)
    silhouette = max(polygon_parts(boundary), key=lambda part: part.area)
    art = ART[figure]
    if "body" in art:
        silhouette = Polygon(art["body"]).buffer(0)
    features = art["contours"]
    proposed = []
    for kind, colour, shape in features:
        if kind == "ellipse":
            proposed.append([dict(type=kind, colour=colour, box=shape, cost=1)])
            continue
        area = Polygon(shape)
        # Keep simple marked regions contiguous. Hand marks lie just inside
        # source contours and may bleed by a fraction over the underlay.
        proposed.append(bounded_contour(area, colour, placement, max(3, min(9, len(shape) - 2))))
    min_outline = 13 if figure in ("cat", "whale") else 11
    detail_budget = budget - min_outline
    # All landmarks survive. Decrease complex blocks without splitting the
    # accents or reaching into extra masked primitives.
    while sum(map(len, proposed)) > detail_budget:
        largest = max(range(len(proposed)), key=lambda index: len(proposed[index]))
        kind, colour, points = features[largest]
        assert kind == "polygon"
        proposed[largest] = bounded_contour(Polygon(points), colour, placement, len(proposed[largest]) - 1)
    remaining = budget - sum(map(len, proposed))
    base = bounded_contour(silhouette, art["fill"], placement, remaining, tolerance=.28)
    assert base, figure
    shapes = base + [shape for region in proposed for shape in region]
    assert len(shapes) <= budget
    return shapes, len(base), mask


def drawing(shapes):
    preview = Image.new("RGBA", (SIZE, SIZE))
    canvas = ImageDraw.Draw(preview)
    for shape in shapes:
        if shape["type"] == "ellipse":
            x, y, w, h = shape["box"]
            canvas.ellipse((x, y, x + w, y + h), fill=shape["colour"])
        else:
            canvas.polygon([tuple(point) for point in shape["points"]], fill=shape["colour"])
    return preview


def export_rows(shapes):
    """Map source coordinates to the portrait painter's centred 44px rows."""
    scale = 44 / SIZE
    rows = []
    for shape in shapes:
        red, green, blue = bytes.fromhex(shape["colour"][1:])
        if shape["type"] == "nativeTriangle":
            transform = shape["placement"]
            x, y = transform["cx"] - SIZE / 2, transform["cy"] - SIZE / 2
            width, height = transform["w"], transform["h"]
            image = 100003
            rotation = [transform[key] for key in ("rx", "ry", "rz")]
        else:
            assert shape["type"] == "ellipse", "Unexpected fallback geometry"
            left, top, width, height = shape["box"]
            x, y = left + width / 2 - SIZE / 2, SIZE / 2 - (top + height / 2)
            image = 106025
            rotation = []
        rows.append([image, *(round(value * scale, 6) for value in (x, y, width, height)),
                     red, green, blue, *(round(value, 6) for value in rotation)])
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slay", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("--source", type=Path, default=Path(__file__).with_name("native-fit-source.webp"))
    parser.add_argument("--budgets", type=int, nargs="+", default=[40])
    args = parser.parse_args()
    placement = load_module(args.slay / "scripts/art/native-triangle-placement.py")
    source_atlas = Image.open(args.source).convert("RGBA")
    assert source_atlas.size == (SIZE * COLUMNS, SIZE * (len(ART) // COLUMNS))
    evidence = {}
    exported = {budget: {} for budget in args.budgets}
    for index, figure in enumerate(ART):
        left, top = SIZE * (index % COLUMNS), SIZE * (index // COLUMNS)
        source = source_atlas.crop((left, top, left + SIZE, top + SIZE))
        produced = args.out / figure
        produced.mkdir(parents=True, exist_ok=True)
        matte = Image.new("RGBA", source.size, MATTE)
        reference = Image.alpha_composite(matte, source).convert("RGB")
        evidence[figure] = {}
        for budget in args.budgets:
            result, silhouette, mask = make_shapes(source, figure, placement, budget)
            preview = drawing(result)
            composite = Image.alpha_composite(matte, preview).convert("RGB")
            error = np.abs(np.asarray(composite, dtype=float) - np.asarray(reference, dtype=float))
            occupied = np.asarray(preview.getchannel("A")) >= 128
            measured = dict(foregroundRgbMeanAbsoluteError=round(float(error[mask].mean()), 3),
                            silhouetteIoU=round(float((occupied & mask).sum() / (occupied | mask).sum()), 4))
            figures = dict(width=SIZE, height=SIZE, budget=budget, nativeImages=len(result),
                           silhouetteImageCount=silhouette, sourceAtlasSha256=digest(args.source),
                           sourceRgbaSha256=hashlib.sha256(source.tobytes()).hexdigest(), placementSha256=digest(Path(placement.__file__)), **measured, shapes=result)
            composite.save(produced / f"fit-{budget}.png")
            (produced / f"fit-{budget}.json").write_text(json.dumps(figures) + "\n", encoding="utf-8")
            evidence[figure][budget] = dict(images=len(result), silhouetteImages=silhouette, **measured)
            exported[budget][figure] = export_rows(result)
    for budget, figures in exported.items():
        (args.out / f"rows-{budget}.json").write_text(json.dumps(figures, indent=2) + "\n", encoding="utf-8")
    (args.out / "receipt.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(evidence))


if __name__ == "__main__":
    main()
