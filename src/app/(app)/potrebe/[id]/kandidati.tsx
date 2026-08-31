import React, { useState, useEffect } from "react";
import { View, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "../../../../ui/Text";
import { Button, Card } from "../../../../ui/Button";
import { palette, space, elevation } from "../../../../theme/tokens";
import { useIzvor } from "../../../../store/uloga";
import { noviZahtevId } from "../../../../lib/idempotencija";
import type { KandidatProjekcija, PotrebaProjekcija } from "../../../../contracts/projections";

export default function KandidatiEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = useIzvor();
  
  const [kandidati, setKandidati] = useState<KandidatProjekcija[]>([]);
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [bira, setBira] = useState<string | null>(null);

  useEffect(() => {
    let ziv = true;
    if (id) {
      izvor.prijaveZaPotrebu(id).then((k) => {
        if (ziv) setKandidati(k);
      });
      izvor.potreba(id).then((p) => {
        if (ziv) setPotreba(p);
      });
    }
    return () => { ziv = false; };
  }, [id, izvor]);

  const izaberi = async (prijava: KandidatProjekcija) => {
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
        <T variant="heading">Kandidati ({kandidati.length})</T>
        
        {kandidati.length === 0 && (
          <T variant="meta" tone="muted">Trenutno nema prijava.</T>
        )}

        {kandidati.map((k) => (
          <Card key={k.prijavaId} style={elevation.card}>
             <View style={{ padding: space.base, gap: space.md }}>
                <T variant="meta" style={{ fontWeight: "800" }}>{k.ime || "Kandidat"}</T>
                <T variant="heading" tone="ink">{k.cena.prikaz}</T>
                <T variant="meta" tone="muted">Mesta: {k.pokrivaMesta} • {k.dolazakTekst}</T>
                
                <Button 
                  label={bira === k.prijavaId ? "Sklapanje..." : "Izaberi & Dogovor"} 
                  disabled={bira !== null || k.stanje !== "IZBORNA"}
                  onPress={() => izaberi(k)}
                />
             </View>
          </Card>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}
