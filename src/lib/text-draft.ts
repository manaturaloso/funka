import {siteTextCatalog,type SiteTextKey} from '../../shared/site-text-catalog';
import type {TextRecords} from './site-texts';
export interface TextDraft {changes:Partial<Record<SiteTextKey,string|null>>;base:TextRecords|null}
const empty=():TextDraft=>({changes:{},base:null});
export function textDraftKey(uid:string){return `funka:text-draft:${uid}`;}
export function readTextDraft(uid:string):TextDraft {
  try {
    const raw=sessionStorage.getItem(textDraftKey(uid));if(!raw)return empty();
    const data=JSON.parse(raw);if(!data||typeof data.changes!=='object'||!data.changes||Array.isArray(data.changes))return empty();
    const changes:TextDraft['changes']={},base:TextRecords={};
    for(const [key,value] of Object.entries(data.changes)){
      if(!Object.hasOwn(siteTextCatalog,key)||(value!==null&&(typeof value!=='string'||value.length>2000)))return empty();
      changes[key as SiteTextKey]=value as string|null;
    }
    if(data.base!==null&&data.base!==undefined){
      if(typeof data.base!=='object'||Array.isArray(data.base))return empty();
      for(const [key,value] of Object.entries(data.base)){
        if(!Object.hasOwn(siteTextCatalog,key)||!value||typeof value!=='object')return empty();
        const original=value as {text?:unknown;revision?:unknown};
        if(typeof original.text!=='string'||typeof original.revision!=='number'||!Number.isInteger(original.revision)||original.revision<1)return empty();
        base[key as SiteTextKey]={text:original.text,revision:original.revision};
      }
    }
    return {changes,base};
  }catch{return empty();}
}
export function writeTextDraft(uid:string,draft:TextDraft){
  try{if(Object.keys(draft.changes).length)sessionStorage.setItem(textDraftKey(uid),JSON.stringify(draft));else sessionStorage.removeItem(textDraftKey(uid));}catch{/* Editing remains available if browser storage is unavailable. */}
}
