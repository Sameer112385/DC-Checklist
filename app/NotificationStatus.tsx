'use client';
import {useEffect,useState} from 'react';import {microsoft} from '../lib/microsoft-client';
export default function NotificationStatus({recordId}:{recordId:string}){
 const [status,setStatus]=useState('checking'),[retry,setRetry]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;microsoft('notification_status',{recordId}).then(result=>{if(active){setStatus(result.status);setRetry(result.canRetry)}}).catch(()=>{if(active)setStatus('unavailable')});return()=>{active=false}},[recordId]);
 async function send(){setBusy(true);setError('');try{const result=await microsoft('notify',{recordId});setStatus(result.status)}catch(e){setError(e instanceof Error?e.message:'Teams notification failed.')}finally{setBusy(false)}}
 return <div className="notification-status"><p role="status">Teams notification: {status==='not_queued'?'not yet queued':status}</p>{retry&&['failed','pending','not_queued'].includes(status)&&<><small>Check Teams or workflow run history before retrying if delivery was interrupted.</small><button disabled={busy} onClick={send}>{busy?'Sending…':'Retry Teams notification'}</button></>}{error&&<p className="error" role="alert">{error}</p>}</div>;
}
