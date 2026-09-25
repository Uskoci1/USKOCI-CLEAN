import { useState, type ReactNode } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { CaretRight } from 'phosphor-react-native';
import type { WorkerAiPatch, WorkerAiProfile, WorkerAiReview } from '../../data/workerAiClientService';
import { capabilityTerms } from '../../lib/capabilityTerms';
import { countryCode } from '../../lib/market';
import { T } from '../Text';
import { Press } from '../Press';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { sys, card, floating, inset, field } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { civilDay, scheduleZone, weekdays } from '../calendar/calendarPresentation';
import { raspon } from '../../lib/vreme';
import { osoba, plural } from '../system/plural';

/** One word for nothing given (2026-09-24): three different empty words read as three different states. */
const EMPTY='Nije navedeno';
const list=(values:readonly string[])=>values.length?values.join(' · '):EMPTY;
/** Live card of the worker profile proposal beside the conversation. */
export function WorkerAiCard({profile,compact,review,disabled}:{profile:WorkerAiProfile;compact:boolean;review:()=>void;disabled:boolean}){
  const skills = profile.skills.length ? profile.skills.join(' · ') : 'Šta možeš da preuzmeš?';
  const place = `${profile.location.city || 'Područje nije navedeno'}${profile.location.operatingCountryCode ? ` · ${profile.location.operatingCountryCode}` : ''}`;
  const team = osoba(profile.teamCapacity);
  const availability = profile.availability.availableNow ? 'Mogu odmah' : 'Mogu odmah: isključeno';
  const schedule = `${plural(profile.availability.rules.length, 'redovan termin', 'redovna termina', 'redovnih termina')} · ${plural(profile.availability.windows.length, 'poseban termin', 'posebna termina', 'posebnih termina')}`;
  // One review target: the card gives under the finger, while facts update immediately without their own animation.
  // The compact face keeps room for the conversation and still exposes the complete review through the same action.
  return <Press accessibilityRole="button" accessibilityLabel="Pregledaj profil"
    accessibilityHint="Otvara sve podatke pre završnog čuvanja."
    accessibilityValue={{text:`${skills}. ${place}, ${profile.location.radiusKm} km. ${team}. ${availability}. ${schedule}.`}}
    accessibilityState={{disabled}} disabled={disabled} onPress={review} haptic={disabled?'none':'select'} scaleTo={0.99} hitSlop={0}
    style={[s.card,compact&&s.cardCompact]}>
    <View style={s.previewHead}>
      <View style={[s.previewIcon,compact&&s.previewIconCompact]}><FactArt kind="tasks" size={28} /></View>
      <View style={[s.grow,s.previewSummary]}>
        <T variant="cardTitleCompact" numberOfLines={compact?1:2} style={s.skillHeading}>{skills}</T>
        {compact?<>
          <T variant="meta" tone="muted" numberOfLines={1}>{place} · {team}</T>
          <T variant="meta" numberOfLines={1} style={disabled?s.muted:s.reviewLabel}>Pregledaj profil</T>
        </>:null}
      </View>
      {compact?<ReviewCue disabled={disabled}/>:null}
    </View>
    {!compact?<>
      <View style={s.previewFacts}>
        <PreviewFact art="pin">{`${place} · ${profile.location.radiusKm} km`}</PreviewFact>
        <PreviewFact art="users">{`${team} · ${availability}`}</PreviewFact>
      </View>
      <View style={s.reviewLink}>
        <T variant="bodyStrong" style={[s.grow,disabled?s.muted:s.reviewLabel]}>Pregledaj profil</T>
        <ReviewCue disabled={disabled}/>
      </View>
    </>:null}
  </Press>;
}
function ReviewCue({disabled}:{disabled:boolean}){
  return <View style={[s.reviewCue,disabled&&s.reviewCueDisabled]}>
    <CaretRight size={18} weight="bold" color={disabled?sys.color.muted:sys.color.onGreen}/>
  </View>;
}
function PreviewFact({art,children}:{art:FactArtKind;children:string}){
  return <View style={s.previewFact}><FactArt kind={art} size={24}/><T variant="note" style={[s.grow,s.ink]}>{children}</T></View>;
}
function Row({label,value,quiet=false}:{label:string;value:string;quiet?:boolean}){
  return <View style={s.row}><T variant="meta" tone="muted">{label}</T><T selectable variant="body" style={quiet?s.muted:s.ink}>{value}</T></View>;
}
function ReviewSection({title,art,children}:{title:string;art:FactArtKind;children:ReactNode}){
  return <View style={s.reviewSection}>
    <View style={s.sectionHead}><View style={s.sectionIcon}><FactArt kind={art} size={28}/></View>
      <T accessibilityRole="header" variant="heading" style={[s.grow,s.skillHeading]}>{title}</T></View>
    <View style={s.reviewRows}>{children}</View>
  </View>;
}
/** The frozen review the worker accepts: every fact the save will write, nothing else. */
export function WorkerAiReviewDetails({review}:{review:WorkerAiReview}){
  const p=review.profile;
  return <View style={s.review}>
    <View style={s.reviewIntro}>
      <View style={s.sectionHead}><View style={s.introIcon}><FactArt kind="person" size={32}/></View>
        <T accessibilityRole="header" variant="title" style={[s.grow,s.skillHeading]}>{p.displayName||'Radni profil'}</T></View>
      <T variant="note" tone="muted">Proveri sve podatke. Završno dugme prihvata ovaj pregled i čuva profil.</T>
    </View>
    {review.missingRequired.length?<View style={s.reviewNotice}><FactArt kind="info" size={24}/>
      <T accessibilityRole="alert" variant="body" style={[s.grow,s.ink]}>Dopuni: {review.missingRequired.join(', ')}.</T></View>:null}
    <ReviewSection title="Veštine i oprema" art="tool">
      <Row label="Veštine i usluge" value={list(p.skills)} /><Row label="Alat i oprema" value={list(p.tools)} />
      {/* Licences are the owner's wording to decide, so their empty word stays as it was ("Nisu navedene"). */}
      <Row label="Vozila" value={list(p.vehicles)} /><Row label="Licence koje navodiš" value={p.licenses.length?p.licenses.join(' · '):'Nisu navedene'} />
    </ReviewSection>
    <ReviewSection title="Ljudi i predstavljanje" art="users">
      <Row label="Broj ljudi, uključujući tebe" value={String(p.teamCapacity)} /><Row label="Kratko predstavljanje" value={p.bio||EMPTY} />
    </ReviewSection>
    <ReviewSection title="Područje rada" art="map">
      <Row label="Grad i država" value={`${p.location.city||EMPTY}${p.location.operatingCountryCode?' · '+p.location.operatingCountryCode:''}`} />
      <Row label="Radijus rada" value={`${p.location.radiusKm} km`} />
      <T variant="note" tone="muted">{p.location.approximatePosition?'Približna tačka radnog područja je sačuvana.':'Približna tačka nije uneta. Možeš je podesiti kroz postojeće područje rada.'}</T>
    </ReviewSection>
    <ReviewSection title="Kada možeš da radiš" art="clock">
      <Row label="Dostupnost" value={p.availability.availableNow?'Mogu odmah, dok to ne isključiš':'Status „Mogu odmah“ je isključen'} />
      <T variant="note" tone="muted">{scheduleZone(p.availability.timezone)}</T>
    </ReviewSection>
    <ReviewSection title="Redovna nedelja" art="calendar">
      {weekdays.map(day=>{
        const rules=p.availability.rules.filter(r=>r.weekdays.includes(day.day));
        return <Row key={day.day} label={day.name} quiet={!rules.length} value={rules.map(r=>
          `${r.startTime}–${r.endTime} · od ${civilDay(r.startsOn)}${r.endsOn?' do '+civilDay(r.endsOn):''}${r.active?'':' · pauzirano'}${r.label?' · '+r.label:''}`).join('\n')||'Nema redovnih termina'} />;
      })}
    </ReviewSection>
    <ReviewSection title="Posebni datumi" art="calendar">
      {p.availability.windows.length?p.availability.windows.map(w=><Row key={w.id} label={w.state==='AVAILABLE'?'Slobodno za rad':'Zauzeto'}
        value={`${raspon(w.startsAt,w.endsAt,{zona:p.availability.timezone})}${w.label?' · '+w.label:''}`} />):<T variant="body" tone="muted">Nema posebnih datuma.</T>}
    </ReviewSection>
    <T variant="note" tone="muted">Veštine i licence navodiš ti. Postojeći Dogovori ostaju obaveze. Dostupnost ne uključuje HITNO.</T>
  </View>;
}
function Field({label,value,change,disabled,numeric=false,multiline=false}:{label:string;value:string;change:(v:string)=>void;disabled:boolean;numeric?:boolean;multiline?:boolean}){
  return <View style={{gap:6}}><T variant="meta" tone="muted">{label}</T><TextInput accessibilityLabel={label} style={[s.input,multiline&&s.multiline]}
    value={value} editable={!disabled} onChangeText={v=>{if(!disabled)change(v);}} multiline={multiline} keyboardType={numeric?'number-pad':'default'} maxLength={numeric?3:multiline?25500:160}/></View>;
}
/** Manual correction of the proposal; applied to the proposal, saved only through the final review. */
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
  return <><T variant="meta" tone="muted">Izmene ostaju u predlogu do završnog pregleda i čuvanja. U liste unesi jednu stavku po redu.</T>
    <View style={s.section}><T variant="heading" style={s.ink}>Ko si i šta radiš</T>
      <Field disabled={disabled} label="Ime na profilu" value={name} change={setName}/><Field disabled={disabled} label="Veštine i usluge" value={skills} change={setSkills} multiline/>
      <Field disabled={disabled} label="Alat i oprema" value={tools} change={setTools} multiline/><Field disabled={disabled} label="Vozila" value={vehicles} change={setVehicles} multiline/>
      <Field disabled={disabled} label="Licence koje navodiš" value={licenses} change={setLicenses} multiline/><Field disabled={disabled} label="Broj ljudi, uključujući tebe" value={capacity} change={setCapacity} numeric/>
      <Field disabled={disabled} label="Kratko predstavljanje" value={bio} change={setBio} multiline/></View>
    <View style={s.section}><T variant="heading" style={s.ink}>Područje rada</T>
      <Field disabled={disabled} label="Država rada (npr. RS)" value={country} change={setCountry}/>
      <Field disabled={disabled} label="Grad ili mesto rada" value={city} change={setCity}/><Field disabled={disabled} label="Radijus rada u km" value={radius} change={setRadius} numeric/></View>
    {error?<View style={s.notice}><T accessibilityRole="alert" variant="body" style={s.ink}>{error}</T></View>:null}<V2Action label="Primeni na pregled profila" disabled={disabled} onPress={submit}/>
  </>;
}
export function WorkerAiActivation({activate,disabled,change}:{activate:boolean;disabled:boolean;change:(v:boolean)=>void}){
  return <View style={s.activation}><View style={{flex:1}}><T variant="bodyStrong" style={s.ink}>Aktiviraj profil posle čuvanja</T><T variant="meta" tone="muted">Isključeno: profil ostaje nacrt.</T></View>
    <Switch accessibilityLabel="Aktiviraj profil posle čuvanja" value={activate} disabled={disabled} onValueChange={change} trackColor={{true:sys.color.green,false:sys.color.lineStrong}} thumbColor={sys.color.surface}/></View>;
}
const s=StyleSheet.create({
  ink:{color:sys.color.ink},
  muted:{color:sys.color.muted},
  grow:{flex:1,minWidth:0},
  card:{...card,...floating,padding:sys.space.base,gap:sys.space.sm,minHeight:48,
    backgroundColor:sys.conversation.summary,borderColor:sys.conversation.edge},
  cardCompact:{padding:sys.space.md,borderRadius:sys.radius.cardCompact},
  previewHead:{flexDirection:'row',alignItems:'center',gap:sys.space.md},
  previewIcon:{width:40,height:40,borderRadius:sys.radius.control,backgroundColor:sys.conversation.iconWell,alignItems:'center',justifyContent:'center'},
  previewIconCompact:{width:36,height:36},
  previewSummary:{gap:sys.space.xs},
  skillHeading:{color:sys.color.green},
  previewFacts:{gap:sys.space.sm},
  previewFact:{flexDirection:'row',alignItems:'flex-start',gap:sys.space.sm},
  reviewLink:{minHeight:28,flexDirection:'row',alignItems:'center',gap:sys.space.sm},
  reviewLabel:{color:sys.color.green,fontWeight:'700'},
  reviewCue:{width:28,height:28,borderRadius:sys.radius.pill,backgroundColor:sys.color.green,alignItems:'center',justifyContent:'center'},
  reviewCueDisabled:{backgroundColor:sys.conversation.iconWell},
  review:{gap:sys.space.xl},
  reviewIntro:{gap:sys.space.md,padding:sys.space.base,borderRadius:sys.radius.card,
    backgroundColor:sys.conversation.summary,borderWidth:1,borderColor:sys.conversation.edge},
  introIcon:{width:48,height:48,borderRadius:sys.radius.control,backgroundColor:sys.conversation.iconWell,alignItems:'center',justifyContent:'center'},
  reviewSection:{gap:sys.space.md},
  sectionHead:{flexDirection:'row',alignItems:'center',gap:sys.space.md},
  sectionIcon:{width:36,height:36,borderRadius:sys.radius.control,backgroundColor:sys.conversation.ground,alignItems:'center',justifyContent:'center'},
  reviewRows:{gap:sys.space.base},
  reviewNotice:{padding:sys.space.base,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft,flexDirection:'row',alignItems:'flex-start',gap:sys.space.md},
  section:{...card,gap:12},
  row:{gap:sys.space.xs,minWidth:0},
  notice:{padding:14,borderRadius:sys.radius.control,backgroundColor:sys.color.warnSoft},
  input:{...field},
  multiline:{minHeight:96,textAlignVertical:'top'},
  // A flat tint, not the orange budget (critique B19): the one orange on the review is not a switch row.
  activation:{...inset,padding:16,backgroundColor:sys.color.wash,flexDirection:'row',gap:12,alignItems:'center'},
});
