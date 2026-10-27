export type ReadingMetric='temp'|'humidity';
export const readingTimeNote="Times use Riyadh (AST). New times record value entry; '(submitted)' means the exact reading time was not recorded.";
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'medium',hourCycle:'h23'});
export function hasReading(answer:any,metric:ReadingMetric){const value=answer?.[metric];return value!=null&&String(value).trim()!==''&&Number.isFinite(Number(value));}
function timestamp(value:any){if(value==null||value==='')return NaN;return typeof value==='number'?value:Date.parse(value);}
export function recordReading(answer:any,key:string,value:any,now=Date.now()){
 const next={...answer,[key]:value};
 if(key==='temp'||key==='humidity'){
  if(hasReading(next,key)){next[key+'RecordedAt']=new Date(now).toISOString();next[key+'TimeSource']='entry';}
  else{delete next[key+'RecordedAt'];delete next[key+'TimeSource'];}
 }
 return next;
}
export function normalizeReadingTimes(answers:any,now=Date.now()){
 return Object.fromEntries(Object.entries(answers).map(([id,input])=>{const answer={...(input as any)};for(const metric of ['temp','humidity'] as const){
  if(!hasReading(answer,metric)){delete answer[metric+'RecordedAt'];delete answer[metric+'TimeSource'];continue;}
  const recorded=typeof answer[metric+'RecordedAt']==='string'?timestamp(answer[metric+'RecordedAt']):NaN;
  const valid=Number.isFinite(recorded)&&recorded>=now-7*86400000&&recorded<=now+300000;
  answer[metric+'RecordedAt']=new Date(valid?recorded:now).toISOString();answer[metric+'TimeSource']=valid?'entry':'submission';
 }return [id,answer]}));
}
export function readingStamp(answer:any,record:any,metric:ReadingMetric){
 const saved=timestamp(answer?.[metric+'RecordedAt']);
 if(Number.isFinite(saved))return {at:saved,source:answer?.[metric+'TimeSource']==='submission'?'submission':answer?.[metric+'TimeSource']==='amendment'?'amendment':'entry'};
 return {at:timestamp(record?.createdAt??record?.at),source:'submission'};
}
export function formatMetricTime(answer:any,record:any,metric:ReadingMetric){
 if(!hasReading(answer,metric))return '';
 const stamp=readingStamp(answer,record,metric);if(!Number.isFinite(stamp.at))return 'Time not recorded';
 return formatter.format(new Date(stamp.at))+' AST'+(stamp.source==='submission'?' (submitted)':stamp.source==='amendment'?' (amended)':'');
}
export function readingTimeLines(answer:any,record:any):string[]{
 const temp=formatMetricTime(answer,record,'temp'),humidity=formatMetricTime(answer,record,'humidity');
 if(temp&&humidity&&temp!==humidity)return ['T: '+temp,'H: '+humidity];
 return temp||humidity?[temp||humidity]:[];
}
