# P5 — licence u ručnom radnom profilu

Datum: 2026-09-27. Klijentska integracija; ovaj izveštaj ne potvrđuje primenu na DEV niti proveru na uređaju. Root zasebno primenjuje odobreni owned-reader paket i beleži njegov receipt. Nema stvarnog upisa u profil u ovom krugu.

Pre izmene `mojRadnikProfil` je odbacivao postojeće serverske `licenses`, ručni editor ih nije prikazivao, a potvrda aktivacije nije upoređivala taj deo profila. Uske regresije pre izmene: **10 FAIL / 69 PASS**. Konkretno, aktivacija je prikazivala uspeh kada je naknadno učitan spisak licenci bio drugačiji.

Posle izmene:

- Owned projekcija zahteva `licence: string[]`. Serversko `licenses: []` je valjan prazan spisak; odsutno, null ili neispravno polje daje nedostupan profil, bez podrazumevanog praznog spiska. Stavke i redosled se čuvaju bez razdvajanja po zarezima.
- Ručni profil prikazuje **Licence koje navodiš**, uz objašnjenje da ih USKOČI ne proverava. Postojeće stavke mogu da se uklone, nove da se dodaju. Nedodata stavka zadržava unos i zaustavlja čuvanje. Važe isti limiti liste kao za veštine/alate/vozila.
- Samo promenjena lista ulazi u postojeću `licence` komandu; izričito uklanjanje poslednje stavke šalje `[]`. Nepromenjene licence se ne prepisuju. Postojeći writer nije menjan.
- Provera sačuvanog profila uključuje licence; aktivacija potvrđuje i nepromenjene pregledane licence. Nepodudaran odgovor zadržava unos i postojeći tok provere/ponavljanja. Vlasništvo naloga, fokus, foreground, rokovi, aktivacija i kapacitet ostaju na postojećim kontrolerima.
- Lažni izvor vraća obaveznu listu i podržava njenu postojeću komandu. Dve fixture dopune prate novi obavezni model.

Provera: **5 suite-ova, 121 PASS**, 35.179 s; `git diff --check` PASS. Pokrenuti su `worker-profile-read`, `worker-profile-native`, `pkg005-worker-onboarding`, `pkg011-slice5-presentation` i `w02-profile-write-safety`. Regresije pokrivaju validan/prazan/odsutan/neispravan server odgovor, tačan prikaz i čuvanje, izričito pražnjenje, nepodudaran i naknadno potvrđen rezultat, konkurentnu promenu pri aktivaciji i zadržavanje nedodate licence kroz blur/refocus uz odbijanje starog callback-a.

Integrisani TypeScript, APK i native pregled sekcije s tastaturom ostaju root proveri. Nema promene servera, kandidata, javnog profila, TaskCard/Peek-a, zavisnosti niti direktnog Supabase upisa.
