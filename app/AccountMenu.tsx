'use client';
import {useState} from 'react';
import {browserClient} from '../lib/supabase-browser';
import {useProfile} from '../lib/profile-context';
export default function AccountMenu(){
  const profile=useProfile();const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function signOut(){setBusy(true);setError('');try{const {error}=await browserClient().auth.signOut();if(error)throw error}catch(e){setError(e instanceof Error?e.message:'Could not sign out.')}finally{setBusy(false)}}
  return <div className="header-account"><span className="header-email" title={profile.email}>{profile.email}</span><span className="header-role">{profile.role}</span><button disabled={busy} onClick={signOut}>{busy?'Signing out…':'Sign out'}</button>{error&&<span className="header-account-error" role="alert">{error}</span>}</div>;
}
