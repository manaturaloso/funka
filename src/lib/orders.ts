import { httpsCallable } from 'firebase/functions';
import { functions, sparkMode } from './firebase';
import type { Scope, Member } from '../../shared/orders';
export async function call<T>(name:string, data:unknown):Promise<T> {
  if(sparkMode) return (await import('../spark')).sparkCall<T>(name,data);
  if(!functions) throw new Error('Firebase no está configurado.');
  return (await httpsCallable<unknown,T>(functions,name)(data)).data;
}
export const loadScopes = () => call<Scope[]>('listScopes',{});
export const loadMembers = (scope:Scope) => call<Member[]>('listMembers',{teamId:scope.teamId,brandId:scope.brandId});
export const message = (error:unknown) => error instanceof Error ? error.message : 'No se pudo completar la operación.';
export function localDeadline(value:string|null) {if(!value)return '';const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const get=(key:string)=>parts.find(p=>p.type===key)?.value;return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;}
export const deadlineISO=(value:string)=>value?new Date(`${value}:00-05:00`).toISOString():null;
export const dateLabel=(value:string|null)=>value?new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'Sin fecha';
