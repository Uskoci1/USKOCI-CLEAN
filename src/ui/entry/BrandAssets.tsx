import Svg, { G, Path } from 'react-native-svg';
import { brandParts, brandWords } from './spojBrandData';
import { BRAND_PARTS } from './spojBrandMath';

export function BrandMark({ size = 58 }: { size?: number }) {
  return <Svg width={size} height={size * 291 / 280} viewBox="0 0 280 291" accessible={false}>
    <G>{BRAND_PARTS.map((part, index) => <G key={index} transform={`translate(${part[0]} ${part[1]})`}>
      {brandParts[index].map((path, key) => <Path key={key} {...path} />)}
    </G>)}</G>
  </Svg>;
}

export function BrandLockup({ width = 156 }: { width?: number }) {
  return <Svg width={width} height={width * 104 / 320} viewBox="39 174 320 104" accessible accessibilityRole="image" accessibilityLabel="USKOČI">
    <G transform="translate(42.806 175.496) scale(.34)"><G transform="rotate(.40107046 140 145.44829)">
      {BRAND_PARTS.map((part, index) => <G key={index} transform={`translate(${part[0]} ${part[1]})`}>
        {brandParts[index].map((path, key) => <Path key={key} {...path} />)}
      </G>)}
    </G></G>
    {brandWords.map((word, index) => <G key={index} transform={word.transform}>{word.paths.map((path, key) => <Path key={key} {...path} />)}</G>)}
  </Svg>;
}
