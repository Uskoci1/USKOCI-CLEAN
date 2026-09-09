import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { readBuildIdentity } from '../data/buildIdentity';
import { palette, space, type } from '../theme/tokens';

const targets = {
  canonical: 'Referentni USKOČI projekat', local: 'Lokalno test okruženje',
  other: 'Drugo ili neprepoznato okruženje', unconfigured: 'Okruženje nije zabeleženo',
};

/** Small in-context support detail, not another navigation destination. */
export function BuildIdentity() {
  const [expanded, setExpanded] = useState(false);
  const build = readBuildIdentity();
  return <View style={styles.root}>
    <Pressable accessibilityRole="button" accessibilityLabel="Podaci o verziji"
      accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={styles.button}>
      <Text style={styles.label}>USKOČI · {build.version ?? 'verzija nije zabeležena'}{build.sourceCommit ? ` · ${build.sourceCommit.slice(0, 7)}` : ''}{build.sourceDirty ? ' *' : ''}</Text>
    </Pressable>
    {expanded ? <View accessibilityLiveRegion="polite" style={styles.details}>
      <Text selectable style={styles.copy}>Izvor: {build.sourceCommit ?? 'nije zabeležen'}</Text>
      <Text style={styles.copy}>{build.sourceDirty === true ? 'Radna verzija sa lokalnim izmenama.'
        : build.sourceDirty === false ? 'Izgrađeno iz čistog radnog stabla.' : 'Čistoća radnog stabla nije potvrđena.'}</Text>
      <Text style={styles.copy}>{targets[build.backendTarget]}</Text>
      <Text style={styles.copy}>Verzija servera i aktivne mogućnosti proveravaju se zasebno.</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  label: { color: palette.inkMuted, ...type.meta, textAlign: 'center' },
  details: { gap: space.sm, paddingHorizontal: space.sm },
  copy: { color: palette.inkMuted, ...type.meta },
});
