import React, { useState, useEffect } from "react";
import { View, ScrollView, TextInput, Alert, ActivityIndicator, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { T } from "../../../ui/Text";
import { Button } from "../../../ui/Button";
import { palette, space, radius } from "../../../theme/tokens";
import { useIzvor } from "../../../store/uloga";
import type { RadnikProfilProjekcija } from "../../../contracts/projections";

export default function ProfilRadnikEkran() {
  const router = useRouter();
  const izvor = useIzvor();
  
  const [profil, setProfil] = useState<RadnikProfilProjekcija | null>(null);
  const [ucitavam, setUcitavam] = useState(true);
  const [snimam, setSnimam] = useState(false);
  
  const [ime, setIme] = useState("");
  const [grad, setGrad] = useState("");
  const [biografija, setBiografija] = useState("");
  const [dostupanOdmah, setDostupanOdmah] = useState(false);
  
  useEffect(() => {
    let ziv = true;
    async function init() {
      try {
        const p = await izvor.mojRadnikProfil();
        if (ziv) {
          setProfil(p);
          if (p) {
            setIme(p.ime);
            setGrad(p.grad);
            setBiografija(p.biografija);
            setDostupanOdmah(p.dostupanOdmah);
          }
        }
      } finally {
        if (ziv) setUcitavam(false);
      }
    }
    init();
    return () => { ziv = false; };
  }, [izvor]);

  const sacuvaj = async (zavrsi: boolean) => {
    if (zavrsi && (!ime.trim() || !grad.trim())) {
      Alert.alert("Nedostaju podaci", "Unesite ime i grad pre završetka profila.");
      return;
    }

    setSnimam(true);
    const ishod = await izvor.azurirajRadnikProfil({
      ime: ime.trim(),
      grad: grad.trim(),
      biografija: biografija.trim(),
      dostupanOdmah,
      zavrsi
    });
    setSnimam(false);

    if (ishod.ok) {
      if (zavrsi) {
        Alert.alert("Uspeh", "Vaš profil je sada aktivan!");
        router.back();
      } else {
        Alert.alert("Uspeh", "Izmene su sačuvane.");
      }
    } else {
      Alert.alert("Greška", ishod.poruka);
    }
  };

  if (ucitavam) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={palette.forest700} />
      </SafeAreaView>
    );
  }

  const isNovi = !profil || profil.stanje !== 'ACTIVE';

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView contentContainerStyle={{ padding: space.base, gap: space.md }}>
        <T variant="heading">{isNovi ? "Postavite profil Radnika" : "Moj Radnički Profil"}</T>
        
        {isNovi && (
          <View style={{ backgroundColor: palette.cream050, padding: space.md, borderRadius: radius.md }}>
            <T variant="meta" tone="muted">Morate popuniti osnovne podatke da biste se prijavljivali na poslove.</T>
          </View>
        )}
        
        <View style={{ gap: space.xs }}>
          <T variant="label">Ime (kako će vas naručioci videti)</T>
          <TextInput 
            value={ime}
            onChangeText={setIme}
            placeholder="Npr. Nikola Petrović"
            style={{ 
              borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
              padding: space.sm, fontSize: 16, color: palette.ink 
            }}
          />
        </View>

        <View style={{ gap: space.xs }}>
          <T variant="label">Grad / Lokacija rada</T>
          <TextInput 
            value={grad}
            onChangeText={setGrad}
            placeholder="Npr. Novi Sad"
            style={{ 
              borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
              padding: space.sm, fontSize: 16, color: palette.ink 
            }}
          />
        </View>

        <View style={{ gap: space.xs }}>
          <T variant="label">Kratka biografija (opciono)</T>
          <TextInput 
            value={biografija}
            onChangeText={setBiografija}
            multiline
            placeholder="Nešto o vašem iskustvu..."
            style={{ 
              borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
              padding: space.sm, fontSize: 16, color: palette.ink, minHeight: 80, textAlignVertical: "top"
            }}
          />
        </View>
        
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: palette.line100 }}>
          <View style={{ flex: 1, paddingRight: space.md }}>
            <T variant="body">Dostupan odmah</T>
            <T variant="meta" tone="muted">Označite ako možete prihvatiti HITNE poslove.</T>
          </View>
          <Switch value={dostupanOdmah} onValueChange={setDostupanOdmah} />
        </View>

      </ScrollView>

      <View style={{ padding: space.base, borderTopWidth: 1, borderTopColor: palette.line100, backgroundColor: palette.ground, gap: space.sm }}>
         <Button 
           label={isNovi ? "Završi profil" : "Sačuvaj izmene"} 
           disabled={snimam || !ime.trim() || !grad.trim()}
           onPress={() => sacuvaj(isNovi)} 
         />
         {!isNovi && (
           <Button 
             kind="quiet"
             label="Nazad"
             onPress={() => router.back()} 
           />
         )}
      </View>
    </SafeAreaView>
  );
}
