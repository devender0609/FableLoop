import{NextResponse}from"next/server";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({configured:Boolean(process.env.FAL_KEY),model:process.env.FAL_VIDEO_MODEL||"fal-ai/kling-video/v3/pro/text-to-video"})}
