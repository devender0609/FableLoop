import {NextRequest,NextResponse} from "next/server";
import {falSubmit} from "@/lib/fal";

export const maxDuration=30;

export async function POST(req:NextRequest){
 try{
  const{imageUrl,prompt,format,dialogue,outputMode}=await req.json();
  if(typeof imageUrl!=="string"||!imageUrl.startsWith("https://"))return NextResponse.json({error:"A completed storyboard image is required."},{status:400});
  if(typeof prompt!=="string"||prompt.length>5000)return NextResponse.json({error:"Invalid motion prompt."},{status:400});
  const narrated=outputMode==="narrated";
  const audio=!narrated&&typeof dialogue==="string"&&dialogue.trim().length>0;
  const performance=narrated
   ?"The people remain silent with naturally closed mouths. No talking, mouthing words, lip movement, voice or narration. Use expressive eyes, posture and physical action only."
   :audio?`The character says exactly: “${dialogue}”. Natural synchronized speech and restrained acting.`:"No spoken dialogue.";
  const data=await falSubmit("fal-ai/kling-video/v2.6/pro/image-to-video",{
   image_url:imageUrl,
   prompt:`${prompt}. ${performance} Preserve the exact identity, face, clothing and composition of the reference image. Subtle cinematic camera movement.`,
   duration:"5",
   aspect_ratio:format==="9:16"?"9:16":"16:9",
   generate_audio:audio,
   negative_prompt:"subtitles, captions, logos, watermark, identity change, costume change, duplicate people, deformed face, exaggerated mouth movement"
  });
  return NextResponse.json({requestId:data.request_id,statusUrl:data.status_url,responseUrl:data.response_url});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Motion scene could not start."},{status:502})}
}
