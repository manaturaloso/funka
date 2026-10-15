import {googleIdentity,requireAdmin} from './security';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createHash } from 'node:crypto';
import { canBootstrap, invitationSchema, scopeKey } from '../../shared/access';
initializeApp();
const db = getFirestore();
const options = { region: 'us-central1', maxInstances: 5 };
const emailKey = (email: string) => createHash('sha256').update(email).digest('hex');
export const establishAccess = onCall(options, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes ingresar con Google.');googleIdentity(request.auth);
  const { uid, token } = request.auth;
  const email = typeof token.email === 'string' ? token.email.toLowerCase() : '';
  const provider = token.firebase?.sign_in_provider;
  if (!email || token.email_verified !== true || provider !== 'google.com') throw new HttpsError('permission-denied', 'Se requiere una identidad Google verificada.');
  const userRef = db.doc(`users/${uid}`);
  const ownerRef = db.doc('system/bootstrap');
  const inviteRef = db.doc(`invitations/${emailKey(email)}`);
  await db.runTransaction(async tx => {
    const [user, owner, invitation] = await Promise.all([tx.get(userRef), tx.get(ownerRef), tx.get(inviteRef)]);
    // Existing server decisions, including deactivation, take precedence over login.
    if (user.exists && user.data()!.role !== 'pending') {tx.update(userRef,{googleVerified:true,authProvider:'google.com'});return;}
    const bootstrap = canBootstrap({email, emailVerified: true, provider}) && (!owner.exists || owner.data()!.uid === uid);
    const invited = invitation.exists && invitation.data()!.active === true;
    const scopes = invited ? invitation.data()!.scopes : [];
    const teamIds=invited?(invitation.data()!.teamIds||[...new Set(scopes.map((scope:{teamId:string})=>scope.teamId))]):[];
    tx.set(userRef, {uid, email, googleVerified:true,authProvider:'google.com',revision:(user.data()?.revision||0)+1,teamIds, displayName: typeof token.name === 'string' ? token.name : email, active: bootstrap || invited, role: bootstrap ? 'superadmin' : invited ? 'member' : 'pending', scopes, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
    if (bootstrap && !owner.exists) tx.create(ownerRef, {uid, createdAt: FieldValue.serverTimestamp()});
    for(const teamId of teamIds)tx.set(userRef.collection('memberships').doc(teamId),{teamId});
    for (const scope of scopes) tx.set(userRef.collection('access').doc(scopeKey(scope.teamId, scope.brandId)), scope);
  });
  return {status: 'ok'};
});
export const authorizeEmail = onCall(options, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Debes ingresar.');googleIdentity(request.auth);
  const parsed = invitationSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Correo o accesos inválidos.');
  const {email, scopes} = parsed.data;
  await db.runTransaction(async tx => {
    await requireAdmin(tx,request.auth!.uid);
    for (const scope of scopes) {
      const brand = await tx.get(db.doc(`teams/${scope.teamId}/brands/${scope.brandId}`));
      if (!brand.exists || brand.data()!.archived === true) throw new HttpsError('failed-precondition', 'La combinación equipo y marca no está activa.');
    }
    tx.set(db.doc(`invitations/${emailKey(email)}`), {email, scopes, active: true, createdBy: request.auth!.uid, updatedAt: FieldValue.serverTimestamp()});
    tx.create(db.collection('adminActivity').doc(), {action: 'authorizeEmail', actorUid: request.auth!.uid, createdAt: FieldValue.serverTimestamp()});
  });
  return {status: 'authorized'};
});
export { listScopes, createScope, listMembers, createOrder, mutateOrder } from './orders';

export {listAdmin,saveMember,saveInvitation,saveEntity,saveScope,getSettings,saveSettings,saveOrderTemplate,listOrderTemplates} from './admin';
export {saveDeck,loadDeckVersions,listBrandDecks,previewDeckApply,applyDeckPreview} from './decks';

export {listScopedOrders,batchOrders,markNotificationRead,setFollower} from './productivity';

export {saveRecurrence,runRecurrence,dailyRecurrences} from './recurrences';
