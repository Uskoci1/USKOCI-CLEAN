# Identitet: sandbox ili stvarna aktivacija

Pregled zvaničnih izvora: **2026-09-13**. Predlog odluke, ne izabran provider,
odobrenje biometrije, trošak ili live batch. Nije otvoren provider nalog, poslat
dokument/selfie, kontaktirana prodaja ili pozvan plaćeni API.

**Za sadašnji privatni Android test moguće je pripremiti vezu sa pravim provider
sandbox-om, ako njegov nalog zaista dopušta ovaj status operatera. Sandbox ne
potvrđuje ničiji identitet i ne otključava produkcionu podobnost.** Nije potvrđeno
da trenutno postoji upotrebljiv USKOČI identity-provider nalog.

## Već odlučeno

[D-0133/134/137](../../authority/sources/owner-history/03_HISTORICAL_C12/105_PRODUCT_DECISION_REGISTER.md)
i njihova reconciliation traže jednu account-level istinu za obe namere: samo
aktuelan, važeći server rezultat daje bedž. Opoziv/istek uklanja ga iz obe
projekcije. Bedž ne znači stručnu licencu, pouzdanost ili garantovanu bezbednost;
dokazi nisu javni. V5 matrica42 ostaje obavezna funkcija. AF-D10 potvrđuje da
operater još nije registrovan. [Postojeći audit](RICH_MEDIA_IDENTITY_DECISIONS.md#6-identitet-poznato-značenje-nedostaje-stvarni-metod)
beleži zatvoren `identity_admitted` i nedostajući stvarni verification tok.
Ručno postavljen `verified=true`, Auth nalog, avatar ili poznanstvo sa owner-om
nisu verifikacija i nisu predložena prečica.

## Šta zvanični izvori stvarno potvrđuju

| Opcija | Sandbox i Android/React Native | Srbija / operater | Javno objavljen trošak i granica |
| --- | --- | --- | --- |
| **Persona — kandidat za izolovan sandbox, dostupnost naloga još neproverena** | Sandbox nema usage naplatu ni stvarne provere; ishodi se kontrolišu test podacima. Postoje RN SDK i provider-hosted redirect. To dopušta test server webhook/recovery veze, ne pravi identity PASS. [Environments](https://docs.withpersona.com/environments), [integracije](https://docs.withpersona.com/how-persona-works), [RN vodič](https://docs.withpersona.com/react-native-sdk-v2-integration-guide). | Tačna RS dokumenta nisu javno potvrđena ovim pregledom: coverage mapa traži važeći plan/program i nije dostupna trial nalogu. Prihvatanje neregistrovanog srpskog projekta za sandbox mora se proveriti pre registracije koja bi davala neistinite poslovne izjave. [Coverage uslovi](https://help.withpersona.com/articles/2e5oF5LSDBKT0ZsYaj45in/). | Standardni Essential: od **USD250/mesec, najmanje12meseci**. Startup program nije opšte besplatno pravo: traži incorporated business, odobrenje i karticu; objavljuje500 besplatnih mesečnih ID provera iUSD1 preko kvote. Ne pretpostaviti da AF-D10 projekat ispunjava te uslove. [Cenovnik](https://withpersona.com/pricing), [program/uslovi podobnosti](https://withpersona.com/startups). |
| **Veriff — dokumentovana RS pokrivenost, self-serve trenutno ne odgovara AF-D10** | Test integracije nisu naplaćene ni stvarno proverene. RN SDK navodi AndroidAPI26+, Expo plugin i EAS Build, kao i webhook uslov; postoji hosted flow. Dokazana kompatibilnost sa našim Expo57/RN0.86.3 tek bi se testirala. [Test integracije](https://devdocs.veriff.com/docs/how-to-create-an-integration), [RN vodič](https://devdocs.veriff.com/v1/docs/react-native-sdk-guide). | Srbija je navedena u dokumentnoj coverage tabeli. **Self-Serve Addendum §1 traži pravno lice, ne privatnog pojedinca; §2 traži IDV predstavnika pre trial-a i kasniji onboarding/KYB.** Podržan srpski dokument ne rešava poslovnu podobnost. [Coverage](https://www.veriff.com/supported-countries), [obavezujući self-serve uslovi](https://www.veriff.com/documents/ss-addendum/ver-ssa-2501). | Essential javno navodi **USD0.80/provera i USD49 mesečni minimum**. Cena navodi15-dnevni trial/50 sesija, dok Addendum navodi15dana/20sesija i zahtevan IDV; ne obećavati50 ili no-document onboarding bez potvrde stvarnih uslova. [Aktuelni cenovnik](https://www.veriff.com/plans/self-serve), [Addendum §2/4/5](https://www.veriff.com/documents/ss-addendum/ver-ssa-2501). |
| **Stripe Identity — tehnički upotrebljiv SDK, poslovna RS kapija nije otvorena** | Zvanični vodič ima RN SDK, native sheet i web redirect; integracija zahteva aktiviran Stripe nalog i Identity prijavu. Povratak sa ekrana nije konačan dokaz: rezultat stiže API/webhook putem. [RN](https://docs.stripe.com/identity/verify-identity-documents?platform=react-native&type=new-integration), [redirect](https://docs.stripe.com/identity/verify-identity-documents?platform=web&type=redirect). | Srbija nije na objavljenoj listi podržanih **business locations** za Identity. Ne birati lažnu državu, tuđe pravno lice ili Stripe Connect listu kao zamenu. Document coverage i poslovna podobnost su različite provere. [Zvanična podobnost](https://docs.stripe.com/identity/use-cases). | USD cenovnik prikazuje **USD1.50 za dokument+selfie**, prvih50 provera besplatno; cena/ponuda ne zaobilazi poslovnu kapiju. [Identity cena](https://stripe.com/identity). |

Ovo je ograničeno poređenje tri kandidata, ne tvrdnja da drugi provider ne postoji.
Nije pronađena potvrda da je bilo koja produkciona opcija već dopuštena sadašnjem
USKOČI operateru. Posebno ugovoreni razvojni pristup može promeniti taj zaključak
tek kada stvarno bude odobren; marketinška demo stranica to ne dokazuje.

## Opcija A — stvarna sandbox integracija bez pravih dokumenata

**Konkretan scope za owner izbor:** proveriti prihvatljivost Persona sandbox/trial
pristupa za neregistrovan projekat, pa samo ako stvarni uslovi to dopuštaju,
povezati test environment sa USKOČI serverom i privatnim Android prikazom.
To nije izbor Persona-e za buduću produkciju. Eventualno stvaranje naloga,
poslovne izjave ili slanje pitanja provajderu nisu izvršeni ovim dokumentom.

Koristiti isključivo izmišljene test podatke/provider presets i bezlične test
slike. Persona vodič izričito kaže da se u sandbox ne unosi pravi PII, a Simulate
podržava izmišljene government-ID/selfie rezultate.
[Zvanični test vodič](https://docs.withpersona.com/tutorial-ios-sdk-precreate),
[Simulate](https://help.withpersona.com/articles/5NB4eGgy0k8oRs5O5sDOR1/).
Sandbox ne znači da slika slučajno poslata provajderu nije obrađena ili sačuvana;
zato se prava lična karta, pasoš ili selfie ne koriste ni „samo za test“.

Rutinski adapter: server-owned opaque attempt sa `environment=SANDBOX`,
account/session vezom, exact request ID-om i durable receipt-om; tajne samo na
serveru; autorizovan resume istog attempt-a; provera potpisa webhook-a,
duplikata/redosleda i status readback-a. Client callback/deep link samo vraća u
aplikaciju. Sandbox uspeh može prikazati „Test provere završen“ u privatnom test
ekranu, a **nikada javni bedž ili `identity_admitted=true`**.

Hosted redirect smanjuje promene native zavisnosti; RN SDK daje ugrađen native
tok, ali zahteva zaseban kompatibilan APK i stvarnu proveru kamera/otkazivanje/
background/restart ponašanja. Ovo su tehničke alternative, ne dokaz da je jedan
od SDK-ova već kompatibilan. Provider-hosted verifikacija nije prenošenje V5 HTML
prototipa u WebView.

## Opcija B — priprema stvarne verifikacije

Pre prvog pravog dokumenta/selfie-ja potrebni su konkretan prihvaćen provider i
ugovorna podobnost operatera/RS use-case-a, tačno podržani dokumenti i provere,
poseban budžet/plan, data-processing ugovor, odobrene zemlje obrade i processor
mapa, privacy/legal osnov i korisničko obaveštenje, tačni retention/deletion i
appeal/revoke/expiry postupci. Ovo su otvoreni RC2/V5 ulazi; sandbox ih ne zatvara.

„Dokument+selfie“ može uključiti poređenje geometrije lica, liveness, dokumentna
polja i uređajne/IP signale. Persona eksplicitno opisuje biometriju, customer
retention uputstva i primarne data centre SAD/Nemačka. Njena identity sekcija
nema isto automatsko trenutno brisanje kao zasebna age-assurance sekcija; ne
obećavati zero retention ili EU-only na osnovu njih.
[Processor Privacy Policy, Identity Verification](https://withpersona.com/legal/privacy-policy).
Veriff planovi takođe uključuju biometriju/liveness; Stripe dokument+selfie
opisuje biometrijsko uparivanje.
[Veriff plan](https://www.veriff.com/plans/self-serve),
[Stripe Identity](https://stripe.com/identity).

Predlog minimizacije za USKOČI: provider direktno prikuplja odobrene dokaze;
USKOČI čuva samo potrebnu vezu/status/vremena/policy/decision reference. Ne praviti
dodatni Storage arhiv ličnih karata ili selfija. „Ne kopiramo kod nas“ ne uklanja
odgovornost za provider obradu. Stvarna aktivacija account-level statusa mora
imati potpisanu/verifikovanu odluku, environment/policy binding, opoziv/istek,
freshness i jedinstvenu javnu projekciju za obe namere. Samo dokument bez
provere da pripada osobi ne sme se preimenovati u isti nivo uverenja.

**Postojećih USD5 za Gemini ovo ne pokriva:** nema identity verifikacije,
biometrije, selfija/dokumenata, drugog providera, pretplate ili njegovih API
troškova u AF-D01/02/07/09/12 odobrenju. Google kredit nije prenosiv provider
budžet, a Gemini opis slike nije identity-verification autoritet.

## Minimalno pitanje za root, tek kada je potrebno owner opredeljenje

Predlog formulacije, nije već poslato pitanje: **„Za proveru identiteta želiš li
prvo Persona sandbox vezu sa izmišljenim podacima i bez javnog bedža, pod uslovom
da dozvole pristup neregistrovanom projektu, ili da sada pripremimo stvarnu
verifikaciju sa zasebnim provider ugovorom, obradom dokumenta/selfija i budžetom?“**

Ako se izabere sandbox, nije potrebno ponovo pitati o već zaključanom značenju
bedža ili dve namere. Ako onboarding traži registraciju/plaćanje/pravi dokument,
taj uslov se prijavljuje pre zavisne radnje; ne izmišlja se firma. Ako se izabere
stvarna verifikacija, sledeća odluka mora biti konkretna ponuda i privacy scope,
ne blanket „odobri KYC“. Matrica42 ostaje OPEN dok stvarna tražena proizvodna
funkcija nije povezana i proverena; sandbox napredak ne uklanja funkciju iz obima.

Provera je bila read-only: zvanične javne dokumentacije/uslovi/cene i postojeći
lokalni owner lockovi. Nema SDK instalacije, promene SQL-a, account registracije,
naloga sa ličnim podacima, provider poziva ili live aktivacije.
