from pathlib import Path

path = Path('src/data/lazniIzvor.ts')
text = path.read_text(encoding='utf-8-sig')
old = "    stanje: 'DRAFT',\n    dostupanOdmah: false,\n    radijusKm: 10,"
new = "    stanje: 'ACTIVE',\n    dostupanOdmah: true,\n    radijusKm: 10,"
if old not in text:
    raise SystemExit('worker profile fixture marker not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('visual proof worker fixture activated')
