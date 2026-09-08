import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { PrilikaDetaljiProjekcija } from '../../contracts/publicTaskDetail';
import type { NeedTaskGeography, NeedTaskGeographyPoint } from '../../contracts/needFactsV2';
import { Card } from '../Button';
import { T } from '../Text';
import { space } from '../../theme/tokens';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card style={s.card}><View style={s.section}>
    <T variant="heading" accessibilityRole="header">{title}</T>{children}
  </View></Card>;
}

function Values({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null;
  return <View style={s.group}><T variant="bodyStrong">{title}</T>
    {values.map((value, index) => <T key={`${index}:${value}`} variant="body">• {value}</T>)}
  </View>;
}

function Place({ title, point }: { title: string; point?: NeedTaskGeographyPoint }) {
  const text = [point?.label, point?.area, point?.city].filter(Boolean).join(', ');
  return <View style={s.group}><T variant="meta" tone="muted">{title}</T>
    <T variant="body">{text || 'Područje nije navedeno.'}</T></View>;
}

function Geography({ value }: { value: NeedTaskGeography }) {
  if (value.mode === 'REMOTE') return <T variant="body">Na daljinu, bez dolaska na lokaciju.</T>;
  if (value.mode === 'AREA_BASED') return <>
    {value.start && value.serviceArea && <Place title="Početno područje" point={value.start} />}
    <Place title="Područje rada" point={value.serviceArea ?? value.start} />
  </>;
  return <>
    <Place title={value.mode === 'STATIONARY' ? 'Mesto rada' : 'Polazište'} point={value.start} />
    {value.mode === 'MULTI_STOP' && value.waypoints?.map((point, index) =>
      <Place key={index} title={`Stanica ${index + 1}`} point={point} />)}
    {(value.mode === 'POINT_TO_POINT' || (value.mode === 'MULTI_STOP' && value.end)) && <Place title="Odredište" point={value.end} />}
    <T variant="meta" tone="muted">Prikazana su javna, približna područja.</T>
  </>;
}

/** Public detail projection only: no client, mutation, eligibility or identity verdict. */
export function PublicTaskMaterial({ task }: { task: PrilikaDetaljiProjekcija }) {
  const requirements = task.zahtevi;
  return <View style={s.content}>
    <View style={s.heading}>
      <T variant="label" tone="muted">{task.statusTekst}</T>
      <T variant="title" accessibilityRole="header">{task.naslov}</T>
      {task.kategorija ? <T variant="meta" tone="muted">{task.kategorija}</T> : null}
    </View>
    <Card style={s.card}><View style={s.section}>
      <T variant="bodyStrong">{task.podrucjeTekst}</T>
      <T variant="body">{task.vremeTekst}</T>
      <T variant="meta" tone="muted">Popunjeno {task.pokrivenost.popunjeno} od {task.pokrivenost.ukupno} mesta</T>
      {task.rezimCene === 'OFFERS' ? <T variant="bodyStrong">Traži ponude</T>
        : task.ponudjenaCena ? <T variant="bodyStrong">{task.ponudjenaCena.prikaz}</T> : null}
    </View></Card>
    <Section title="Šta treba da se uradi">
      <T variant="body" selectable>{task.opis || 'Opis nije naveden.'}</T>
    </Section>
    <Section title="Mesto i kretanje">
      {task.javnaGeografija.state === 'available' ? <Geography value={task.javnaGeografija.value} />
        : <T variant="body" tone="muted">Detalji mesta i kretanja nisu dostupni vašem nalogu.</T>}
    </Section>
    <Section title="Šta je potrebno">
      <Values title="Veštine" values={requirements.vestine} />
      <Values title="Alat i oprema" values={requirements.alati} />
      <Values title="Vozila" values={requirements.vozila} />
      <Values title="Licence i dozvole" values={requirements.licence} />
      <View style={s.group}><T variant="bodyStrong">Iskustvo</T>
        <T variant="body">{requirements.minimalnoIskustvoGodina === null ? 'Uslov za iskustvo nije naveden.'
          : requirements.minimalnoIskustvoGodina === 0 ? 'Prethodno iskustvo nije obavezno.'
            : `Traženo iskustvo: najmanje ${requirements.minimalnoIskustvoGodina} god.`}</T></View>
      {requirements.zahtevaProverenIdentitet ? <T variant="body">Za ovaj zadatak traži se proveren identitet.</T> : null}
    </Section>
    <Section title="Važni uslovi zadatka">
      {task.kriticniUslovi.state === 'unavailable'
        ? <T variant="body" tone="muted">Dodatni uslovi nisu dostupni vašem nalogu.</T>
        : task.kriticniUslovi.value.length
          ? task.kriticniUslovi.value.map((value, index) => <T key={`${index}:${value}`} variant="body">• {value}</T>)
          : <T variant="body" tone="muted">Nisu navedeni dodatni uslovi.</T>}
    </Section>
  </View>;
}

const s = StyleSheet.create({
  content: { gap: space.base }, heading: { gap: space.sm, paddingVertical: space.sm },
  card: { backgroundColor: '#FFFFFF', borderColor: '#DCE3DE', borderRadius: 24 },
  section: { padding: space.xl, gap: space.base }, group: { gap: space.xs },
});
