import { call } from './orders';
import { defaultSettings,type AdminPage,type AdminRecord,type Deck } from '../../shared/admin';
export type Section='users'|'invitations'|'teams'|'brands'|'scopes'|'decks'|'adminActivity'|'orderTemplates';
export type Settings=typeof defaultSettings&{revision:number;timeZone:string};
export const listAdmin=(section:Section,cursor:string|null=null)=>call<AdminPage>('listAdmin',{section,cursor});
export async function allAdmin(section:Section){const rows:AdminRecord[]=[];let cursor:string|null=null;do{const page=await listAdmin(section,cursor);rows.push(...page.records);cursor=page.nextCursor;}while(cursor);return rows;}
export const settings=()=>call<Settings>('getSettings',{});
export function asDeck(row:AdminRecord,brands:AdminRecord[]):Deck {
  const defaults=brands.find(brand=>brand.id===row.brandId)?.defaultDecks as Record<string,string>|undefined;
  return {id:row.id,revision:Number(row.revision||0),brandId:String(row.brandId),channel:row.channel as Deck['channel'],name:String(row.name),description:String(row.description||''),pieces:row.pieces as Deck['pieces'],archived:Boolean(row.archived),isDefault:defaults?.[String(row.channel)]===row.id};
}
