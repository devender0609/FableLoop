import{NextRequest,NextResponse}from"next/server";
import{falSubmit,modelFor}from"@/lib/fal";
export const maxDuration=30;
export async function POST(req:NextRequest){try{const{videoUrls}=await req.json();if(!Array.isArray(videoUrls)||videoUrls.length<2||videoUrls.length>20||videoUrls.some(x=>typeof x!=="string"||!/^https:\/\//.test(x)))return NextResponse.json({error:"Two or more completed video shots are required."},{status:400});const data=await falSubmit(modelFor("merge"),{video_urls:videoUrls});return NextResponse.json({requestId:data.request_id,statusUrl:data.status_url,responseUrl:data.response_url})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Movie assembly could not start."},{status:502})}}
