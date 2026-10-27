export const validReading=(v:unknown)=>v!==''&&v!=null&&Number.isFinite(Number(v));
export function defaultTrendIds(options:any[],rows:any[]){const ids=new Set<string>();for(const metric of ['temp','humidity']){options.filter(i=>rows.some(r=>r.id===i.id&&validReading(r[metric]))).slice(0,3).forEach(i=>ids.add(i.id))}return [...ids]}
