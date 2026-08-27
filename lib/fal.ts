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
export async function falStatus(model:string,requestId:string){
 const key=falKey();if(!key)throw new Error("FAL_KEY is not configured.");
 const base=`https://queue.fal.run/${model}/requests/${encodeURIComponent(requestId)}`;
 const statusResponse=await fetch(`${base}/status`,{headers:{Authorization:`Key ${key}`}});
 const status=await statusResponse.json().catch(()=>({}));
 if(!statusResponse.ok)throw new Error(status.detail||status.error||"Could not read provider status.");
 if(status.status==="COMPLETED"){
  const resultResponse=await fetch(base,{headers:{Authorization:`Key ${key}`}});
  const result=await resultResponse.json().catch(()=>({}));
  if(!resultResponse.ok)throw new Error(result.detail||result.error||"Could not retrieve the rendered video.");
  return{...status,result};
 }
 return status;
}
