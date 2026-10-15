import {auth} from '../lib/firebase';
import {FieldValue,getFirestore,type Ref,type Transaction,HttpsError} from './store';
import {orderSnapshot,receiptId} from '../../shared/order-history';
export function collaborativeReceipt(tx:Transaction,ref:Ref,before:unknown,after:unknown,operationId:string,kind:string){
 const next=after as Record<string,unknown>,previous=before as Record<string,unknown>|null;
 const data={action:`order.${kind}`,actorUid:auth!.currentUser!.uid,actorEmail:auth!.currentUser!.email!.toLowerCase(),actorName:auth!.currentUser!.displayName||'',teamId:next.teamId,brandId:next.brandId,orderId:ref.id,operationId,before:previous?orderSnapshot(previous):null,after:orderSnapshot(next),createdAt:FieldValue.serverTimestamp()};
 if(new TextEncoder().encode(JSON.stringify(data)).length>900000)throw new HttpsError('resource-exhausted','El historial de este cambio supera el tamaño permitido. Divide el pedido en pedidos más pequeños.');
 tx.create(getFirestore().doc(`adminActivity/${receiptId(String(next.teamId),String(next.brandId),ref.id,Number(next.revision))}`),data);
}
