import {useSiteText} from '../lib/site-texts';
import { useEffect } from 'react';
import { useBranding } from '../lib/branding';
export function Brand({compact=false}:{compact?:boolean}) {const uiText=useSiteText();
  const {branding,loaded}=useBranding();
  const src=loaded?(compact?branding.symbolData:branding.logoData):(compact?'/branding/funka-simbolo-oficial.png':'/branding/funka-logo-oficial.png');
  useEffect(()=>{
    let icon=document.querySelector<HTMLLinkElement>('link[data-funka-icon]');
    if(branding.symbolData){if(!icon){icon=document.createElement('link');icon.rel='icon';icon.dataset.funkaIcon='true';document.head.append(icon);}icon.href=branding.symbolData;}
    else icon?.remove();
  },[branding.symbolData]);
  return src?<img className={compact?'brand-symbol':'brand-logo'} src={src} style={{'--funka-header-width':`${branding.headerWidth}px`} as React.CSSProperties} alt={compact?'Funka':'Funka · Marketing que funciona'}/>:<span className="wordmark brand-name">{""+uiText("Brand.876339aab6bf")+""}</span>;
}
