import { useEffect,useState } from 'react';
import { doc,onSnapshot } from 'firebase/firestore';
import { db,sparkMode } from './firebase';
import { brandingSchema,emptyBranding,type Branding } from '../../shared/branding';
export function useBranding(){
  const [branding,setBranding]=useState<Branding>(emptyBranding),[loaded,setLoaded]=useState(!db||!sparkMode),[error,setError]=useState('');
  useEffect(()=>{
    if(!db||!sparkMode)return;
    return onSnapshot(doc(db,'branding/public'),snapshot=>{
      const d=snapshot.data();const parsed=brandingSchema.safeParse(d?{logoData:d.logoData,symbolData:d.symbolData,headerWidth:d.headerWidth??180,revision:d.revision}:emptyBranding);
      if(parsed.success){setBranding(parsed.data);setError('');}else setError('La identidad visual guardada no tiene un formato válido.');setLoaded(true);
    },()=>{setError('No se pudo consultar la identidad visual.');setLoaded(true);});
  },[]);
  return {branding,loaded,error};
}
