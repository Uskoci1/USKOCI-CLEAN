# Stvarne izmene u V2

## Izbor namere
Potpuno se uklanjaju oba teksta izbora i footer. Nema preostalog 32% natpisa. Boja širi polje iza istog belog panela. Dodati su diskretni vektorski motivi: traženje pomoći i preuzimanje zadatka. Originalno sklapanje, namig, putanje i slogan nisu menjani. Dupli izbor, prekid i reduced motion su provereni lokalno.

## Poruke i ponude
Velika ponovljena kartica iznad chata zamenjena je kompaktnim prihvaćenim kontekstom. Detalji se otvaraju u sheet-u. Retry/outbox semantika nije zamenjena novom logikom. Prijava dobija živ sažetak cene i broja ljudi uz završno dugme, odvojeno od 0 RSD platformske naknade. Tastatura/fokus se ne prekidaju pri tom osvežavanju.

## Mapa i izvoz
Mapa dobija lokalni transform, drag, zoom, eksplicitnu pretragu oblasti, isti podskup u Listi i reset. Ne nazivamo šemu pravom kartografijom/GPS-om. Novi zadatak ostaje dostupan, bez duplog vidljivog CTA iza otvorenog pina.

Zahtev za izvoz može da se zatraži, otkaže uz potvrdu i ponovo zatraži. Stanje je odvojeno po lokalnom nalogu; offline radnja ne glumi uspeh. Nema izmišljene gotove arhive ili download-a.

## Usklađivanje sa motorom
Read-only provera aiNeedV2Production otkrila je da postojeći server autoritet odbija izmenu Zadatka nakon prvog Dogovora. V1 lokalni editExisting je to dozvoljavao. V2 sada blokira ulaz u tu izmenu i ponovo proverava zaključavanje pri čuvanju; usmerava na Dogovor. Ovo nije nova poslovna odluka.

## Zajednički vizuelni sloj
Ujednačene su kartice, podloge, senke, čitljivost metapodataka, naslovna hijerarhija, tap-zone, fokus, sticky akcije i sheet-ovi. Dodata je kratka navigaciona animacija koja se ne ponavlja pri svakom unosu. Svi prikazi su pregledani; nisu svi pojedinačno rekonstruisani. Inventar to izričito razlikuje.

## Paket za prenos
Izdvojeni su stvarni SVG resursi, originalna motion geometrija/vremenski tok, proverena čista TypeScript matematika i neintegrisane native prezentacione reference. Dodati su binding vodič, 66 screen ugovora, očuvani 186 kriterijumi, Codex početna komanda i konkretne acceptance kapije.
