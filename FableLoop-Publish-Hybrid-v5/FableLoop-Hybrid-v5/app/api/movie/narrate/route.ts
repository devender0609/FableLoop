import{NextRequest,NextResponse}from"next/server";
import{falSubmit}from"@/lib/fal";
export const maxDuration=30;
const voices={
 "american-woman":{model:"fal-ai/kokoro/american-english",voice:"af_heart"},
 "american-man":{model:"fal-ai/kokoro/american-english",voice:"am_michael"},
 "british-woman":{model:"fal-ai/kokoro/british-english",voice:"bf_emma"},
 "british-man":{model:"fal-ai/kokoro/british-english",voice:"bm_fable"},
 "hindi-woman":{model:"fal-ai/kokoro/hindi",voice:"hf_alpha"},
 "hindi-man":{model:"fal-ai/kokoro/hindi",voice:"hm_omega"},
 "spanish-woman":{model:"fal-ai/kokoro/spanish",voice:"ef_dora"},
 "spanish-man":{model:"fal-ai/kokoro/spanish",voice:"em_alex"}
}as const;
export async function POST(req:NextRequest){try{const{text,voice}=await req.json(),selected=voices[voice as keyof typeof voices]||voices["american-woman"];if(typeof text!=="string"||text.trim().length<2||text.length>5000)return NextResponse.json({error:"Narration must contain 2 to 5,000 characters."},{status:400});const data=await falSubmit(selected.model,{prompt:text.trim(),voice:selected.voice,speed:1});return NextResponse.json({requestId:data.request_id,statusUrl:data.status_url,responseUrl:data.response_url})}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Narration could not start."},{status:502})}}
