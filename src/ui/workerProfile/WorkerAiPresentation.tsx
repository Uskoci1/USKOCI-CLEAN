import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import type { WorkerAiPatch, WorkerAiProfile, WorkerAiReview } from '../../data/workerAiClientService';
import { capabilityTerms } from '../../lib/capabilityTerms';
import { countryCode } from '../../lib/market';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { aiFirst as a } from '../aiFirst/tokens';
import { weekdays, zonedParts } from '../calendar/calendarPresentation';

const list=(values:readonly string[],empty='Još nije navedeno')=>values.length?values.join(' · '):empty;
export function WorkerAiCard({profile,compact,review,disabled}:{profile:WorkerAiProfile;compact:boolean;review:()=>void;disabled:boolean}){
  return <View style={s.card}><T style={s.label}>TVOJ RADNI PROFIL</T>
    <T numberOfLines={compact?1:2} style={s.title}>{profile.skills.length?profile.skills.join(' · '):'Šta možeš da preuzmeš?'}</T>
    <T style={s.body}>{profile.location.city||'Područje rada'}{profile.location.operatingCountryCode?` · ${profile.location.operatingCountryCode}`:''} · {profile.teamCapacity} {profile.teamCapacity===1?'osoba':'ljudi'}</T>
    {!compact?<T style={s.meta}>{profile.location.radiusKm} km · {profile.availability.availableNow?'Dostupan sada':'Dostupnost po rasporedu'} · {profile.availability.rules.length} redovnih termina</T>:null}
    <V2Action label="Pregledaj profil" disabled={disabled} onPress={review} kind="quiet" />
  </View>;
}
function Row({label,value}:{label:string;value:string}){return <View style={s.row}><T style={s.meta}>{label}</T><T selectable style={s.body}>{value}</T></View>;}
export function WorkerAiReviewDetails({review}:{review:WorkerAiReview}){
  const p=review.profile;
  return <><T accessibilityRole="header" style={s.title}>{p.displayName||'Radni profil'}</T>
    <T style={s.meta}>Proveri sve podatke. Završno dugme prihvata ovaj pregled i čuva profil.</T>
    <Row label="Veštine i usluge" value={list(p.skills)} /><Row label="Alat i oprema" value={list(p.tools,'Nije navedeno')} />
    <Row label="Vozila" value={list(p.vehicles,'Nije navedeno')} /><Row label="Licence koje navodiš" value={list(p.licenses,'Nisu navedene')} />
    <Row label="Broj ljudi, uključujući tebe" value={String(p.teamCapacity)} /><Row label="Kratko predstavljanje" value={p.bio||'Nije navedeno'} />
    <Row label="Područje rada" value={`${p.location.city||'Nije navedeno'}${p.location.operatingCountryCode?' · '+p.location.operatingCountryCode:''} · ${p.location.radiusKm} km`} />
    <T style={s.meta}>{p.location.approximatePosition?'Približna tačka radnog područja je sačuvana.':'Približna tačka nije uneta. Možeš je podesiti kroz postojeće područje rada.'}</T>
    <Row label="Dostupnost" value={p.availability.availableNow?'Dostupan sada, dok sam ne promeniš status':'Status „Dostupan sada“ je isključen'} />
    <T style={s.meta}>Vremenska zona: {p.availability.timezone}</T>
    <T accessibilityRole="header" style={s.subtitle}>Redovna nedelja</T>
    {weekdays.map(day=><Row key={day.day} label={day.name} value={p.availability.rules.filter(r=>r.weekdays.includes(day.day)).map(r=>
      `${r.startTime}–${r.endTime} · od ${r.startsOn}${r.endsOn?' do '+r.endsOn:''}${r.active?'':' · pauzirano'}${r.label?' · '+r.label:''}`).join('\n')||'Nema redovnih termina'} />)}
    <T accessibilityRole="header" style={s.subtitle}>Posebni datumi</T>
    {p.availability.windows.length?p.availability.windows.map(w=>{const start=zonedParts(new Date(w.startsAt),p.availability.timezone),end=zonedParts(new Date(w.endsAt),p.availability.timezone);
      return <Row key={w.id} label={w.state==='AVAILABLE'?'Dostupan':'Nedostupan'} value={`${start.date} ${start.time} — ${end.date} ${end.time}${w.label?' · '+w.label:''}`} />;}):<T style={s.body}>Nema posebnih datuma.</T>}
    <T style={s.meta}>Veštine i licence su podaci koje sam navodiš. Postojeći Dogovori ostaju obaveze. Dostupnost ne uključuje HITNO.</T>
    {review.missingRequired.length?<T accessibilityRole="alert" style={s.error}>Dopuni: {review.missingRequired.join(', ')}.</T>:null}
  </>;
}
function Field({label,value,change,disabled,numeric=false,multiline=false}:{label:string;value:string;change:(v:string)=>void;disabled:boolean;numeric?:boolean;multiline?:boolean}){
  return <View style={{gap:6}}><T style={s.body}>{label}</T><TextInput accessibilityLabel={label} style={[s.input,multiline&&{minHeight:96,textAlignVertical:'top'}]}
    value={value} editable={!disabled} onChangeText={v=>{if(!disabled)change(v);}} multiline={multiline} keyboardType={numeric?'number-pad':'default'} maxLength={numeric?3:multiline?25500:160}/></View>;
}
export function WorkerAiManual({profile,disabled,apply}:{profile:WorkerAiProfile;disabled:boolean;apply:(patch:WorkerAiPatch)=>void}){
  const [name,setName]=useState(profile.displayName),[bio,setBio]=useState(profile.bio),[capacity,setCapacity]=useState(String(profile.teamCapacity));
  const [city,setCity]=useState(profile.location.city),[country,setCountry]=useState(profile.location.operatingCountryCode??''),[radius,setRadius]=useState(String(profile.location.radiusKm));
  const [skills,setSkills]=useState(profile.skills.join('\n')),[tools,setTools]=useState(profile.tools.join('\n')),[vehicles,setVehicles]=useState(profile.vehicles.join('\n')),[licenses,setLicenses]=useState(profile.licenses.join('\n'));
  const [error,setError]=useState<string|null>(null);
  const submit=()=>{
    if(disabled)return;
    const arrays=[skills,tools,vehicles,licenses].map(v=>capabilityTerms(v.split('\n').map(x=>x.trim()).filter(Boolean)));
    const countryValue=country.trim()?countryCode(country.trim().toUpperCase()):null;
    if(!arrays.every(Boolean)||!/^(?:[1-9]|[1-4][0-9]|50)$/.test(capacity)||!/^\d{1,3}$/.test(radius)||Number(radius)<1||Number(radius)>200
      ||(country.trim()&&!countryValue)||bio.length>4000){setError('Proveri liste, državu, kapacitet 1–50 i radijus 1–200 km.');return;}
    apply({displayName:name,bio,teamCapacity:Number(capacity),skills:arrays[0]!,tools:arrays[1]!,vehicles:arrays[2]!,licenses:arrays[3]!,
      location:{city,operatingCountryCode:countryValue,radiusKm:Number(radius)}});
  };
  return <><T style={s.meta}>Izmene ostaju u predlogu do završnog pregleda i čuvanja. U liste unesi jednu stavku po redu.</T>
    <Field disabled={disabled} label="Ime na profilu" value={name} change={setName}/><Field disabled={disabled} label="Veštine i usluge" value={skills} change={setSkills} multiline/>
    <Field disabled={disabled} label="Alat i oprema" value={tools} change={setTools} multiline/><Field disabled={disabled} label="Vozila" value={vehicles} change={setVehicles} multiline/>
    <Field disabled={disabled} label="Licence koje navodiš" value={licenses} change={setLicenses} multiline/><Field disabled={disabled} label="Broj ljudi, uključujući tebe" value={capacity} change={setCapacity} numeric/>
    <Field disabled={disabled} label="Kratko predstavljanje" value={bio} change={setBio} multiline/><Field disabled={disabled} label="Država rada (npr. RS)" value={country} change={setCountry}/>
    <Field disabled={disabled} label="Grad ili mesto rada" value={city} change={setCity}/><Field disabled={disabled} label="Radijus rada u km" value={radius} change={setRadius} numeric/>
    {error?<T accessibilityRole="alert" style={s.error}>{error}</T>:null}<V2Action label="Primeni na pregled profila" disabled={disabled} onPress={submit}/>
  </>;
}
export function WorkerAiActivation({activate,disabled,change}:{activate:boolean;disabled:boolean;change:(v:boolean)=>void}){
  return <View style={s.activation}><View style={{flex:1}}><T style={s.body}>Aktiviraj profil posle čuvanja</T><T style={s.meta}>Isključeno: profil ostaje nacrt.</T></View>
    <Switch accessibilityLabel="Aktiviraj profil posle čuvanja" value={activate} disabled={disabled} onValueChange={change} trackColor={{true:a.color.green}}/></View>;
}
const s=StyleSheet.create({
  card:{padding:18,borderRadius:a.radius.card,backgroundColor:a.color.wash,gap:7,borderWidth:1,borderColor:a.color.line},
  title:{...a.text.card,color:a.color.ink},subtitle:{...a.text.title,color:a.color.ink},label:{...a.text.meta,fontWeight:'700',color:a.color.green},
  body:{...a.text.body,color:a.color.ink},meta:{...a.text.meta,color:a.color.muted},row:{gap:5,paddingVertical:10,borderBottomWidth:1,borderColor:a.color.line},
  error:{...a.text.body,color:a.color.danger},input:{...a.text.body,color:a.color.ink,borderWidth:1,borderColor:a.color.line,borderRadius:14,padding:12,minHeight:48},
  activation:{padding:16,borderRadius:16,backgroundColor:a.color.warm,flexDirection:'row',gap:12,alignItems:'center'},
});
