import React, { useState, useEffect } from "react";
import { View, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { T } from "@/ui/Text";
import { Button } from "@/ui/Button";
import { palette, space, radius, touch, elevation } from "@/ui/osnova";
import { koristiStanje } from "@/store/stanje";

export default function PrilikaDetaljiEkran() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const izvor = koristiStanje((s) => s.izvor);
  
  const [prilika, setPrilika] = useState<any>(null);

  useEffect(() => {
    let ziv = true;
    izvor.prilika(id as string).then((p) => {
      if (ziv) setPrilika(p);
    });
    return () => { ziv = false; };
  }, [id, izvor]);

  if (!prilika) {
    return (
      <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground, padding: space.base }}>
        <T variant="meta" tone="muted">Učitavam priliku...</T>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView contentContainerStyle={{ padding: space.base, gap: space.md }}>
        <View style={{ gap: space.xs }}>
          <T variant="label" tone="muted">PRILIKA</T>
          <T variant="heading">{prilika.naslov}</T>
        </View>

        <View style={{ backgroundColor: palette.cream050, padding: space.md, borderRadius: radius.md, gap: space.sm }}>
          <T variant="meta" style={{ fontWeight: "700" }}>{prilika.podrucjeTekst}</T>
          <T variant="meta" tone="muted">{prilika.vremeTekst}</T>
          <T variant="meta" tone="muted">Mesta: {prilika.pokrivenost?.popunjeno || 0}/{prilika.pokrivenost?.ukupno || 1}</T>
        </View>

        <View style={{ gap: space.xs }}>
          <T variant="meta" style={{ fontWeight: "700" }}>Uslovi:</T>
          {prilika.uslovi?.map((u: string) => (
             <T key={u} variant="meta" tone="muted">• {u}</T>
          ))}
        </View>

      </ScrollView>

      <View style={{ padding: space.base, borderTopWidth: 1, borderTopColor: palette.line100, backgroundColor: palette.ground }}>
         <Button 
           label="Sastavi prijavu" 
           onPress={() => router.push(`/prilike/${id}/prijava` as any)} 
         />
      </View>
    </SafeAreaView>
  );
}
