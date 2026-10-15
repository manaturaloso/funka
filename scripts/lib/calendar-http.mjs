// Retry explicit service throttling only. A failed commit keeps its version
// preconditions, so a retry cannot overwrite a newer edit.
export async function calendarRequest(fetcher,url,options,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=5}={}){
 for(let attempt=0;attempt<attempts;attempt++){
  const response=await fetcher(url,options),payload=await response.json().catch(()=>null);
  if(response.ok)return payload;
  if([429,503].includes(response.status)&&attempt+1<attempts){const seconds=Number(response.headers.get('retry-after'));await sleep(Number.isFinite(seconds)&&seconds>0?Math.min(seconds*1000,30000):Math.min(1000*2**attempt,16000));continue;}
  const status=String(payload?.error?.status||'').replace(/[^A-Z_]/g,'').slice(0,60);
  // Only the structured provider status is public. Never log request bodies,
  // headers, identity tokens or arbitrary error payloads.
  throw Error(`Firebase rechazó la operación (${response.status}${status?'; '+status:''}).`);
 }
}
