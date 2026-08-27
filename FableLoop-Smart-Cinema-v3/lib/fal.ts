const DEFAULT_VIDEO_MODEL="fal-ai/kling-video/v3/pro/text-to-video";
const MERGE_MODEL="fal-ai/ffmpeg-api/merge-videos";

export function falKey(){return process.env.FAL_KEY?.trim()}
export function modelFor(kind:string|null){return kind==="merge"?MERGE_MODEL:(process.env.FAL_VIDEO_MODEL||DEFAULT_VIDEO_MODEL)}
export async function falSubmit(model:string,input:Record<string,unknown>){
 const key=falKey();if(!key)throw new Error("FAL_KEY is not configured.");
 const response=await fetch(`https://queue.fal.run/${model}`,{method:"POST",headers:{Authorization:`Key ${key}`,"Content-Type":"application/json"},body:JSON.stringify(input)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.detail?.[0]?.msg||data.detail||data.error||`Provider rejected the request (${response.status}).`);
 return data;
}
function trustedJobUrl(raw:string,requestId:string,expectStatus:boolean){
 const url=new URL(raw);
 if(url.protocol!=="https:"||url.hostname!=="queue.fal.run"||!url.pathname.includes(`/requests/${requestId}`)||(expectStatus&&!url.pathname.endsWith("/status")))throw new Error("The provider returned an invalid job address.");
 return url.toString();
}
export async function falStatus(requestId:string,statusUrl:string,responseUrl:string){
 const key=falKey();if(!key)throw new Error("FAL_KEY is not configured.");
 const safeStatus=trustedJobUrl(statusUrl,requestId,true),safeResponse=trustedJobUrl(responseUrl,requestId,false);
 const statusResponse=await fetch(safeStatus,{headers:{Authorization:`Key ${key}`},cache:"no-store"});
 const status=await statusResponse.json().catch(()=>({}));
 if(!statusResponse.ok)throw new Error(status.detail||status.error||"Could not read provider status.");
 if(status.status==="COMPLETED"){
  const resultResponse=await fetch(safeResponse,{headers:{Authorization:`Key ${key}`},cache:"no-store"});
  const result=await resultResponse.json().catch(()=>({}));
  if(!resultResponse.ok)throw new Error(result.detail||result.error||"Could not retrieve the rendered video.");
  return{...status,result};
 }
 return status;
}
