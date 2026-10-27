export function cleanIssueNote(note:string=''){return [...new Set(note.split(/\s*\|\s*/).filter(part=>part&&!/^(Outstanding issue:|Issue:)\s*\d{6}-\d+/i.test(part)))].join(' | ')}
export function issueInspections(ticket:any,records:any[],events:any[]){
 const links=new Set(events.filter(e=>e.issue_id===ticket.id&&e.record_id).map(e=>e.record_id));links.add(ticket.first_record);
 const start=Date.parse(ticket.reported_at),end=ticket.closed_at?Date.parse(ticket.closed_at):Infinity;
 return records.filter(r=>{if(r.kind!=='inspection'||r.group!==ticket.group_id||!r.answers?.[ticket.item_id])return false;const a=r.answers[ticket.item_id];if(links.has(r.id)||a.issueId===ticket.id)return true;if(a.issueId&&a.issueId!==ticket.id)return false;return Number(r.createdAt)>=start&&Number(r.createdAt)<=end;}).sort((a,b)=>Number(a.createdAt)-Number(b.createdAt)||a.id.localeCompare(b.id));
}
