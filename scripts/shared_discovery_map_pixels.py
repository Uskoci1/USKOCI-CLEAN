"""Read original Android PNGs without rewriting them; bounded pixel evidence, not visual acceptance."""
import hashlib
import struct
import zlib


def read_png(path):
    raw = path.read_bytes()
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Original screenshot is not PNG')
    position, compressed, header, ended = 8, bytearray(), None, False
    while position < len(raw):
        length = struct.unpack('>I', raw[position:position + 4])[0]
        kind = raw[position + 4:position + 8]
        data = raw[position + 8:position + 8 + length]
        crc = raw[position + 8 + length:position + 12 + length]
        if len(data) != length or len(crc) != 4 or zlib.crc32(kind + data) != struct.unpack('>I', crc)[0]:
            raise ValueError('Truncated or corrupt PNG chunk')
        position += length + 12
        if kind == b'IHDR':
            if header is not None or position != 33:
                raise ValueError('PNG must have one first header')
            header = struct.unpack('>IIBBBBB', data)
        elif kind == b'IDAT':
            compressed.extend(data)
        elif kind == b'IEND':
            if length or position != len(raw):
                raise ValueError('Invalid PNG end')
            ended = True
            break
    if not header or not ended:
        raise ValueError('PNG header or end missing')
    width, height, depth, color, compression, filtering, interlace = header
    if not (0 < width <= 4096 and 0 < height <= 8192 and width * height <= 20000000
            and depth == 8 and color in (2, 6) and compression == filtering == interlace == 0):
        raise ValueError('Unsupported Android PNG dimensions or encoding')
    channels = 3 if color == 2 else 4
    stride = width * channels
    inflater = zlib.decompressobj()
    expected = height * (stride + 1)
    encoded = inflater.decompress(compressed, expected + 1)
    if len(encoded) != expected or not inflater.eof or inflater.unused_data:
        raise ValueError('Invalid bounded PNG payload')
    pixels = bytearray(height * stride)
    for y in range(height):
        start = y * (stride + 1)
        method = encoded[start]
        row = bytearray(encoded[start + 1:start + 1 + stride])
        previous = pixels[(y - 1) * stride:y * stride] if y else bytes(stride)
        if method not in range(5):
            raise ValueError('Unknown PNG row filter')
        if method:
            for x in range(stride):
                left = row[x - channels] if x >= channels else 0
                up = previous[x]
                upper_left = previous[x - channels] if x >= channels else 0
                if method == 1:
                    prediction = left
                elif method == 2:
                    prediction = up
                elif method == 3:
                    prediction = (left + up) // 2
                else:
                    p = left + up - upper_left
                    distances = (abs(p - left), abs(p - up), abs(p - upper_left))
                    prediction = (left, up, upper_left)[distances.index(min(distances))]
                row[x] = (row[x] + prediction) & 255
        pixels[y * stride:(y + 1) * stride] = row
    return width, height, channels, pixels


def region(image, bounds):
    width, height, channels, pixels = image
    x1, y1, x2, y2 = bounds
    if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 <= height):
        raise ValueError('Map region must be wholly inside the original screenshot')
    return b''.join(pixels[(y * width + x1) * channels:(y * width + x2) * channels] for y in range(y1, y2))


def circles(image, bounds, color):
    width, _, channels, pixels = image
    x1, y1, x2, y2 = bounds
    region(image, bounds)
    mask = set()
    for y in range(y1 + 4, y2 - 4):
        for x in range(x1 + 4, x2 - 4):
            offset = (y * width + x) * channels
            if all(abs(pixels[offset + component] - color[component]) <= 4 for component in range(3)):
                mask.add(y * width + x)
    found = []
    while mask:
        pending = [mask.pop()]
        component = []
        while pending:
            point = pending.pop(); component.append(point)
            for adjacent in (point - 1, point + 1, point - width, point + width):
                if adjacent in mask:
                    mask.remove(adjacent); pending.append(adjacent)
        if len(component) < 60:
            continue
        xs, ys = [p % width for p in component], [p // width for p in component]
        left, top, right, bottom = min(xs), min(ys), max(xs) + 1, max(ys) + 1
        w, h = right - left, bottom - top
        if (min(w, h) >= 10 and max(w, h) < min(x2 - x1, y2 - y1) * 0.45
                and 0.65 <= w / h <= 1.55 and len(component) / (w * h) >= 0.4):
            found.append({'center': [(left + right) // 2, (top + bottom) // 2],
                          'bounds': [left, top, right, bottom], 'pixels': len(component)})
    return sorted(found, key=lambda value: (-value['pixels'], value['center']))


def summarize_map(path, bounds):
    image = read_png(path)
    _, _, channels, _ = image
    raw = region(image, bounds)
    samples = {tuple(raw[index:index + 3]) for index in range(0, len(raw) - 3, channels * 13)}
    return {'bounds': list(bounds), 'region_sha256': hashlib.sha256(raw).hexdigest(),
            'sampled_colors': len(samples), 'clusters': circles(image, bounds, (20, 47, 48)),
            'points': circles(image, bounds, (250, 107, 50))}


def compare_map_regions(before_path, before_bounds, after_path, after_bounds):
    before, after = read_png(before_path), read_png(after_path)
    if before[2] != after[2] or (before_bounds[2] - before_bounds[0], before_bounds[3] - before_bounds[1]) != (
            after_bounds[2] - after_bounds[0], after_bounds[3] - after_bounds[1]):
        raise AssertionError('Map dimensions changed across Back; comparison needs explicit review')
    a, b = region(before, before_bounds), region(after, after_bounds)
    channels = before[2]
    differences = [abs(a[index + channel] - b[index + channel])
                   for index in range(0, len(a), channels * 5) for channel in range(3)]
    mean = sum(differences) / len(differences)
    close = sum(value <= 16 for value in differences) / len(differences)
    result = {'mean_channel_delta': mean, 'fraction_within16': close,
              'method': 'Same-sized actual map-region pixels; no fabricated camera coordinate or renderer hook.'}
    if mean > 8 or close < 0.94:
        raise AssertionError(f'Map changed across Back beyond accepted raster tolerance: {result}')
    return result
