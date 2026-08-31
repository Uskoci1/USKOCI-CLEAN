import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "../../../../ui/Text";
import { Button } from "../../../../ui/Button";
import { palette, space, radius } from "../../../../theme/tokens";
import { useIzvor } from "../../../../store/uloga";

export default function PrijavaEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = useIzvor();
  
  const [prilika, setPrilika] = useState<any>(null);
  const [cena, setCena] = useState("");
  const [napomena, setNapomena] = useState("");
  const [saljem, setSaljem] = useState(false);

  useEffect(() => {
    let ziv = true;
    izvor.prilika(id as string).then((p) => {
      if (ziv) setPrilika(p);
    });
    return () => { ziv = false; };
  }, [id, izvor]);

  const podnesi = async () => {
    if (!prilika || !cena) return;
    setSaljem(true);
    const k = {
      clientRequestId: Math.random().toString(36).substring(7),
      potrebaId: prilika.id,
      potrebaRevizija: prilika.revizija || 1,
      radnikProfilId: "00000000-0000-0000-0000-000000000000", // The real one is resolved by backend auth.uid() usually, or we can fetch it. For now, assuming backend ignores it or uses auth.uid.
      pokrivenaMesta: 1,
      cenaRsd: parseInt(cena, 10),
      predlozeniPocetak: null,
      predlozeniKraj: null,
      napomena: napomena || null
    };
    
    // We added podnesiPrijavu in ports
    const ishod = await (izvor as any).podnesiPrijavu(k);
    setSaljem(false);
    if (ishod.ok) {
      Alert.alert("Uspeh", "Prijava je uspešno podneta!");
      router.replace("/moje-prijave");
    } else {
      Alert.alert("Greška", ishod.greska?.poruka || "Došlo je do greške.");
    }
  };

  if (!prilika) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground, padding: space.base }}>
        <T variant="meta" tone="muted">Učitavam...</T>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView contentContainerStyle={{ padding: space.base, gap: space.md }}>
        <T variant="heading">Sastavi prijavu</T>
        
        {/* C-023: Flattened Context instead of Modal */}
        <View style={{ backgroundColor: palette.cream050, padding: space.md, borderRadius: radius.md, marginBottom: space.md }}>
           <T variant="meta" tone="muted" style={{ fontWeight: "700" }}>Detalji posla:</T>
           <T variant="meta" tone="muted">{prilika.naslov}</T>
           <T variant="meta" tone="muted">{prilika.podrucjeTekst} • {prilika.vremeTekst}</T>
        </View>
        
        <View style={{ gap: space.xs, marginTop: space.md }}>
          <T variant="label">Vaša cena (RSD)</T>
          <TextInput 
            value={cena}
            onChangeText={setCena}
            keyboardType="numeric"
            placeholder="Npr. 5000"
            style={{ 
              borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
              padding: space.sm, fontSize: 16, color: palette.ink 
            }}
          />
        </View>

        <View style={{ gap: space.xs, marginTop: space.sm }}>
          <T variant="label">Napomena za naručioca</T>
          <TextInput 
            value={napomena}
            onChangeText={setNapomena}
            multiline
            placeholder="Opciono: Možemo se dogovoriti oko..."
            style={{ 
              borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
              padding: space.sm, fontSize: 16, color: palette.ink, minHeight: 80, textAlignVertical: "top"
            }}
          />
        </View>

      </ScrollView>

      <View style={{ padding: space.base, borderTopWidth: 1, borderTopColor: palette.line100, backgroundColor: palette.ground }}>
         <Button 
           label={saljem ? "Šaljem..." : "Pošalji prijavu"} 
           disabled={saljem || !cena}
           onPress={podnesi} 
         />
      </View>
    </SafeAreaView>
  );
}
