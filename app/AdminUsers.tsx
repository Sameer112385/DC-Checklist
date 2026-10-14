'use client';
import {useCallback,useEffect,useState} from 'react';
import {UserPlus,Users,ShieldCheck} from 'lucide-react';
import {apiFetch} from '../lib/supabase-browser';
import {readApiJson} from '../lib/api-json';
import {roles,type Profile,type Role} from '../lib/roles';
import {useProfile} from '../lib/profile-context';
import MicrosoftSettings from './MicrosoftSettings';
export default function AdminUsers(){
  const me=useProfile();
  const [users,setUsers]=useState<Profile[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState('');
  const [email,setEmail]=useState(''),[fullName,setFullName]=useState(''),[password,setPassword]=useState(''),[role,setRole]=useState<Role>('inspector'),[existing,setExisting]=useState(false);
  const load=useCallback(async()=>{setLoading(true);try{setUsers(await readApiJson(await apiFetch('/api/admin/users'),'Could not load users.'))}finally{setLoading(false)}},[]);
  useEffect(()=>{load().catch(e=>setError(e.message))},[load]);
  async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setNotice('');try{
    await readApiJson(await apiFetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,full_name:fullName,password:existing?undefined:password,role,existing})}),'Could not add the user.');
    setEmail('');setFullName('');setPassword('');setRole('inspector');setNotice('User added successfully. Their login and checklist role are saved in Supabase.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not add the user.')}finally{setBusy(false)}}
  async function save(user:Profile){setBusy(true);setError('');setNotice('');try{
    await readApiJson(await apiFetch('/api/admin/users',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:user.user_id,role:user.role,active:user.active,full_name:user.full_name})}),'Could not update the user.');
    setNotice('User updated in Supabase. Their access changes on the next request.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Could not update the user.')}finally{setBusy(false)}}
  function edit(id:string,field:keyof Profile,value:string|boolean){setUsers(rows=>rows.map(u=>u.user_id===id?{...u,[field]:value}:u))}
  const visible=users.filter(u=>(u.email+' '+u.full_name+' '+u.role).toLowerCase().includes(search.toLowerCase()));
  return <><MicrosoftSettings/><div className="admin-summary"><article><Users size={22}/><strong>{users.length}</strong><span>Checklist users</span></article><article><ShieldCheck size={22}/><strong>{users.filter(u=>u.active).length}</strong><span>Active accounts</span></article><article><strong>3</strong><span>Inspector · Supervisor · Admin</span></article></div>
    {error&&<div className="error" role="alert">{error}</div>}{notice&&<p className="admin-notice" role="status">{notice}</p>}
    <section><div className="sectiontitle"><h2><UserPlus size={18}/> Add user</h2></div><p className="hint">Inspectors submit rounds. Supervisors review inspections and record repairs. Admins also manage checklists and users.</p>
      <form onSubmit={add} className="admin-form"><label>Account type<select value={existing?'existing':'new'} onChange={e=>{setExisting(e.target.value==='existing');setPassword('')}}><option value="new">Create new account</option><option value="existing">Add existing Supabase account</option></select></label>
      <label>Full name<input required maxLength={120} value={fullName} onChange={e=>setFullName(e.target.value)}/></label><label>Email<input type="email" required maxLength={254} autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label>Role<select value={role} onChange={e=>setRole(e.target.value as Role)}>{roles.map(r=><option key={r} value={r}>{r[0].toUpperCase()+r.slice(1)}</option>)}</select></label>
      {!existing&&<label>Initial password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/><small>At least 12 characters. Give this password to the user securely.</small></label>}
      <div><button className="primary" disabled={busy}>{busy?'Saving…':'Add user'}</button></div></form></section>
    <section><div className="sectiontitle"><h2>Manage users</h2><button disabled={busy} onClick={()=>{setError('');load().catch(e=>setError(e.message))}}>Refresh users</button></div><label>Search users<input placeholder="Name, email or role" value={search} onChange={e=>setSearch(e.target.value)}/></label>
      {loading?<p>Loading users…</p>:<div className="tablewrap admin-table"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(user=><tr key={user.user_id}>
        <td><input aria-label={'Name for '+user.email} maxLength={120} value={user.full_name} onChange={e=>edit(user.user_id,'full_name',e.target.value)}/></td><td>{user.email}{user.user_id===me.user_id&&<small>Your account</small>}</td>
        <td><select aria-label={'Role for '+user.email} disabled={busy||user.user_id===me.user_id} value={user.role} onChange={e=>edit(user.user_id,'role',e.target.value)}>{roles.map(r=><option key={r} value={r}>{r[0].toUpperCase()+r.slice(1)}</option>)}</select></td>
        <td><select aria-label={'Status for '+user.email} disabled={busy||user.user_id===me.user_id} value={user.active?'active':'disabled'} onChange={e=>edit(user.user_id,'active',e.target.value==='active')}><option value="active">Active</option><option value="disabled">Disabled</option></select></td>
        <td><button disabled={busy||!user.full_name.trim()} onClick={()=>save(user)}>Save changes</button></td></tr>)}</tbody></table>{!visible.length&&<p>No users match this search.</p>}</div>}
      <p className="hint">Disabling an account blocks checklist access and keeps its inspection history. Your own admin account and the last active admin are protected.</p></section></>;
}
