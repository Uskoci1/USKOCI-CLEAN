# R18 storage — tačan Android APK

Status: **APK_BUILT_ATTESTED_DEVICE_PENDING**.

APK source: `cc8649a80d5c62ed6f50e6a3f9fe825742a4af0e`. Provereni runtime: `33d86b45a06883af8524130a3e6cf2ee1b69e61b`; dodatak je samo ograničeni CI zahtev za build, bez nove promene aplikacije.

[Build](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36242064743). SHA-256: `d92d7304c08383ada282af323f6d70203c6c8116b6a140fae3b62d44523997c5`. Bajtova: 70742905. ABI: arm64-v8a. Preuzet APK je nezavisno upoređen sa checksum-om i sa obe source-bound attestation datoteke; Hermes bundle hash je ponovo izračunat. Recovery i launcher icon: PASS.

## Nije dokazano

APK nije instaliran niti testiran na fizičkom telefonu u ovoj proveri. Ne dokazuje push, produkciono potpisivanje, Play Store, App Store ili jednakost svih DEV funkcija. Nije bilo DEV/Edge/provider/push izmena. Razvojni paket koristi postojeći rs.uskoci.dev build put; ne treba ga predstavljati kao push-capable ili production paket.

## Sledeća ograničena provera

Prvo potvrditi tačan instalirani hash/izvor i pokretanje. Zatim, samo na posebno odobrenom zadatku i nalozima, proveriti poznato odbijanje, profil → povratak, dvostruki reset i offline/replay bez duplikata. Ne brisati podatke aplikacije ili nalog da bi se izazvao storage kvar; ti kvarovi su simulirani u CI-ju, ne na korisnikovom telefonu. Telefon u kontrolnoj tabli ostaje nepotvrđen.
