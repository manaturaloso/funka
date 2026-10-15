import {it,expect} from 'vitest';
import {accessErrorKind} from '../src/lib/access-error';
it('distingue cuota de permisos o conexión',()=>{expect(accessErrorKind({code:'resource-exhausted'})).toBe('quota');expect(accessErrorKind({code:'firestore/resource-exhausted'})).toBe('quota');expect(accessErrorKind(new Error('Quota exceeded.'))).toBe('quota');expect(accessErrorKind({code:'permission-denied'})).toBe('permission');expect(accessErrorKind({code:'unavailable'})).toBe('connection');});
it('no inventa una causa para errores desconocidos',()=>{expect(accessErrorKind(null)).toBe('unknown');expect(accessErrorKind({message:'private server details'})).toBe('unknown');});
