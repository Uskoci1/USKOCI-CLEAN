# Dimenzionalni identitet, mirna mapa i radni profil — 3.10.2026.

## Odluka i odnos prema nacrtu

Vlasnik traži materijal iz priloženog logotipa 13524, zadržavanje postojeće animacije, mirne kontrole mape i razgovor koji gradi lični radni profil. Postojeći tokovi i ugovori ostaju osnova. Odstupanje od starog vizuelnog zaključavanja: ravni znak/slova zamenjeni su odobrenim reljefnim materijalom. Nije napravljen novi intro ni drugi proizvod. Prikaz izvora mape ostaje čitljiv: nije pretvoren u znak uzvika jer nije upozorenje.

## Konkretna promena

- Zajednički BrandMark/BrandLockup, About i uvod koriste originalni zeleni/narandžasti reljef. Sedam semantičkih delova deli jedan atlas; izvorni položaji i 4380ms časovnik ostaju. Mala optička varijanta ispod48dp ostaje sinhroni SVG. Nativni splash i postojeći P6 task pin imaju isti novi materijal; veličina/anchor/halo/source-count ugovor pina nisu menjani. Launcher ikona nije menjana.
- Izvori mape su na stalnom mestu ispod pretrage/filtera, sa punim imenima i48dp dodirom. Zum je na desnoj strani; panel ga pokriva umesto da ga gura. Kamera ostavlja mesto za ovu traku. Nema promene upita, podataka, selekcije ili povratka.
- Lični radni profil ima „Obaveštenja o poslovima” u grupi područja i dostupnosti; otvara postojeći WORKER skup. Povratak/promena naloga/nepotvrđeno čuvanje zadržavaju postojeće zaštite. Nazivi u tom skupu su kraći. Nijedno obaveštenje nije uključeno samim ulaskom.
- About je sažet i daje više prostora identitetu. Interna postojeća galerija dobija stvarnu animaciju za pregled bez Auth/provider/storage pisanja.

## Kritika i ispravke pre builda

Prvi vektorski sjaj nije zadržao dubinu reference, pa je zamenjen vernim atlasom. Nezavisni pregled je uklonio pravougaone rezove ruku i odvojio semantičke obrise. Android clipRule je eksplicitan na potrošaču maske. Keširani SVG Image ne daje uvek onLoad: spremnost potvrđuje nativni Image koji ostaje montiran i kod reduced-motion/povratnog ulaza. Rok izlaska iz splash-a i originalni fallback ostaju.

## Provere i granice

Izvor: mapa270/3 suite, radni profil102/3, entry/auth/About143/5 i galerija2/1 prošli u svojim opsezima; završni objedinjeni prolaz se beleži ispod. Originalne geometrijske fixture provere ostaju. Pixel pregled iz SVG izvora nije dokaz native prikaza ili fluidnosti.

APK i stvarni ekrani ovog paketa još nisu provereni u trenutku izrade izvora. Telefon nije priključen. Nema tvrdnje o celoj aplikaciji, store spremnosti, stvarnom unauth/Auth toku ili primljenom push-u.

## AI/matching šta zaista ostaje

Postojeći V1 ne može da sačuva željene/odbijene vrste rada i opštu HITNO preferenciju. Ne sme ih prikazati kao sačuvane. Radno iskustvo je matching uslov, a trenutno nije u AI šemi. V2 zahteva povezanu šemu, session/review/hash, atomsko čuvanje, export/erasure i proveru sertifikata pre primene. Ranija WPP01 primena ostaje važeća; ovaj paket ne menja DEV/Edge/sertifikat i ne šalje push. Detalji: WORKER_PERSONAL_PROFILE_20261003.md.

## Materijal i dokaz

Provenance, ceo imagegen prompt i SHA256: assets/brand/uskoci-dimensional-20261003.json. SVG izvori ostaju uz splash i pin. Privatne pre-slike: native-w2/brand-before-about.png, stable-map-before.png. Screenshot/video i exact-build rezultat biće dodati posle instalacije.

## Izvorna integracija i kritika

Izvor1b3825fb je pushovan; APK run37148428976 gradi taj tačan izvor. Završni lokalni entry/auth/About/gallery/splash prolaz120/6 i TypeScript prošli. Nezavisni pregled potvrđuje byte/hash/dimenzije atlas-a, splash-a i pina i postojeću zaštitu Worker navigacije.

CI37148429851:427 suite/9380 slučajeva i6snapshot-a PASS; jedini FAIL je zabrana novog neposrednog čitanja širine prozora na About i lokalnoj sceni. Ispravka koristi izmereni prostor roditelja (onLayout), dok postojeća zajednička layout klasa određuje prelamanje About. Guard nije oslabljen ni proširen. Ciljani ponovni prolaz90/3 i TypeScript PASS; puna ponovna CI provera mora vezati korigovani izvor.

Dizajnerski reperi, ne kopiranje: [Airbnb opis novog proizvoda](https://news.airbnb.com/airbnb-2025-summer-release) povezuje objedinjene tokove sa dimenzionalnim i animiranim interfejsom. [Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion) i [Reduced Motion kriterijumi](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria) su kontrola za pregled. Primena u USKOČI je naša odluka: materijal na prepoznatljivim predmetima, mirne svakodnevne kontrole i izvorni uvod uz smanjeno kretanje.
