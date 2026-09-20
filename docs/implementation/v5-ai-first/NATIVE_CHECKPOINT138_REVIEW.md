# Stvarna Android provera izvora54abcbe

**Naknadno direktno poređenje sa V4.9: ENTRY_SIGNATURE_FIDELITY nije PASS.** Ovaj APK prikazuje stariju završnu SPOJ V2 kompoziciju: nedostaju dve originalne fotografije, izvorne SVG beleške i njihov V4.9 intent prelaz. Četiri stvarna kadra ispod dokazuju opaženu native animaciju, ne vernost celoj novijoj referenci. V4.9 korekcija je u toku; source freeze, novi APK i ponovno vizuelno poređenje tek slede. Referentni snimak na tačno390×844 i geometrija sačuvani su kao `artifacts/v5-native-smoke/v49-reference390-entry.png` i `v49-reference390-geometry.json`. Ranije200%/IME provere ostaju dokaz samo navedenog starog APK-a.

2026-09-13; potpisani samostalni release APK, bez Metro-a. Ovo je provera ulaza i auth prikaza, ne tvrdnja da je kompletan V5 live povezan. Izvor je `54abcbe6e0d6664ad73a14a6d91ed2dce7e5672a`, tree `6de66ac521b2be00f4a15e607f4ebcfb3e4b610e`. Kasnija139 native poruka o zaštiti dokaza nije u ovom APK-u.

APK: `C:/Users/user/Desktop/USKOCI ZAVRSAVANJE/USKOCI-V5-138-54abcbe6.apk`; SHA256 `3b9bfdecb946752348fa112ab7fb7b31454cd88ebcaf5953508ed58167f63027`,105667361 bajtova. Paket `rs.uskoci.preview`, versionCode35, minSDK24, targetSDK36. Potpis je postojeći `df2edf3f91abcb1df10eac03802ba55caedc29aee3d7188846182e0e49015782`. Build receipt je [build-checkpoint138-receipt.json](../evidence/v5-ai-first-20260912/build-ci-control/build-checkpoint138-receipt.json).

Provera je rađena samo na izdvojenom `USKOCI_V5_TEST`, `emulator-5554`, Android36.1. Originalni Pixel uređaj nije menjan. Za prvo pokretanje obrisani su samo lokalni podaci ove potvrđeno odjavljene test instalacije. Nisu uneti pristupni podaci, poslat Auth zahtev, prihvaćeni pravni uslovi, pozvan Gemini ili objavljen Zadatak. Jedan nenamerni lokalni znak u praznom polju lozinke tokom zatvaranja tastature nije poslat i uklonjen je resetom izdvojene instalacije.

| Stvarna provera | Nalaz |
| --- | --- |
| Hladno pokretanje | Instalacija uspešna, stvarna `.MainActivity`, proces ostaje aktivan. Prvo snimljeno pokretanje4395 ms po `am start -W`. |
| Originalni ulaz | Kontinuirani Android screenrecord pokazuje sklapanje originalnih delova, namigivanje levog oka, prelaz u naziv, potpis i dva završna izbora. Sačuvana su četiri puna kadra iz stvarnog videa. |
| Tekst200% | Izbori se slažu vertikalno; skrol dovodi oba izbora, „Prijavi se“ i završnu napomenu u vidljiv prostor. Nema primećenog horizontalnog odsecanja ovih kontrola. |
| Prijava + tastatura200% | Aktivno polje lozinke i glavna akcija ostaju vidljivi iznad stvarne Android tastature. |
| Registracija200% | Ime, prezime, grad, email i lozinke dostupni skrolom; kompletna saglasnost i pravne veze čitljive; pri fokusu potvrde lozinke polje i glavna akcija ostaju iznad tastature. Nalog nije napravljen. |
| Smanjeno kretanje | Sa `transition_animation_scale=0`, koji stvarno čitaju instalirani React Native i Reanimated, aplikacija prelazi iz početnog statičnog znaka u završni ulaz bez sklapanja/namigivanja. |
| Vraćena podešavanja | `font_scale=1.0`, `animator_duration_scale=null`, prethodni `transition_animation_scale=1.0`. |

Dokazi su lokalno u `artifacts/v5-native-smoke/`. Osnovni video je `checkpoint138-intro.mp4`. Četiri izdvojena kadra `checkpoint138-assembly.png`, `checkpoint138-wink.png`, `checkpoint138-wordmark.png`, `checkpoint138-welcome.png` potiču iz video vremena4.60,5.85,7.35,9.00 sekundi; to su vremena snimka, ne navodno izmereni JS animation clock. Hash-evi su u `checkpoint138-visual-capture.json`.

Smanjeno kretanje dokazuje `checkpoint138-reduced-verified.mp4` i zaseban `checkpoint138-reduced-verified-capture.json`. Početni `checkpoint138-reduced.mp4` zadržan je kao neuspešno podešen pokušaj: promena samo `animator_duration_scale` nije RN reduced-motion signal. Taj pokušaj nije PASS. Kod animacije nije menjan da bi provera prošla. Crna prazna polja na kontaktnom listu pripadaju nepopunjenim poljima fiksnog video preglednika; nisu opaženi crni ekrani aplikacije.

Slike `checkpoint138-login200-ime.png`, `checkpoint138-signup200-scrolled.png`, `checkpoint138-signup200-ime.png` i odgovarajući XML predstavljaju stvarno prikazane forme. XML bez uključene čitalačke usluge nije dokaz TalkBack redosleda; taj širi audit ovde nije proglašen završenim.

Ova provera ne dokazuje fizički mikrofon/GPS, stvarni AI interim/final, prijavljenog drugog korisnika, live SQL139, dostavu push-a ili konačnu pravnu spremnost. Za njih ostaju zasebne stvarne provere i konkretan odobren live paket.
