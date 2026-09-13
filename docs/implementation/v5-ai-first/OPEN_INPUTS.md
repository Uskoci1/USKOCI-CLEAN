# Preostali rad za povezani private-test APK

Vlasničke odluke AF-D19–26 zatvaraju proizvodne ulaze za ovaj ciklus. Tačan
ugovor je u [OWNER_PRIVATE_TEST_DECISIONS_20260913.md](OWNER_PRIVATE_TEST_DECISIONS_20260913.md).
AF-D26 izričito odobrava proverene migracije, RPC/Edge/Storage, secrets i
konfiguraciju canonical DEV/ALPHA projekta `leqcwgzvjsxugfgzdmth`. Dodatni
staging i izbor organizacije nisu potrebni. Budući zaseban production projekat
ostaje van ove dozvole. Ovaj dokument nije tvrdnja da je promocija izvršena.

## Odgovoreno — ne pitati ponovo

- Urgent ostaje postojeća oznaka u istom toku. Bez novih 6h/60min pravila,
  ETA/dispatch/radius engine-a ili blokiranja prvog povezanog APK-a.
- Postojeći vlasnički nalog i jedan novi jasno označeni interni QA nalog
  dozvoljeni su za razvoj/test. Odgovor AF-D26 određuje canonical DEV/ALPHA
  okruženje. QA ne sme uticati na stvarnu reputaciju, statistiku, ranking,
  naplatu ili production obaveštenja. Donorski lab se ne resetuje.
- Privatne Agreement fotografije: najviše 6 po poruci, 10 MB po originalu,
  najviše 1600 px i uklanjanje EXIF/GPS/nepotrebnih metapodataka. Private Storage,
  bez javnih URL-ova; stvarna prava učesnika i postojeći kontrolisani support.
  Predlog 12/dan je odbijen. Privremena serverska safety granica za ovaj test
  je 120 novih otprema u rolling 24h i 12/min; idempotentan replay se ne broji
  ponovo. Ovo je odabrana implementaciona granica unutar vlasničke dozvole.
- Istorija završenih zadataka, Dogovora, poruka i fotografija ostaje dok nalog
  postoji; nema automatskog brisanja posle 30 dana. Zatvaranje naloga koristi
  privacy tok za brisanje/anonimizaciju, uz samo neophodne izuzetke. Ne izmišljati
  pravne rokove niti ugrađivati bezuslovno trajno čuvanje.
- Samoprijavljen identitet, bez lažnog verified bedža. External KYC je
  disabled/non-required za ovaj APK. Vozilo ostaje jednostavan postojeći model;
  kg/sedišta nisu obavezni. Email potvrda i session integrity ostaju obavezni.
- Fotografije i voice input jesu obim V1; trajni audio, video, dokumenti i
  proizvoljni prilozi nisu obim ovog ciklusa. Puštanje mikrofona finalizuje
  vidljiv izmenjiv tekst. Tek izričito Pošalji pokreće AI poruku; objava zadatka
  ostaje jedna završna akcija u detaljnom pregledu.
- AF-D15: odustajanje od već poslatog nepoznatog AI odgovora zadržava potrošnju,
  blokira kasne upise i ne ponavlja provider poziv automatski.
- AF-D16: samo email Auth za sada. Ne aktivirati Google/Apple/SMS naloge/troškove.
- AF-D17–18: prihvaćeni support limiti i jedini vlasnički operater za privatni
  test, audit pristupa, poslati zahtevi/safety/izabrani dokazi i ručna žalba.
  Bez otvaranja cele prepiske, Gemini obrade support sadržaja ili novih sankcija.
- Plaćeni Gemini, prolazni audio/Google okvir, Task foto i Q&A provera i zajednički
  interni limit rezervacija od $5 ostaju odobreni. Kratke kontrolisane probe i
  provera potrošnje ostaju potrebne; limit nije garancija konačnog Google računa.
- Supabase panel pristup i veza postojećeg ključa sa plaćenim Uskoci-clean
  projektom već su provereni. Vlasnik je obavešten o ranijem prikazu ključa i
  izabrao nastavak bez zamene. Ne ponavljati vrednost ili zahtev za rotaciju.
- Operater još nije registrovan. Ne izmišljati firmu, adresu, broj, email ili
  pravni potpis. RC2 sadržaj je dostavljen i pročitan; ne tražiti paket ponovo.

## Tehnički poslovi, a ne nova pitanja za dozvolu

Završiti izvor i izolovane SQL/Storage/Auth provere svih kandidata, sačuvati
rekonstruktivne migracije u GitHub-u, proveriti stvarno stanje canonical
DEV/ALPHA i primeniti verifikovan izvor sa postflight dokazima. Povezati
odobreni provider/config i kontrolisane probe, kreirati interni QA nalog,
proći stvaran E2E sa dva naloga i napraviti instalabilan APK nad tim backendom.

Nedostajući dokaz nije dokaz funkcionalnosti: Entry povratak, speech capture,
fotografije, privatna prava i završni E2E traže stvarne provere. Ako se pojavi
dokazani P0/P1 problem osnovnog toka, bezbednosti, integriteta ili build-a,
prvo ga konkretno dijagnostikovati. Ne otvarati novi proizvodni scope.

Budući javni pravni sadržaj/registrovani operater, napredni Urgent, external KYC,
drugi mediji i zaseban production deploy ostaju budući ciklusi po odluci
vlasnika. Nisu samovoljno obrisane funkcije niti ponovo otvoreni ulazi ovog APK-a.
