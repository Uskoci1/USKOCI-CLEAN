import { useState, type ComponentProps } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { AgreementChat } from '../AgreementChat';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Press } from '../Press';
import { ProductHeader } from '../product/ProductDetails';
import { Avatar } from '../system/Avatar';
import { ChromeIconButton } from '../system/ScreenChrome';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { AgreementHero, AgreementPersonBar, agreementRole, AgreementTabs } from './AgreementPresentation';

type Props = {
  agreement: DogovorProjekcija;
  person?: UcesnikProjekcija;
  back: () => void;
  onOverview: () => void;
  waiting?: string | null;
  chat: ComponentProps<typeof AgreementChat>;
};

/**
 * The keyboard owns the screen boundary in the route. This frame measures the space left inside it, so secondary
 * context can yield before it crowds the transcript or the writing controls. At large text the person's full name,
 * role and accepted terms join the history scroll; the short bar always retains Back and the accepted overview.
 * The chat itself never remounts when that composition changes: its draft, selected message and photo tray survive.
 */
export function AgreementThreadPresentation({ agreement, person, back, onOverview, waiting = null, chat }: Props) {
  const { height } = useWindowDimensions();
  const scale = useTextScale();
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const compact = scale >= 1.6 || (availableHeight ?? height) < 560;
  const title = readableTitle(agreement.naslov);
  const initials = person ? <Avatar initials={person.inicijali} size={40} /> : null;
  const context = compact ? <View testID="agreement-thread-context" style={s.context}>
    {person ? <View style={s.person}>
      {person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials}
      <View style={s.personCopy}>
        <T accessibilityRole="header" variant="bodyStrong">{person.ime}</T>
        {agreementRole(person) ? <T variant="note" tone="muted">{agreementRole(person)}</T> : null}
      </View>
    </View> : null}
    <AgreementHero agreement={agreement} />
    {waiting ? <T variant="bodyStrong" style={s.waiting}>{waiting}</T> : null}
  </View> : null;

  return <View testID="agreement-thread-frame" style={s.frame} onLayout={({ nativeEvent }) => {
    const next = Math.round(nativeEvent.layout.height);
    if (next > 0) setAvailableHeight(current => current === next ? current : next);
  }}>
    {compact ? <View testID="agreement-thread-compact-bar" style={s.bar}>
      <ChromeIconButton label="Nazad" icon={ArrowLeft} onPress={back} />
      <T accessibilityRole="header" accessibilityLabel={person ? `Poruke: ${person.ime}` : 'Poruke'} variant="bodyStrong" numberOfLines={1} style={s.barTitle}>
        {person && scale < 1.6 ? person.ime : 'Poruke'}
      </T>
      <Press accessibilityRole="button" accessibilityLabel={`Uslovi Dogovora: ${title}${waiting ? `. ${waiting}` : ''}`}
        accessibilityHint="Otvara pregled prihvaćenih uslova i narednih koraka." onPress={onOverview} haptic="select" hitSlop={0} style={s.overview}>
        {waiting ? <View style={s.dot} /> : null}
        <T variant="note" tone="green">Uslovi</T>
      </Press>
    </View> : <>
      {person ? <AgreementPersonBar person={person} back={back} /> : <ProductHeader title="Dogovor" back={back} />}
      <View style={s.tabs}>
        <AgreementTabs tab="poruke" onChange={tab => { if (tab === 'pregled') onOverview(); }} />
        <AgreementHero agreement={agreement} compact waiting={waiting} onOpen={onOverview} />
      </View>
    </>}
    <AgreementChat {...chat} compact={compact} context={context} />
  </View>;
}

const s = StyleSheet.create({
  frame: { flex: 1, minHeight: 0 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: sys.conversation.ground },
  barTitle: { flex: 1, minWidth: 0 },
  overview: { minHeight: 48, minWidth: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 12, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.warn },
  tabs: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  context: { gap: 16, paddingBottom: 24, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: sys.conversation.edge },
  person: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  personCopy: { flex: 1, minWidth: 0, gap: 4 },
  waiting: { color: sys.color.warn },
});
