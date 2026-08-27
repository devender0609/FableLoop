import{NextRequest,NextResponse}from"next/server";
import{falSubmit}from"@/lib/fal";
export const maxDuration=30;
export async function POST(req:NextRequest){try{const{videoUrl,audioUrl}=await req.json();if(typeof videoUrl!=="string"||typeof audioUrl!=="string"||!videoUrl.startsWith("https://")||!audioUrl.startsWith("https://"))return NextResponse.json({error:"A completed movie and narration track are required."},{status:400});const data=await falSubmit("fal-ai/ffmpeg-api/merge-audio-video",{video_url:videoUrl,audio_url:audioUrl});return NextResponse.json({requestId:data.request_id,statusUrl:data.status_url,responseUrl:data.response_url})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Narration mix could not start."},{status:502})}}
