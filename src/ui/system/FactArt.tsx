import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/**
 * The owner's two-tone fact artwork, transcribed from the V28/V31 prototype (`v17ArtPaths`,
 * decision 2026-09-22: "identičan izgled"). Same 32-unit drawings, same three tones — green for
 * places and money, orange for time, people, alerts and tasks, grey when a thing is not active.
 * Decorative: the words beside it carry the meaning, so it is hidden from screen readers.
 */
export type FactArtKind = 'pin' | 'calendar' | 'clock' | 'users' | 'money' | 'remote' | 'bell' | 'phone' | 'map' | 'tasks'
  | 'agreements' | 'offers';

type Tone = { front: string; edge: string; light: string; soft: string };
const MUTED: Tone = { front: '#8A938E', edge: '#5C6860', light: '#D6DDD8', soft: '#EAEEEB' };
const ORANGE: Tone = { front: '#F78028', edge: '#CF5B12', light: '#FFBE85', soft: '#FFF0E2' };
const GREEN: Tone = { front: '#079C77', edge: '#077958', light: '#6FD0AB', soft: '#E1F4EC' };
const ORANGE_KINDS: readonly FactArtKind[] = ['calendar', 'users', 'bell', 'tasks'];

const line = (d: string, color = '#35463D', width = 1.9) =>
  <Path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />;

function drawing(kind: FactArtKind, c: Tone, muted: boolean): ReactNode {
  const face = (d: string) => <Path d={d} fill={c.front} />;
  const edge = (d: string) => <Path d={d} fill={c.edge} />;
  const shine = (d: string) => line(d, c.light, 1.8);
  const shadow = <Ellipse cx={16} cy={29.4} rx={10.2} ry={1.6} fill="#163D2B" opacity={0.07} />;
  switch (kind) {
    case 'pin': return <>{shadow}{edge('M16 29.5s10-9.7 10-17.1a10 10 0 0 0-20 0c0 7.4 10 17.1 10 17.1Z')}
      {face('M16 27.5s9.3-9.1 9.3-16.1a9.3 9.3 0 0 0-18.6 0c0 7 9.3 16.1 9.3 16.1Z')}{shine('M10 10.4a6.2 6.2 0 0 1 6-5.2')}
      <Circle cx={16} cy={11.4} r={4} fill="#056B4D" opacity={0.32} /><Circle cx={16} cy={10.9} r={3.35} fill="#FFFFFF" /></>;
    case 'calendar': return <>{shadow}<Rect x={4.2} y={7.5} width={24.2} height={21.2} rx={5.2} fill="#D6DAD6" />
      <Rect x={3.6} y={5.6} width={24.2} height={21.2} rx={5.2} fill="#FFFFFF" stroke="#D5DAD5" strokeWidth={1.1} />
      {edge('M3.6 12.6V11a5.4 5.4 0 0 1 5.4-5.4h13.4a5.4 5.4 0 0 1 5.4 5.4v1.6Z')}{face('M3.6 11.3V9.9a4.3 4.3 0 0 1 4.3-4.3h15.6a4.3 4.3 0 0 1 4.3 4.3v1.4Z')}
      {shine('M7.1 8h17.1')}{line('M10.1 3.4v4.3M21.3 3.4v4.3', '#35463D', 2.1)}
      <Rect x={7.4} y={15} width={7.6} height={7.6} rx={2} fill={c.soft} />
      <Path d="m9.5 18.5 1.4 1.5 2.3-3" fill="none" stroke={c.front} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      {line('M19.3 16.7h3.4M19.3 21.1h3.4', '#6A736C', 1.8)}</>;
    case 'clock': return <>{shadow}<Circle cx={16.5} cy={17.3} r={12} fill="#CFD6D0" />
      <Circle cx={16} cy={15.5} r={12} fill="#FAFCFA" stroke="#B8C4BB" strokeWidth={1.2} />
      <Path d="M16 3.5a12 12 0 0 1 11.9 10.7" fill="none" stroke={muted ? '#78857A' : '#F78028'} strokeWidth={2.9} strokeLinecap="round" />
      {line('M16 8.1v7.4l4.6 3.3', '#33463B', 2.3)}<Circle cx={16} cy={15.5} r={1.8} fill="#33463B" />
      {line('M7.7 15.5h.6M16 23.3v.6', '#9AA59D', 1.7)}{line('M8.2 10.1a9.2 9.2 0 0 1 4.2-3.3', '#FFFFFF', 1.9)}</>;
    case 'users': return <>{shadow}<Circle cx={23.1} cy={10.7} r={4.3} fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      <Path d="M19.8 26.2h8a2 2 0 0 0 2-2v-2.7a7.1 7.1 0 0 0-12.4-4.7Z" fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      <Circle cx={11.1} cy={10.1} r={5.3} fill={c.edge} /><Circle cx={11.1} cy={9.1} r={5.3} fill={c.front} />
      {shine('M8.2 7.7a3.2 3.2 0 0 1 2.9-1.8')}{edge('M2 25.8v-2.3a9.1 9.1 0 0 1 18.2 0v2.3a2.6 2.6 0 0 1-2.6 2.6h-13A2.6 2.6 0 0 1 2 25.8Z')}
      {face('M2 24.2v-2.1a9.1 9.1 0 0 1 18.2 0v2.1a2.6 2.6 0 0 1-2.6 2.6h-13A2.6 2.6 0 0 1 2 24.2Z')}{shine('M5.9 21.5a5.3 5.3 0 0 1 2.2-3.1')}</>;
    case 'money': return <>{shadow}<Rect x={7.5} y={3.6} width={21.8} height={16} rx={4} fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      <Rect x={2.3} y={11} width={26.4} height={17} rx={4.2} fill={c.edge} /><Rect x={2.3} y={9.1} width={26.4} height={17} rx={4.2} fill={c.front} />
      {shine('M6.6 11.8h17.7')}<Ellipse cx={15.5} cy={17.5} rx={4} ry={4.8} fill="#FFFFFF" />
      {line('M15.5 15.9v3.1', c.edge, 1.8)}{line('M6.6 17.7v3.4m17.8-6.7v3.4', c.light, 1.9)}</>;
    case 'remote': return <>{shadow}<Rect x={2.6} y={4.8} width={26.8} height={19.7} rx={4.2} fill={c.edge} />
      <Rect x={2.6} y={3.4} width={26.8} height={19.7} rx={4.2} fill={c.front} /><Rect x={5.3} y={6.1} width={21.4} height={13.7} rx={1.8} fill="#FFFFFF" />
      {line('M16 23.2v4.3M10.9 28h10.2', '#576A5D', 2)}{line('m10.6 12.9 3.2 3.2 7-7', c.front, 2.1)}</>;
    case 'bell': return <>{shadow}{edge('M6.1 24.7c-1.4 0-1.8-1.4-.8-2.5 1.8-1.9 2.2-3.5 2.2-8a8.5 8.5 0 0 1 17 0c0 4.5.4 6.1 2.2 8 1 1.1.6 2.5-.8 2.5Z')}
      {face('M6.1 22.9c-1.4 0-1.8-1.4-.8-2.5 1.8-1.9 2.2-3.5 2.2-7.6a8.5 8.5 0 0 1 17 0c0 4.1.4 5.7 2.2 7.6 1 1.1.6 2.5-.8 2.5Z')}
      {shine('M11 12.7a5 5 0 0 1 4.9-5')}<Path d="M13.2 26.3a2.8 2.8 0 0 0 5.6 0" fill="#364D40" />{line('M16 2.8v2', '#364D40', 2.1)}</>;
    case 'phone': return <>{shadow}{edge('M7.3 3.4h4.1l3.1 7-3.4 2.7a23.2 23.2 0 0 0 8 8l2.7-3.4 7 3.1v4.1c0 4.5-6.4 5.8-15.8-2.5S.8 5.8 5.1 4.1Z')}
      {face('M7.3 2.1h4.1l3.1 7-3.4 2.7a23.2 23.2 0 0 0 8 8l2.7-3.4 7 3.1v4.1c0 4.5-6.4 5.8-15.8-2.5S.8 4.5 5.1 2.8Z')}
      {shine('M7.4 5.4h1.7l1.1 2.5')}{line('M21.4 3.9a8.4 8.4 0 0 1 6.2 6.2M20.6 8.2a3.7 3.7 0 0 1 2.7 2.7', '#6E8576', 1.8)}</>;
    case 'map': return <>{shadow}<Path d="m3 8.1 8-3 10 3 8-3v22.2l-8 3-10-3-8 3Z" fill="#C3CFC6" />
      <Path d="m3 6.4 8-3 10 3 8-3v22.2l-8 3-10-3-8 3Z" fill="#F7FBF7" stroke="#C3CFC6" strokeWidth={1.1} />
      <Path d="m11 3.4 10 3v22.2l-10-3Z" fill={c.soft} />{line('M11 4.2v20.3M21 18.5v9', muted ? '#A8B4AB' : '#9BCDB4', 1.1)}
      {edge('M20.6 21s7.1-6.6 7.1-12a7.1 7.1 0 1 0-14.2 0c0 5.4 7.1 12 7.1 12Z')}{face('M20.6 19.5s6.7-6.3 6.7-11.4a6.7 6.7 0 1 0-13.4 0c0 5.1 6.7 11.4 6.7 11.4Z')}
      <Circle cx={20.6} cy={8.1} r={2.5} fill="#FFFFFF" />{shine('M16.4 7a4.2 4.2 0 0 1 3.3-2.8')}</>;
    case 'tasks': return <>{shadow}<Rect x={6.2} y={4.4} width={21.1} height={25.4} rx={4.2} fill="#C5CDC7" />
      <Rect x={4.7} y={2.7} width={21.1} height={25.4} rx={4.2} fill="#FFFFFF" stroke="#CCD4CE" strokeWidth={1.1} />
      <Rect x={10.2} y={2.8} width={10.1} height={4.2} rx={1.8} fill={c.edge} /><Rect x={10.2} y={1.4} width={10.1} height={4.2} rx={1.8} fill={c.front} />
      {line('M10.2 11.4h10.1M10.2 16.1h6.8', '#7B887E', 1.7)}<Circle cx={23.4} cy={23.6} r={7.2} fill={c.edge} /><Circle cx={23.4} cy={22.3} r={7.2} fill={c.front} />
      {line('m20.1 22.1 2.2 2.3 4.4-4.5', '#FFFFFF', 2)}{shine('M19.7 18.9a4.6 4.6 0 0 1 2.6-1.1')}</>;
    case 'agreements': return <>{shadow}
      <Path d="M15.3 10.2h11a4.3 4.3 0 0 1 4.3 4.3v8.7a4.3 4.3 0 0 1-4.3 4.3h-1.5v3l-5-3h-4.5a4.3 4.3 0 0 1-4.3-4.3v-8.7a4.3 4.3 0 0 1 4.3-4.3Z" fill={c.soft} stroke={c.light} strokeWidth={1.1} />
      {edge('M8.5 3.4h13A5.5 5.5 0 0 1 27 8.9v11a5.5 5.5 0 0 1-5.5 5.5H12l-8 5V8.9a5.5 5.5 0 0 1 4.5-5.5Z')}
      {face('M8.5 1.8h13A5.5 5.5 0 0 1 27 7.3v11a5.5 5.5 0 0 1-5.5 5.5H12l-8 5V7.3a5.5 5.5 0 0 1 4.5-5.5Z')}
      {shine('M8.2 6a2.5 2.5 0 0 1 2.1-1h10.2')}{line('m9.6 13.1 3.6 3.7 7.4-7.4', '#FFFFFF', 2.5)}</>;
    case 'offers': return <>{shadow}{edge('M8.4 4h15.2A5.4 5.4 0 0 1 29 9.4v12.2a5.4 5.4 0 0 1-5.4 5.4H13L5 31v-5.6A5.4 5.4 0 0 1 3 21.6V9.4A5.4 5.4 0 0 1 8.4 4Z')}
      {face('M8.4 2.3h15.2A5.4 5.4 0 0 1 29 7.7v12.2a5.4 5.4 0 0 1-5.4 5.4H13l-8 4v-5.6A5.4 5.4 0 0 1 3 19.9V7.7a5.4 5.4 0 0 1 5.4-5.4Z')}
      {shine('M8 6h15.3')}{line('M9.5 12h13M9.5 17.6h8.4', '#FFFFFF', 2.2)}</>;
  }
}

function FactArtBase({ kind, size = 20, muted = false }: { kind: FactArtKind; size?: number; muted?: boolean }) {
  const tone = muted ? MUTED : ORANGE_KINDS.includes(kind) ? ORANGE : GREEN;
  return <View aria-hidden style={{ width: size, height: size }}>
    <Svg width={size} height={size} viewBox="0 0 32 32">{drawing(kind, tone, muted)}</Svg>
  </View>;
}

export const FactArt = memo(FactArtBase);
