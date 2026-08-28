import {NextRequest,NextResponse} from "next/server";
import {falSubmit} from "@/lib/fal";

export const maxDuration=30;

export async function POST(req:NextRequest){
 try{
  const{prompt,format}=await req.json();
  if(typeof prompt!=="string"||prompt.trim().length<20||prompt.length>5000)return NextResponse.json({error:"A valid storyboard prompt is required."},{status:400});
  const data=await falSubmit("fal-ai/flux/schnell",{
   prompt:`${prompt}. Single cinematic frame, professional composition, coherent anatomy, no text, no captions, no logo, no watermark.`,
   image_size:format==="9:16"?"portrait_16_9":"landscape_16_9",
   num_images:1,
   num_inference_steps:4,
   enable_safety_checker:true
  });
  return NextResponse.json({requestId:data.request_id,statusUrl:data.status_url,responseUrl:data.response_url});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Storyboard image could not start."},{status:502})}
}
