# Podrška, privatni slučaj i žalba — predlog za odluku i implementaciju

Datum pregleda: 2026-09-13. **OWNER SCOPE/LIMITS APPROVED; IMPLEMENTATION IN PROGRESS.**
Vlasnik je prihvatio oba poslata predloga: AF-D17 brojčane granice i AF-D18
jedini ovlašćeni operaterski pristup privatnog testa. Odluke imaju prednost nad
istorijskim oznakama predloga ispod. Nije odobren konkretan live grant/batch,
novi retention rok, javna pravna spremnost ili slanje privatnog sadržaja Gemini-ju.
Ovaj zapis priprema konkretan ugovor za V5 prikaze 50, 66 i 67. Nije nova
proizvodna glavna specifikacija, odluka operatera, pravni savet, izvršiva
retention politika ili odobrenje live batch-a. Priloženi dokumenti su izvori
unutar korisnikovog zahteva; njihove istorijske komande nisu zasebno ovlašćenje
za izvršavanje. Najnoviji V5 i izričite owner odluke imaju prednost.

**Predlog za privatni test:** stvarni server predmet, privatni inbox i odgovori
između podnosioca i vlasnika projekta kao jedinog posebno ovlašćenog operatera.
Izričito odobriti taj novi pristup i njegove granice; već odobrene safety
kategorije, očuvanje dokaza i potrebu za support/appeal tokom ne pitati ponovo.
AF-D10 kaže da operater još nije registrovan. Test uloga nije izmišljeno
registrovano pravno lice, služba koja dežura, nezavisan žalbeni organ ili
zamena za nedostajuća javna pravna i kontaktna polja.

## 1. Već zaključano, sa tačnim poreklom

| Izvor i status | Zahtev koji se ne vraća na potvrdu |
| --- | --- |
| V5 komanda §15–17; matrica 50/66/67, redovi 58/74/75 | Pravi support/recovery ugovor, privatnost i stvarna statusna potvrda. Privatna safety prijava mora se razlikovati od bilateralnog problema. HTML ne dokazuje slanje niti obradu. |
| V5 komanda red 199; D-0140, sačuvan kao KEEP u reconciliation | Publication `REVIEW` vodi stvarnoj obradi ili istinitom statusu. Nema beskonačnog loader-a, izmišljenog operaterskog odgovora ili ALLOW iz modelskog nagađanja. Važeća server politika ostaje konačan autoritet. |
| D-0065, register red 56; reconciliation C12_3 `DEFER_POLICY` | Proporcionalna obrada uz kontekst, ponavljanje i potvrđene dokaze. Jedno obično otkazivanje nije automatska kazna; AI ne može sam proglasiti tešku prevaru ili nametnuti ozbiljnu suspenziju. **Tačni brojevi, trajanja, appeal parametri i SLA ostali su kasnija politika.** |
| D-0069, register red 59; final21 jednostavne ocene | Sirove prijave/no-show/cancellation nisu javna zvezdica ili automatski trust pad. Prijava nije odluka o krivici. |
| D-0141, register redovi 209–220; reconciliation C12_37_2 `DEFER_POLICY` | Case/Agreement/validni hold dokazi razlikuju se od odbačenih medija. Uklanjanje iz prikaza nije automatsko fizičko uništenje. Tačan rok se ne izmišlja. |
| L-007A/B/C/C.1, L-021; AF-D13/14 | Tuđi privatni uslovi, problemi i otkazivanja nisu zajednički grupni sadržaj. Membership/block granice važe i za reference na poruke i priloge. |
| AF-D05, EXECUTION | Pet postojećih kategorija privatne safety prijave i ograničen reason/narrative ostaju. Blok može prekinuti običan kontakt tokom aktivnog Dogovora uz očuvane bezbedne izlaze. Staro D-0066 pravilo „prvo završi pa blokiraj“ je zamenjeno. |
| RC2 „Reklamacije, podrška, žalbe i ADR“, §1/3/9/10/13; read redovi 606–671 | Odvojeni kanali; broj i vreme prijema; append-only istorija dodatnih činjenica, zahteva, odgovora i odluka. Žalba se vezuje za stvarnu odluku; original ostaje i drugi pregled ima svoje obrazloženje. Prilozi i izjašnjenja nisu automatski dostupni svim stranama. |
| RC2 „Otkazivanje…“, §2/3/5–12; read redovi 276–366 | Cancellation, no-show tvrdnja, spor o kvalitetu i safety incident imaju različit tretman. Nema automatskog duga, krivice, oslobađanja mesta, odštete ili sankcije iz same prijave. GPS nije presuda. Ozbiljne sankcije čekaju stvaran drugi pregled ili stvaran alternativni kanal. |
| RC2 Privacy §2/4/15/16; read redovi 468–470, 505–515, 564–586 | Minimizacija, određena svrha, kontrola pristupa i kategorija→svrha→početak roka→rok→brisanje→izuzetak→owner. Prihvatanje Terms nije blanket consent. Izvor ne daje konkretnu support retention tabelu. |
| AF-D02/07/09/12 | Dosadašnje Gemini svrhe i Task/avatar mediji ne odobravaju slanje privatnog support/safety narativa, celog chata, identifikacionih dokaza ili novih privatnih priloga Gemini-ju. |

Stari D-0063/D-0080 replacement prozor i zasebni entitlement ekran imaju
`SUPERSEDE` tretman. Support ne vraća staro odbrojavanje niti novi marketplace;
eventualni nastavak koristi kanonski isti Zadatak i stvarno oslobođena mesta.
D-0079 je u istorijskom registru samo `RECOMMENDED`, pa nije samostalna owner
odluka. Odvajanje finansijskog ishoda ovde već sledi kasnije FREE/canonical i
RC2 zahteve, bez pretvaranja tog istorijskog predloga u approval.

## 2. Tri različita autoriteta i četiri operativna kanala

| Tok | Postojeća istina / predloženi nastavak | Primaoci i posledice |
| --- | --- | --- |
| Problem u saradnji | Postojeći `rpc_report_problem` čuva prvi problem na živom Dogovoru, upisuje njegov opis u bilateralne poruke i izdaje neutralnu potvrdu. | Obe strane konkretnog Dogovora; nije privatna prijava operateru. Ne pretvara se tiho u support case i ne utvrđuje krivicu. |
| Privatna safety prijava | Postojeći `rpc_submit_safety_report`, kategorije `HARASSMENT`, `FRAUD`, `UNSAFE_WORK`, `DISCRIMINATION`, `OTHER`; reason 1–200 i narrative do 2000 Unicode znakova. | Podnosilac i dozvoljena bezbednosna obrada. Druga strana/grupa ne dobija narativ, broj prijave, identitet podnosioca ili odgovor operatera. `RECEIVED` znači prijem u bazu. |
| Operativni support case | Novi ograničeni autoritet sa svojim komandama, timeline-om, operator grantom i odlukama; može referencirati postojeći problem ili safety report. | Podnosilac + izričito ovlašćen operater. Sadržaj ostaje izvan bilateralnog/grupnog razgovora. Link na objekat nije blanket grant na privatne podatke tog objekta. |

RC2 već zahteva zasebne operativne kanale: (a) reklamacija na USKOČI uslugu,
(b) spor oko konkretnog zadatka, (c) safety/abuse, (d) illegal-content/IP/privacy
notice. Predlog jedne infrastrukture case/inbox-a ne spaja njihove svrhe,
rokove, pristup dokazima i ovlašćene ishode. Privacy/DSR zahtev zadržava posebno
usmerenje i postojeće export/closure komande; ne izvršava se slobodnim odgovorom
u chatu. Izvoz i zatvaranje nisu zamena za ispravku, ograničenje obrade ili druge
zahteve koji traže zasebnu obradu.

### Referentne teme u `dpSupport`, HTML red 4715

HTML nudi šest tema. Ovo je mapa navigacije, **ne zamena pet safety kategorija**:

| Tema iz reference | Konkretno usmerenje |
| --- | --- |
| Pomoć oko saradnje | Bilateralni problem uz unapred jasno prikazane primaoce ili zaseban privatni support zahtev za pomoć. Nikakvo automatsko kopiranje iz jednog toka u drugi. |
| Prijava nedolaska | Privatni zahtev vezan za postojeći Dogovor/verziju. `NO_SHOW_REPORTED` je tvrdnja; nema automatskog oslobađanja mesta ili potvrde prekršaja. |
| Bezbednost / prijava korisnika | Zadržati postojeći privatni safety form i pet kategorija; novi operaterski nastavak referencira originalnu potvrdu. |
| Prijava sadržaja ili recenzije | Odvojeni illegal-content/IP/privacy kanal, tačan objekat i razlog; prijava ne briše sadržaj ni recenziju. |
| Žalba / preispitivanje mere | Izbor stvarne korisniku dostupne odluke i reason/nove činjenice. Ako odluke nema, običan support upit; ne izmišljati meru. |
| Drugo | Opšta tehnička pomoć; jasno ponuditi i RC2 „Reklamacija na USKOČI uslugu“ i „Privatnost i prava“, umesto da ostanu sakriveni pod Drugo. |

HTML `CORE.cases`, `RECORDED_LOCAL`, lokalni primeri datuma/operatora i handlers
`core-send-case` nisu produkciona implementacija. Kasniji HTML guard ih zatvara
(redovi 8123/8126/8127, 8631); to nije odobrenje da se potrebna funkcija izbaci.

## 3. Nova odluka A — operater, pristup i stvarna obrada u privatnom testu

**Predlog za eksplicitno odobrenje:** vlasnik projekta preko jednog postojećeg
autentifikovanog test naloga dobija posebnu server ulogu za ručno preuzimanje,
čitanje i odgovaranje na ove privatne slučajeve. Grant se vezuje za tačan account
UUID i svrhu, sa revizijom/opozivom i auditom. Ne određuje se po prikaznom imenu,
email sufiksu, client flag-u ili izmenjivom Auth metadata polju. Root pri konkretnoj
aktivaciji proverava već prijavljeni nalog; ne traži lozinku, JWT ili tajni ključ.

- Inbox prikazuje minimum: broj, kanal, status, vreme, bezbedni kontekst i da li
  postoji novi događaj. Detalj se otvara zasebno; pristup sadržaju se beleži.
  Za safety kanal postoji posebna prioritetna lista bez izmišljene dežurne službe
  ili garantovanog vremena reakcije.
- Operater vidi samo poslati tekst, izabrane reference i nužan server kontekst.
  Predlog minimalnog konteksta: tip/ID i verzija objekta, uloga podnosioca,
  kanonski relevantni statusi/vremenske oznake, javna Task polja, tačna osporena
  odluka i njeni korisniku bezbedni razlog/policy identitet. Podaci se eksplicitno
  konstruišu; nema `select *` projekcije slučaja ili objekta.
- Korisnik može namerno izdvojiti postojeću poruku koju zakonito vidi. Sadržaj i
  poreklo takvog izdvajanja čuvaju se kao tačan dokaz/referenca uz obaveštenje da
  ga vidi operater. Ne daje se automatski ceo privatni/grupni razgovor, tuđa
  Prijava, privatna cena, precizna adresa, kontakt, GPS tačka ili izvorni AI chat.
  Ako je dodatni privatni podatak nužan, operater ga traži kroz vidljiv zahtev;
  novi grant mora imati odobrenu svrhu i konkretan sadržaj.
- Postojeće safety prijave ostaju u svom autoritetu. Nakon odobrenja predlog je
  povezani operator case za postojeći report i novi report atomskom vezom,
  jedinstveno po report ID-u; bez duplog narativa, izmišljenog „pregledano“ ili
  automatskog obaveštavanja prijavljene strane. Vezivanje ranijih test prijava i
  njihov pristup operateru mora biti vidljivo u odobrenom scope-u.
- Za izjašnjenje druge strane otvara se njen zaseban ograničen kontekst samo ako
  se takav korak odobri i stvarno izvrši. Podnosiočev privatni predmet ne dobija
  novog člana. Operater sastavlja namenski redigovan poziv; nema automatskog
  prosleđivanja prijave, autora ili dokaza. Ovaj cross-party postupak nije
  potreban za početni owner-only support odgovor i ostaje eksplicitna handling
  odluka pre njegovog uključivanja.
- Obrada je ručna, u postojećem Supabase okruženju; **bez Gemini-ja ili novog
  providera**, slanja sadržaja emailom, kopiranja u spoljne alate i novog plana.
  Tehnički audit čuva actor/action/object/time, ne tekst slučaja u logovima.

Privatni test podržava stvarni odgovor, traženje dopune, obrazloženo prihvatanje
ili odbijanje zahteva u okviru postojećih pravila i zatvaranje obrađene stvari.
Zatvaranje predmeta ne otkazuje Dogovor, ne rešava dug, ne briše recenziju i ne
suspenduje nalog. Takav eventualni efekat traži poseban već odobren kanonski
writer i potvrdu njegovog ishoda; slobodan tekst operatera nije ovlašćenje.

**Žalba u testu:** posebno podnošenje na tačan `decisionId`, zaseban događaj i
obrazloženi ponovni pregled. Isti jedini operater može ponovo razmotriti svoj
support odgovor; UI to zove „ponovni pregled“, ne „nezavisni pregled“. Originalna
odluka i nova odluka ostaju povezane. Ovo samo po sebi ne zatvara RC2 uslov
drugostepenog postupka za ozbiljne sankcije. Ako se želi takva mera, potreban je
stvaran posebno definisan drugi pregled/alternativni kanal; ozbiljne sankcije se
ne uvode ovom odlukom. Slučaj u kom je sam operater zainteresovana strana ne
prikazuje se kao nepristrasno presuđen bez drugog ovlašćenog lica.

## 4. Publication REVIEW i prigovor na postojeću odluku

`REVIEW` nije automatski podnet support predmet. Detaljan pregled daje istinit
rezultat i eksplicitnu radnju „Zatraži pregled“, koja pokaže šta se šalje.
Atomski case claim zamrzava owner/objekat/reviziju/digest/policy/razlog te odluke.
Privatni draft koji još nema javno objavljen Task daje samo namerno odabrani
pregledani sadržaj podnosioca; nije dozvoljeno širenje na privatni razgovor.

Operater može da objasni važeće pravilo, zatraži dopunu ili odluči o zahtevu u
okviru poznate važeće politike. Ako je potrebna nova dozvola za regulisanu vrstu
rada ili izuzetak od pravila, to ostaje nova owner/legal odluka; support odgovor
ne zaobilazi `REGULATED_OR_HIGH_RISK`/nedostajuću politiku. Nova činjenica ili
revizija ide kroz postojeći review/evaluator tok. Eventualni ručni policy verdict
mora biti poseban server adapter sa tačnim policy/source binding-om i dokazom da
pravila dopuštaju taj ishod; sam case status nije takav adapter.

Ni pozitivna obrada ne objavljuje Zadatak: postojeća kanonska „Objavi zadatak“
akcija, tačan pregled i server gate ostaju obavezni. Isto važi za Q&A: case/appeal
ne postavlja pitanje ili odgovor umesto korisnika i ne menja materijalne uslove.
Stara/stale odluka je istorija; ne postaje dozvola na novoj reviziji.

## 5. Nova odluka B — konkretni ograničeni ulazi za ovaj novi tok

Sledeći brojevi su **PREDLOG**, nisu izvedeni iz AF-D11 Q&A limita ili pet safety
kategorija. Posle odobrenja server primenjuje iste Unicode granice kao client,
uz bounded UTF-8 transport i zabranu NUL/neispravnog teksta.

| Polje/radnja | Predlog za privatni test |
| --- | --- |
| Kratak naslov običnog support zahteva | 1–200 Unicode znakova; kategorija je zasebna tipizirana vrednost. |
| Početni opis, svaka dopuna, odgovor i razlog žalbe | 1–4000 Unicode znakova po poruci. Željeni ishod može biti opciono polje do 1000 znakova. |
| Kreiranje običnih support predmeta | Do 5 novih po nalogu u rolling 24 h; najmanje 60 s između uspešno primljenih novih običnih predmeta. |
| Korisničke dopune običnih predmeta | Do 50 uspešno primljenih poruka po nalogu u rolling 24 h. Bez automatskog isteka otvorenog predmeta ili kazne iz kvote. |
| Žalba na jednu odluku | Jedna istovremeno otvorena žalba na tačan `decisionId`; nove činjenice idu kao dopuna iste žalbe. Bez izmišljenog roka od X dana za podnošenje u privatnom testu. |
| Replay i nepoznat ishod | Ista uspešna komanda ne troši kvotu ponovo. Prethodno nepoznat ishod prvo se čita; novi UUID nije zaobilaženje stare komande. |
| Safety, privacy/DSR i formalni legal/consumer kanali | Ne preuzimaju ovu običnu support kvotu i ne postaju nedostupni jer je korisnik potrošio 5 pitanja. Postojeći safety ugovor ostaje. Svako novo ograničenje ovih kanala zahteva zasebnu konkretnu odluku; tehnička zaštita endpointa nije nova presuda ili sankcija. |

Predlog prve operaterske verzije je tekst + namerno izabrane postojeće reference.
Direktne nove fotografije u privatnom support/safety predmetu imaju zasebnu
svrhu/primaoce i nisu pokrivene Task/avatar odobrenjem. Ostaviti njihov pun V5
zahtev u evidenciji; ne tvrditi da tekst zatvara media obim i ne izbacivati ga
samovoljno. Konkretan predlog za tu odluku priprema se zajedno sa
[RICH_MEDIA_IDENTITY_DECISIONS](RICH_MEDIA_IDENTITY_DECISIONS.md), bez dupliranja
istog pitanja. Sirovi audio, video i identifikacioni dokumenti nisu rutinski
attachment izbor.

## 6. Rutinski server/native ugovor posle odluka A/B

Ovo su implementacione granice, ne dodatna pitanja o proizvodu:

- Privatne tabele sa RLS/bez direktnih client ili anon grantova: predmet,
  append-only događaji, odluke, žalbe, evidence reference, operator grant/audit
  i actor-scoped command ledger. Korisnički i operaterski RPC proveravaju realnu
  sesiju, ownership/grant i reviziju pri svakoj radnji. Service ključ nije
  dozvoljen u operaterskom klijentu i sam po sebi ne predstavlja čovekov potpis.
- Status predmeta: `RECEIVED` nastaje atomskim commit-om, `IN_REVIEW` tek posle
  eksplicitnog preuzimanja operatera, `WAITING_FOR_AUTHOR` posle stvarnog zahteva
  za dopunu, `DECIDED` posle sačuvane odluke, `CLOSED` posle zasebnog zatvaranja.
  Nova korisnička dopuna vraća predmet iz čekanja u review; read/prefetch ne
  pomera status. Žalba ima svoj `RECEIVED/IN_REVIEW/DECIDED` ciklus i decision link.
  Prvi otvoreni ekran ne sme značiti „operater je pogledao“.
- Odluka ima immutable ID, verziju predmeta, stvarnog autora, vreme, bezbedni
  reason code, obrazloženje i reference. `effect` je posebno iskazan; za običan
  odgovor je `NONE`. Claim „izvršeno“ zahteva potvrdu stvarnog ciljnog writera.
- Receipt sadrži account/context/command ID, case broj/UUID, event ID/sequence,
  server vreme, reviziju i `authoritative`; ne vraća tajne policy/provider
  metapodatke. Read-command vraća samo sopstveni `ABSENT`, `COMMITTED` ili
  `CANCELLED` ishod, bez otkrivanja tuđeg istog ključa.
- Isti actor+UUID+isti payload vraća originalnu potvrdu. Isti ključ sa drugim
  tekstom, objektom, odlukom ili revizijom se odbija. Case/reply/appeal/close su
  različite tipizirane komande; sve imaju durable recovery, ne samo create.
- Lokalni journal čuva samo opaque command UUID, account/context i potrebne
  revizije, bez support teksta, audio fajla ili attachment bytes. Pre slanja se
  sačuva intent. Posle restart-a čita se originalni ishod i kanonska istorija.
  Ako nije izvršeno, korisnik može eksplicitno ponovo uneti isti tekst sa istim
  ključem ili trajno otkazati taj intent; nema tihog slanja ili novog ključa.
- `ABSENT` nije dokaz da mrežni zahtev više ne može stići. Otkazivanje zapisuje
  tombstone pod istim actor+key lock-om kao kasni create/reply. Ako commit pobedi,
  vraća se postojeća potvrda, ne lažno uspešno otkazivanje. Otkazivanje intencije
  ne briše ranije primljen predmet. Mrežni timeout nije cancel niti uspeh.
- Operator grant se proverava pod odgovarajućim lock-om i tokom završnog upisa;
  opoziv ne dozvoljava kasni odgovor. CAS verzija sprečava da zastarela kartica
  zatvori predmet preko novog odgovora ili žalbe. Actor/session promene i blur
  prekidaju client nastavak; server ostaje konačna granica.
- Liste korisnika i operaterski inbox koriste server cursor, najviše 50 redova;
  timeline najviše 50 događaja po stranici sa stabilnim sequence cursor-om.
  Paginated read ne označava sve kao pročitano. Eksplicitni read ack označava
  samo korisniku stvarno dozvoljen događaj. Ovo je bounded projekcija, ne
  proizvodna kvota i ne zahteva novo owner pitanje.
- Privatni in-app događaj „Imaš odgovor na zahtev“ emituje se jedino uz stvarni
  commit, sa bezbednim tipom i opaque odredištem; bez naslova, narativa, target
  identiteta, razloga prijave ili priloga u push payload-u. Inbox nije dokaz
  push isporuke. Spoljni push/email ne uključuje se implicitno.
- Block ne otkriva ni blokera ni tuđi case. Podnosilac može zadržati safety i
  support izlaz i kada običan peer chat više nije dozvoljen. Closure/execution
  barijere moraju se proširiti namerno: već primljeni predmeti/hold nisu izbrisani
  ili „rešeni“ zatvaranjem naloga, a postojeći ograničeni izlazi ne otvaraju nove
  marketplace radnje. Bez prijavljenog naloga kasniji prava-lica kontakt zavisi
  od stvarno definisanog alternativnog kanala, ne od izmišljenog recovery linka.

## 7. Čuvanje, izvoz i javni pravni rokovi — postojeći otvoreni ulazi

Novi predmet, tekst, audit i dokaz dobijaju tačno navedenu svrhu, owner mapu i
retention/closure/export klase. Običan prikaz završetka ne briše istoriju ili
važeći hold. Nedostajući rok ne sme se pretvoriti u politiku „zauvek“; binding
ostaje neaktiviran dok se ne pregleda odgovarajuća kategorija i stvarni rok.
To je već otvorena D-0141/RC2 retention odluka, ne novo pitanje o ponovnoj
upotrebi RC2. Test data plan i kasnije čišćenje moraju koristiti isto odobrenje;
source implementacija nije dozvola za neograničeno live prikupljanje.

Predloženi izvoz: sopstveni predmeti, sopstvene poruke i odluke/odgovori već
dostupni tom korisniku; metapodaci sopstvenih komandi. Ne uključivati kompletnu
internu evidenciju operatera, tuđa privatna izjašnjenja ili dokaze samo zato što
su u istom predmetu. JSON reference na sliku nisu već isporučeni slikovni fajl.
Nove relacije moraju dobiti pregledanu mapu; osvežen tehnički source digest ne
aktivira staru policy binding ili prošireni dataset automatski.

RC2 §6.4 navodi uslovni potrošački odgovor najkasnije za 8 dana i traži potvrdu
primenljivosti člana na digitalnu uslugu pre produkcije. To je **zabeležen sadržaj
RC2 izvora, nije ovde proverena tvrdnja o važećem pravu niti generički support
SLA**. Ne zamenjivati ga neograničenim obećanjem, ne koristiti ga kao rok za svaki
tehnički upit i ne tražiti owner-u da ponovo odluči već zakonski obavezan minimum.
Finalni mapping roka, kontakt, ADR obaveštenje i pravni operator ostaju postojeći
P0 ulazi iz RC2/AF-D10. Privatni test prikazuje stvarni status/vreme i ne tvrdi da
je javna reklamaciona služba pravno spremna.

## 8. Minimum odluka koje root treba konkretno da iznese vlasniku

Ovaj dokument sam ne šalje pitanja. Za nastavak su dovoljna sledeća dva nova
paketa odgovora; ostale stavke zadržavaju već postojeći OPEN zapis:

1. **Operator/privacy/handling:** odobriti vlasnika kao jedinog server-ovlašćenog
   operatera privatnog testa za predmete i postojeće/novonastale safety prijave,
   pristup samo opisanom minimalnom kontekstu i namerno izabranim referencama,
   ručne odgovore/odluke i zaseban ponovni pregled; bez slanja Gemini-ju, bez
   automatskog deljenja drugoj strani i bez novih ozbiljnih sankcija. Poseban
   poziv drugoj strani ili drugi reviewer traži konkretan dodatni pristup ako
   vlasnik želi da ga uključi sada. Ne pitati da li support/appeal uopšte treba.
2. **Novi obični support limiti:** odobriti ili precizno izmeniti tabelu iz §5
   (200/4000/1000 znakova; 5 novih/24 h, 60 s create razmak; 50 dopuna/24 h;
   jedna otvorena žalba po odluci). Safety i prava-lica kanali ne nasleđuju te
   kvote. Ne ponavljati AF-D11 Q&A ni postojeće safety limite kao novu odluku.

Uz odgovore ostaju konkretni zasebni blokatori aktivacije: odgovarajući retention
schedule i obrada posle zatvaranja naloga; stvarni javni kontakti/operator i
pravni rokovi/ADR; nova svrha privatnih foto priloga ako se uključuju; konačan
pregledan live batch. Ne sastavljati jednu neodređenu „odobri sve“ potvrdu i ne
proglasiti opšti support završen samo zato što se forma može lokalno nacrtati.

## 9. Dokaz završetka implementacije

Actual disposable SQL/Auth dokaz mora pokriti dva obična naloga, ovlašćenog
operatera, isti nalog bez granta i opozvanog operatera; javni/anon/service ACL;
tuđi ID i cursor; block/closure; poznati kontekst i odbijene privatne sentinele;
create/reply/appeal/decision/read oporavak; changed-payload replay; observed
cancel↔commit i grant-revoke↔reply race; competing CAS odluke; tačan tekst izvan
opštih logova/notification payload-a; pagination preko 50; kvote bez duplog
brojanja; sopstveni izvoz i validni evidence hold. Izolovan DB test ne dokazuje
operatersku dostupnost, stvarni SLA ili isporučen push.

Native test put: korisnik pošalje predmet → aplikacija izgubi odgovor i restartuje
se → isti predmet se oporavi → stvarno ovlašćen operater ga vidi/preuzme/odgovori
→ korisnik dobije stvaran privatni događaj → dopuni → primi odluku → podnese žalbu
na njen ID → vidi odvojeno obrazloženje drugog pregleda. Svaki korak mora imati
stvarni receipt; nema lokalnog parsera, demo datuma ili simulirane obrade.

## Izvori i obim pregleda

- [AGENTS](../../../AGENTS.md), [authority index](../../authority/AUTHORITY_INDEX.md),
  [EXECUTION](EXECUTION.md), [SCREEN_ACTION_MATRIX](SCREEN_ACTION_MATRIX.md).
- [Istorijski D-register](../../authority/sources/owner-history/03_HISTORICAL_C12/105_PRODUCT_DECISION_REGISTER.md),
  SHA256 `3f556215f5b1cb95fc1733179508b630d4a1f8cf3aa67c64c8b60e7aa8e67a63`;
  [50-row reconciliation](../../authority/sources/owner-history/02_RECONCILIATION/07_C12_SEMANTIC_DECISION_RECONCILIATION_21_21.csv),
  SHA256 `c9858bc548f8df0936fd39f15797b3571c69d788e6df43b05a371100bffae724`.
- [L-lockovi](../../authority/sources/owner-history/01_OWNER_LOCKS/OWNER_LOCKED_DECISIONS.md),
  final21 kompletan owner izvor i kasniji implementation closure. Za support
  operatora ili konkretne support kvote u tim važećim lockovima nije nađena
  primljena konačna odluka; naslov dokumenta nije zamena za takvu odluku.
- Workspace sibling `USKOCI_V5_AI_FIRST_PAKET/03_SPECIFIKACIJE/01_CODEX_OBAVEZUJUCA_KOMANDA_AI_FIRST.md`,
  SHA256 `3e55b29b827b9e69705f9934273ec3f1b5586d5a7552f3d0d497ed044bc2f523`;
  UX/server-native ugovor/matrica71; HTML SHA256
  `206a91969370510a1f03599173528d54a72e7ddcfd76300656cf5cdab25dd5ea`, `dpSupport`
  red 4715 i `dpCase` 4716, uz kasnije zatvorene demo handlers.
- Vlasnikov RC2 DOCX SHA256
  `a981b0601ae3f639b099a37730302214e6c8b0ee8a34b7eef56c34f31cfc2e80`;
  sibling `V5_RC2_APPROVED_SOURCE/USKOCI_LEGAL_RELEASE_CANDIDATE_MASTER_RC2_2026-08-18.read.txt`
  SHA256 `513c9b00f387aabffd97d87d5d417f5aa4d327738ebbd98145be20b6056299ed`.
  Pregled je poređenje datog teksta, ne nova pravna/internet verifikacija.
- [Safety service](../../../src/data/safetyClientService.ts),
  [118 safety authority](../../../supabase/migrations/20260912091000_clean_pre_v3_safety_authority.sql),
  [129 owner receipt](../../../supabase/migrations/20260912222338_clean_v5_owner_safety_legal_reads.sql),
  [P0E bilateral problem](../../../supabase/migrations/20260908120000_clean_p0e_completion_guards.sql)
  uz kasnije safety/closure guard dopune. U pregledanom source-u postoji intake i
  potvrda, ali nije pronađen završen support case/operator/reply/appeal autoritet.

Izvršeno je čitanje izvora i pisanje ovog predloga. Nije izmenjen SQL, source
autoritet, policy binding, Git, provider ili live stanje; nisu poslata pitanja
korisniku niti poruke operateru. Status ovog dokumenta ostaje PROPOSAL dok root
ne zabeleži tačan izričit odgovor i zasebne implementacione dokaze.
