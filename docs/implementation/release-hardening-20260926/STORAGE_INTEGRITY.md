# R18 — bezbedno povlačenje lokalnog zahteva

Status: **CLIENT_CI_PASS_DEVICE_PENDING**.

## Potvrđeno pre izmene

Novi testovi su pokrenuti na neizmenjenom kodu i pali: 21 padova. Reset je otvarao novu ponudu pre potvrde uklanjanja starog zahteva, gutao storage greške, a save je dopuštao promenu sadržaja pod istim request ID-em. Prolazni testovi nisu uklonjeni ili oslabljeni.

## Popravka

Reset sada čeka dokazanu odsutnost tačnog zapisa, sa zaključavanjem dvostrukog pritiska i proverom fokusa/naloga. Greška čitanja/brisanja ili drugi sačuvani zahtev ne otvaraju novu ponudu. Per-account/Need red ne pušta noviji save dok se provera odsutnosti ne završi. Isti request ID ne može da dobije druge uslove; korumpiran zapis traži ranije postojeći eksplicitni izlaz. Uspešna serverska potvrda ostaje uspešna i kada lokalno čišćenje ne uspe; hladni oporavak ponavlja samo isti originalni zahtev.

## Dokazi

TypeScript PASS. Ciljano: 160/160. Ceo Jest: 6355/6355, 321 grupa. [CI](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36241718929). Tačan testirani tree i blobovi su u STORAGE_INTEGRITY_CHECKS.json; završni commit dodaje izveštaj, bez novih promena testiranog koda.

## Granice

Bez DEV/Edge/SQL/provider/push izmena i bez novih test naloga. Nova read-only DEV provera u razgovoru blokirana je alatom i NIJE smatrana osveženim dokazom. Postojeći dev_snapshot.json nije menjan. Istorijski PKG-006 SQL rezultat nije dokaz live202 jednakosti. Fizički telefon, APK instalacija i store prihvatanje nisu izvedeni ovim testovima.

Sledeće: APK sa tačnim source bindingom; posebno odobren profil → povratak → prijava i prekid na telefonu. Media i stvarni push i dalje čekaju eksplicitno primeni. Spoljni Artifact prikaz nije objavljen; postojeća tabla je samo regenerisana.
