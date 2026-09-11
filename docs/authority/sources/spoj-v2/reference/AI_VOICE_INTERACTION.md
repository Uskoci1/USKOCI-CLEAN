# SPOJ v1.5 — AI + Voice Interaction

## Novi zadatak
Glavni vertikalni ritam je: **Living Task Object → trenutno AI pitanje → poslednji korisnikov odgovor → composer**.

## Glas
Klik na mikrofon pretvara composer u listening capsule. Waveform i puls pokazuju da je audio unos aktivan; tekst se ispisuje uživo. To nije dokaz AI razumevanja, samo stanje audio/transkripcionog toka.

Nema obaveznog posrednog ekrana `Čuo sam → potvrdi` posle svake rečenice. Nakon završetka govornog poteza, odgovor ulazi u razgovor. Ako je nešto nejasno, sledeće AI pitanje razjašnjava baš tu činjenicu. Jedan završni ljudski pregled ostaje pre čuvanja/objave.

## Istorija
Ceo razgovor je dostupan na zahtev. Glavni ekran prikazuje samo ono što je trenutno potrebno, zato duga istorija ne potiskuje karticu i pitanje.

## Radni profil
Isti conversation rhythm, ali zaseban živi Worker Profile object. Ne koristi Task Object za osobu. Veštine/oprema/tim/dostupnost imaju svoje semantics.
