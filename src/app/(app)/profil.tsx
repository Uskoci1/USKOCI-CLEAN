import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowsLeftRight, User, Star, Gear, CaretRight } from 'phosphor-react-native';

import { T } from '../../ui/Text';
import { Press } from '../../ui/Press';
import { Card } from '../../ui/Button';
import { palette, space, radius, elevation, touch } from '../../theme/tokens';
import { useUloga, promeniProstor } from '../../store/uloga';

export default function Profil() {
  const uloga = useUloga();
  const narucilac = uloga === 'narucilac';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: palette.ground }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.base, paddingBottom: space.xxl, gap: space.base }}
        showsVerticalScrollIndicator={false}
      >
        <T variant="display" style={{ marginTop: space.sm }}>Profil</T>

        <Card style={elevation.card}>
          <View style={{ padding: space.base, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 52, height: 52, borderRadius: radius.lg, backgroundColor: palette.forest800,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <T variant="heading" tone="onDark">MŠ</T>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T variant="heading">Miloš</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Star size={14} color={palette.teal500} weight="fill" />
                <T variant="meta" tone="muted">4,9 · 18 recenzija</T>
              </View>
            </View>
          </View>
        </Card>

        {/*
          Kanon: jedan nalog koristi oba prostora. Ovo nije druga prijava —
          isti korisnik gleda iste Dogovore sa druge strane.
        */}
        <Press
          accessibilityRole="button"
          accessibilityLabel={`Pređi u prostor ${narucilac ? 'Uskočera' : 'Naručioca'}`}
          haptic="medium"
          scaleTo={0.985}
          onPress={() => {
            promeniProstor();
            router.replace('/');
          }}
        >
          <Card style={[{ borderColor: palette.orange, borderWidth: 1.5 }, elevation.card]}>
            <View style={{ padding: space.base, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View
                style={{
                  width: 40, height: 40, borderRadius: radius.md, backgroundColor: palette.orangeSoft,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <ArrowsLeftRight size={20} color={palette.orangeInk} weight="bold" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodyStrong">
                  Pređite u prostor {narucilac ? 'Uskočera' : 'Naručioca'}
                </T>
                <T variant="meta" tone="muted">
                  Sada ste u prostoru {narucilac ? 'Naručioca' : 'Uskočera'}. Isti nalog.
                </T>
              </View>
              <CaretRight size={17} color={palette.orangeInk} />
            </View>
          </Card>
        </Press>

        <Card>
          {[
            { ikona: User, naslov: 'Javni profil', opis: 'Šta drugi vide o Vama' },
            { ikona: Star, naslov: 'Recenzije', opis: '18 recenzija' },
            { ikona: Gear, naslov: 'Podešavanja', opis: 'Obaveštenja, privatnost, nalog' },
          ].map((r, i, sve) => (
            <Press
              key={r.naslov}
              accessibilityRole="button"
              accessibilityLabel={r.naslov}
              haptic="select"
              scaleTo={0.995}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.md,
                paddingHorizontal: space.base, minHeight: touch.min + 12,
                borderBottomWidth: i < sve.length - 1 ? 1 : 0,
                borderBottomColor: palette.line100,
              }}
            >
              <r.ikona size={19} color={palette.teal500} />
              <View style={{ flex: 1, gap: 1 }}>
                <T variant="bodyStrong">{r.naslov}</T>
                <T variant="meta" tone="muted">{r.opis}</T>
              </View>
              <CaretRight size={16} color={palette.inkMuted} />
            </Press>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
