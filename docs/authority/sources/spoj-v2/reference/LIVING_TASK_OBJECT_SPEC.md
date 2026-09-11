# SPOJ v1.5 — Living Task Object Specification

## Zašto postoji
Jedan Zadatak ne sme vizuelno da postane novi proizvod na svakom ekranu. Korisnik treba da prepozna isti predmet dok nastaje u AI razgovoru, dok ga vidi u listi i mapi, dok čita ili šalje Prijavu i kada od njega nastane Dogovor.

## Anatomija
1. **Kontekst/status** — Zadatak, Tvoj zadatak, Izabrani zadatak, Dogovoreno.
2. **Kategorijski glyph** — sopstveni vizuelni akcenat, bez emoji pristupa.
3. **Naslov** — najjača semantička tačka.
4. **Gde + kada** — jedan kompaktan meta red.
5. **Ljudi + cena** — dva kompaktna fact pill-a.
6. **Pokrivenost** — samo kada ima semantički smisao, npr. 0/2 dogovoreno.
7. **Uslovi N** — otvara detalje; broj nije procenat potvrde.
8. **Identitet naručioca** — samo na javnom tržištu i samo public-safe.

## Varijante
### Compact
Lista, AI, vrh Candidate/Application konteksta. Cilj: 110–145 px u normalnoj gustini, bez fiksne visine.

### Peek
Bottom sheet izabranog pina. Isti raspored bez dvostrukog naslova i bez ponavljanja cene van kartice.

### Context
Forms, izmene, poruke. Mirnija pozadina, manja visina. Ne preuzima ceo ekran.

### Agreed
Dogovor. Ista anatomija, ali sadržaj dolazi iz prihvaćene Agreement verzije/snapshot-a. Izmena matičnog Zadatka ne sme tiho promeniti ovaj objekat.

## Pravila
- Nema lažne 0 vrednosti za nepoznato.
- 0/2 označava pokrivenost ljudi samo kada backend ima obe vrednosti.
- `Uslovi 2` označava dve stavke, ne dve potvrđene od dve.
- Tačna privatna adresa ne ulazi u javni compact/peek.
- Cena rada i USKOČI naknada nisu ista stvar.
- Kartica ne odlučuje prava i statuse; ona prikazuje već autorizovanu projekciju.
