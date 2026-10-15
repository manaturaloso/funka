import {useSiteText} from './lib/site-texts';
import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {accessErrorKind,accessErrorMessages,type AccessErrorKind} from './lib/access-error';
import {recordAppAccess} from './lib/activity';
import { call } from './lib/orders';
import { ArrowRight, LogOut, ShieldCheck, LayoutDashboard, Settings2 } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { auth, db, functions, configured, sparkMode } from './lib/firebase';
import { Recurrences } from './components/Recurrences';
import { Inbox } from './components/Inbox';
import { Workload } from './components/Workload';
import { Admin } from './components/Admin';
import { Orders } from './components/Orders';
import { Footer } from './components/Footer';
import { Brand } from './components/Brand';
import {isGeneralAdmin} from '../shared/access';
import type { Profile } from '../shared/access';
export function App() {const uiText=useSiteText();
  const [section,setSection]=useState(()=>location.hash==='#admin'?'admin':location.hash==='#inbox'?'inbox':location.hash==='#workload'?'workload':location.hash==='#recurrences'?'recurrences':'orders');
  useEffect(()=>{const changed=()=>setSection(location.hash==='#admin'?'admin':location.hash==='#inbox'?'inbox':location.hash==='#workload'?'workload':location.hash==='#recurrences'?'recurrences':'orders');window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState('');
  const [accessAttempt,setAccessAttempt]=useState(0);
  const [accessFailure,setAccessFailure]=useState<AccessErrorKind>('unknown');
  useEffect(() => {
    if (!auth || !db || !functions) return;
    let unsubscribeProfile: (() => void) | undefined;
    let generation = 0;
    const unsubscribeAuth = onAuthStateChanged(auth, async user => {
      const current = ++generation;
      unsubscribeProfile?.(); setProfile(null); setError(''); setAccessFailure('unknown'); setSession(Boolean(user));
      if (!user) { setLoading(false); return; }
      setLoading(true);
      try {
        await call('establishAccess',{});
        if (current !== generation) return;
        if(sparkMode)await recordAppAccess();
        if (current !== generation) return;
        unsubscribeProfile = onSnapshot(doc(db!, 'users', user.uid), snapshot => {
          if(current!==generation)return;setProfile(snapshot.exists() ? snapshot.data() as Profile : null); setError(''); setLoading(false);
        }, e => {if(current!==generation)return;const kind=accessErrorKind(e);setAccessFailure(kind);setProfile(null);setError(uiText.label(accessErrorMessages[kind],'App'));setLoading(false);});
      } catch (e) { console.warn('Access verification failed:',(e as {code?:string}).code||'unknown'); if (current === generation) {const kind=accessErrorKind(e);setAccessFailure(kind);setError(uiText.label(accessErrorMessages[kind],'App')); setLoading(false);} }
    });
    return () => {generation++; unsubscribeAuth(); unsubscribeProfile?.();};
  }, [accessAttempt]);
  async function login() {
    if (!auth) return;
    setLoading(true); setError('');
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch { setError(uiText("App.049851a7002e")); setLoading(false); }
  }
  if (!session) return <div className="login-page"><div className="brand-lockup"><Brand/></div><main className="login-card"><div className="eyebrow">{""+uiText("App.79cf00c63e3c")+""}</div><h1>{""+uiText("App.a6903434865f")+""}<br/>{""+uiText("App.1f5f611ebddc")+""}</h1><p>{""+uiText("App.c8bd1dbf6a8e")+""}</p><button className="primary login-button" onClick={login} disabled={!configured || loading}>{""+uiText("App.ab51f6ea5985")+" "}<ArrowRight size={18}/></button>{!configured && <p className="notice">{""+uiText("App.b4031248c6e3")+""}</p>}{error && <p role="alert" className="error">{error}</p>}<div className="login-note"><ShieldCheck size={16}/>{" "+uiText("App.d5077e256157")+""}</div></main><Footer/></div>;
  const allowed = profile?.active && profile.role !== 'pending';
  return <Tooltip.Provider><div className="app-shell"><header><a className="brand-link" href="/" aria-label={uiText("App.d4ff39621b13")}><Brand/></a><div className="user-menu"><span>{profile?.displayName}</span><Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" aria-label={uiText("App.c6e6960395f4")} onClick={() => {if (auth) void signOut(auth).catch(() => setError(uiText("App.f0b326f58897")));}}><LogOut size={18}/></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip" sideOffset={8}>{""+uiText("App.c6e6960395f4")+""}</Tooltip.Content></Tooltip.Portal></Tooltip.Root></div></header><main className="workspace">{loading ? <p role="status">{""+uiText("App.19b877dc467a")+""}</p> : error ? <section className="access-error"><h1>{uiText.label('No se pudo abrir Funka','App')}</h1><p className="error" role="alert">{error}</p>{accessFailure==='quota'&&<p>{uiText.label('Puedes mantener tu sesión abierta y volver a intentarlo más tarde.','App')}</p>}<button className="primary" disabled={loading} onClick={()=>{setLoading(true);setError('');setAccessAttempt(attempt=>attempt+1);}}>{uiText.label('Reintentar acceso','App')}</button></section> : !allowed ? <section className="pending"><ShieldCheck size={36}/><h1>{profile&&profile.role!=='pending'?uiText("App.8a76158dace1"):uiText("App.4b08ec901549")}</h1><p>{profile&&profile.role!=='pending'?uiText("App.614741a3fac2"):uiText("App.024a9784c17d")}</p><p>{""+uiText("App.77c860cdef94")+""}</p></section> : <><nav className="tabs app-navigation" aria-label={uiText("App.766d27f411cd")}><button aria-pressed={section==='orders'} onClick={()=>{location.hash='orders';}}><LayoutDashboard size={18}/>{" "+uiText("App.d86393bc38de")+""}</button><button aria-pressed={section==='inbox'} onClick={()=>{location.hash='inbox';}}>{""+uiText("App.80dade6fab6f")+""}</button><button aria-pressed={section==='workload'} onClick={()=>{location.hash='workload';}}>{""+uiText("App.3e000125a0e5")+""}</button>{isGeneralAdmin(profile)&&<button aria-pressed={section==='recurrences'} onClick={()=>{location.hash='recurrences';}}>{""+uiText("App.720207590f40")+""}</button>}{isGeneralAdmin(profile)&&<button aria-pressed={section==='admin'} onClick={()=>{location.hash='admin';}}><Settings2 size={18}/>{" "+uiText("App.1a1b3e6ecc51")+""}</button>}</nav>{section==='admin'&&isGeneralAdmin(profile)?<Admin profile={profile!}/>:section==='recurrences'&&isGeneralAdmin(profile)?<Recurrences/>:section==='inbox'?<Inbox profile={profile!}/>:section==='workload'?<Workload profile={profile!}/>:<Orders profile={profile!}/>}</>}</main><Footer/></div></Tooltip.Provider>;
}
