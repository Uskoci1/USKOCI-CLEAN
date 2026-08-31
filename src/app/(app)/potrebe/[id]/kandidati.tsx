import React, { useState, useEffect } from "react";
import { View, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "../../../../ui/Text";
import { Button } from "../../../../ui/Button";
import { Card } from "../../../../ui/Button";
import { palette, space, radius, elevation } from "../../../../theme/tokens";
import { useIzvor } from "../../../../store/uloga";

export default function KandidatiEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = useIzvor();
  
  const [kandidati, setKandidati] = useState<any[]>([]);
  const [potreba, setPotreba] = useState<any>(null);
  const [bira, setBira] = useState<string | null>(null);

  useEffect(() => {
    let ziv = true;
    // We assume izvor.prijaveZaPotrebu(id) exists, as seen in ports.ts
    izvor.prijaveZaPotrebu(id as string).then((k) => {
      if (ziv) setKandidati(k);
    });
    // For expectedRevision we might need the need itself
    return () => { ziv = false; };
  }, [id, izvor]);

  const izaberi = async (prijava: any) => {
    setBira(prijava.prijavaId);
    const k = {
      clientRequestId: Math.random().toString(36).substring(7),
      potrebaId: id as string,
      potrebaRevizija: prijava.potrebaRevizija || 1, // Fallback if projection missing
      prijavaId: prijava.prijavaId,
      prijavaVerzija: prijava.verzija || 1,
      prijavaHash: prijava.hash || "abc",
      mesta: prijava.pokrivenaMesta || 1
    };
    
    const ishod = await izvor.izaberiPrijavu(k);
    setBira(null);
    if (ishod.ok) {
      Alert.alert("Bravo", "Dogovor je sklopljen!");
      // router.replace(`/dogovori/${ishod.podatak.dogovorId}`);
      router.back();
    } else {
      Alert.alert("Greška (Stale Review / Race)", ishod.greska?.poruka || "Prijava je izmenjena u međuvremenu.");
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView contentContainerStyle={{ padding: space.base, gap: space.md }}>
        <T variant="heading">Kandidati ({kandidati.length})</T>
        
        {kandidati.length === 0 && (
          <T variant="meta" tone="muted">Trenutno nema prijava.</T>
        )}

        {kandidati.map((k, i) => (
          <Card key={k.prijavaId || i} style={elevation.card}>
             <View style={{ padding: space.base, gap: space.md }}>
                <T variant="meta" style={{ fontWeight: "800" }}>{k.radnikIme || "Kandidat"}</T>
                <T variant="heading" tone="ink">{k.cenaRsd} RSD</T>
                {k.napomena ? <T variant="meta" tone="muted">"{k.napomena}"</T> : null}
                
                <Button 
                  label={bira === k.prijavaId ? "Sklapanje..." : "Izaberi & Dogovor"} 
                  disabled={bira !== null}
                  onPress={() => izaberi(k)}
                />
             </View>
          </Card>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}
