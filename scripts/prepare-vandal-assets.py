#!/usr/bin/env python3
"""Prepare user-licensed Vandal PNGs from independent ZIP archives.

Usage: python scripts/prepare-vandal-assets.py /path/to/7.zip ...
Requires Pillow. Each source must be a numbered PNG with transparency.
Outputs 256x256 binary-alpha PNGs and preserves the original aspect ratio.
"""
import argparse
import io
from pathlib import Path
import re
import zipfile
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'vandal'

def prepare(archive):
    count = 0
    with zipfile.ZipFile(archive) as z:
        for entry in z.infolist():
            match = re.fullmatch(r'(\d+)\.png', Path(entry.filename).name, re.I)
            if not match or entry.is_dir():
                continue
            number = int(match.group(1))
            if not 1 <= number <= 200 or entry.file_size > 100_000_000:
                raise ValueError(f'Unexpected file: {entry.filename}')
            with Image.open(io.BytesIO(z.read(entry))) as image:
                if image.width * image.height > 50_000_000 or 'A' not in image.getbands():
                    raise ValueError(f'Invalid or opaque source: {entry.filename}')
                alpha = image.getchannel('A')
                alpha.thumbnail((256, 256), Image.Resampling.LANCZOS)
                # Fine spray marks can average well below 128 when a large
                # source is downsampled. Keep those marks in the binary mask.
                alpha = alpha.point(lambda v: 255 if v >= 16 else 0, mode='1').convert('L')
                if alpha.getbbox() is None:
                    raise ValueError(f'Empty mask: {entry.filename}')
                result = Image.new('RGBA', (256, 256), (255, 255, 255, 0))
                result.putalpha(Image.new('L', (256, 256), 0))
                result.paste(Image.new('RGBA', alpha.size, (255, 255, 255, 255)),
                             ((256-alpha.width)//2, (256-alpha.height)//2), alpha)
                OUT.mkdir(parents=True, exist_ok=True)
                result.save(OUT / f'{number:03d}.png', optimize=True)
                count += 1
    return count

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archives', nargs='+', type=Path)
    args = parser.parse_args()
    for archive in args.archives:
        print(f'{archive.name}: {prepare(archive)} masks')
