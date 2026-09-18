import { StyleSheet, View } from 'react-native';
import { ArrowsLeftRight } from 'phosphor-react-native';
import type { Uloga } from '../../contracts/projections';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { intentTitle, sys } from './tokens';

/**
 * A screen that belongs to the other intent says so, and offers the way across (owner decision,
 * 2026-09-18).
 *
 * `IntentTransition` is the other half of the same rule and asks before it moves you, because there
 * the person tapped something. Here they did not: a link, a notification or a return target simply
 * landed them on a screen whose content belongs to the intent they are not in. So this states the
 * fact in place and offers one way out, rather than a sheet in front of a screen they never asked
 * for. Nothing switches until they say so — the store stays the only writer.
 *
 * The intent has two names and both are used here: what you are ("naručilac") in the sentence, and
 * the mode you would switch to ("MENI TREBA") on the control that switches it.
 */
const asRole: Record<Uloga, string> = { narucilac: 'naručilac', uskocer: 'uskočer' };

export function CrossIntentNotice({ belongsTo, detail, onSwitch, disabled = false }: {
  belongsTo: Uloga; detail: string; onSwitch: () => void; disabled?: boolean;
}) {
  return <View accessibilityRole="summary" style={s.notice}>
    <View style={s.head}>
      <ArrowsLeftRight size={18} color={sys.color.green} />
      <T variant="bodyStrong" style={s.title}>{`Ovo radiš kao ${asRole[belongsTo]}`}</T>
    </View>
    <T variant="note" tone="muted">{detail}</T>
    <V2Action label={`Pređi u ${intentTitle(belongsTo)}`} kind="primary" disabled={disabled} onPress={onSwitch} />
  </View>;
}

const s = StyleSheet.create({
  notice: { marginHorizontal: 20, marginBottom: 10, padding: 14, gap: 8,
    borderRadius: sys.radius.card, backgroundColor: sys.color.greenSoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: sys.color.ink, flex: 1, minWidth: 0 },
});
