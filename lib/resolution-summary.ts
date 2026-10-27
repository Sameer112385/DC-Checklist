import {cleanIssueNote} from './issue-history';
export function resolutionSummary(ticket:any,events:any[],records:any[]){
 if(ticket.status!=='Closed')throw new Error('A resolution report is available after the issue is verified and closed.');
 const ordered=events.filter(e=>e.issue_id===ticket.id).slice().sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||String(a.id).localeCompare(String(b.id)));
 const closed=ordered.filter(e=>e.action==='Verify and close').at(-1);
 const limit=closed?Date.parse(closed.at):ticket.closed_at?Date.parse(ticket.closed_at):Infinity;
 const repair=ordered.filter(e=>e.action==='Complete repair'&&Date.parse(e.at)<=limit).at(-1);
 const original=records.find(r=>r.id===ticket.first_record),reported=ordered.find(e=>e.action==='Reported');
 return {ticket,verified:!!closed,closed,repair,inspector:original?.name||reported?.actor_name||'Not recorded',originalFault:cleanIssueNote(ticket.original_note)||'Not recorded',closedAt:closed?.at||ticket.closed_at,timeline:ordered.filter(e=>e.action!=='Checklist observation'&&Date.parse(e.at)<=limit),photos:[...(ticket.photos||[]).map((id:string)=>({id,label:'Original fault'})),...(repair?.details?.photos||[]).map((id:string)=>({id,label:'After repair'}))]};
}
export const resolutionTime=(v:any)=>v&&Number.isFinite(new Date(v).getTime())?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'}).format(new Date(v))+' AST':'Not recorded';
