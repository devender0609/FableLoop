"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {AlertCircle,Check,ChevronDown,Clapperboard,Download,Film,Loader2,Pause,RotateCcw,Sparkles,WandSparkles} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {Progress} from "@/components/ui/progress";
import {Badge} from "@/components/ui/badge";
import {Alert,AlertDescription,AlertTitle} from "@/components/ui/alert";
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from "@/components/ui/accordion";

type Shot={id:number;title:string;seconds:number;prompt:string;dialogue:string;status:"waiting"|"queued"|"rendering"|"ready"|"failed";requestId?:string;videoUrl?:string;error?:string};
type Plan={title:string;logline:string;style:string;characterBible:string;shots:Shot[]};
type Stage="idea"|"planning"|"review"|"rendering"|"merging"|"complete"|"error";

const examples=[
 "A retired astronaut discovers a tiny rocket growing in her garden. Make it emotional, hopeful and cinematic.",
 "A detective follows a red umbrella through rainy Mumbai and uncovers a surprising family secret.",
 "Two school friends enter a hidden library where unfinished stories come alive after midnight."
];

const stageCopy:Record<Stage,string>={
 idea:"Describe your movie",planning:"Writing screenplay",review:"Review the shot plan",rendering:"Generating cinematic shots",merging:"Assembling your movie",complete:"Your movie is ready",error:"Production stopped"
};

export default function Home(){
 const[idea,setIdea]=useState(""),[characters,setCharacters]=useState(""),[style,setStyle]=useState("Cinematic realism"),[format,setFormat]=useState("16:9"),[length,setLength]=useState("30"),[stage,setStage]=useState<Stage>("idea"),[plan,setPlan]=useState<Plan|null>(null),[movieUrl,setMovieUrl]=useState(""),[error,setError]=useState(""),[configured,setConfigured]=useState<boolean|null>(null);
 const stop=useRef(false);
 useEffect(()=>{fetch("/api/movie/config").then(r=>r.json()).then(x=>setConfigured(Boolean(x.configured))).catch(()=>setConfigured(false));return()=>{stop.current=true}},[]);
 const ready=plan?.shots.filter(s=>s.status==="ready").length||0,total=plan?.shots.length||0;
 const progress=stage==="planning"?8:stage==="review"?15:stage==="rendering"?(15+(ready/Math.max(total,1))*72):stage==="merging"?92:stage==="complete"?100:0;
 const cost=useMemo(()=>{const seconds=Number(length);return{low:(seconds*.07).toFixed(2),high:(seconds*.40).toFixed(2)}},[length]);

 async function planMovie(){
  if(idea.trim().length<12){setError("Give FableLoop a little more detail about the movie.");return}
  setError("");setStage("planning");setMovieUrl("");
  try{const r=await fetch("/api/movie/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idea,characters,style,format,length:Number(length)})});const data=await r.json();if(!r.ok)throw new Error(data.error||"Could not plan the movie.");setPlan(data);setStage("review")}catch(e){setError(e instanceof Error?e.message:"Could not plan the movie.");setStage("error")}
 }
 function updateShot(id:number,patch:Partial<Shot>){setPlan(p=>p?{...p,shots:p.shots.map(s=>s.id===id?{...s,...patch}:s)}:p)}
 async function render(){
  if(!plan)return;if(!configured){setError("Add FAL_KEY in Vercel Environment Variables before rendering a real movie.");setStage("error");return}
  stop.current=false;setError("");setStage("rendering");const completed:string[]=[];
  for(const shot of plan.shots){
   if(stop.current)return;
   try{
    updateShot(shot.id,{status:"queued"});
    const submit=await fetch("/api/movie/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:shot.prompt,dialogue:shot.dialogue,seconds:shot.seconds,format})});
    const job=await submit.json();if(!submit.ok)throw new Error(job.error||"Shot submission failed.");
    updateShot(shot.id,{status:"rendering",requestId:job.requestId});
    let done=false;
    for(let attempt=0;attempt<120&&!done;attempt++){
     if(stop.current)return;
     await new Promise(r=>setTimeout(r,5000));
     const status=await fetch(`/api/movie/status?requestId=${encodeURIComponent(job.requestId)}`);
     const data=await status.json();if(!status.ok)throw new Error(data.error||"Render status failed.");
     if(data.status==="COMPLETED"){if(!data.videoUrl)throw new Error("Provider completed without a video.");completed.push(data.videoUrl);updateShot(shot.id,{status:"ready",videoUrl:data.videoUrl});done=true}
     else if(data.status==="FAILED")throw new Error(data.error||"Provider could not render this shot.");
    }
    if(!done)throw new Error("This shot exceeded the render time limit.");
   }catch(e){updateShot(shot.id,{status:"failed",error:e instanceof Error?e.message:"Shot failed"});setError(`“${shot.title}” failed. You can return to the plan and render again.`);setStage("error");return}
  }
  setStage("merging");
  try{
   const r=await fetch("/api/movie/merge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({videoUrls:completed})});const job=await r.json();if(!r.ok)throw new Error(job.error||"Could not assemble the movie.");
   for(let attempt=0;attempt<80;attempt++){await new Promise(x=>setTimeout(x,3000));const s=await fetch(`/api/movie/status?requestId=${encodeURIComponent(job.requestId)}&kind=merge`);const data=await s.json();if(data.status==="COMPLETED"){if(!data.videoUrl)throw new Error("Movie merge finished without a file.");setMovieUrl(data.videoUrl);setStage("complete");return}if(data.status==="FAILED")throw new Error(data.error||"Movie assembly failed.")}
   throw new Error("Movie assembly exceeded the time limit.");
  }catch(e){setError(e instanceof Error?e.message:"Movie assembly failed.");setStage("error")}
 }
 function reset(){stop.current=true;setPlan(null);setMovieUrl("");setError("");setStage("idea")}

 return <main className="min-h-screen bg-[#0b0c11] text-[#f5f3ef]">
  <header className="border-b border-white/10 bg-[#0b0c11]/90 backdrop-blur"><div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between px-5 lg:px-8"><button onClick={reset} className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#ff5d45] shadow-[0_8px_30px_rgba(255,93,69,.22)]"><Clapperboard size={19}/></span><span className="text-xl font-bold tracking-[-.04em]">FableLoop <em className="font-normal text-white/45">Cinema</em></span></button><div className="flex items-center gap-3"><span className={`size-2 rounded-full ${configured?"bg-emerald-400":"bg-amber-400"}`}/><span className="hidden text-xs text-white/55 sm:inline">{configured?"Movie engine connected":"Setup mode"}</span><Badge className="border-white/10 bg-white/5 text-white hover:bg-white/5">v2.0</Badge></div></div></header>
  <div className="mx-auto grid max-w-[1380px] lg:grid-cols-[260px_1fr]">
   <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-white/10 px-5 py-8 lg:block"><p className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-white/35">Production</p>{(["idea","planning","review","rendering","merging","complete"] as Stage[]).map((s,i)=>{const current=(["idea","planning","review","rendering","merging","complete"] as Stage[]).indexOf(stage),pos=i;return <div key={s} className="relative flex gap-3 pb-7"><span className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs ${pos<current||stage==="complete"?"border-[#ff725e] bg-[#ff5d45] text-white":pos===current?"border-white bg-white text-black":"border-white/15 bg-[#11131a] text-white/35"}`}>{pos<current||stage==="complete"?<Check size={14}/>:i+1}</span>{i<5&&<span className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px bg-white/10"/>}<div><p className={`pt-1 text-sm font-semibold ${pos<=current?"text-white":"text-white/30"}`}>{stageCopy[s]}</p>{s==="rendering"&&plan?<p className="mt-1 text-xs text-white/35">{ready}/{total} shots</p>:null}</div></div>})}</aside>
   <section className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
    <div className="mx-auto max-w-5xl">
     <div className="mb-8 flex items-start justify-between gap-6"><div><p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-[#ff765f]">AI MOVIE STUDIO</p><h1 className="text-4xl font-bold leading-none tracking-[-.05em] sm:text-5xl">{stageCopy[stage]}</h1></div>{stage!=="idea"&&<Button variant="outline" onClick={reset} className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><RotateCcw/>New movie</Button>}</div>
     {error&&<Alert className="mb-6 border-red-400/25 bg-red-400/10 text-red-100"><AlertCircle/><AlertTitle>Production message</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
     {stage==="idea"&&<IdeaForm idea={idea} setIdea={setIdea} characters={characters} setCharacters={setCharacters} style={style} setStyle={setStyle} format={format} setFormat={setFormat} length={length} setLength={setLength} cost={cost} configured={configured} onPlan={planMovie}/>}
     {stage==="planning"&&<Loading title="Writing your screenplay" text="Building the cast bible, dialogue, action, camera direction and connected shot plan."/>}
     {(stage==="review"||stage==="rendering"||stage==="merging"||stage==="error")&&plan&&<Production plan={plan} setPlan={setPlan} stage={stage} progress={progress} ready={ready} total={total} onRender={render}/>}
     {stage==="complete"&&plan&&movieUrl&&<Finished plan={plan} movieUrl={movieUrl} onReset={reset}/>}
    </div>
   </section>
  </div>
 </main>
}

function IdeaForm(p:{idea:string;setIdea:(x:string)=>void;characters:string;setCharacters:(x:string)=>void;style:string;setStyle:(x:string)=>void;format:string;setFormat:(x:string)=>void;length:string;setLength:(x:string)=>void;cost:{low:string;high:string};configured:boolean|null;onPlan:()=>void}){
 return <div className="grid gap-6 lg:grid-cols-[1fr_310px]"><div className="overflow-hidden rounded-[26px] border border-white/10 bg-[#13151d] shadow-2xl"><div className="p-6 sm:p-8"><Label className="mb-3 block text-sm font-bold">Tell us the movie you imagine</Label><Textarea value={p.idea} onChange={e=>p.setIdea(e.target.value)} placeholder="A detective follows a red umbrella through rainy Mumbai and uncovers a surprising family secret…" className="min-h-44 resize-none rounded-2xl border-white/10 bg-[#0d0f15] p-5 text-base leading-7 text-white placeholder:text-white/25"/><div className="mt-3 flex flex-wrap gap-2">{examples.map((x,i)=><button key={x} onClick={()=>p.setIdea(x)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45 hover:border-[#ff765f] hover:text-white">Try concept {i+1}</button>)}</div></div><div className="border-t border-white/10 p-6 sm:p-8"><Label className="mb-3 block text-sm font-bold">Important characters <span className="font-normal text-white/35">(optional)</span></Label><Input value={p.characters} onChange={e=>p.setCharacters(e.target.value)} placeholder="Maya, 28, determined detective, red coat…" className="h-12 rounded-xl border-white/10 bg-[#0d0f15] text-white"/></div><div className="flex flex-col justify-between gap-4 border-t border-white/10 bg-white/[.025] p-6 sm:flex-row sm:items-center sm:p-8"><p className="max-w-md text-xs leading-5 text-white/40">FableLoop creates a screenplay first. You review every shot before paid video rendering begins.</p><Button onClick={p.onPlan} className="h-12 rounded-xl bg-[#ff5d45] px-6 font-bold hover:bg-[#e84d37]"><WandSparkles/>Develop movie</Button></div></div>
 <aside className="space-y-4"><div className="rounded-2xl border border-white/10 bg-[#13151d] p-5"><p className="mb-4 text-xs font-bold uppercase tracking-wider text-white/35">Direction</p><Pick label="Visual style" value={p.style} set={p.setStyle} values={["Cinematic realism","3D animated film","Stylized graphic novel","Warm family cinema","Dark atmospheric thriller"]}/><div className="mt-4 grid grid-cols-2 gap-3"><Pick label="Format" value={p.format} set={p.setFormat} values={["16:9","9:16"]}/><Pick label="Length" value={p.length} set={p.setLength} values={["15","30","45","60"]} suffix=" sec"/></div></div><div className="rounded-2xl border border-white/10 bg-[#13151d] p-5"><div className="flex items-center justify-between"><span className="text-sm text-white/60">Estimated provider cost</span><b>${p.cost.low}–${p.cost.high}</b></div><p className="mt-2 text-xs leading-5 text-white/35">Estimate only. Model price, retries and shot duration determine the actual charge.</p></div>{p.configured===false&&<Alert className="border-amber-400/20 bg-amber-400/10 text-amber-100"><AlertCircle/><AlertTitle>Setup required</AlertTitle><AlertDescription>Add FAL_KEY in Vercel before rendering. Planning still works.</AlertDescription></Alert>}</aside></div>
}
function Pick({label,value,set,values,suffix=""}:{label:string;value:string;set:(x:string)=>void;values:string[];suffix?:string}){return <div><Label className="mb-2 block text-xs text-white/45">{label}</Label><Select value={value} onValueChange={x=>x&&set(x)}><SelectTrigger className="w-full border-white/10 bg-[#0d0f15] text-white"><SelectValue/></SelectTrigger><SelectContent>{values.map(x=><SelectItem key={x} value={x}>{x}{suffix}</SelectItem>)}</SelectContent></Select></div>}
function Loading({title,text}:{title:string;text:string}){return <div className="rounded-[26px] border border-white/10 bg-[#13151d] p-12 text-center sm:p-20"><span className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-[#ff5d45]/15 text-[#ff765f]"><Loader2 className="animate-spin" size={30}/></span><h2 className="text-2xl font-bold">{title}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/45">{text}</p></div>}
function Production({plan,setPlan,stage,progress,ready,total,onRender}:{plan:Plan;setPlan:(p:Plan)=>void;stage:Stage;progress:number;ready:number;total:number;onRender:()=>void}){
 const editable=stage==="review"||stage==="error";return <div className="grid gap-6 xl:grid-cols-[1fr_320px]"><div><div className="mb-5 rounded-2xl border border-white/10 bg-[#13151d] p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">{plan.title}</h2><p className="mt-2 text-sm leading-6 text-white/45">{plan.logline}</p></div><Badge className="bg-[#ff5d45]/15 text-[#ff8978] hover:bg-[#ff5d45]/15">{plan.style}</Badge></div></div><Accordion type="multiple" defaultValue={plan.shots.map(s=>String(s.id))} className="space-y-3">{plan.shots.map((shot,i)=><AccordionItem key={shot.id} value={String(shot.id)} className="rounded-2xl border border-white/10 bg-[#13151d] px-5"><AccordionTrigger className="hover:no-underline"><div className="flex min-w-0 flex-1 items-center gap-4 text-left"><ShotStatus status={shot.status}/><div className="min-w-0"><p className="truncate font-bold">Shot {i+1}: {shot.title}</p><p className="mt-1 text-xs text-white/35">{shot.seconds} seconds · {shot.dialogue?"Dialogue + native audio":"Action + native audio"}</p></div></div><ChevronDown className="ml-2 size-4 text-white/30"/></AccordionTrigger><AccordionContent><div className="grid gap-4 pb-3"><div><Label className="mb-2 block text-xs text-white/35">Cinematic prompt</Label><Textarea value={shot.prompt} disabled={!editable} onChange={e=>setPlan({...plan,shots:plan.shots.map(s=>s.id===shot.id?{...s,prompt:e.target.value}:s)})} className="min-h-28 border-white/10 bg-[#0d0f15] text-sm leading-6 text-white disabled:opacity-80"/></div>{shot.dialogue&&<div><Label className="mb-2 block text-xs text-white/35">Spoken dialogue</Label><Input value={shot.dialogue} disabled={!editable} onChange={e=>setPlan({...plan,shots:plan.shots.map(s=>s.id===shot.id?{...s,dialogue:e.target.value}:s)})} className="border-white/10 bg-[#0d0f15] text-white"/></div>}{shot.videoUrl&&<video src={shot.videoUrl} controls className="aspect-video w-full rounded-xl bg-black"/>}{shot.error&&<p className="text-xs text-red-300">{shot.error}</p>}</div></AccordionContent></AccordionItem>)}</Accordion></div>
 <aside className="space-y-4"><div className="rounded-2xl border border-white/10 bg-[#13151d] p-5"><p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/35">Character continuity</p><p className="text-sm leading-6 text-white/60">{plan.characterBible}</p></div>{stage!=="review"&&<div className="rounded-2xl border border-white/10 bg-[#13151d] p-5"><div className="mb-3 flex justify-between text-sm"><span>Production progress</span><b>{Math.round(progress)}%</b></div><Progress value={progress} className="h-2"/><p className="mt-3 text-xs text-white/35">{ready}/{total} cinematic shots complete</p></div>}<Button onClick={onRender} disabled={!editable} className="h-12 w-full bg-[#ff5d45] font-bold hover:bg-[#e84d37]">{stage==="error"?<><RotateCcw/>Render again</>:<><Film/>Render real movie</>}</Button><p className="text-center text-xs leading-5 text-white/30">Rendering starts paid provider jobs. Keep this tab open while the movie is produced.</p></aside></div>
}
function ShotStatus({status}:{status:Shot["status"]}){const map={waiting:["bg-white/5 text-white/35",Film],queued:["bg-amber-400/10 text-amber-300",Pause],rendering:["bg-blue-400/10 text-blue-300",Loader2],ready:["bg-emerald-400/10 text-emerald-300",Check],failed:["bg-red-400/10 text-red-300",AlertCircle]} as const;const[c,I]=map[status];return <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${c}`}><I size={18} className={status==="rendering"?"animate-spin":""}/></span>}
function Finished({plan,movieUrl,onReset}:{plan:Plan;movieUrl:string;onReset:()=>void}){return <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#13151d]"><video src={movieUrl} controls autoPlay className="aspect-video w-full bg-black"/><div className="flex flex-col justify-between gap-5 p-6 sm:flex-row sm:items-center sm:p-8"><div><h2 className="text-2xl font-bold">{plan.title}</h2><p className="mt-2 text-sm text-white/45">All {plan.shots.length} shots assembled into one downloadable MP4.</p></div><div className="flex gap-3"><Button variant="outline" onClick={onReset} className="border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white"><Sparkles/>New movie</Button><Button asChild className="bg-[#ff5d45] hover:bg-[#e84d37]"><a href={movieUrl} download><Download/>Download MP4</a></Button></div></div></div>}
