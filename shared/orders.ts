import { z } from 'zod';
import { scopeSchema } from './access';
export const statuses = ['Por asignar','Pendiente','En proceso','Esperando material','Por validar','En pausa','Por subir','Entregado'] as const;
export const statusSchema = z.enum([...statuses,'En revisión','Bloqueado']);
export const priorities = ['Alta','Media','Baja'] as const;
export const prioritySchema = z.enum([...priorities,'Normal','Urgente']);
export const visibleStatus=(status:string)=>status==='En revisión'?'Por validar':status==='Bloqueado'?'En pausa':status;
export const visiblePriority=(priority:string)=>priority==='Normal'?'Media':priority==='Urgente'?'Alta':priority;

const id = z.string().regex(/^[a-zA-Z0-9-]{1,80}$/);
const text = z.string().trim().min(1).max(200);
export const linkSchema = z.string().max(4000).refine(value => {
  try { return ['https:','http:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Usa un enlace HTTP o HTTPS.');
export const pieceSchema = z.object({
  id, source:z.object({deckId:id,pieceId:id,revision:z.number().int().min(1)}).strict().optional(),retired:z.boolean().optional(), name:text, quantity:z.number().int().min(1).max(10000), measures:z.string().max(200), format:z.string().max(100), specs:z.string().max(4000), references:z.array(linkSchema).max(20), group:z.string().max(100), order:z.number().int().min(0), required:z.boolean(), assigneeUid:id.nullable(), deadline:z.string().datetime().nullable(), state:z.enum(['Pendiente','Lista','No aplica']), reason:z.string().max(1000), deliveryUrl:linkSchema.nullable(),
}).strict().superRefine((piece, ctx) => {
  if (piece.required && piece.state === 'No aplica' && !piece.reason.trim()) ctx.addIssue({code:'custom',message:'Explica por qué la pieza obligatoria no aplica.'});
});
export type Piece = z.infer<typeof pieceSchema>;
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}, 'Usa una fecha válida.');
// Optional for compatibility with existing orders and older clients.
export const detailImageSchema=z.object({id:z.string().uuid(),name:z.string().max(200),dataUrl:z.string().max(160000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/)}).strict();
export type DetailImage=z.infer<typeof detailImageSchema>;
export const planningFieldsSchema = z.object({
  detailImages:z.array(detailImageSchema).max(2).optional(),
  campaignName:z.string().trim().max(200).optional(),
  estimatedMinutes:z.number().int().min(1).max(100000).nullable().optional(),
  assignedOn:calendarDate.nullable().optional(),
  socialNetwork:z.string().trim().max(100).optional(),
  postingDate:calendarDate.nullable().optional(),
});
export const fieldsSchema = z.object({
  ...planningFieldsSchema.shape,
  title:text, description:z.string().max(10000), type:z.string().trim().min(1).max(100), channel:z.enum(['WP','SIS']).nullable(), priority:prioritySchema, assigneeUid:id.nullable(), collaborators:z.array(id).max(50), deadline:z.string().datetime().nullable(),
}).strict();
export const createOrderSchema = scopeSchema.extend({...planningFieldsSchema.shape,type:z.string().trim().min(1).max(100).optional(),priority:prioritySchema.optional(),requestId:id,title:text,status:z.enum(statuses).optional(),deliveryUrl:linkSchema.nullable().optional(),description:z.string().max(10000).default(''),collaborators:z.array(id).max(50).default([]),assigneeUid:id.nullable().default(null),deadline:z.string().datetime().nullable().default(null),templateId:id.nullable().default(null),channel:z.enum(['WP','SIS']).nullable().default(null)}).strict();
export const mutationSchema = scopeSchema.extend({orderId:id, revision:z.number().int().min(1), operationId:id, action:z.discriminatedUnion('kind',[
  z.object({kind:z.literal('edit'),fields:fieldsSchema}).strict(),
  z.object({kind:z.literal('status'),status:statusSchema,reason:z.string().max(1000).default(''),resolverUid:id.nullable().default(null)}).strict(),
  z.object({kind:z.literal('piece'),piece:pieceSchema}).strict(),
  z.object({kind:z.literal('comment'),body:z.string().trim().min(1).max(10000),pieceId:id.nullable().default(null),mentionedUids:z.array(id).max(50).default([])}).strict(),
  z.object({kind:z.literal('delivery'),url:linkSchema,pieceId:id.nullable().default(null)}).strict(),
  z.object({kind:z.literal('deliver'),url:linkSchema.nullable().optional(),exception:z.string().max(1000).default('')}).strict(),
  z.object({kind:z.literal('review'),result:z.enum(['Aprobado','Requiere ajustes']),reason:z.string().max(1000).default('')}).strict(),
  z.object({kind:z.literal('dependencies'),orderIds:z.array(id).max(20).refine(v=>new Set(v).size===v.length,'No repitas dependencias.')}).strict(),
  z.object({kind:z.literal('archive'),archived:z.boolean()}).strict(),
])}).strict();
export interface Order extends z.infer<typeof fieldsSchema> {
  dependencies?:string[];
  orderTemplate?:{id:string;revision:number;name:string};deck?:{id:string;revision:number;name:string;channel:'WP'|'SIS'};id:string; teamId:string; brandId:string; status:z.infer<typeof statusSchema>; pieces:Piece[]; assignedUids:string[]; createdBy:string; revision:number; archived:boolean; deadlineMode:'automatic'|'manual'; review:'Pendiente'|'Aprobado'|'Requiere ajustes'; deliveryUrl:string|null; deckWarning:boolean; block:{reason:string;resolverUid:string|null;previousStatus:z.infer<typeof statusSchema>}|null;
}
export interface Scope {teamId:string;brandId:string;teamName:string;brandName:string}
export interface Member {uid:string;displayName:string;email:string}
export function assignedUids(order: Pick<Order,'assigneeUid'|'collaborators'|'pieces'>): string[] {return [...new Set([order.assigneeUid,...order.collaborators,...order.pieces.map(p=>p.assigneeUid)].filter((uid):uid is string => Boolean(uid)))];}
export function readyForDelivery(order: Pick<Order,'pieces'|'deliveryUrl'>, _exception = '') {
  const required = order.pieces.filter(piece=>piece.required);
  if (required.some(piece=>piece.state !== 'Lista' && !(piece.state === 'No aplica' && piece.reason.trim()))) return 'Completa las piezas obligatorias o documenta por qué no aplican.';
  return null;
}
