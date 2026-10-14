import {jsPDF} from 'npm:jspdf@4.2.1';
import {autoTable} from 'npm:jspdf-autotable@5.0.8';
import templates from './templates.json' with {type:'json'};
import {font} from './pdf-font.ts';
const items=(r:any,t:any[])=>r.items||t.find(g=>g.id===r.group)?.items.filter((i:any)=>r.answers?.[i.id])||[];

export function createInspectionPdf(records:any[], templates:any[], options:{demo?:boolean; filters?:string; status?:string; font?:string;companyName?:string;logo?:string}={}) {
  const doc=new jsPDF({orientation:'landscape',compress:true});
  if(options.font){doc.addFileToVFS('Inspector.ttf',options.font);doc.addFont('Inspector.ttf','Inspector','normal');doc.setFont('Inspector','normal');}
  const width=doc.internal.pageSize.getWidth();
  records.forEach((r,index)=>{
    if(index)doc.addPage();
    const g=templates.find(g=>g.id===r.group);
    const companyName=r.companyName||options.companyName;
    const header=[...(companyName?[companyName]:[]),options.demo?'DEMO — DC Daily Checklist':'DC Daily Checklist',
      `Inspection: ${r.date} | Shift ${r.shift} | ${r.location??g?.site??''} | ${r.areaName??g?.name??r.group}`,
      `Inspector: ${r.name??'Not recorded'}`,
      `Submitted: ${new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'}).format(new Date(r.createdAt))} AST`,
      ...(options.filters?[`Filters: ${options.filters}`]:[])];
    doc.setFontSize(10);
    const lines=header.flatMap(line=>doc.splitTextToSize(line,width-(options.logo?56:28)));
    const headerHeight=14+lines.length*5;
    const checks=items(r,templates).filter((i:any)=>!options.status||r.answers[i.id]?.status===options.status);
    autoTable(doc,{startY:headerHeight,margin:{top:headerHeight,bottom:14,left:14,right:14},
      head:[['Section / check','Status','Temperature °C','Humidity %','Answer / remarks']],
      body:checks.map((i:any)=>{const a=r.answers[i.id]??{};return [[i.section,i.label].filter(Boolean).join(' / '),a.status??'—',a.temp??'—',a.humidity??'—',[a.value,a.note].filter(v=>v!=null&&v!=='').join(' · ')||'—'];}),
      styles:{font:options.font?'Inspector':'helvetica',fontStyle:'normal',fontSize:9,cellPadding:3,overflow:'linebreak'},headStyles:{fontStyle:'normal',fillColor:[23,62,76]},
      columnStyles:{0:{cellWidth:80},1:{cellWidth:30},2:{cellWidth:30},3:{cellWidth:25}},
      didDrawPage:()=>{if(options.logo){const image=doc.getImageProperties(options.logo),scale=Math.min(20/image.width,16/image.height);doc.addImage(options.logo,options.logo.startsWith('data:image/png')?'PNG':'JPEG',width-34,10,image.width*scale,image.height*scale);}doc.setFontSize(10);doc.text(lines,14,12);doc.setFontSize(8);doc.text(`Inspection ${index+1} of ${records.length} | Page ${doc.getNumberOfPages()}`,14,doc.internal.pageSize.getHeight()-6);}});
  });
  return doc;
}


export async function buildPdf(record:any){return createInspectionPdf([record],templates,{font,logo:record.pdfLogo}).output("datauristring").split(",")[1];}
