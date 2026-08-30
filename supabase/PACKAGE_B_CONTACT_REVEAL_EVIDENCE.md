# Paket B — Scoped reveal privatnog podatka

**Datum:** 30.08.2026 · **Baza:** clean DEV/ALPHA `leqcwgzvjsxugfgzdmth`
**Nivo dokaza:** `AUTHENTICATED_RUNTIME_PROVEN` — tri stvarno prijavljena naloga,
`set local role authenticated` + JWT claims. **Nijedan test nije rađen kao
`service_role`.**

`ANTIGRAVITY_ARTIFACT_NOT_LOCALLY_AVAILABLE` — nalazi su preuzeti iz direktive i
**ponovo potvrđeni sopstvenom forenzikom**, ne prihvaćeni zdravo za gotovo.

---

## Klasifikacija prenetih nalaza

| nalaz | klasifikacija | dokaz |
|---|---|---|
| `app_accounts` SELECT je own-only | **CONFIRMED** | politika `app_accounts_select_own`: `auth.uid() = id` |
| `access_grants` je directional | **CONFIRMED** | `granted_by` / `granted_to`, unique po kanalu i smeru |
| nema authoritative RPC-a koji grant pretvara u scoped reveal | **CONFIRMED_CURRENT_GAP** | nijedna funkcija u bazi nije referisala `access_grants` |

## Nalaz koji direktiva nije imala

Sopstvena forenzika je našla **latentnu rupu u izdavanju granta**, ozbiljniju od
prijavljenog gapa.

Zatečena politika `access_grants_grant` tražila je samo da je izdavalac
`auth.uid()` i da je **bilo koja** strana Dogovora. Polje `granted_to_account_id`
nije bilo ograničeno **ni na koga**.

Napad, izveden nad živom bazom kao Uskoćer W1:

```
insert into access_grants (agreement_id, channel, granted_by, granted_to, status)
values (<dogovor>, 'EXACT_LOCATION', <W1>, <W2 van Dogovora>, 'GRANTED')
→ PROŠLO
```

Uskoćer je izdao dozvolu za **tuđu** tačnu adresu **trećem licu**.

### Zašto adresa ipak nije procurila

Čitanje kao W2 vratilo je **0 redova**. Razlog nije bila grant politika nego
**ugnežđena RLS na `agreements`** — W2 ne vidi red Dogovora, pa `EXISTS` u
politici `need_sensitive_granted_read` ne uspeva.

To je **slučajna odbrana, ne projektovana**. Čim bi se čitanje Dogovora igde
proširilo (npr. da kandidati vide sažetak), adresa bi procurila istog trenutka.
Zato je zatvoreno i pored toga što se danas ne ostvaruje.

---

## Šta je implementirano

Migracije `clean_scoped_contact_reveal` i `clean_grant_policy_inline`.
**`app_accounts` RLS nije olabavljen.** Telefon i dalje niko ne čita direktno.

### 1. Vlasništvo nad podatkom po kanalu

| ko | sme da podeli |
|---|---|
| Naručilac | `PHONE` (svoj broj) i `EXACT_LOCATION` (svoja adresa) |
| Uskoćer | **samo** `PHONE` (svoj broj) |

Primalac mora biti **druga strana istog Dogovora**. Treće lice je nemoguće.

Logika je **ugrađena u samu politiku**, ne u `SECURITY DEFINER` pomoćnike.
Prvi pokušaj je koristio pomoćnike i pao je na `permission denied` — RLS se
izvršava kao pozivalac. Otvaranje tih funkcija roli `authenticated` napravilo bi
oracle „da li je nalog X strana u Dogovoru Y" nad proizvoljnim UUID-em, pa je
odbačeno.

### 2. `public.rpc_reveal_contact(agreement_id, channel)`

Jedini put od directional granta do privatnog podatka. Provera redom:
prijavljen → strana Dogovora → aktivan grant ka meni → grant izdao **vlasnik
podatka** → primalac je druga strana → nije opozvan → nije istekao.

Dodata kolona `access_grants.expires_at` (nullable, additive).

### 3. Odbrana u dubini na `need_sensitive`

Politika sada dodatno traži da je grant izdao Naručilac (`granted_by =
a.requester_account_id`) i da je primalac izvršilac tog Dogovora — više se ne
oslanja na to što treće lice ne vidi `agreements`.

---

## Adversarial matrica — sve izvršeno nad živom bazom

### Izdavanje dozvole

| # | pokušaj | očekivano | ishod |
|---|---|---|---|
| T1 | W1 deli **tuđu lokaciju** trećem licu | DENY | **DENY** |
| T2 | W1 deli **tuđu lokaciju** Naručiocu | DENY | **DENY** |
| T3 | W1 deli svoj telefon **trećem licu** | DENY | **DENY** |
| T4 | W2 (van Dogovora) izdaje bilo šta | DENY | **DENY** |
| — | Naručilac deli svoj telefon Uskoćeru | ALLOW | **ALLOW** |
| — | Uskoćer deli svoj telefon Naručiocu | ALLOW | **ALLOW** |

### Reveal

| # | pokušaj | očekivano | ishod |
|---|---|---|---|
| P1 | W1 sa važećim PHONE grantom | samo telefon | **samo telefon** |
| P2 | W1 traži lokaciju bez granta | DENY | **`NO_ACTIVE_GRANT`** |
| P3 | treće lice traži bilo šta | DENY | **`NOT_PARTY`** |
| P4 | tuđi/nepostojeći Dogovor | DENY | **`AGREEMENT_NOT_FOUND`** |
| P5 | kanal `EMAIL` | DENY | **`UNSUPPORTED_CHANNEL`** |
| L1 | opozvan grant | DENY | **`NO_ACTIVE_GRANT`** |
| L2 | istekao grant | DENY | **`NO_ACTIVE_GRANT`** |
| F1 | treće lice čita `need_sensitive` | 0 redova | **0 redova** |
| F2 | treće lice čita `app_accounts` | samo svoj | **samo svoj (1)** |
| F4 | vlasnik čita svoju adresu | radi | **radi** |

### Dokaz da PHONE ne otkriva ništa više

Stvarni ključevi odgovora, snimljeni iz baze:

```
PHONE     → agreementId, authoritative, channel, expiresAt, grantedAt,
            ownerAccountId, phone
LOCATION  → accessNotes, agreementId, authoritative, channel, exactAddress,
            exactLat, exactLng, expiresAt, grantedAt
```

**PHONE payload ne sadrži `email`, ni `exactAddress`, ni koordinate.**
Email se nigde ne otkriva — standardni email reveal **nije** vraćen jer nije
kanonski.

---

## Status

| stavka | nivo dokaza |
|---|---|
| scoped PHONE reveal | `AUTHENTICATED_RUNTIME_PROVEN` |
| scoped EXACT_LOCATION reveal | `AUTHENTICATED_RUNTIME_PROVEN` |
| zatvaranje latentne rupe u izdavanju granta | `AUTHENTICATED_RUNTIME_PROVEN` |
| lifecycle (opoziv, istek) | `AUTHENTICATED_RUNTIME_PROVEN` |
| klijentska strana (ekran → CTA → reveal) | **nije dodirnuta** — paket A |

Test fixture (3 naloga, Potreba, Dogovor, grantovi) **obrisan posle merenja**;
baza je vraćena na nulu redova.
