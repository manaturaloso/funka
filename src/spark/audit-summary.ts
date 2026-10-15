export function auditValue(value:unknown,key='',depth=0):unknown{
 if(value===undefined)return null;
 if(value===null||typeof value==='boolean'||typeof value==='number')return value;
 if(typeof value==='string')return value.startsWith('data:image/')?'Imagen adjunta':value.length>10000?{preview:value.slice(0,10000),characters:value.length,truncated:true}:value;
 if(depth>6)return 'Contenido anidado';
 if(Array.isArray(value))return value.slice(0,100).map(v=>auditValue(v,key,depth+1));
 if(typeof value==='object'){
  if('toDate' in value&&typeof value.toDate==='function')return value.toDate().toISOString();
  return Object.fromEntries(Object.entries(value).filter(([k])=>!['createdAt','updatedAt','dataUrl','logoData','symbolData'].includes(k)).map(([k,v])=>[k,auditValue(v,k,depth+1)]));
 }
 return String(value);
}
