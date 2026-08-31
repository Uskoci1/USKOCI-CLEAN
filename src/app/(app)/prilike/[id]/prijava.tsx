import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "../../../../ui/Text";
import { Button } from "../../../../ui/Button";
import { palette, space, radius } from "../../../../theme/tokens";
import { useIzvor } from "../../../../store/uloga";
import { noviZahtevId } from "../../../../lib/idempotencija";
import type { PotrebaProjekcija, PrilikaProjekcija } from "../../../../contracts/projections";

export default function PrijavaEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = useIzvor();
  
  const [prilika, setPrilika] = useState<PrilikaProjekcija | null>(null);
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [cena, setCena] = useState("");
  const [napomena, setNapomena] = useState("");
  const [saljem, setSaljem] = useState(false);

  useEffect(() => {
    let ziv = true;
    if (id) {
      izvor.prilika(id).then((p) => {
        if (ziv) setPrilika(p);
      });
      izvor.potreba(id).then((p) => {
        if (ziv) setPotreba(p);
      });
    }
    return () => { ziv = false; };
  }, [id, izvor]);

  const podnesi = async () => {
    if (!potreba || !prilika) {
      Alert.alert("Greška", "Podaci o prilici nisu učitani. Pokušajte ponovo.");
      return;
    }
    const cenaBroj = parseInt(cena, 10);
    if (isNaN(cenaBroj) || cenaBroj <= 0) {
      Alert.alert("Greška", "Unesite ispravnu cenu u RSD.");
      return;
    }

    setSaljem(true);
    const k = {
      clientRequestId: noviZahtevId("prijava"),
      potrebaId: potreba.id,
      potrebaRevizija: potreba.revizija,
      radnikProfilId: "", // resolved canonically by backend/izvor from authenticated profile
      pokrivenaMesta: 1,
      cenaRsd: cenaBroj,
      predlozeniPocetak: null,
      predlozeniKraj: null,
      napomena: napomena.trim() ? napomena.trim() : null,
    };
    
    const ishod = await izvor.podnesiPrijavu(k);
    setSaljem(false);
    if (ishod.ok) {
      Alert.alert("Uspeh", "Prijava je uspešno podneta!");
      router.replace("/moje-prijave");
    } else {
      Alert.alert(ishod.naslov || "Greška pri slanju", ishod.poruka);
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
