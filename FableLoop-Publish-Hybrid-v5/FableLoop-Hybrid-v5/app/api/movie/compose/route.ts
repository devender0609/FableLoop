import {NextRequest,NextResponse} from "next/server";
import {falSubmit} from "@/lib/fal";

export const maxDuration=30;
type Segment={url:string;type:"image"|"video";seconds:number};

export async function POST(req:NextRequest){
 try{
  const{segments}=await req.json() as{segments:Segment[]};
  if(!Array.isArray(segments)||segments.length<2||segments.length>20)return NextResponse.json({error:"Two or more visual scenes are required."},{status:400});
  if(segments.some(s=>!s||typeof s.url!=="string"||!s.url.startsWith("https://")||!["image","video"].includes(s.type)||!Number.isFinite(s.seconds)))return NextResponse.json({error:"One or more timeline scenes are invalid."},{status:400});
  let timestamp=0;
  const tracks=segments.map((segment,index)=>{
   const duration=Math.max(1000,Math.min(10000,Math.round(segment.seconds*1000)));
   const track={id:`scene-${index+1}`,type:segment.type,keyframes:[{timestamp,duration,url:segment.url}]};
   timestamp+=duration;
   return track;
  });
  const data=await falSubmit("fal-ai/ffmpeg-api/compose",{tracks});
  return NextResponse.json({requestId:data.request_id,statusUrl:data.status_url,responseUrl:data.response_url});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Hybrid movie assembly could not start."},{status:502})}
}
