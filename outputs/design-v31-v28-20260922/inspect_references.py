from pathlib import Path
from html.parser import HTMLParser
import re, json, hashlib

OUT = Path(__file__).resolve().parent
SOURCES = {
    'V31': Path('C:/Users/user/Downloads/USKOCI_V31_BALANCED_PREMIUM.html'),
    'V28': Path('C:/Users/user/Downloads/USKOCI_V28_PREGLED (1).html'),
}
class Inventory(HTMLParser):
    def __init__(self):
        super().__init__(); self.images=[]; self.links=[]; self.ids=[]; self.scripts=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag=='img': self.images.append({k:(v[:90]+'…' if v and v.startswith('data:') else v) for k,v in a.items()})
        if tag in ('script','link') and ('src' in a or 'href' in a): self.links.append(a)

result={}
for key,path in SOURCES.items():
    raw=path.read_bytes(); text=raw.decode('utf-8-sig'); parser=Inventory(); parser.feed(text)
    safe=re.sub(r'data:[^;\s"\']+;base64,[A-Za-z0-9+/=\s]+', '[EMBEDDED_ASSET_OMITTED]', text)
    css='\n'.join(re.findall(r'<style[^>]*>([\s\S]*?)</style>',safe,re.I))
    scripts='\n'.join(re.findall(r'<script[^>]*>([\s\S]*?)</script>',safe,re.I))
    css=re.sub(r'}\s*', '}\n',css)
    (OUT/(key+'.css.txt')).write_text(css,encoding='utf-8')
    (OUT/(key+'.js.txt')).write_text(scripts,encoding='utf-8')
    shell=re.sub(r'<(style|script)[^>]*>[\s\S]*?</\1>', '',safe,flags=re.I)
    (OUT/(key+'.shell.txt')).write_text(shell,encoding='utf-8')
    result[key]={'path':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw),'css_lines':len(css.splitlines()),'js_lines':len(scripts.splitlines()),'images':parser.images,'external':parser.links,'ids':parser.ids,'functions':re.findall(r'function\s+(\w+)\s*\(',scripts),'urls':sorted(set(re.findall(r'https?://[^\s"\'<>]+',safe)))}
(OUT/'reference-inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
if __name__ == '__main__':
    print(json.dumps({k:{field:v[field] for field in ('sha256','bytes','css_lines','js_lines','external','urls')} for k,v in result.items()},ensure_ascii=False,indent=2))
