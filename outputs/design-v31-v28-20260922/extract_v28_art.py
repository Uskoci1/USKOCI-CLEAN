from pathlib import Path
import re,json,ast,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent
source=(ROOT/'V28.js.txt').read_text(encoding='utf-8')
body=source.split('function v17ArtPaths(kind,{muted=false}={}) {',1)[1].split('return drawings[key]',1)[0].split('const drawings={',1)[1]
drawings=dict(re.findall(r'^\s+(\w+):'+chr(96)+r'(.*)'+chr(96)+r'[,]?$',body,re.M))
assert len(drawings)==12,len(drawings)
shadow='<ellipse cx="16" cy="29.4" rx="10.2" ry="1.6" fill="#163D2B" opacity=".07"/>'
def art(name,muted=False):
    colors=dict(front='#8A938E',edge='#5C6860',light='#D6DDD8',soft='#EAEEEB') if muted else dict(front='#F78028',edge='#CF5B12',light='#FFBE85',soft='#FFF0E2') if name in ['calendar','users','bell','tasks'] else dict(front='#079C77',edge='#077958',light='#6FD0AB',soft='#E1F4EC')
    def line(d,color='#35463D',width=1.9,cls=''):
        return f'<path class="{cls}" d="{d}" fill="none" stroke="{color}" stroke-width="{width}"/>'
    def expression(match):
        s=match[1]
        if s=='shadow': return shadow
        if s.startswith('c.'): return colors[s[2:]]
        if s=="muted?'#78857A':'#F78028'": return '#78857A' if muted else '#F78028'
        call=re.fullmatch(r'(face|edge|line|shine)\((.*)\)',s)
        if not call: raise ValueError(s)
        method,args=call.groups()
        args=re.sub(r'c\.(front|edge|light|soft)',lambda m:repr(colors[m[1]]),args)
        args=args.replace("muted?'#A8B4AB':'#9BCDB4'",repr('#A8B4AB' if muted else '#9BCDB4'))
        values=ast.literal_eval('['+args+']')
        if method=='line': return line(*values)
        if method=='shine': return line(values[0],colors['light'],1.8,'v17-highlight')
        return f'<path class="v17-{method}" d="{values[0]}" fill="{colors["front" if method=="face" else "edge"]}"/>'
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="i reference-art">'+re.sub(r'\$\{([^{}]+)\}',expression,drawings[name])+'</svg>'
    for node in ET.fromstring(svg).iter():
        assert node.tag.split('}')[-1] in ['svg','path','circle','rect','ellipse']
        assert not any(k.lower().startswith('on') or 'href' in k.lower() for k in node.attrib)
    return svg
assets={k:art(k) for k in drawings}
assets.update({k+'Muted':art(k,True) for k in ['tasks','map','agreements']})
(ROOT/'v28-vector-assets.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'staticVectors':len(assets),'referenceScriptsExecuted':False}))
