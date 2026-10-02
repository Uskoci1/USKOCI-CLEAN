# Prompt za Codex (nalepi ceo tekst ispod u Codex, sa otvorenim folderom ovog checkout-a)

Folder: `C:\Users\user\Desktop\USKOCI_CANONICAL_WORKSPACE_2026-09-08\USKOCI-CLEAN\.claude\worktrees\uskoci-kompletan-audit-2e715e`, grana `work/uskoci-ui-unification-20260924`.

---

Nastavljaš rad na aplikaciji USKOČI (Expo/React Native + Supabase) tačno od tačke gde je stao Claude Code, u ISTOM folderu i na istoj grani. Ne pokreći Claude sesiju u ovom folderu istovremeno (jedan agent po checkout-u).

1. Pročitaj `AGENTS.md` u celini (obavezujuća pravila), pa `docs/implementation/handoff-codex-20261002/CODEX_HANDOFF_20261002.md`: stanje, jedinice koje su isporučene a nisu prihvaćene, red rada, zamke.
2. Pre ičega samo čitanje: `git status -sb`, `git log --oneline -20` i DEV snimak iz odeljka 1.2 handoff-a (ledger 221, sertifikat `0579191d...`). Ako se bilo šta razlikuje, STANI i pitaj vlasnika.
3. Nastavi od odeljka 6.A: push (ako je grana ispred origin-a), pa čitaj CI proofove koje push pokrene; zatim 6.B (nezavisna revizija neproverenih jedinica), pa 6.C (sledeći UI talas iz kritike emulatora), pa ostatak reda rada.
4. Granice koje ne smeš da pređeš (detalji u AGENTS.md, odeljak 3):
   - Ništa na DEV ili PROD bez vlasnikove TAČNE reči `PRIMENI <ime paketa>` posle approval bloka. Golo „Primeni“ ne važi ni za jedan paket. Samo-čitanje DEV nema potrebe za odobrenjem.
   - Nema novih zavisnosti, plaćenog AI poziva, naloga ni ključeva bez izričitog odobrenja (`expo-audio` ~57.0.4 je odobren uz proveru kompatibilnosti).
   - Telefon HONOR samo kad vlasnik kaže „sad“; svakodnevni native QA ide na emulator `USKOCI_V5_TEST`. Nikad `pm clear`, odjava ili brisanje podataka; instalacija samo `adb install -r`.
   - Ne izmišljaj pravne ni operativne podatke (rokove čuvanja, firmu, pravni osnov); nema tajni u repou; sirovi razgovori se ne kopiraju u repo; snimci ekrana vlasnikovog naloga se ne commit-uju.
   - Deterministički serverski konflikt diže `PT409`, nikad `40001`. Ne dodiruješ zaključane ulazne fajlove (`src/ui/entry/**`, `src/ui/referenceEntry/**`).
   - Ne označavaj ništa kao gotovo bez dokaza za taj nivo (SOURCE / JEST / CI / DEV / EMULATOR / TELEFON); neuspele dokaze čuvaj.
5. Vlasniku odgovaraj kratko, na srpskom (latinica), jednostavnim rečima, sa jasno označenim nivoom dokaza. Posle svake zatvorene jedinice: ažuriraj `docs/control/redovi.json`, pokreni osvežavanje iz odeljka 9 handoff-a, commit sa eksplicitnim fajlovima (nikad `git add -A`), push, proveri da je `HEAD...origin` na `0 0`.
6. Na kraju svakog rada napiši vlasniku: šta je urađeno, šta je dokazano na kom nivou, šta nije dokazano i šta samo on može da odluči.
