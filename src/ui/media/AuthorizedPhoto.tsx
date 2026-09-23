import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { mediaClientService } from '../../data/mediaClientService';
import { uuid } from '../../data/serverReceipt';
import { sesijaSada, useSesija } from '../../store/sesija';
import { T } from '../Text';
import { aiFirst as a } from '../aiFirst/tokens';
import { sys } from '../system/tokens';

// Bounded in-memory representation; no signed URL or persistent image cache.
function jpegDataUri(bytes: ArrayBuffer): string {
  const data = new Uint8Array(bytes), alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = []; let part = '';
  for (let i = 0; i < data.length; i += 3) {
    const word = (data[i] << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0);
    part += alphabet[(word >>> 18) & 63] + alphabet[(word >>> 12) & 63]
      + (i + 1 < data.length ? alphabet[(word >>> 6) & 63] : '=') + (i + 2 < data.length ? alphabet[word & 63] : '=');
    if (part.length >= 16384) { chunks.push(part); part = ''; }
  }
  chunks.push(part); return 'data:image/jpeg;base64,' + chunks.join('');
}

export function AuthorizedPhoto(p: { assetId: string; needId?: string; profileId?: string; caseId?: string; agreementId?: string; messageId?: string; label: string; style?: StyleProp<ViewStyle>; contentFit?: 'contain' | 'cover';
  /** Drawn instead of the failure sentence when the photo cannot be read, e.g. initials in a small avatar. */ unavailable?: ReactNode }) {
  const { user, accountRevision } = useSesija();
  const binding = `${user?.id}:${accountRevision}:${p.assetId}:${p.needId ?? ''}:${p.profileId ?? ''}:${p.caseId ?? ''}:${p.agreementId ?? ''}:${p.messageId ?? ''}`;
  const [image, setImage] = useState<{ key: object; uri: string; binding: string } | null>(null), [failed, setFailed] = useState(false);
  const active = useRef<object | null>(null);
  useFocusEffect(useCallback(() => {
    const key = {}; active.current = key; const abort = new AbortController();
    const current = () => active.current === key && sesijaSada().user?.id === user?.id && sesijaSada().accountRevision === accountRevision;
    setImage(null); setFailed(false);
    void mediaClientService.readMedia(p.assetId, { ...(p.needId ? { needId: p.needId } : {}),
      ...(p.profileId ? { profileId: p.profileId } : {}), ...(p.caseId ? { caseId: p.caseId } : {}),
      ...(p.agreementId ? { agreementId: p.agreementId } : {}), ...(p.messageId ? { messageId: p.messageId } : {}) }, { signal: abort.signal }).then(result => {
      if (!current()) return;
      if (result.ok) setImage({ key, uri: jpegDataUri(result.podatak.bytes), binding }); else setFailed(true);
    });
    return () => { if (active.current === key) active.current = null; abort.abort(); setImage(null); };
  }, [p.assetId, p.needId, p.profileId, p.caseId, p.agreementId, p.messageId, user?.id, accountRevision]));
  return <View style={[{ aspectRatio: 4 / 3, backgroundColor: a.color.wash, borderRadius: sys.radius.control, overflow: 'hidden', justifyContent: 'center' }, p.style]}>
    {image && image.key === active.current && image.binding === binding ? <Image source={{ uri: image.uri }} accessibilityLabel={p.label}
      accessible contentFit={p.contentFit ?? 'contain'} cachePolicy="none" recyclingKey={binding}
      transition={0} style={{ width: '100%', height: '100%' }} />
      : failed ? p.unavailable ?? <T style={{ ...a.text.meta, color: a.color.muted, padding: 12 }}>Fotografija trenutno nije dostupna.</T>
        : <ActivityIndicator accessibilityLabel="Učitavanje fotografije" color={a.color.green} />}
  </View>;
}

export function mediaAssetId(ref: string): string | null {
  const match = /^([a-f0-9-]{36})\/v5\/([a-f0-9-]{36})\/[a-f0-9]{64}\.jpg$/i.exec(ref);
  return match && uuid(match[1]) && uuid(match[2]) ? match[2] : null;
}
