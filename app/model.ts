import base from './templates.json';
export function merge(qs:any[],areas:any[]=[]){const t:any[]=JSON.parse(JSON.stringify([...base,...areas]));for(const q of qs.sort((a,b)=>a.createdAt-b.createdAt)){const g=t.find(g=>g.id===q.group);if(!g)continue;const i=g.items.findIndex((i:any)=>i.id===q.item.id);if(i<0)g.items.push(q.item);else g.items[i]=q.item}return t}
export function items(r:any,t:any[]){return r.items||base.find(g=>g.id===r.group)?.items.filter((i:any)=>r.answers?.[i.id])||[]}
export function complete(i:any,a:any){if(i.required===false)return true;if(!i.type||i.type==='status')return !!a?.status;const k=i.type==='temperature'?'temp':i.type==='humidity'?'humidity':'value';return a?.[k]!=null&&String(a[k]).trim()!==''}
