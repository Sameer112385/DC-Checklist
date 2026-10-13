'use client';
import {useEffect,useState} from 'react';
import {browserClient} from '../lib/supabase-browser';
export default function AuthGate({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<string|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    try{const client=browserClient();client.auth.getSession().then(({data,error})=>{if(active){setUser(data.session?.user.email??null);if(error)setError(error.message);setLoading(false)}});
      const {data}=client.auth.onAuthStateChange((_event,session)=>{if(active){setUser(session?.user.email??null);setLoading(false)}});
      return ()=>{active=false;data.subscription.unsubscribe()};
    }catch(e){setError(e instanceof Error?e.message:'Could not connect.');setLoading(false)}
  },[]);
  async function login(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const {error}=await browserClient().auth.signInWithPassword({email,password});if(error)throw error;setPassword('')}catch(e){setError(e instanceof Error?e.message:'Could not sign in.')}finally{setBusy(false)}}
  if(loading)return <div className="auth-screen"><p>Checking your session…</p></div>;
  if(user)return <><div className="account-bar"><span>{user}</span><button onClick={async()=>{try{const {error}=await browserClient().auth.signOut();if(error)throw error;setUser(null)}catch(e){setError(e instanceof Error?e.message:'Could not sign out.')}}}>Sign out</button>{error&&<span role="alert">{error}</span>}</div><div key={user}>{children}</div></>;
  return <div className="auth-screen"><section className="auth-card"><h1>DC Daily Checklist</h1><p>Sign in with your approved inspector account.</p><form onSubmit={login}><label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form>{error&&<p className="error" role="alert">{error}</p>}</section></div>;
}
