"""Build the independent, network-free flow study from trusted static assets."""
from pathlib import Path
import base64
import json

folder = Path(__file__).resolve().parent
repo = folder.parents[1]
art = json.loads((folder / 'v28-vector-assets.json').read_text(encoding='utf-8'))
font_dir = repo / 'assets' / 'fonts' / 'inter'
# The typeface is already present in the owner's parallel visual work. Only read it.
font_css = ''
for name, weight in [('Regular', 400), ('SemiBold', 600), ('Bold', 700), ('ExtraBold', 800)]:
    source = font_dir / f'Inter-{name}.ttf'
    if source.is_file():
        raw = base64.b64encode(source.read_bytes()).decode('ascii')
        font_css += "@font-face{font-family:Inter;src:url(data:font/ttf;base64," + raw + ") format('truetype');font-weight:" + str(weight) + ";font-style:normal;font-display:swap}\n"
if font_css:
    license_text = (font_dir / 'OFL.txt').read_text(encoding='utf-8').replace('*/', '* /')
    font_css += '\n/* Embedded Inter font license:\n' + license_text + '\n*/'
text = (folder / 'flow.template.html').read_text(encoding='utf-8')
text = text.replace('__ART__', json.dumps(art, ensure_ascii=False).replace('</', '<\\/')).replace('__FONT__', font_css)
(folder / 'TOK.html').write_text(text, encoding='utf-8')
print(json.dumps({'output': 'TOK.html', 'bytes': len(text.encode('utf-8')), 'local_font': bool(font_css), 'icons': len(art)}))
