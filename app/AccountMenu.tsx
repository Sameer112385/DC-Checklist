'use client';
import {useEffect,useRef,useState} from 'react';
import {MoreHorizontal,X,LogOut,Settings,Clock3} from 'lucide-react';
import {browserClient} from '../lib/supabase-browser';
import {useProfile} from '../lib/profile-context';
export default function AccountMenu({onSettings}:{onSettings?:()=>void}){
 const profile=useProfile(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState<Date|null>(null);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),close=useRef<HTMLButtonElement>(null);
 const name=profile.full_name||profile.email,initials=name.split(/[\s@._-]+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase();
 useEffect(()=>{setNow(new Date());const clock=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(clock)},[]);
 useEffect(()=>{if(!open)return;close.current?.focus();
 function outside(e:PointerEvent){if(!root.current?.contains(e.target as Node))setOpen(false)}
 function keys(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus()}}
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keys);
 return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keys)}},[open]);
 async function signOut(){setBusy(true);setError('');try{const {error}=await browserClient().auth.signOut();if(error)throw error}catch(e){setError(e instanceof Error?e.message:'Could not sign out.')}finally{setBusy(false)}}
 return <div ref={root} className="sidebar-account" onBlur={e=>{if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}>
 <div className="sidebar-clock" title={now?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'full',timeStyle:'medium'}).format(now)+' · Riyadh (AST)':'Riyadh (AST)'}><Clock3 size={20} className="sidebar-clock-icon" aria-label="Current Riyadh date and time"/><span className="sidebar-clock-text"><small>Current date & time · Riyadh (AST)</small>{now&&<time dateTime={now.toISOString()}>{new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'full',timeStyle:'medium'}).format(now)}</time>}</span></div>
 <button ref={trigger} className="account-card" aria-label="Open account menu" aria-haspopup="dialog" aria-expanded={open} aria-controls="account-panel" onClick={()=>setOpen(v=>!v)}><span className="account-avatar">{initials}</span><span className="account-card-text"><strong>{name}</strong><small>{profile.email}</small></span><MoreHorizontal size={18}/></button>
 {open&&<div id="account-panel" className="account-popover" role="dialog" aria-label="Profile and account"><div className="account-heading"><h2>My account</h2><button ref={close} aria-label="Close account menu" onClick={()=>{setOpen(false);trigger.current?.focus()}}><X size={18}/></button></div><div className="account-identity"><strong>{name}</strong><p>{profile.email}</p><span className="profile-role">{profile.role}</span></div>{profile.role==='admin'&&onSettings&&<button className="profile-settings" onClick={()=>{setOpen(false);onSettings()}}><Settings size={18}/>Admin settings</button>}<button className="account-signout" disabled={busy} onClick={signOut}><LogOut size={18}/>{busy?'Signing out…':'Sign out'}</button>{error&&<p className="error" role="alert">{error}</p>}</div>}
 </div>;
}
