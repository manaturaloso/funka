import {useState} from 'react';
import type {DetailImage} from '../../shared/orders';
import {useSiteText} from '../lib/site-texts';
import {message} from '../lib/orders';
// Small private references live with the protected order; no public bucket is needed.
export async function prepareDetailImage(file:File):Promise<DetailImage>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('Usa JPG, PNG o WEBP de hasta 20 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  let scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));
  for(let attempt=0;attempt<6;attempt++){
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');if(!context)throw Error('No se pudo preparar la imagen.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const dataUrl=canvas.toDataURL('image/webp',.8);if(dataUrl.length<=160000)return {id:crypto.randomUUID(),name:file.name.slice(0,200),dataUrl};scale*=.7;
  }
  throw Error('La imagen sigue siendo demasiado grande. Prueba con una imagen más pequeña.');
 }finally{bitmap.close();}
}
export function DetailImages({value,onChange,disabled=false,onBusy}:{value:DetailImage[];onChange:(images:DetailImage[])=>void;disabled?:boolean;onBusy?:(busy:boolean)=>void}){
 const t=useSiteText(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="detail-images"><label>{t.label('Imágenes del pedido (opcional)','Orders')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled||busy||value.length>=2} onChange={async e=>{const files=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';setError('');if(value.length+files.length>2){setError(t.label('Puedes adjuntar hasta 2 imágenes.','Orders'));return;}setBusy(true);onBusy?.(true);try{const images=await Promise.all(files.map(prepareDetailImage));onChange([...value,...images]);}catch(error){setError(message(error));}finally{setBusy(false);onBusy?.(false);}}}/></label>
 <p className="form-hint">{t.label('Hasta 2 imágenes JPG, PNG o WEBP. Se optimizan como referencia; entrega los originales mediante Mega.','Orders')}</p>
 {busy&&<p role="status">{t.label('Preparando imágenes…','Orders')}</p>}{error&&<p role="alert" className="error">{error}</p>}
 <div className="detail-image-grid">{value.map(image=><figure key={image.id}><a href={image.dataUrl} download={image.name.replace(/\.[^.]+$/,'')+'.webp'}><img src={image.dataUrl} alt={image.name}/></a><figcaption>{image.name}</figcaption><button type="button" className="text-button" disabled={disabled||busy} onClick={()=>onChange(value.filter(i=>i.id!==image.id))}>{t.label('Quitar imagen','Orders')}</button></figure>)}</div></section>;
}
