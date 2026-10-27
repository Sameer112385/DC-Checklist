'use client';
import {useState} from 'react';
import IssueStatus from './IssueStatus';
import {downloadIssues,matchingIssues} from '../lib/issue-report';
import type {ShiftTiming} from '../lib/shifts';
const time=(v:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' AST';
export default function IssueManager({issues,events,reload,location,readOnly=false,onPreviewIssue,selectedIssueId='',onSelectIssue,records,templates,shifts,onViewInspection}:{onPreviewIssue?:(id:string)=>void;selectedIssueId?:string;onSelectIssue?:(id:string)=>void;records:any[];templates:any[];shifts:ShiftTiming[];onViewInspection:(r:any)=>void;issues:any[];events:any[];reload:()=>Promise<unknown>;location:string;readOnly?:boolean}){
 const [filter,setFilter]=useState('Active'),[error,setError]=useState(''),[message,setMessage]=useState('');
 const filtered=matchingIssues(issues,location,filter);
 return <section className="issue-manager"><div className="sectiontitle"><h2>Issues and repair history</h2></div><div className="issue-toolbar"><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}>{['Active','Open','In progress','Awaiting verification','Closed','All'].map(s=><option key={s}>{s}</option>)}</select></label><button disabled={!filtered.length} onClick={()=>{try{downloadIssues(filtered,events);setMessage('Excel report downloaded.')}catch{setError('Could not export issues. Please try again.')}}}>Export Excel</button><button onClick={()=>void reload()}>Refresh issues</button></div>
 {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 <p className="hint">Use Closed or All to review resolved issues. Original checklists and photos are retained.</p><div className="tablewrap issue-list-table"><table><thead><tr><th>Issue number</th><th>Location / item</th><th>Status</th><th>Reported</th></tr></thead><tbody>{filtered.map(t=><tr key={t.id}><td><button className="issue-link" onClick={()=>onPreviewIssue?.(t.id)}>{t.number}</button></td><td><button className="issue-link" onClick={()=>onPreviewIssue?.(t.id)}>{t.label}</button><small>{t.location} · {t.area}</small></td><td><IssueStatus status={t.status}/></td><td><span className="mobile-field-label">Reported: </span>{time(t.reported_at)}</td></tr>)}</tbody></table></div>
 </section>;
}
