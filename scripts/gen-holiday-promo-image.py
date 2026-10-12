"""Left promo card image for the homepage "Товары к праздникам" block (components/HolidayProducts.tsx).
Style reference = our Halloween banner. Text is rendered in HTML, so the image must contain none.
Usage: python3 scripts/gen-holiday-promo-image.py <out.png>"""
import sys, base64, requests
key = [l.split('=',1)[1].strip().strip('"') for l in open('.env') if l.startswith('OPENAI_API_KEY=')][0]
refs = ['public/banners/banner-10-halloween.webp', 'All the Files with material here/Лого Шармастер/Profile Photo Sharmaster.kz D2.png']
from PIL import Image
import io
ims = []
for p in refs:
    b = io.BytesIO(); Image.open(p).convert('RGB').save(b, 'PNG'); ims.append(('image[]', ('ref.png', b.getvalue(), 'image/png')))
prompt = (
 "Vertical promo card illustration for a balloon and party-supplies shop website. Style of the FIRST reference image: glossy pastel 3D inflated-balloon look, cute and friendly, rounded shapes, soft shadows. "
 "Brand colours of the SECOND reference: sky blue, bubblegum pink, sunny yellow, mint green. "
 "Scene: a lively birthday-party celebration on a bright sky-blue background with a soft pink glow at the bottom. "
 "Hero: an adorable smiling round yellow foil-balloon character with rosy cheeks, wearing a small red-and-white party hat, arms up cheering, standing at the bottom-right. "
 "Around and above it a big cheerful cloud of flying balloons: a giant pink foil heart, a mint foil star, a number-style gold foil balloon without any digits (plain rounded shape), "
 "transparent confetti-filled balloons, pastel latex balloons in pink, blue, lilac, yellow and mint, a cute foil unicorn-free animal balloon (little bear), "
 "a party popper bursting with streamers and confetti, a wrapped gift box with a ribbon, and a small tiered birthday cake with candles on the bottom-left. "
 "Confetti, stars and curly ribbons fill the air. Composition: the TOP 35% of the image is mostly calm sky-blue with only a few tiny confetti dots (a headline will be placed there later); the busy scene fills the lower 65%. "
 "Absolutely no text, no letters, no numbers, no logos anywhere in the image."
)
r = requests.post('https://api.openai.com/v1/images/edits', headers={'Authorization': f'Bearer {key}'},
    files=ims, data={'model': 'gpt-image-1', 'prompt': prompt, 'size': '1024x1536', 'quality': 'high', 'n': '2'}, timeout=600)
print(r.status_code)
j = r.json()
if r.status_code != 200: print(str(j)[:600]); sys.exit(1)
for k, d in enumerate(j['data']):
    out = sys.argv[1].replace('.png', f'-{k}.png'); open(out, 'wb').write(base64.b64decode(d['b64_json'])); print('saved', out)
