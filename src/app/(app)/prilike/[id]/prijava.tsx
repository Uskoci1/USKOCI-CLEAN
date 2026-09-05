import React, { useState, useEffect, useRef } from "react";
import { View, ScrollView, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "../../../../ui/Text";
import { Button } from "../../../../ui/Button";
import { palette, space, radius } from "../../../../theme/tokens";
import { useIzvor } from "../../../../store/uloga";
import { noviZahtevId } from "../../../../lib/idempotencija";
import type { PotrebaProjekcija, PrilikaProjekcija, RadnikProfilProjekcija } from "../../../../contracts/projections";

export default function PrijavaEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = useIzvor();
  
  const [prilika, setPrilika] = useState<PrilikaProjekcija | null>(null);
  const [potreba, setPotreba] = useState<PotrebaProjekcija | null>(null);
  const [profil, setProfil] = useState<RadnikProfilProjekcija | null>(null);
  const [ucitavam, setUcitavam] = useState(true);
  
  const [cena, setCena] = useState("");
  const [pokrivenaMesta, setPokrivenaMesta] = useState("1");
  const [napomena, setNapomena] = useState("");
  const [saljem, setSaljem] = useState(false);
  // One screen submission attempt keeps one semantic key. If the server commits
  // and the response is lost, a retry must replay that exact command rather
  // than silently creating a new Application version.
  const clientRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    let ziv = true;
    
    async function ucitajSve() {
      if (!id) return;
      try {
        const [p, pot, prof] = await Promise.all([
          izvor.prilika(id),
          izvor.potreba(id),
          izvor.mojRadnikProfil()
        ]);
        if (ziv) {
          setPrilika(p);
          setPotreba(pot);
          setProfil(prof);
          
          if (p?.rezimCene === 'MY_PRICE' && p.ponudjenaCena) {
             setCena(String(p.ponudjenaCena.iznos));
          }
          
          if (!prof || prof.stanje !== 'ACTIVE') {
             Alert.alert("Profil nije popunjen", "Morate popuniti svoj radnički profil pre nego što podnesete prijavu.");
             router.replace("/profil/radnik" as any);
          }
        }
      } finally {
        if (ziv) setUcitavam(false);
      }
    }
    
    ucitajSve();
    
    return () => { ziv = false; };
  }, [id, izvor]);

  const podnesi = async () => {
    if (!potreba || !prilika || !profil) {
      Alert.alert("Greška", "Podaci o prilici nisu učitani. Pokušajte ponovo.");
      return;
    }
    const cenaBroj = parseInt(cena, 10);
    if (isNaN(cenaBroj) || cenaBroj <= 0) {
      Alert.alert("Greška", "Unesite ispravnu cenu u RSD.");
      return;
    }
    const mestaBroj = parseInt(pokrivenaMesta, 10);
    const preostalaMesta = Math.max(0, potreba.pokrivenost.preostalo);
    if (isNaN(mestaBroj) || mestaBroj < 1 || mestaBroj > preostalaMesta) {
      Alert.alert("Greška", "Broj ljudi mora biti u okviru trenutno preostalih mesta.");
      return;
    }

    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = noviZahtevId("prijava");
    }

    setSaljem(true);
    const k = {
      clientRequestId: clientRequestIdRef.current,
      potrebaId: potreba.id,
      potrebaRevizija: potreba.revizija,
      radnikProfilId: profil.id,
      pokrivenaMesta: mestaBroj,
      cenaRsd: cenaBroj,
      predlozeniPocetak: null,
      predlozeniKraj: null,
      napomena: napomena.trim() ? napomena.trim() : null,
    };
    
    const ishod = await izvor.podnesiPrijavu(k);
    setSaljem(false);
    if (ishod.ok) {
      Alert.alert("Uspeh", "Prijava je uspešno podneta!");
      router.replace("/moje-prijave" as any);
    } else {
      // A known server rejection means this semantic command definitely did not
      // commit, so a corrected payload gets a fresh key. RPC_ERROR is the
      // transport/unknown-outcome fallback and deliberately keeps the old key.
      if (ishod.kod !== 'RPC_ERROR') {
        clientRequestIdRef.current = null;
      }
      Alert.alert(ishod.naslov || "Greška pri slanju", ishod.poruka);
    }
  };

  if (ucitavam) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground, padding: space.base, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={palette.forest700} />
        <T variant="meta" tone="muted" style={{ marginTop: space.sm }}>Učitavam...</T>
      </SafeAreaView>
    );
  }

  if (!prilika || !profil || profil.stanje !== 'ACTIVE') {
    // If not active, the useEffect redirect will trigger shortly, just return empty
    return null;
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

        {potreba?.pokrivenost && potreba.pokrivenost.ukupno > 1 && (
          <View style={{ gap: space.xs, marginTop: space.sm }}>
            <T variant="label">Koliko ljudi pokrivate? (Preostalo {potreba.pokrivenost.preostalo})</T>
            <TextInput 
              value={pokrivenaMesta}
              onChangeText={setPokrivenaMesta}
              keyboardType="numeric"
              style={{ 
                borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
                padding: space.sm, fontSize: 16, color: palette.ink 
              }}
            />
          </View>
        )}
        
        <View style={{ gap: space.xs, marginTop: space.md }}>
          <T variant="label">
             {prilika.rezimCene === 'MY_PRICE' ? 'Fiksna cena naručioca (RSD)' : 'Vaša cena (RSD)'}
          </T>
          <TextInput 
            value={cena}
            onChangeText={setCena}
            keyboardType="numeric"
            placeholder="Npr. 5000"
            editable={prilika.rezimCene !== 'MY_PRICE'}
            style={{ 
              borderWidth: 1, borderColor: palette.line100, borderRadius: radius.md,
              padding: space.sm, fontSize: 16, color: prilika.rezimCene === 'MY_PRICE' ? palette.inkMuted : palette.ink,
              backgroundColor: prilika.rezimCene === 'MY_PRICE' ? palette.cream050 : 'transparent'
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
           disabled={saljem || !cena || !pokrivenaMesta}
           onPress={podnesi} 
         />
      </View>
    </SafeAreaView>
  );
}
