export type ShiftTiming={id:string;start:string;end:string};
export const defaultShifts:ShiftTiming[]=[{id:'1',start:'08:00',end:'17:00'},{id:'2',start:'14:00',end:'23:00'},{id:'3',start:'23:00',end:'08:00'}];
export function validateShifts(input:any):ShiftTiming[]{
 if(!Array.isArray(input)||input.length!==3)throw new Error('Set start and end times for all three shifts.');
 return ['1','2','3'].map(id=>{const s=input.find(v=>v?.id===id);if(!s||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||s.start===s.end)throw new Error('Choose valid, different start and end times for Shift '+id+'.');return {id,start:s.start,end:s.end}});
}
export function shiftLabel(recordOrId:any,schedule:ShiftTiming[]=defaultShifts){const record=typeof recordOrId==='object'?recordOrId:null,id=String(record?record.shift:recordOrId);const snapshot=record?.shiftTiming?.id===id?record.shiftTiming:null;const timing=snapshot||schedule.find(s=>s.id===id);return 'Shift '+id+(timing?' · '+timing.start+'–'+timing.end+' AST'+(timing.end<timing.start?' (next day)':'')+(record&&!snapshot?' (current schedule)':''):'');}
