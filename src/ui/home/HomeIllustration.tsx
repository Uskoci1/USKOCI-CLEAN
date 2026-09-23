import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { sys } from '../system/tokens';

const { art, color } = sys;

/**
 * Native geometry from the owner's USKOCI_OTVORI (4).html heroArt(), not a replacement logo. Its tones are named in
 * `sys.art`; the ground shadow, the back sheet and the pin were a hair off the palette and now are the palette
 * (iconWell, greenSoft, orange).
 */
export function HomeIllustration({ size = 109 }: { size?: number }) {
  const leaf = `home-leaf-${useId().replace(/:/g, '')}`;
  return <Svg width={size} height={size} viewBox="0 0 136 136" accessible={false}>
    <Defs><LinearGradient id={leaf} x1="0" y1="0" x2="1" y2="1">
      <Stop stopColor={art.leafLight} /><Stop offset="1" stopColor={art.leafDeep} />
    </LinearGradient></Defs>
    <Ellipse cx="71" cy="116" rx="47" ry="6" fill={color.iconWell} />
    <G>
      <Rect x="26" y="33" width="59" height="74" rx="16" fill={color.greenSoft} transform="rotate(-12 54 71)" />
      <Rect x="30" y="26" width="59" height="74" rx="15" fill={color.surface} stroke={art.paperEdge} strokeWidth="1.5" />
      <Rect x="45" y="41" width="25" height="4" rx="2" fill={art.paperTitle} />
      <Rect x="45" y="52" width="30" height="3.5" rx="1.75" fill={art.paperRule} />
      <Rect x="45" y="62" width="20" height="3.5" rx="1.75" fill={art.paperRule} />
      <Circle cx="80" cy="95" r="18" fill={`url(#${leaf})`} />
      <Path d="m73 95 5 5 10-11" stroke={color.onGreen} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </G>
    <Path d="M122 49c0 17-18 31-18 31S86 66 86 49a18 18 0 1 1 36 0Z" fill={color.orange} />
    <Circle cx="104" cy="49" r="6.5" fill={color.surface} />
    <Path d="M17 18v8m-4-4h8" stroke={art.spark} strokeWidth="2" strokeLinecap="round" />
    <Circle cx="116" cy="104" r="3" fill={art.dot} />
  </Svg>;
}
