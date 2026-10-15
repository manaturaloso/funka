import { z } from 'zod';
import { statuses } from './orders';
const id=z.string().max(80).regex(/^[a-zA-Z0-9-]*$/);
const date=z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/);
export const viewFiltersSchema=z.object({audience:z.enum(['mine','brands']),archived:z.boolean(),view:z.enum(['board','list','calendar']),search:z.string().max(200),scopeFilter:z.string().max(162).regex(/^$|^[a-zA-Z0-9-]+__[a-zA-Z0-9-]+$/),statusFilter:z.enum(['',...statuses,'En revisión','Bloqueado']),period:z.enum(['','today','late','next']),channel:z.enum(['','WP','SIS']),priority:z.enum(['','Alta','Media','Baja','Normal','Urgente']),typeFilter:z.string().max(100),teamFilter:id,brandFilter:id,responsibleFilter:id,fromDate:date,toDate:date}).strict();
export type ViewFilters=z.infer<typeof viewFiltersSchema>;
export const savedViewSchema=z.object({name:z.string().trim().min(1).max(80),filters:viewFiltersSchema}).strict();
export interface SavedView {id:string;name:string;filters:ViewFilters;revision:number}
