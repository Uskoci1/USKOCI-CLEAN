#!/bin/sh
cd "$(dirname "$0")"
ok=0; bad=0; miss=0
while read f m; do
  [ -z "$f" ] && continue
  if [ ! -f "$f.sql" ]; then echo "NEDOSTAJE  $f"; miss=$((miss+1)); continue; fi
  a=$(printf '%s' "$(cat "$f.sql")" | md5sum | cut -d' ' -f1)
  if [ "$a" = "$m" ]; then ok=$((ok+1)); else echo "NE VALJA   $f ($a != $m)"; bad=$((bad+1)); fi
done < MD5_MANIFEST.txt
echo "---- ok=$ok neispravnih=$bad nedostaje=$miss"
