import {SUPERADMIN_EMAIL} from '../../shared/access';
// Spark adapter. Derived from functions/src/security.ts; enforce authorization in firestore.spark.rules.
import { getFirestore, FieldValue, Timestamp, FieldPath, type Transaction, type QuerySnapshot } from './store';
import { onCall, HttpsError } from './store';
import { z } from 'zod';
export function parse<T>(schema:z.ZodType<T>,value:unknown):T {const result=schema.safeParse(value);if(!result.success)throw new HttpsError('invalid-argument',result.error.issues.map(issue=>issue.message).join(' '));return result.data;}
export async function requireAdmin(tx:Transaction,uid:string){const user=await tx.get(getFirestore().doc(`users/${uid}`)),owner=await tx.get(getFirestore().doc('system/bootstrap'));if(!user.exists||user.data()!.active!==true||user.data()!.role!=='superadmin'||user.data()!.email?.toLowerCase()!==SUPERADMIN_EMAIL||owner.data()?.uid!==uid)throw new HttpsError('permission-denied','Solo un superadmin activo puede realizar esta operación.');return user.data()!;}
export async function requireActive(tx:Transaction,uid:string){const user=await tx.get(getFirestore().doc(`users/${uid}`));if(!user.exists||user.data()!.active!==true||!['member','superadmin'].includes(user.data()!.role))throw new HttpsError('permission-denied','Tu acceso no está activo.');return user.data()!;}
export function checkRevision(data:Record<string,unknown>|undefined,revision:number){if((data?.revision||0)!==revision)throw new HttpsError('aborted','Otra persona modificó este registro. Actualiza los datos antes de guardar.');}
export function ensureSize(value:unknown,limit=700000){if(new TextEncoder().encode(JSON.stringify(value)).length>limit)throw new HttpsError('resource-exhausted','El contenido supera el tamaño permitido. Reduce las especificaciones o divide el trabajo.');}
