export function isDemoRecord(record:any){return record?.demo===true||String(record?.id||'').startsWith('demo-')}
export function selectInspectionData(live:any[],sample:any[],requested:boolean,enabled:boolean){return requested&&enabled?sample.filter(isDemoRecord):live.filter(r=>!isDemoRecord(r))}
