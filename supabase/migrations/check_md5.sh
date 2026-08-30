#!/bin/sh
# Poredi svaki fajl na disku sa DOSLOVNIM primenjenim SQL-om iz migration history.
# Normalizacija: uklanja CR i zavrsne prazne redove — sadrzaj mora biti identican.
cd "$(dirname "$0")"
ok=0; bad=0; miss=0
while read f m; do
  [ -z "$f" ] && continue
  if [ ! -f "$f.sql" ]; then echo "NEDOSTAJE  $f"; miss=$((miss+1)); continue; fi
  a=$(printf '%s' "$(tr -d '\r' < "$f.sql")" | md5sum | cut -d' ' -f1)
  if [ "$a" = "$m" ]; then ok=$((ok+1)); else echo "NE VALJA   $f"; bad=$((bad+1)); fi
done < MD5_MANIFEST.txt
echo "---- ok=$ok neispravnih=$bad nedostaje=$miss"
