export type AccessErrorKind='quota'|'connection'|'permission'|'unknown';
export const accessErrorMessages:Record<AccessErrorKind,string>={
 quota:'Firebase alcanzó su cuota gratuita temporalmente. No podemos verificar tu acceso hasta que se restablezca. Tus permisos no se han cambiado.',
 connection:'No pudimos conectar con Firebase para verificar tu acceso. Revisa tu conexión y reintenta.',
 permission:'Firebase rechazó la verificación de tu acceso. Reintenta; si continúa, revisa tu autorización con el administrador.',
 unknown:'No pudimos verificar tu acceso. Intenta verificarlo nuevamente.'
};
export function accessErrorKind(error:unknown):AccessErrorKind{
 const e=error as {code?:unknown;message?:unknown}|null;const code=String(e?.code||'').split('/').at(-1),message=String(e?.message||'').toLowerCase();
 if(code==='resource-exhausted'||message.includes('quota exceeded'))return 'quota';
 if(['unavailable','deadline-exceeded','network-request-failed'].includes(code||''))return 'connection';
 if(['permission-denied','unauthenticated'].includes(code||''))return 'permission';
 return 'unknown';
}
