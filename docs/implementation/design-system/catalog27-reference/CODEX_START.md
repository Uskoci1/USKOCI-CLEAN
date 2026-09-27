# Codex — USKOČI, aktivni paket 27

## 1. Sačuvaj aktuelnu aplikaciju
Ovo je predaja resursa, ne već izmenjen APK. Nastavlja paket 26. Pre ugradnje pročitaj aktuelnu granu, NEXT.md i projektne instrukcije. Raniji inventar a047bc0 nije nova provera današnjeg stanja. Ne menjaj logo, navigaciju, modele, Press/Text, outbox, kamere i audio dozvole, postojeće kontrolere, bezbednosnu logiku ili lokalne dorade adaptera.

## 2. Obuhvat
Svih 49 statičnih porodica + 5 crteža stanja, sa istih 216 SVG i 756 PNG resursa. Animirani skup ima 27 porodica / 28 motiva uključujući error / 55 glavnih JSON izvoza. Veličine i .lottie kontejneri nisu nove porodice.

Novo:
| name | ID | veći prikaz | app32 | normalno stanje |
|---|---|---:|---:|---|
| lock | I38 | 583 ms | 333 ms | katanac zatvoren, statičan |
| shield | I44 | 567 ms | 317 ms | štit bez kvačice, statičan |
| support | I41 | 600 ms | 350 ms | kolut miruje |
| document | I40 | 567 ms | 333 ms | dokument miruje |

Ove porodice bile su planirane kao mirni simboli u meniju. Dodati pokreti su OPCIONI predlozi za prvo izdvojeno pojavljivanje odgovarajućeg panela. Ne dodaj animaciju u svaki red podešavanja. Nova statika i materijal čekaju korisnikov vizuelni pregled.

## 3. Jedna aktivna verzija
- `animations/<name>/{feature64,app32}.json`: aktivni animacioni izvori. .lottie sadrži iste podatke.
- `stills/<name>/`: odgovarajući mirni SVG i providni PNG. Za animacije iz 27 koristi nov `stills`, ne stari veliki `premium` PNG.
- `static/`: komplet ranijih pojedinačnih SVG/PNG ikonica i adaptera. Mini20/mini24 ostaju jednostavni.
- `preserved/microphone/animation/`: kontrolisani nivo glasa; ne puštati kao nasumičnu petlju.
- `legacy-micromotion/`: raniji prikazni primeri, ne dodatni efekat oko već animirane komponente.
- Raniji `docs/`, `source/` i QA pripadaju svojim izdanjima. Aktuelni opseg provere je samo `qa/27/`.

## 4. Ugradnja
`integration/sources.ts` ima dopunjenu statičku mapu. Adapter `UskociAnimatedIcon` nije promenjen; sačuvaj lokalne popravke, nemoj ga slepo prepisati. Proveri kompatibilnu postojeću verziju `lottie-react-native`, Expo/React Native i arhitekturu projekta; ništa se ovim paketom ne instalira.

Normalan meni:
```tsx
<UskociAnimatedIcon name="lock" size={32} visible={screenIsFocused} />
```
Bez novog eventId komponenta je mirna. Za sasvim mali red koristiti postojeći UskociIcon size={24}. Roditelj poseduje pristupačan naziv, radnju i stanje; ikona uz isti naziv je dekorativna.

Namerni jednokratni ulaz panela, samo ako ga UI projekat zaista želi:
```tsx
<UskociAnimatedIcon
  name="support"
  size={64}
  eventId={explicitPanelPresentationId}
  animateOnMount={true}
  visible={screenIsFocused}
/>
```
Prezentacioni ID je stabilan identifikator prikaza, ne command ID i ne novi Date.now() pri svakom renderu. Promena teksta, osvežavanje, povratak istoriji ili skrolovanje nisu novi događaji za proslavu. Skrivena ruta, AppState pozadina i smanjeno kretanje prikazuju mirni kadar; ne nadoknađuj ukrase po povratku.

## 5. Značenje nije određeno završetkom pokreta
- Katanac je stalno zatvoren: nije tvrdnja o novom zaključavanju, enkripciji, dozvoli ili identitetu.
- Štit nema kvačicu: nije značka proverenog korisnika ili potvrda rešenog slučaja.
- Kolut ne znači da je operater prisutan, da je zahtev primljen ili da odgovor stiže u određenom roku.
- List ne znači da je dokument pročitan, prihvaćen, potpisan ili preuzet.
- Nijedan onAnimationFinish ne poziva servis, upis, slanje, promenu statusa, prihvatanje dokumenta ili navigaciju.

Osvežavanje iz 25 i dalje koristi odvojeni UskociRefreshIcon sa stvarnim busy. Greška, nepoznat ishod i čekanje saglasnosti imaju odvojene tekstove i radnje. Poruke 16 i prethodni kontrolisani mikrofonski izvori su očuvani. Ne uvodi novu veliku scenu rukovanja.

## 6. Šta otvoriti
`OTVORI.html`: četiri nove animacije pojedinačno i odvojen statični primer menija.
`KATALOG.html`: 28 animiranih motiva i cela statična biblioteka. Raspakuj ceo folder: ovaj katalog koristi relativne PNG putanje da ne duplira bitmape u HTML-u.
`docs/SCENARIJI_27.md`: materijal, tačan pokret, značenje i granice.
`docs/PAKOVANJE_27.md`: očuvanje resursa i format predaje.

## 7. Provera i ograničenja
Pogledaj qa/27/results.json, preservation.json, typescript-syntax.json i runtime-availability.json. Lokalni pregled koristi označeni UskociJsonPreview SVG renderer. To nije standardni lottie-web. Browser testovi serviraju lokalne resurse kroz Playwright route fulfillment, bez mrežnog servisa; direktno file:// otvaranje u testnom Chromium-u je blokirano njegovom politikom. Samostalni HTML za pregled ima ugrađene resurse.

Nisu potvrđeni standardni lottie-web/dotLottie renderer, puni projektni typecheck, Metro/native build, fizički Android/iOS, brzina slabijeg uređaja ili ugradnja u APK. Pokušaj preuzimanja standardnog plejera u ovoj sesiji nije uspeo. Postojeće brojke ranijih QA provera nisu novi dokazi.

Pre produkcije proveri složene putanje koluta i otvora katanca, gradijente, njihanje, sastavljenost katanca, pričvršćenost ugla dokumenta i identičan kraj animacije/miran PNG u ciljnom plejeru. Gde prikaz nije potvrđen, zadrži statični PNG. Uobičajena upotreba ostaje mirna. Pokreni projektni typecheck, lint i postojeće testove bez izmene poslovnih ugovora.

Tehnička referenca konsultovana 27.09.2026: zvanični airbnb/lottie-web Wiki Usage i loadAnimation-options. Ta dokumentacija opisuje API, ne poslovna pravila USKOČI-ja.
