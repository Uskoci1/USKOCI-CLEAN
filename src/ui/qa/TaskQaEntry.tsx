import {SettingsPanel,SettingsText,SettingsAction} from '../settings/SettingsPresentation';

export function TaskQaEntry({onPress,disabled=false}:{onPress:()=>void;disabled?:boolean}) {
  return <SettingsPanel><SettingsText variant="heading">Pitanja o zadatku</SettingsText>
    <SettingsText tone="muted">Pitanja i odgovori koji razjašnjavaju ovaj zadatak pre dogovora.</SettingsText>
    <SettingsAction label="Otvori pitanja i odgovore" kind="secondary" onPress={onPress} disabled={disabled}/>
  </SettingsPanel>;
}
