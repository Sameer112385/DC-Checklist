import {jsPDF} from 'jspdf';
import {autoTable} from 'jspdf-autotable';
import {resolutionSummary,resolutionTime} from '../lib/resolution-summary';
type Photo={id:string;label:string;data?:string;unavailable?:boolean};
export function createResolutionPdf(ticket:any,events:any[],records:any[],options:{companyName:string;logo?:string|null;font?:string;photos?:Photo[]} ){
 const report=resolutionSummary(ticket,events,records),doc=new jsPDF({compress:true});
 if(options.font){doc.addFileToVFS('Inspector.ttf',options.font);doc.addFont('Inspector.ttf','Inspector','normal');doc.setFont('Inspector','normal')}
 const font=options.font?'Inspector':'helvetica',width=210,height=297,left=14,right=196;let y=31;
 const text=(value:any)=>String(value??'').trim()||'Not recorded';
 doc.setProperties({title:'Issue Resolution Report - '+ticket.number,subject:ticket.label,author:options.companyName});
 doc.setTextColor(23,62,76);doc.setFontSize(18);doc.text('Issue Resolution Report',left,y);y+=8;doc.setFontSize(11);doc.text('Reference: RES-'+ticket.number,left,y);y+=8;
 const table=(title:string,rows:any[])=>{if(y>240){doc.addPage();y=30}autoTable(doc,{startY:y,head:[[title,'']],body:rows,theme:'grid',margin:{top:30,bottom:20,left,right:14},styles:{font,fontStyle:'normal',fontSize:9,cellPadding:3,overflow:'linebreak',textColor:[35,55,70],lineColor:[222,230,236],lineWidth:0.15},headStyles:{fillColor:[23,62,76],textColor:[255,255,255],fontStyle:'normal'},columnStyles:{0:{cellWidth:46,fillColor:[246,249,250]},1:{cellWidth:136}},rowPageBreak:'avoid'});y=(doc as any).lastAutoTable.finalY+8};
 table('Issue summary',[
 ['Issue number',ticket.number],['Closure status',report.verified?'Verified and closed':'Closed - historical record (verification not recorded)'],['Location / area',[ticket.location,ticket.area].filter(Boolean).join(' / ')],['Equipment / checklist item',ticket.label],['Original fault',report.originalFault],['Reported by / Inspector',report.inspector],['First reported',resolutionTime(ticket.reported_at)],['Closed on',resolutionTime(report.closedAt)]
 ]);
 const d=report.repair?.details||{};
 table('Repair and corrective action',[
 ['Problem / root cause',text(d.rootCause)],['Repair / replacement',text(d.repair)],['Repair completed by',text(report.repair?.actor_name)],['Repair completed on',resolutionTime(report.repair?.at)],['Contractor details',d.contractor||'Not specified'],['Work order / ticket reference',d.reference||'Not provided'],['Further action required',d.furtherAction||'Not recorded'],...(d.furtherAction==='Yes'?[['Follow-up action',text(d.followUp)],['Responsible person',text(d.responsible)],['Target date',text(d.due)]]:[])
 ]);
 table('Verification and closure',[
 ['Verified by',report.closed?.actor_name||'Not recorded'],['Verification date / time',resolutionTime(report.closed?.at)],['Verification comments',report.closed?.details?.verification||'Not recorded'],['Closure statement',report.verified?'The repair was reviewed and the issue was verified and closed. Any outstanding follow-up is listed above.':'This issue was closed under a historical workflow. Verification evidence was not recorded.']
 ]);
 if(report.timeline.length){if(y>230){doc.addPage();y=30}autoTable(doc,{startY:y,head:[['Date / time (AST)','Lifecycle event','Recorded by']],body:report.timeline.map(e=>[resolutionTime(e.at),e.action,e.actor_name||'Not recorded']),margin:{top:30,bottom:20,left,right:14},styles:{font,fontStyle:'normal',fontSize:8,cellPadding:3,overflow:'linebreak'},headStyles:{fillColor:[23,62,76],fontStyle:'normal'},columnStyles:{0:{cellWidth:48},1:{cellWidth:64}},rowPageBreak:'avoid'});y=(doc as any).lastAutoTable.finalY+8}
 const photos=options.photos||report.photos.map(p=>({...p,unavailable:true}));
 if(photos.length){doc.addPage();y=32;doc.setFontSize(14);doc.setTextColor(23,62,76);doc.text('Photo evidence',left,y);y+=10;
 for(const photo of photos){if(y+92>height-22){doc.addPage();y=32}doc.setFontSize(10);doc.setTextColor(35,55,70);doc.text(photo.label,left,y);y+=6;if(photo.data){try{const props=doc.getImageProperties(photo.data),scale=Math.min(180/props.width,78/props.height),w=props.width*scale,h=props.height*scale;doc.addImage(photo.data,props.fileType,left,y,w,h,undefined,'FAST');y+=h+10}catch{doc.setFontSize(9);doc.text('Photo could not be rendered. Original evidence is retained in the company system.',left,y,{maxWidth:182});y+=20}}else{doc.setFontSize(9);doc.text('Photo unavailable when this report was generated. Evidence is retained in the company system.',left,y,{maxWidth:182});y+=20}}
 }
 const total=doc.getNumberOfPages();for(let page=1;page<=total;page++){doc.setPage(page);doc.setFont(font,'normal');doc.setDrawColor(220,229,235);doc.line(left,23,right,23);doc.setFontSize(10);doc.setTextColor(23,62,76);doc.text(doc.splitTextToSize(options.companyName,145).slice(0,2),left,12);if(options.logo){try{const p=doc.getImageProperties(options.logo),scale=Math.min(24/p.width,16/p.height);doc.addImage(options.logo,p.fileType,196-p.width*scale,5,p.width*scale,p.height*scale)}catch{}}
 doc.line(left,280,right,280);doc.setFontSize(8);doc.setTextColor(100,118,130);doc.text('RES-'+ticket.number+' | DC Daily Checklist',left,286);doc.text('Page '+page+' of '+total,right,286,{align:'right'})}
 return doc;
}
export async function loadResolutionFont(){const response=await fetch('/fonts/Inspector-Regular.ttf');if(!response.ok)throw new Error('Could not load the report font. Please retry.');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)}
