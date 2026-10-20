'use client';
import {useEffect,useState} from 'react';
import {browserClient,apiFetch} from '../lib/supabase-browser';
import {readApiJson} from '../lib/api-json';
import {ProfileContext} from '../lib/profile-context';
import LoginForm from './LoginForm';
import PasswordChange from './PasswordChange';
import type {Profile} from '../lib/roles';
function ApprovedApp({children}:{children:React.ReactNode}){
  const [profile,setProfile]=useState<Profile|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;setError('');apiFetch('/api/me').then(r=>readApiJson(r,'Could not check your access.')).then(p=>{if(active)setProfile(p)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[attempt]);
  if(error)return <div className="auth-screen"><section className="auth-card"><h2>Checklist access</h2><p className="error" role="alert">{error}</p><button onClick={()=>setAttempt(n=>n+1)}>Check again</button><button onClick={()=>browserClient().auth.signOut().catch(()=>setError("Could not sign out. Please retry."))}>Sign out</button></section></div>;
  if(!profile)return <div className="auth-screen"><p>Checking your role…</p></div>;
  if(profile.role!=='admin'&&profile.password_change_required)return <div className="auth-screen"><PasswordChange required onComplete={()=>{setProfile(null);setAttempt(n=>n+1)}}/></div>;
  return <ProfileContext.Provider value={profile}><div key={profile.user_id+profile.role}>{children}</div></ProfileContext.Provider>;
}
export default function AuthGate({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    try{const client=browserClient();client.auth.getSession().then(({data,error})=>{if(active){setUser(data.session?.user.email??null);if(error)setError(error.message);setLoading(false)}}).catch(e=>{if(active){setError(e.message);setLoading(false)}});
      const {data}=client.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user.email??null);setLoading(false)}});
      return ()=>{active=false;data.subscription.unsubscribe()};
    }catch(e){setError(e instanceof Error?e.message:'Could not connect.');setLoading(false)}
  },[]);
  async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await browserClient().auth.signInWithPassword({email,password});if(error)throw error;setPassword('')}catch(e){setError(e instanceof Error?e.message:'Could not sign in.')}finally{setBusy(false)}}
  if(loading)return <div className="auth-screen"><p>Checking your session…</p></div>;
  if(user)return <ApprovedApp key={user}>{children}</ApprovedApp>;
  return <LoginForm email={email} password={password} busy={busy} error={error} onEmail={setEmail} onPassword={setPassword} onSubmit={login}/>;
}
