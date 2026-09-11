from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[1]
s=(ROOT/'input/BASE_LINEAGE_V1.html').read_text()
s=s.replace('</head>','<style id="spoj-v2-style">\n'+(ROOT/'source/spoj-v2.css').read_text()+'\n</style>\n</head>',1)
s=s.replace('</body>','<script id="spoj-v2-script">\n'+(ROOT/'source/spoj-v2.js').read_text()+'\n</script>\n</body>',1)
s=s.replace('<title>', '<title>V2 · ',1)
out=ROOT/'prototype/USKOCI_SPOJ_V2.html';out.write_text(s)
(ROOT.parent/'USKOCI_SPOJ_V2_20260910.html').write_text(s)
(ROOT/'evidence/build.json').write_text(json.dumps({'input_sha256':hashlib.sha256((ROOT/'input/BASE_LINEAGE_V1.html').read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size},indent=2))
print(out,out.stat().st_size)
