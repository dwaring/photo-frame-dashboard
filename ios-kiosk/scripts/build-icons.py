"""Render the small code-native house mark as opaque iPad PNG icons (stdlib only)."""
from pathlib import Path
import struct
import zlib

out = Path(__file__).resolve().parent.parent / "build/Payload/HomeKiosk.app"
roof = [(0.14, 0.47), (0.5, 0.16), (0.86, 0.47), (0.79, 0.55), (0.5, 0.30), (0.21, 0.55)]


def inside(x, y, points):
    result = False
    prev = points[-1]
    for point in points:
        ax, ay = prev
        bx, by = point
        if (ay > y) != (by > y) and x < (bx - ax) * (y - ay) / (by - ay) + ax:
            result = not result
        prev = point
    return result


def color(x, y):
    if inside(x, y, roof):
        return (238, 246, 248)
    if 0.28 < x < 0.72 and 0.49 < y < 0.81:
        if 0.44 < x < 0.56 and 0.63 < y:
            return (20, 44, 57)
        return (113, 212, 196)
    return (20, 44, 57)


def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))


for name, size in [("Icon-76.png", 76), ("Icon-76@2x.png", 152), ("Icon-83.5@2x.png", 167)]:
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            samples = [color((x + (sx + 0.5) / 4) / size, (y + (sy + 0.5) / 4) / size)
                       for sy in range(4) for sx in range(4)]
            rows.extend(sum(sample[channel] for sample in samples) // 16 for channel in range(3))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
    (out / name).write_bytes(png)
