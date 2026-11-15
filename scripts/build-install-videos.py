"""Build Setlog's original illustrated installation guides (no stock/AI media).

Requires Pillow and imageio-ffmpeg. Run from any directory; outputs go to repo root.
"""
from pathlib import Path
import math
import subprocess
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
W, H, FPS, SECONDS = 720, 660, 15, 12
BG, LIME, INK, MUTED = '#1e241e', '#d4fa7d', '#141615', '#a9b2a8'
FONT = Path('C:/Windows/Fonts')
logo = Image.open(ROOT / 'icon-v2-192.png').convert('RGB')


def font(size, bold=False):
    return ImageFont.truetype(str(FONT / ('seguisb.ttf' if bold else 'segoeui.ttf')), size)


def label(d, xy, text, size=24, color=INK, bold=False):
    d.text(xy, text, fill=color, font=font(size, bold))


def box(d, rect, fill, radius=16, outline=None, width=1):
    d.rounded_rectangle(rect, radius, fill, outline, width)


def share(d, x, y, color=INK):
    d.line([(x, y+13), (x, y+32), (x+27, y+32), (x+27, y+13)], fill=color, width=3)
    d.line([(x+13, y+22), (x+13, y)], fill=color, width=3)
    d.line([(x+5, y+8), (x+13, y), (x+21, y+8)], fill=color, width=3)


def tap(d, x, y, t):
    r = 19 + 5 * math.sin(t * math.pi * 3)
    d.ellipse((x-r, y-r, x+r, y+r), outline='#7fa83b', width=4)
    d.ellipse((x-7, y-7, x+7, y+7), fill=LIME, outline=INK, width=1)


def app_page(im, d):
    label(d, (116, 136), 'Setlog', 32, '#f2f4ef', True)
    label(d, (116, 180), 'Your workout journal', 20, MUTED)
    box(d, (112, 230, 607, 316), '#262e26')
    label(d, (136, 251), 'Log workout', 26, '#f2f4ef', True)
    box(d, (112, 336, 607, 414), '#262e26')
    label(d, (136, 354), 'Your progress, one set at a time.', 21, MUTED)


def browser(d, platform):
    if platform == 'iphone':
        box(d, (110, 515, 610, 575), '#e7e9e5', 28)
        d.line((135, 538, 157, 538), fill=INK, width=3)
        d.line((135, 547, 151, 547), fill=INK, width=3)
        label(d, (195, 530), 'kushacodes1901.github.io', 22)
        d.arc((566, 531, 589, 554), 40, 315, fill=INK, width=3)
        d.polygon([(586, 529), (590, 539), (579, 536)], fill=INK)
    else:
        box(d, (110, 118, 610, 180), '#e7e9e5', 26)
        label(d, (133, 135), 'kushacodes1901.github.io', 22)
        for y in [134, 146, 158]:
            d.ellipse((577, y, 582, y+5), fill=INK)


def confirm(im, d, platform, show_add=False):
    box(d, (104, 123, 616, 578), '#f1f2ee', 22)
    if platform == 'iphone':
        label(d, (125, 145), 'Cancel', 23)
        label(d, (247, 147), 'Add to Home Screen', 24, bold=True)
        box(d, (530, 135, 600, 181), LIME, 20)
        label(d, (548, 145), 'Add', 23, bold=True)
    else:
        label(d, (140, 155), 'Install app', 30, bold=True)
    im.paste(logo.resize((80, 80)), (138, 221))
    label(d, (240, 228), 'Setlog', 30, bold=True)
    label(d, (240, 272), 'Workout journal', 21, '#66705f')
    if platform == 'iphone':
        box(d, (126, 355, 596, 430), '#e3e7df', 14)
        label(d, (144, 379), 'Open as Web App', 24)
        box(d, (510, 374, 578, 411), LIME, 19)
        d.ellipse((544, 378, 573, 407), fill=INK)
        label(d, (144, 452), 'Keep this on if it appears.', 21, '#66705f')
    else:
        box(d, (380, 476, 582, 537), LIME, 26)
        label(d, (442, 489), 'Install', 26, bold=True)
    return (565, 158) if platform == 'iphone' else (488, 507)


def home_screen(im, d):
    box(d, (104, 123, 616, 578), '#263327', 22)
    for x, y, color in [(140, 167, '#5b6954'), (252, 167, '#6c775e'), (364, 167, '#495c4a'), (476, 167, '#5c6b53'),
                         (140, 290, '#485e49'), (252, 290, '#65765d'), (364, 290, '#58694e')]:
        box(d, (x, y, x+78, y+78), color, 20)
    im.paste(logo.resize((80, 80)), (476, 289))
    label(d, (482, 378), 'Setlog', 22, '#f2f4ef')
    box(d, (132, 474, 588, 553), '#3c4b39', 30)
    for x in [172, 276, 380, 484]:
        box(d, (x, 489, x+53, 540), '#66765c', 15)


CAPTIONS = {
    'iphone': ['1. Open the menu, then Share', '2. Add to Home Screen', '3. Keep Open as Web App on', '4. Tap Add. Open Setlog.'],
    'android': ['1. Open Chrome’s menu', '2. Choose Install / Add to Home screen', '3. Confirm Install', '4. Open Setlog. You’re ready.']
}


def frame(platform, seconds):
    phase = min(3, int(seconds // 3))
    local = seconds % 3
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    label(d, (32, 14), 'SAFARI · iPHONE / iPAD' if platform == 'iphone' else 'CHROME · ANDROID', 15, MUTED, True)
    label(d, (32, 45), CAPTIONS[platform][phase], 30, '#f2f4ef', True)
    box(d, (84, 98, 636, 607), '#080b08', 36)
    box(d, (100, 115, 620, 589), INK, 24)
    app_page(im, d)
    browser(d, platform)
    if platform == 'iphone':
        if phase == 0:
            if local < .9:
                tap(d, 146, 544, seconds)
            else:
                box(d, (112, 352, 608, 504), '#f1f2ee', 20)
                box(d, (124, 367, 596, 425), LIME, 12)
                share(d, 142, 379)
                label(d, (191, 381), 'Share', 27, bold=True)
                label(d, (142, 446), 'Add to Bookmarks', 24)
                tap(d, 553, 395, seconds)
        elif phase == 1:
            box(d, (104, 236, 616, 578), '#f1f2ee', 22)
            label(d, (134, 263), 'Share', 28, bold=True)
            label(d, (134, 328), 'Copy', 24)
            label(d, (134, 385), 'Add Bookmark', 24)
            box(d, (122, 435, 598, 497), LIME, 12)
            label(d, (143, 452), '+  Add to Home Screen', 26, bold=True)
            label(d, (134, 526), 'Edit Actions…', 23, '#66705f')
            tap(d, 555, 465, seconds)
        elif phase == 2:
            confirm(im, d, platform)
            tap(d, 546, 393, seconds)
        elif local < 1:
            x, y = confirm(im, d, platform)
            tap(d, x, y, seconds)
        else:
            home_screen(im, d)
            tap(d, 516, 330, seconds)
    else:
        if phase == 0:
            tap(d, 580, 148, seconds)
        elif phase == 1:
            box(d, (232, 190, 610, 555), '#f1f2ee', 20)
            label(d, (258, 220), 'New tab', 24)
            label(d, (258, 285), 'History', 24)
            label(d, (258, 350), 'Share…', 24)
            box(d, (246, 406, 596, 493), LIME, 12)
            label(d, (264, 420), 'Install / Add to', 25, bold=True)
            label(d, (264, 453), 'Home screen', 25, bold=True)
            tap(d, 555, 450, seconds)
        elif phase == 2:
            x, y = confirm(im, d, platform)
            tap(d, x, y, seconds)
        else:
            home_screen(im, d)
            tap(d, 516, 330, seconds)
    for index in range(4):
        x = 274 + index * 45
        box(d, (x, 626, x+32, 631), LIME if index == phase else '#46513f', 3)
    return im


for platform in CAPTIONS:
    video = ROOT / f'install-{platform}.mp4'
    process = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-vcodec', 'rawvideo', '-s', f'{W}x{H}', '-pix_fmt', 'rgb24', '-r', str(FPS),
        '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(video)], stdin=subprocess.PIPE)
    for index in range(SECONDS * FPS):
        process.stdin.write(frame(platform, index / FPS).tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError('Video encoding failed')
    frame(platform, 0).save(ROOT / f'install-{platform}.jpg', quality=88)
    captions = 'WEBVTT\n\n' + '\n\n'.join(
        f'00:00:{index*3:02}.000 --> 00:00:{index*3+3:02}.000\n{text}'
        for index, text in enumerate(CAPTIONS[platform])) + '\n'
    (ROOT / f'install-{platform}.vtt').write_text(captions, encoding='utf-8')
    print(f'{video.name}: {video.stat().st_size:,} bytes, {SECONDS}s, {W}x{H}')
