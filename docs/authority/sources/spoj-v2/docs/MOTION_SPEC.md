# Motion — originalni intro + V2 izbor

## Originalni intro: 4380 ms, geometrija zaključana
`motion/original-rIntroFrame.js` je izvučena originalna funkcija. `geometry.json` i `original-parts.json` sadrže viewBox, transform i geometriju delova. `html-reference-frames.json` beleži 39 uzoraka (13 vremena ×3 širine). `native-starter/BrandSceneMath.ts` je čista prenosiva matematika, proverena prema tim uzorcima.

| Vreme ms | Događaj |
|---|---|
| 40–760 | Spajanje krakova originalnog znaka |
| 80–650 | Ulazak kružnih delova |
| 630–900 | Mali donji deo |
| 760–1120 | Pin u znaku |
| 930–1240 | Osmeh |
| 1450–1550 / 1620–1750 | Zatvaranje / otvaranje jednog oka |
| 1920–2690 | Prelaz velikog centralnog znaka u originalni lockup |
| 2700–3200 | Otkrivanje SKOČI putanja |
| 3210–3500 | Slogan |
| 3590–4200 | Teal/narandžasta polja iza belog panela |
| 3980–4340 | Izbori i footer |
| 4380 | Završetak, omogućena interakcija |

Cubic ease-out u originalnoj geometriji: 1−(1−p)^3. Ne menjati poredak transformacija pojedinačnih SVG grupa, rotaciju ili lokalne centre. Podaci o box-u moraju biti u istom koordinatnom sistemu; ne primenjivati DOM offsete kao native safe-area vrednosti.

## Izbor namere: 760 ms
Na t=0 obe grupe izbora i footer postaju potpuno nevidljivi i neinteraktivni. Ne čuvati 32% opacity. Originalni beli panel/znak je iznad boje i motiva. Od110 do640 ms odabrana boja prelazi sa50% na100%, cubic-bezier(.2,.8,.2,1). Od250 do490 ms pojavljuje se kontekstualni motiv, bez teksta, sa SVG vidljivošću .085. Diskretni kružni obris ima belu liniju na .08. Nakon760 ms prelazi se na važeći auth cilj samo ako su nalog, revizija sesije i polazni ekran još isti.

Reduced motion: završni intro kadar odmah, izbor bez prostornog sweep-a. Otvaranje postojećeg autorizovanog deep link-a ne sme čekati ceremoniju. Dupli tap samo jednom, prekid/unmount/account switch/background poništava zakazanu navigaciju.

## Interijer
Navigation-only opacity/translateY5, 190 ms; pritisak110 ms. Ne animirati ponovo ceo ekran pri kucanju. Semantička promena činjenice može diskretno da se istakne; svetleći efekat ne predstavlja server potvrdu. Loading/voice valovi nisu dokaz provider rada.

## Granica native reference
`IntentSweepLayer.tsx` daje početnu prezentacionu implementaciju sa istim vremenskim intervalima. Nije povezana/kompajlirana u actual Expo repo-u. Caller mora da obezbedi slojeve belog panela, skrivanje izbora, dostupnost auth cilja, stable callbacks i tačno session ponašanje. JS-driver width u referenci treba profilisati na uređaju; optimizovati kroz ekvivalentan clip/transform tek uz dokaz jednakog kretanja.

41 provera čiste matematike nije dokaz native60fps, splash ponašanja ili Android/iOS rendera. Te kapije ostaju u `QA_ACCEPTANCE.md`.
