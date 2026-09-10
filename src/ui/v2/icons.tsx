import Svg, { G, Path } from 'react-native-svg';
import { v2 } from './tokens';

/** Exact paths/tones from SPOJ V2 assets/icons/{back,send,chat,chevron}.svg.
 * No substitute icon family or redrawn brand geometry. */
export type V2IconName = 'back' | 'send' | 'chat' | 'chevron';
export function V2Icon({ name, size = 22, color = v2.color.ink }: { name: V2IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeLinecap="round" strokeLinejoin="round" strokeWidth={name === 'send' || name === 'chat' ? 1.7 : 1.75}
    accessible={false} focusable={false}>
    {name === 'back' ? <Path d="M15 5l-7 7 7 7" /> : null}
    {name === 'chevron' ? <Path d="M9 5l7 7-7 7" /> : null}
    {name === 'send' ? <><G fill={color} opacity={0.12} stroke="none"><Path d="m10 14 11-11-7 18Z" /></G>
      <Path d="m3 10 18-7-7 18-4-7-7-4Z" /><Path d="m10 14 5-5" /></> : null}
    {name === 'chat' ? <><G fill={color} opacity={0.12} stroke="none"><Path d="M8 5h9q3 0 3 4v6q0 2-4 2H9l-4 2V9q0-4 3-4Z" /></G>
      <Path d="M8 4h8a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H9l-5 3V9a5 5 0 0 1 4-5Z" /><Path d="M8 9h9M8 13h6" /></> : null}
  </Svg>;
}
