'use client';
import {useEffect,useState} from 'react';
import {microsoft} from '../lib/microsoft-client';
function Photo({id,label}:{id:string,label:string}){
 const [url,setUrl]=useState(''),[link,setLink]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true,objectUrl='';setError('');microsoft('photo_get',{id}).then(data=>{if(!active)return;const bytes=Uint8Array.from(atob(data.content),c=>c.charCodeAt(0));objectUrl=URL.createObjectURL(new Blob([bytes],{type:data.mime}));setUrl(objectUrl);setLink(data.webUrl)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[id]);
 return <figure>{url?<a href={link} target="_blank" rel="noopener noreferrer"><img src={url} alt={'Fault photo: '+label} loading="lazy"/></a>:<p role={error?'alert':'status'}>{error||'Loading photo…'}</p>}<figcaption>{label}{link&&<a href={link} target="_blank" rel="noopener noreferrer">Open in SharePoint</a>}</figcaption></figure>;
}
export function PhotoGallery({ids=[],label='Inspection photo'}:{ids?:string[],label?:string}){return ids.length?<div className="photo-gallery">{ids.map(id=><Photo key={id} id={id} label={label}/>)}</div>:null}
export default function PhotoAttachments({group,item,label,ids=[],onUploaded,onRemove,onBusy}:{group:string,item:string,label:string,ids:string[],onUploaded:(id:string)=>void,onRemove:(id:string)=>void,onBusy:(delta:number)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function upload(file:File){setError('');if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||!file.size){setError('Choose a JPEG, PNG or WebP photo up to 5 MB.');return}setBusy(true);onBusy(1);try{
  const content=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Could not read photo.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file)});
  const result=await microsoft('photo_upload',{group,item,mime:file.type,content});onUploaded(result.id);
 }catch(e){setError(e instanceof Error?e.message:'Photo upload failed.')}finally{setBusy(false);onBusy(-1)}}
 return <div className="fault-photos"><label>Fault photo <strong>(required)</strong><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||ids.length>=3} aria-label={'Upload fault photo for '+label} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)upload(file)}}/></label><small>{busy?'Uploading to company SharePoint…':'Up to 3 photos · JPEG, PNG or WebP · 5 MB each'}</small>{error&&<p role="alert" className="error">{error}</p>}{!ids.length&&!busy&&<p className="hint">Add a picture of this fault before submitting.</p>}<PhotoGallery ids={ids} label={label}/>{ids.map((id,index)=><button key={id} type="button" disabled={busy} onClick={()=>onRemove(id)}>Remove photo {index+1} from checklist</button>)}<small>Removing an attachment here keeps its file in SharePoint.</small></div>;
}
