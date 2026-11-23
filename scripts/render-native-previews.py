"""Draw simulated UI frames exported by tests/native/verify-m1.mjs."""

import argparse
from functools import lru_cache
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageColor, ImageDraw, ImageFont


SCENE_COLOUR = "#0b1f24"
ELLIPSE_IMAGE = 106025
RECTANGLE_IMAGE = 100001
DESKTOP_CANVAS = (1600, 900)


def read_font():
    match = subprocess.check_output(
        ["fc-match", "-f", "%{file}\t%{index}", "Noto Sans CJK SC"],
        text=True,
    )
    name, index = match.split("\t", maxsplit=1)
    return name, int(index)


def colour(value, opacity=1):
    red, green, blue, alpha = ImageColor.getcolor(value, "RGBA")
    return red, green, blue, round(alpha * opacity)


def draw_label(draw, record, font, position, size):
    content = record.get("content", "")
    if not content:
        return
    face = font(record["fontSize"])
    alignment = record.get("align", "centre")
    vertical = record.get("valign", "middle")
    x, y = position
    width, height = size
    if alignment == "left":
        horizontal_anchor, x = "l", x - width / 2
    elif alignment == "right":
        horizontal_anchor, x = "r", x + width / 2
    else:
        horizontal_anchor = "m"
    if vertical == "top":
        vertical_anchor, y = "t", y - height / 2
    elif vertical == "bottom":
        vertical_anchor, y = "b", y + height / 2
    else:
        vertical_anchor = "m"
    draw.text(
        (x, y), content, font=face, anchor=horizontal_anchor + vertical_anchor,
        fill=colour(record.get("colour", "#ffffff"), record.get("opacity", 1)),
    )


def draw_frame(records, size, font):
    canvas = Image.new("RGB", size, SCENE_COLOUR)
    draw = ImageDraw.Draw(canvas, "RGBA")
    centre = size[0] / 2, size[1] / 2
    parents = {}
    for record in records:
        parent_path = record.get("parent")
        if parent_path:
            parent_x, parent_y, parent_visible = parents[parent_path]
        else:
            parent_x, parent_y, parent_visible = *centre, True
        local_x, local_y = record["position"]
        x, y = parent_x + local_x, parent_y - local_y
        visible = parent_visible and record.get("active", True) and record.get("visible", True)
        parents[record["path"]] = x, y, visible
        if not visible:
            continue
        width, height = record["size"]
        if record["kind"] == "text":
            draw_label(draw, record["text"], font, (x, y), (width, height))
        elif record["kind"] == "image":
            image = record.get("image")
            if image is None:
                continue
            if image not in (ELLIPSE_IMAGE, RECTANGLE_IMAGE):
                raise ValueError(f"Image {image} is unavailable for preview at {record['path']}")
            box = (x - width / 2, y - height / 2, x + width / 2, y + height / 2)
            paint = colour(record.get("colour", "#ffffff"), record.get("opacity", 1))
            if image == ELLIPSE_IMAGE:
                draw.ellipse(box, fill=paint)
            else:
                draw.rectangle(box, fill=paint)
    return canvas


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("frames", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--desktop", action="store_true", help="Use the 1600×900 preview canvas")
    parser.add_argument("--font", type=Path, help="Override the installed preview font")
    args = parser.parse_args()

    source = json.loads(args.frames.read_text(encoding="utf-8"))
    mobile = source["canvas"]
    size = DESKTOP_CANVAS if args.desktop else (mobile["width"], mobile["height"])
    font_path, font_index = (args.font, 0) if args.font else read_font()

    @lru_cache(maxsize=None)
    def font(font_size):
        return ImageFont.truetype(font_path, font_size, index=font_index)

    args.output.mkdir(parents=True, exist_ok=True)
    for name, records in source["frames"].items():
        if not name.isidentifier():
            raise ValueError(f"Invalid frame name: {name}")
        draw_frame(records, size, font).save(args.output / f"{name}.png", optimize=True)


if __name__ == "__main__":
    main()
