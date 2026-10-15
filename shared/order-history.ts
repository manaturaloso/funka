// Must match the projection in firestore.spark.rules. Exclude image bytes and
// infrastructure/import metadata, while retaining all collaboratively edited fields.
export const receiptFields=['id','teamId','brandId','title','description','type','channel','priority','assigneeUid','collaborators','deadline','status','pieces','assignedUids','createdBy','revision','archived','deadlineMode','review','deliveryUrl','deckWarning','block','deck','orderTemplate','dependencies','campaignName','estimatedMinutes','assignedOn','socialNetwork','postingDate','deliveryException'] as const;
export function orderSnapshot(order:Record<string,unknown>){return {...Object.fromEntries(receiptFields.filter(k=>k in order).map(k=>[k,order[k]])),detailImages:(Array.isArray(order.detailImages)?order.detailImages:[]).map((i:{id:string;name:string})=>({id:i.id,name:i.name}))};}
export function receiptId(team:string,brand:string,id:string,revision:number){return `collab-${team}__${brand}__${id}__${revision}`;}
