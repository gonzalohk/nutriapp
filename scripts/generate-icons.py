"""Generates the PWA icons (optional; the PNGs are committed). Needs Pillow: pip install pillow"""
from PIL import Image, ImageDraw

GREEN = (21, 128, 61)
WHITE = (255, 255, 255)


def icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), GREEN)
    d = ImageDraw.Draw(img)
    # A maskable icon keeps its artwork inside the central 80% "safe zone".
    scale = 0.62 if maskable else 0.78
    r = size * scale / 2
    c = size / 2
    d.ellipse([c - r, c - r, c + r, c + r], fill=WHITE)  # plate
    leaf = [(c, c - r * 0.62), (c + r * 0.5, c), (c, c + r * 0.62), (c - r * 0.5, c)]
    d.polygon(leaf, fill=GREEN)  # leaf
    d.line([(c, c - r * 0.45), (c, c + r * 0.45)], fill=WHITE, width=max(2, size // 60))
    return img


for name, size, maskable in [("icon-192.png", 192, False), ("icon-512.png", 512, False),
                              ("maskable-512.png", 512, True), ("apple-touch-icon.png", 180, False)]:
    icon(size, maskable).save(f"public/icons/{name}")
print("icons written")
