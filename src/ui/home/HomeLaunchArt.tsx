import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { sys } from '../system/tokens';

/** Original Home-only wayfinding artwork. A task sheet and a local map, never a status or an invented photograph. */
export function HomeLaunchArt({ kind, compact = false }: { kind: 'publish' | 'discover'; compact?: boolean }) {
  const size = compact ? 52 : 76;
  return <Svg width={size} height={size} viewBox="0 0 88 88" accessible={false}>
    <Ellipse cx="44" cy="78" rx="31" ry="4" fill={sys.color.iconWell} />
    {kind === 'publish' ? <>
      <Rect x="16" y="17" width="46" height="58" rx="10" fill={sys.color.control} transform="rotate(-9 39 46)" />
      <Path d="M29 10h25l14 14v40a10 10 0 0 1-10 10H29a10 10 0 0 1-10-10V20a10 10 0 0 1 10-10Z"
        fill={sys.color.surface} stroke={sys.color.lineStrong} strokeWidth="1.5" />
      <Path d="M54 10v10a4 4 0 0 0 4 4h10" fill={sys.color.wash} stroke={sys.color.lineStrong} strokeWidth="1.5" />
      <Path d="M30 31h17M30 40h25M30 49h17" stroke={sys.color.green} strokeWidth="3.5" strokeLinecap="round" />
      <Circle cx="64" cy="63" r="18" fill={sys.color.orange} />
      <Path d="M64 55v16M56 63h16" stroke={sys.color.onOrange} strokeWidth="3.2" strokeLinecap="round" />
    </> : <>
      <Path d="m11 27 20-6 25 6 21-6v48l-21 7-25-7-20 6Z" fill={sys.color.surface}
        stroke={sys.color.lineStrong} strokeWidth="1.5" strokeLinejoin="round" />
      <Path d="m31 21 25 6v49l-25-7Z" fill={sys.color.wash} />
      <Path d="M31 22v46M56 28v46" stroke={sys.color.lineStrong} strokeWidth="1.2" />
      <Path d="m15 58 13-4 16 5 20-8 10 3" fill="none" stroke={sys.color.orange} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M64 26c0 12-15 25-15 25S34 38 34 26a15 15 0 1 1 30 0Z" fill={sys.color.green} />
      <Circle cx="49" cy="26" r="5.5" fill={sys.color.onGreen} />
      <Circle cx="23" cy="56" r="4" fill={sys.color.surface} stroke={sys.color.orange} strokeWidth="2.5" />
    </>}
  </Svg>;
}
