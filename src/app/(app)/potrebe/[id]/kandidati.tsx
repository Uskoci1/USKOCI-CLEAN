import React, { useState, useEffect } from "react";
import { View, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "../../../../ui/Text";
import { Button, Card } from "../../../../ui/Button";
import { palette, space, elevation } from "../../../../theme/tokens";
import { useIzvor } from "../../../../store/uloga";
import { noviZahtevId } from "../../../../lib/idempotencija";
import type { KandidatProjekcija, PotrebaProjekcija, StanjePrijave } from "../../../../contracts/projections";

const stanjeTekst: Record<StanjePrijave, string> = {
  SELECTABLE: "Može da se izabere",
  STALE: "Potrebna je nova provera",
  OVERFILL: "Pokriva više mesta nego što je ostalo",
  SELECTED: "Izabran",
  WITHDRAWN: "Prijava je povučena",
  CLOSED: "Prijava je zatvorena",
  FULL: "Sva mesta su popunjena",
};

export default function KandidatiEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = useIzvor();

  const [kandidati, setKandidati] = useState<KandidatProjekcija[]>([]);
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [bira, setBira] = useState<string | null>(null);
  const [ucitava, setUcitava] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  useEffect(() => {
    let ziv = true;
    if (!id) {
      setUcitava(false);
      setGreska("Potreba nije pronađena.");
      return () => { ziv = false; };
    }

    setUcitava(true);
    setGreska(null);
    Promise.all([izvor.prijaveZaPotrebu(id), izvor.potreba(id)])
      .then(([k, p]) => {
        if (!ziv) return;
        setKandidati(k);
        setPotreba(p);
        if (!p) setGreska("Podaci o potrebi nisu dostupni.");
      })
      .catch(() => {
        if (!ziv) return;
        setKandidati([]);
        setPotreba(null);
        setGreska("Nismo uspeli da učitamo prijave. Pokušajte ponovo.");
      })
      .finally(() => {
        if (ziv) setUcitava(false);
      });

    return () => { ziv = false; };
  }, [id, izvor]);

  const izaberi = async (prijava: KandidatProjekcija) => {
    if (!prijava.mozeIzabrati || prijava.stanje !== "SELECTABLE") {
      Alert.alert("Prijava nije dostupna", stanjeTekst[prijava.stanje]);
      return;
    }
    if (!potreba) {
      Alert.alert("Greška", "Podaci o potrebi nisu učitani. Pokušajte ponovo.");
      return;
    }
    if (!prijava.prijavaId || typeof prijava.verzija !== "number" || !prijava.hash) {
      Alert.alert("Bezbednosna greška", "Podaci o prijavi su nepotpuni. Izbor se prekida.");
      return;
    }

    setBira(prijava.prijavaId);
    const k = {
      clientRequestId: noviZahtevId("izbor"),
      potrebaId: potreba.id,
      potrebaRevizija: potreba.revizija,
      prijavaId: prijava.prijavaId,
      prijavaVerzija: prijava.verzija,
      prijavaHash: prijava.hash,
      mesta: prijava.pokrivaMesta,
    };

    const ishod = await izvor.izaberiPrijavu(k);
    setBira(null);
    if (ishod.ok) {
      Alert.alert("Uspeh", "Dogovor je uspešno sklopljen!");
      router.back();
    } else {
      Alert.alert(ishod.naslov || "Greška pri izboru", ishod.poruka);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView contentContainerStyle={{ padding: space.base, gap: space.md }}>
        <T variant="heading">Prijave ({kandidati.length})</T>

        {ucitava && (
          <T variant="meta" tone="muted">Učitavanje prijava…</T>
        )}

        {!ucitava && greska && (
          <Card style={elevation.card}>
            <View style={{ padding: space.base, gap: space.sm }}>
              <T variant="meta" style={{ fontWeight: "800" }}>Prijave trenutno nisu dostupne</T>
              <T variant="meta" tone="muted">{greska}</T>
            </View>
          </Card>
        )}

        {!ucitava && !greska && kandidati.length === 0 && (
          <T variant="meta" tone="muted">Trenutno nema prijava.</T>
        )}

        {!greska && kandidati.map((k) => (
          <Card key={k.prijavaId} style={elevation.card}>
            <View style={{ padding: space.base, gap: space.md }}>
              <T variant="meta" style={{ fontWeight: "800" }}>{k.ime || "Kandidat"}</T>
              <T variant="heading" tone="ink">{k.cena.prikaz}</T>
              <T variant="meta" tone="muted">Mesta: {k.pokrivaMesta} • {k.dolazakTekst}</T>
              <T variant="meta" tone="muted">{stanjeTekst[k.stanje]}</T>
              {k.napomena ? <T variant="meta" tone="muted">{k.napomena}</T> : null}

              <Button
                label={bira === k.prijavaId ? "Sklapanje..." : "Izaberi"}
                disabled={bira !== null || !k.mozeIzabrati}
                onPress={() => izaberi(k)}
              />
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
