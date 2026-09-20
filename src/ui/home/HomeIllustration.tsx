import { useId } from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Native geometry from the owner's USKOCI_OTVORI (4).html heroArt(), not a replacement logo. */
export function HomeIllustration({ size = 109 }: { size?: number }) {
  const leaf = `home-leaf-${useId().replace(/:/g, '')}`;
  return <Svg width={size} height={size} viewBox="0 0 136 136" accessible={false}>
    <Defs><LinearGradient id={leaf} x1="0" y1="0" x2="1" y2="1">
      <Stop stopColor="#24866A" /><Stop offset="1" stopColor="#0D5141" />
    </LinearGradient></Defs>
    <Ellipse cx="71" cy="116" rx="47" ry="6" fill="#EFF3F1" />
    <G>
      <Rect x="26" y="33" width="59" height="74" rx="16" fill="#EAF3EE" transform="rotate(-12 54 71)" />
      <Rect x="30" y="26" width="59" height="74" rx="15" fill="white" stroke="#D8E7DF" strokeWidth="1.5" />
      <Rect x="45" y="41" width="25" height="4" rx="2" fill="#327960" />
      <Rect x="45" y="52" width="30" height="3.5" rx="1.75" fill="#C8DBD0" />
      <Rect x="45" y="62" width="20" height="3.5" rx="1.75" fill="#C8DBD0" />
      <Circle cx="80" cy="95" r="18" fill={`url(#${leaf})`} />
      <Path d="m73 95 5 5 10-11" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </G>
    <Path d="M122 49c0 17-18 31-18 31S86 66 86 49a18 18 0 1 1 36 0Z" fill="#FF800A" />
    <Circle cx="104" cy="49" r="6.5" fill="white" />
    <Path d="M17 18v8m-4-4h8" stroke="#FFAD60" strokeWidth="2" strokeLinecap="round" />
    <Circle cx="116" cy="104" r="3" fill="#AECDBB" />
  </Svg>;
}
