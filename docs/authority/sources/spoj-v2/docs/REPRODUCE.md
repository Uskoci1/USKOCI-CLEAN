# Ponovljiv lokalni rad

HTML se otvara samostalno, bez instalacije i bez mreže. Za izmene: source/build.py uzima input/BASE_LINEAGE_V1.html i dodaje samo source/spoj-v2.css + source/spoj-v2.js. Osnova se ne prepisuje.

Za testove: Python + paketi iz source/requirements.txt, Chromium i Node/TypeScript. USKOCI_CHROMIUM može da pokaže na lokalni Chrome/Chromium executable; podrazumevana Linux putanja je /usr/bin/chromium. Na Windows-u postavi stvarnu lokalnu putanju; nemoj kopirati ovu Linux putanju kao da postoji na tvom računaru.

Iz foldera source:
```
python build.py
python regression.py
python v2_checks.py
python check_layouts.py 360
python check_layouts.py 320
python check_layouts.py 320_large
python check_layouts.py states
python capture.py after ../prototype/USKOCI_SPOJ_V2.html
python capture.py before ../input/BASE_LINEAGE_V1.html
python export_assets.py
python motion_check.py
tsc ../native-starter/BrandSceneMath.ts --strict --target es2020 --module commonjs --outDir ../evidence/math-build
node test_motion.cjs
python build_docs.py
python build_atlas.py
```

build_docs.py čita zamrznute izvore iz input; ne radi novi GitHub/Supabase audit. Ažuriranje source statusa je zaseban read-first zadatak. Nemoj pokretati sve Chromium capture poslove paralelno na memorijski ograničenom okruženju.
