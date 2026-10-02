# RC02 — pripremljena popravka fotografija na DEV-u

Status: SOURCE REVIEWED / NOT APPLIED. Cilj je isključivo canonical DEV `leqcwgzvjsxugfgzdmth`. Za primenu je potrebna vlasnikova tačna odluka **PRIMENI RC02 DEV** prema AGENTS.md §3.1.2 i §3.1.8.

Postojeći dokaz EX05-S02 run36994974880 reprodukovao je čekanje u krug između otkazivanja spremnog priloga i uklanjanja/završetka fotografije. Četiri dodatne linije u jednoj funkciji `public.rpc_cancel_media_upload(uuid,uuid)` ujednačavaju redosled: postojeća zaštita zatvaranja → komanda → razgovor → prilog. Predlog ne menja podatke, ovlašćenja, potpis funkcije, pravila objave ili sertifikate.

- Tačna izmena: [body.diff](body.diff); izvršivi predlog: [rc02_candidate.sql](rc02_candidate.sql).
- Ograničenja i analiza: [SOURCE_REVIEW.md](SOURCE_REVIEW.md).
- Povratak: [rc02_revert.sql](rc02_revert.sql), vraća i poznati stari problem; ne primenjuje se automatski.
- Hash vrednosti: [manifest.json](manifest.json). SQL i funkcijska tela preneti su bez promene bajtova; prateći pregled je normalizovan na LF. Lokalni generator nije prenosivi deployment alat i nije uključen.

Read-only provera 2026-10-02 17:12:43.135622+00 potvrdila je svih sedam funkcijskih pinova. Izračunati closure digest i oba sačuvana sertifikata jednaki su `0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431`; retention_ready=true. To je provera metapodataka, ne izvršenje kandidata. Iste vrednosti moraju ponovo da se provere neposredno pre eventualne primene; odstupanje zaustavlja primenu.

Svako važeće otkazivanje sada može čekati zaključavanje razgovora, uključujući nespremljene priloge i ponovljene komande. Ponovna validacija proverava vlasništvo posle čekanja. Stare transakcije mogu nastaviti sa starim redosledom do završetka. Nije pokrenuta nova provera konkurentnih zahteva niti je ova promena potvrđena na uređaju. Nema tvrdnje da su uklonjeni svi mogući deadlock-ovi.

Primena, ako bude odobrena, mora biti serijska, sa ponovnom proverom pinova, proverenim LF bajtovima i postojećim DEV evidencionim postupkom. Zabeležiti tačan payload i posle primene proveriti novi body hash, nepromenjene atribute i sertifikate. Runtime prihvatanje ostaje odvojeno od uspešne promene metapodataka.
