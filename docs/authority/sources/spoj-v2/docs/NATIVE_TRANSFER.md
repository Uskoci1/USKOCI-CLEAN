# Kako se ovaj HTML prenosi u mobilnu aplikaciju

## Ne prenosi se jedna HTML stranica kao završeni native proizvod
Vizuelni tokeni → postojeći theme. SVG putanje → react-native-svg resursi. Layout → postojeće View/Text/ScrollView/FlatList/Pressable komponente. DOM sheet → postojeći native modal/sheet sa Back/focus pravilima. CSS motion → postojeći native scene clock/Reanimated/Animated. Inputi → native TextInput i prave tastature. Demo state/commands → NE PRENOSI SE; tu se koriste postojeći typed source/hook/RPC autoriteti.

Ne postavljati ceo proizvod u WebView radi lažnog identičnog screenshot-a. Specifičan već odobren web/native element u postojećem repo-u zahteva zasebnu odluku; ovaj paket ne uvodi WebView arhitekturu.

## Redosled
**A. Preflight i reuse.** Proveri najnoviji worktree, source ownership, entry/splash/recovery, source index, service contracts i sve postojeće UI komponente. Gde već postoji dobar hook/adapter, preuzmi ga.

**B. Shared presentation.** Tokeni, originalni assets, header/nav, field/action/sheet, TaskCard i accepted AgreementContext. Render poređenje sa V2 na referentnoj širini390 i uslovima320/360/large text.

**C. Prva stvarna vertikala.** Task projection → detalj → prava Prijava → exact izbor → CONFIRMED Dogovor → poruka. Ne povezivati fake source da bi izgledalo uspešno. Ako publication blokira novi test, koristi odobreno test okruženje i jasno označen postojeći fixture na tom okruženju; ne aktiviraj live politiku da prođe demo.

**D. Autoritativni unos i promene.** AI V2 poruke/činjenice/review/nacrt; objava je zasebna kapija. Izmene i završetak po server pravilima. Unknown outcome čuva isti requestId; nova poslovna namera dobija nov ID.

**E. Preostale celine.** Profili, kalendar, Inbox/preferences, prava mapa i lokacije, reviews, safety, account/export, voice/push. Radi po sposobnostima stvarnog motora, ne po broju nacrtanih dugmadi.

## Izgled plus ponašanje
Svaki native ekran mora čuvati entity ID, reviziju i permission kontekst. Povratak iz detalja čuva filtere, query, stranu liste, položaj scroll-a i aktivnu nameru. Pri promeni naloga se ne prikazuje odgovor/nacrt/receipt prethodnog naloga. Destructive action ima posledicu i potvrdu; cancel ne menja ostale podatke.

Soft keyboard ne sme prekriti aktivan unos ili dugme. Testirati Android Back (tastatura → sheet → screen), safe-area/statusbar, landscape ili eksplicitno podržanu orijentaciju, font scaling i duže stvarne stringove. DOM large-text simulation nije zamena za sistemski text scaling.

## Šta ponovo koristiti iz repozitorijuma
Read-only package snapshot već navodi react-native-svg, Reanimated, gesture-handler i safe-area-context u package.json; ne uvoditi novi framework za iste zadatke. Postoje src/ui/entry i src/ui/referenceEntry, kao i AgreementChat. Pročitaj ih pre zamene. Ne prenosi sedam generacija HTML wrappera u native codebase.

## Kritične razlike
Originalna SVG mapa je simbolična. Stvarna mapa mora dobiti provider, javne koordinate/oblasti, settled/debounced viewport query i privacy pravila. Nema lokacije bez dozvole ili ručnog izbora. Voice zahteva stvaran capture/STT. AI zahteva stvarni server/provider. Push zahteva stvarnu isporuku/receipt. Izvoz zahteva stvarnu arhivu i autorizovan vremenski ograničen pristup.

Native-starter komponente nisu dokaz da je išta od toga završeno. Njihov zadatak je da spreče gubitak geometrije/tajminga u prenosu.

## Tehnički izvori za adapter (spoljašnji, ne product canon)
Expo react-native-svg: https://docs.expo.dev/versions/latest/sdk/svg/  
Reanimated reduced motion: https://docs.swmansion.com/react-native-reanimated/docs/device/ReducedMotionConfig/  
React Native keyboard: https://reactnative.dev/docs/keyboardavoidingview  
React Native accessibility: https://reactnative.dev/docs/accessibility  
Codex AGENTS guidance: https://developers.openai.com/codex/guides/agents-md/

Koristiti verzije usklađene sa stvarnim repo lockfile-om. Dokumentacija ne daje ovlašćenje za nadogradnju dependencies-a ili promenu kanona.
