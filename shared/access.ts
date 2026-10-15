import { z } from 'zod';
export const SUPERADMIN_EMAIL = 'joel.yc23@gmail.com';
export const scopeSchema = z.object({ teamId: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/), brandId: z.string().regex(/^[a-zA-Z0-9-]{1,80}$/) });
export const invitationSchema = z.object({ email: z.email().transform(v => v.toLowerCase().trim()), scopes: z.array(scopeSchema).max(100) });
export const scopeKey = (teamId: string, brandId: string) => `${teamId}__${brandId}`;
export interface Profile { revision?:number;teamIds?:string[];googleVerified?:boolean;uid: string; email: string; displayName: string; active: boolean; role: 'superadmin' | 'member' | 'pending'; scopes: {teamId: string; brandId: string}[] }
export function canBootstrap(identity: {email?: string; emailVerified: boolean; provider?: string}) {
  return identity.email?.toLowerCase() === SUPERADMIN_EMAIL && identity.emailVerified && identity.provider === 'google.com';
}

export function isGeneralAdmin(profile:Partial<Profile>|null|undefined){return profile?.active===true&&profile.role==='superadmin'&&profile.email?.toLowerCase()===SUPERADMIN_EMAIL;}
