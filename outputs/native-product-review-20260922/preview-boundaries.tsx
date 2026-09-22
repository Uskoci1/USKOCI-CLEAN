// Preview-only substitutes for media reads, inbox reads and voice transport.
// Never imported by the application.
import React from 'react';
import { View } from 'react-native';
import { T } from '../../src/ui/Text';
import { FactArt } from '../../src/ui/system/FactArt';
export function ProfilePhoto({ size = 64, initial = '?', fallback }: any) {
  return fallback ?? <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#EFF6F0', alignItems: 'center', justifyContent: 'center' }}>
    <T style={{ fontSize: size / 3, color: '#076E4E' }}>{initial}</T></View>;
}
export function InboxBell() { return <FactArt kind="bell" size={30} />; }
export function loadInterWeb() {}
export const VOICE_PROCESSING_NOTICE = 'Govorni unos se ovde ne pokreće.';
