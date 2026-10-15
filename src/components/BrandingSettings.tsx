import {useSiteText} from '../lib/site-texts';
import { useState } from 'react';
import { useBranding } from '../lib/branding';
import { call,message } from '../lib/orders';
import { type Branding } from '../../shared/branding';
async function readImage(file:File){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>250000)throw new Error('Usa un PNG, JPG o WebP de hasta 250 KB.');
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('No se pudo leer el archivo.'));reader.readAsDataURL(file);});
  const image=new Image();image.src=data;await image.decode();if(image.naturalWidth>7000||image.naturalHeight>7000)throw new Error('La imagen debe medir hasta 7000 píxeles por lado.');return data;
}
export function BrandingSettings(){const uiText=useSiteText();
  const {branding,loaded,error}=useBranding();
  const [saved,setSaved]=useState(false);
  return !loaded?<p role="status">{""+uiText("BrandingSettings.76af137b50e3")+""}</p>:error?<p className="error" role="alert">{error}</p>:<><BrandingForm key={branding.revision} initial={branding} onSaved={()=>setSaved(true)} onChanged={()=>setSaved(false)}/>{saved&&<p role="status">{""+uiText("BrandingSettings.87ec96cb6f59")+""}</p>}</>;
}
function BrandingForm({initial,onSaved,onChanged}:{initial:Branding;onSaved:()=>void;onChanged:()=>void}){const uiText=useSiteText();
  const [draft,setDraft]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function select(key:'logoData'|'symbolData',file:File|undefined){if(!file)return;setBusy(true);setError('');onChanged();try{const data=await readImage(file);setDraft(old=>({...old,[key]:data}));}catch(e){setError(message(e));}finally{setBusy(false);}}
  return <form className="form-stack settings-form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await call('saveBranding',draft);onSaved();}catch(e){setError(message(e));}finally{setBusy(false);}}}><p>{""+uiText("BrandingSettings.f5a0e3d26b66")+""}</p>{([{key:'logoData',label:'Logotipo completo',alt:'Vista previa del logotipo completo'},{key:'symbolData',label:'Símbolo circular',alt:'Vista previa del símbolo circular'}] as const).map(item=><section className="branding-upload" key={item.key}><label>{item.label}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>void select(item.key,e.target.files?.[0])}/></label>{draft[item.key] ? <><img className={item.key==='logoData'?'branding-preview':'branding-preview-symbol'} src={draft[item.key]!} alt={item.alt}/><button type="button" className="secondary" disabled={busy} onClick={()=>{setDraft(old=>({...old,[item.key]:null}));onChanged();}}>{""+uiText("BrandingSettings.f039f4a8c975")+" "}{item.label.toLowerCase()}</button></> : <p className="form-hint">{""+uiText("BrandingSettings.6dddc3ce3df3")+""}</p>}</section>)}<section className="branding-upload"><label>{uiText.label('Tamaño del logo en el encabezado','BrandingSettings')}<input type="range" aria-label={uiText.label('Tamaño del logo en el encabezado','BrandingSettings')} min={100} max={280} step={5} value={draft.headerWidth} disabled={busy} onChange={e=>{setDraft({...draft,headerWidth:Number(e.target.value)});onChanged();}}/></label><span className="form-hint">{draft.headerWidth} px</span>{draft.logoData&&<img src={draft.logoData} alt={uiText.label('Vista previa del logo en el encabezado','BrandingSettings')} style={{width:draft.headerWidth,maxWidth:'100%',height:'auto'}}/>}</section><p className="form-hint">{""+uiText("BrandingSettings.b5bc14e02928")+""}</p>{error&&<p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? uiText("BrandingSettings.3c8dc4dc7a83") : uiText("BrandingSettings.634b49ce6b73")}</button></form>;
}
