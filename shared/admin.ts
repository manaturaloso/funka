import { z } from 'zod';
import { scopeSchema } from './access';
import { pieceSchema, type Piece, type Order } from './orders';
export const entityIdSchema = scopeSchema.shape.teamId;
const name = z.string().trim().min(1).max(100);
export const defaultRequestTypes = ['POP','Deck','Vitrina','Gráfica de tienda','Mail','Otros','PPLs','Video'];
export const requiredFieldNames=['description','assigneeUid','deadline','channel'] as const;
export type RequiredField=typeof requiredFieldNames[number];
export const requiredFieldLabels:Record<RequiredField,string>={description:'Brief',assigneeUid:'Responsable principal',deadline:'Fecha de entrega',channel:'Canal'};
export function missingRequired(fields:Partial<Order>,required:readonly RequiredField[]){return required.filter(field=>!fields[field]||(typeof fields[field]==='string'&&!String(fields[field]).trim())).map(field=>requiredFieldLabels[field]);}
export const settingsSchema = z.object({requestTypes:z.array(name).min(1).max(50).refine(types=>new Set(types.map(type=>type.toLocaleLowerCase('es'))).size===types.length,'Los tipos no deben repetirse.'),deliveryHour:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),syncHour:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),autoDeadlineDays:z.number().int().min(1).max(30),display:z.object({sectionLabels:z.boolean(),helpTexts:z.boolean()}).strict().default({sectionLabels:false,helpTexts:true}),requiredFields:z.array(z.enum(requiredFieldNames)).max(4).default([])}).strict();
export const defaultSettings = {requestTypes:defaultRequestTypes,deliveryHour:'17:00',syncHour:'07:00',autoDeadlineDays:2,display:{sectionLabels:false,helpTexts:true},requiredFields:[] as RequiredField[]};
export const memberSchema = z.object({uid:entityIdSchema,revision:z.number().int().min(0),active:z.boolean(),role:z.enum(['member','superadmin']),teamIds:z.array(entityIdSchema).max(50),scopes:z.array(scopeSchema).max(100)}).strict().superRefine((value,ctx)=>{
  if(value.scopes.some(scope=>!value.teamIds.includes(scope.teamId)))ctx.addIssue({code:'custom',message:'Cada marca debe pertenecer a uno de los equipos seleccionados.'});
  if(new Set(value.scopes.map(scope=>`${scope.teamId}__${scope.brandId}`)).size!==value.scopes.length)ctx.addIssue({code:'custom',message:'Hay accesos repetidos.'});
});
export const invitationAdminSchema = z.object({email:z.email().transform(email=>email.toLowerCase()),active:z.boolean(),revision:z.number().int().min(0),teamIds:z.array(entityIdSchema).max(50),scopes:z.array(scopeSchema).max(100)}).strict().refine(value=>value.scopes.every(scope=>value.teamIds.includes(scope.teamId)),'Selecciona los equipos de las marcas autorizadas.');
export const entitySchema = z.object({requestId:z.string().uuid().optional(),kind:z.enum(['teams','brands']),id:entityIdSchema,revision:z.number().int().min(0),name,archived:z.boolean(),automaticTeamId:entityIdSchema.nullable().default(null)}).strict();
export const deckPieceSchema = z.object({id:pieceSchema.shape.id,name:pieceSchema.shape.name,quantity:pieceSchema.shape.quantity,measures:pieceSchema.shape.measures,format:pieceSchema.shape.format,specs:pieceSchema.shape.specs,references:pieceSchema.shape.references,group:pieceSchema.shape.group,order:pieceSchema.shape.order,required:pieceSchema.shape.required}).strict();
export type DeckPiece=z.infer<typeof deckPieceSchema>;
export const deckSchema=z.object({id:entityIdSchema,revision:z.number().int().min(0),brandId:entityIdSchema,channel:z.enum(['WP','SIS']),name,description:z.string().max(4000),pieces:z.array(deckPieceSchema).min(1).max(100),archived:z.boolean(),isDefault:z.boolean()}).strict().refine(value=>new Set(value.pieces.map(piece=>piece.id)).size===value.pieces.length,'Cada pieza necesita un ID diferente.');
export type Deck=z.infer<typeof deckSchema>;
export const targetSchema=scopeSchema.extend({orderId:entityIdSchema,revision:z.number().int().min(1)}).strict();
export const previewSchema=z.object({deckId:entityIdSchema,deckRevision:z.number().int().min(1),targets:z.array(targetSchema).min(1).max(20)}).strict();
export interface DeckSnapshot {id:string;revision:number;name:string;channel:'WP'|'SIS'}
export function deckSnapshot(deck:Deck):DeckSnapshot{return {id:deck.id,revision:deck.revision,name:deck.name,channel:deck.channel};}
export function copyDeckPiece(piece:DeckPiece,deck:Deck,id:string):Piece{return {...piece,references:[...piece.references],id,assigneeUid:null,deadline:null,state:'Pendiente',reason:'',deliveryUrl:null,source:{deckId:deck.id,pieceId:piece.id,revision:deck.revision},retired:false};}
export function mergeDeck(order:Pick<Order,'pieces'>,deck:Deck,makeId:()=>string) {
  const definitions=new Map(deck.pieces.map(piece=>[piece.id,piece]));const consumed=new Set<string>();
  const added:string[]=[],updated:string[]=[],retired:string[]=[];
  const pieces=order.pieces.map(piece=>{
    if(piece.source?.deckId!==deck.id)return {...piece};
    const definition=definitions.get(piece.source.pieceId);
    if(!definition){retired.push(piece.id);return {...piece,retired:true};}
    consumed.add(definition.id);updated.push(piece.id);
    return {...piece,...definition,references:[...definition.references],id:piece.id,source:{deckId:deck.id,pieceId:definition.id,revision:deck.revision},retired:false};
  });
  for(const definition of deck.pieces)if(!consumed.has(definition.id)){const piece=copyDeckPiece(definition,deck,makeId());added.push(piece.id);pieces.push(piece);}
  return {pieces,added,updated,retired};
}
export interface PreviewResult {previewId:string;expiresAt:string;deck:DeckSnapshot;targets:{targetId:string;title:string;teamId:string;brandId:string;changes:{added:string[];updated:string[];retired:string[]};beforeCount:number;afterCount:number;diff:{pieceId:string;name:string;kind:'añadida'|'actualizada'|'retirada';before:DeckPiece|null;after:DeckPiece|null}[]}[]}
export interface AdminRecord {id:string;[key:string]:unknown}
export interface AdminPage {records:AdminRecord[];nextCursor:string|null}

export function definitionOf(piece:DeckPiece):DeckPiece {return {id:piece.id,name:piece.name,quantity:piece.quantity,measures:piece.measures,format:piece.format,specs:piece.specs,references:piece.references,group:piece.group,order:piece.order,required:piece.required};}

export const orderTemplateSchema=z.object({id:entityIdSchema,revision:z.number().int().min(0),name:z.string().trim().min(1).max(100),title:z.string().trim().min(1).max(200),description:z.string().max(10000),type:z.string().trim().min(1).max(100),channel:z.enum(['WP','SIS']).nullable(),priority:z.enum(['Alta','Media','Baja','Normal','Urgente']),archived:z.boolean()}).strict();
export type OrderTemplate=z.infer<typeof orderTemplateSchema>;
