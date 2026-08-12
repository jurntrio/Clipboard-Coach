from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "website" / "public" / "branding" / "svs-app-icon-v1.png"
WEB_PUBLIC = ROOT / "website" / "public"
WEB_ICONS = WEB_PUBLIC / "icons"
DESKTOP_BRANDING = ROOT / "assets" / "branding"


def remove_connected_white_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue: deque[tuple[int, int]] = deque()
    visited: set[tuple[int, int]] = set()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        red, green, blue, _ = pixels[x, y]
        if min(red, green, blue) < 235:
            continue
        pixels[x, y] = (red, green, blue, 0)
        if x > 0:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    return rgba


def save_png(master: Image.Image, destination: Path, size: int) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    resized = master.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(destination, "PNG", optimize=True)


def main() -> None:
    master = remove_connected_white_background(Image.open(SOURCE))
    master_path = WEB_PUBLIC / "branding" / "svs-app-icon-transparent.png"
    master.save(master_path, "PNG", optimize=True)

    for size in (16, 32, 48, 180, 192, 256, 512):
        save_png(master, WEB_ICONS / f"svs-{size}.png", size)

    save_png(master, WEB_PUBLIC / "icon.png", 512)
    save_png(master, WEB_PUBLIC / "apple-touch-icon.png", 180)

    favicon_sizes = [(16, 16), (32, 32), (48, 48)]
    master.save(WEB_PUBLIC / "favicon.ico", format="ICO", sizes=favicon_sizes)

    desktop_icon = DESKTOP_BRANDING / "svs-app.ico"
    master.save(
        desktop_icon,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    print(f"Created transparent master: {master_path}")
    print(f"Created web icons in: {WEB_ICONS}")
    print(f"Created Windows icon: {desktop_icon}")


if __name__ == "__main__":
    main()
