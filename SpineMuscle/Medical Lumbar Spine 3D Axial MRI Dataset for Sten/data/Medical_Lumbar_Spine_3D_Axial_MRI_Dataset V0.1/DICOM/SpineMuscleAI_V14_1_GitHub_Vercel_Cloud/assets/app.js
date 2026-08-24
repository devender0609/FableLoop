let files=[],state=null,selected=null,isDragging=false,API_BASE="",jobId=null,pollTimer=null;
const $=id=>document.getElementById(id);

function api(path){
  return API_BASE.replace(/\/$/,"") + path;
}
function normalizeApiUrl(v){
  return (v||"").trim().replace(/\/+$/,"");
}
function savedManualApi(){
  try{return normalizeApiUrl(localStorage.getItem("SPINEMUSCLE_INFERENCE_URL")||"")}catch(_){return ""}
}
async function testApiUrl(url){
  const base=normalizeApiUrl(url);
  if(!base) throw new Error("Enter an inference-service URL.");
  const r=await fetch(base+"/health",{cache:"no-store"});
  const j=await r.json().catch(()=>({}));
  if(!r.ok || !j.ok) throw new Error(j.detail||"The service did not pass its /health check.");
  if(!j.dcm2niix || !j.mm_segment){
    throw new Error("The service is reachable, but dcm2niix or mm_segment is missing.");
  }
  return j;
}
async function loadConfig(){
  let envUrl="";
  try{
    const r=await fetch("/api/config",{cache:"no-store"});
    if(r.ok){
      const j=await r.json();
      envUrl=normalizeApiUrl(j.inferenceApiUrl||"");
    }
  }catch(_){}

  const manual=savedManualApi();
  const fallback=normalizeApiUrl(window.SPINE_INFERENCE_URL||"");
  API_BASE=envUrl||manual||fallback;

  $("apiUrlInput").value=API_BASE||"";

  if(!API_BASE){
    connection(false,"No inference service is configured yet. Click Configure after deploying the inference container.");
    $("apiSetupPanel").classList.remove("hidden");
    return;
  }

  try{
    const j=await testApiUrl(API_BASE);
    connection(true,`Connected • MuscleMap ready • dcm2niix ready • API v${j.version||"?"}`);
  }catch(e){
    connection(false,"Configured inference service could not be reached: "+e.message);
    $("apiSetupPanel").classList.remove("hidden");
  }
}
function connection(ok,text){
  const box=$("connectionBox");box.classList.toggle("ok",ok);box.classList.toggle("error",!ok);
  $("connectionText").textContent=text;
  box.querySelector("b").textContent=ok?"Inference service ready":"Inference service unavailable";
  $("analyzeBtn").disabled=!(ok && files.length);
}

function unlockStep(step){
  document.querySelectorAll(".workflowTab").forEach(btn=>{
    const n=Number(btn.dataset.step);
    if(n<=step){btn.disabled=false;btn.classList.remove("locked");if(n<step)btn.classList.add("completed")}
  });
}
function setActiveStep(step){
  document.querySelectorAll(".workflowTab").forEach(btn=>btn.classList.toggle("active",Number(btn.dataset.step)===step));
}
document.querySelectorAll(".workflowTab").forEach(btn=>btn.addEventListener("click",()=>{
  if(btn.disabled)return;
  const el=$(btn.dataset.target);
  if(el&&!el.classList.contains("hidden")){setActiveStep(Number(btn.dataset.step));el.scrollIntoView({behavior:"smooth",block:"start"})}
}));
unlockStep(1);

$("folderInput").addEventListener("change",e=>{
  files=[...e.target.files];
  $("fileCount").textContent=`${files.length} files selected`;
  $("analyzeBtn").disabled=!(API_BASE && files.length);
});

function setStage(name,message,pct){
  const order=["Upload","Convert","Segment","Metrics","Ready"];
  const idx=order.indexOf(name);
  order.forEach((x,i)=>{
    const el=$("stage"+x);
    el.classList.toggle("active",i===idx);
    el.classList.toggle("done",i<idx);
  });
  $("progressTitle").textContent=name==="Ready"?"Analysis ready":name;
  $("progressMessage").textContent=message||"";
  if(typeof pct==="number"){
    $("progressPct").textContent=Math.round(pct)+"%";
    $("progressBar").style.width=Math.max(0,Math.min(100,pct))+"%";
  }
}

$("analyzeBtn").addEventListener("click",()=>{
  if(!API_BASE||!files.length)return;
  $("analyzeBtn").disabled=true;
  $("progressPanel").classList.remove("hidden");
  $("status").textContent="";
  setStage("Upload","Uploading DICOM files to the inference service…",1);

  const fd=new FormData();
  files.forEach(f=>fd.append("files",f,f.webkitRelativePath||f.name));
  const mode=document.querySelector('input[name="analysisMode"]:checked')?.value||"pvmq_fast";
  fd.append("mode",mode);

  const xhr=new XMLHttpRequest();
  xhr.open("POST",api("/jobs"));
  xhr.upload.onprogress=e=>{
    if(e.lengthComputable){
      const p=e.loaded/e.total*18;
      setStage("Upload",`Uploading ${files.length} files…`,p);
    }
  };
  xhr.onload=()=>{
    try{
      const j=JSON.parse(xhr.responseText||"{}");
      if(xhr.status<200||xhr.status>=300)throw new Error(j.detail||j.error||"Upload failed");
      jobId=j.job_id;
      setStage("Convert","Upload complete. Preparing MRI volumes…",20);
      pollJob();
    }catch(e){fail(e.message)}
  };
  xhr.onerror=()=>fail("Network error while uploading the MRI study.");
  xhr.send(fd);
});

async function pollJob(){
  if(!jobId)return;
  try{
    const r=await fetch(api(`/jobs/${jobId}`),{cache:"no-store"});
    const j=await r.json();
    if(!r.ok)throw new Error(j.detail||"Could not read job status");

    if(j.status==="error"){fail(j.error||"Analysis failed");return}
    const stage=(j.stage||"convert").toLowerCase();
    const stageMap={queued:["Convert",22],convert:["Convert",28],segment:["Segment",45],metrics:["Metrics",82],ready:["Ready",100]};
    const [label,base]=stageMap[stage]||["Convert",25];
    const prog=Math.max(base,Number(j.progress||base));
    setStage(label,j.message||"Processing…",prog);

    if(j.status==="ready"){
      state=j.result; showState(state); return;
    }
    pollTimer=setTimeout(pollJob,1800);
  }catch(e){fail(e.message)}
}
function fail(msg){
  if(pollTimer)clearTimeout(pollTimer);
  $("status").textContent="Analysis stopped: "+msg;
  $("analyzeBtn").disabled=false;
  $("progressPanel").classList.add("hidden");
}

function fileUrl(path){return api(path)}
function showState(s){
  $("progressPanel").classList.remove("hidden");
  setStage("Ready",`Analysis complete in ${s.elapsed_seconds||"—"} seconds.`,100);
  $("status").textContent=`${s.files_uploaded} uploaded DICOM files • ${s.analyzed_stacks} stack(s) analyzed • ${s.analysis_mode}`;
  ["reviewCard","metricsCard","csfCard"].forEach(id=>$(id).classList.remove("hidden"));
  unlockStep(4);setActiveStep(2);
  $("mappingText").textContent=s.mapping_status;

  $("overlayGrid").innerHTML=(s.overlays||[]).map(o=>`<figure><img src="${fileUrl(o.url)}" alt="${o.level} segmentation overlay"><figcaption>${o.level}</figcaption></figure>`).join("");
  $("muscleSI").textContent=s.four_level_equal_weight_mean_muscle_SI!=null?Number(s.four_level_equal_weight_mean_muscle_SI).toFixed(2):"—";
  $("levelsAnalyzed").textContent=(s.level_signal||[]).map(x=>x.level).join(", ")||"—";
  $("modeUsed").textContent=s.analysis_mode||"—";

  const mfes=(s.csa_rows||[]).filter(x=>x.label<=4);
  $("metricTable").innerHTML=`<table><thead><tr><th>Level</th><th>Muscle</th><th>CSA (cm²)</th><th>Mean T2 SI</th></tr></thead><tbody>${
    mfes.map(x=>`<tr><td>${x.level}</td><td>${x.muscle}</td><td>${Number(x.CSA_cm2).toFixed(2)}</td><td>${x.mean_signal==null?"—":Number(x.mean_signal).toFixed(1)}</td></tr>`).join("")
  }</tbody></table>`;

  $("metricsDownload").href=fileUrl(s.metrics_url);
  $("csfImg").src=fileUrl(s.csf_reference_url)+"?t="+Date.now();
  $("reviewCard").scrollIntoView({behavior:"smooth",block:"start"});
}

function getRoiRadiusMm(){return Number($("radiusSlider").value)}
function pixelRadiusOnDisplay(){
  if(!state||!state.csf_reference)return 18;
  const [x0,x1]=state.csf_reference.bounds;
  const rect=$("roiLayer").getBoundingClientRect();
  const spacing=(state.csf_pixel_spacing_mm&&state.csf_pixel_spacing_mm.length)?Number(state.csf_pixel_spacing_mm[0]):0.39;
  return Math.max(8,(getRoiRadiusMm()/spacing)*(rect.width/(x1-x0)));
}
function drawMarker(rx,ry){
  const layer=$("roiLayer");let m=layer.querySelector(".roiMarker");
  if(!m){m=document.createElement("div");m.className="roiMarker";layer.appendChild(m)}
  const r=pixelRadiusOnDisplay();m.style.width=2*r+"px";m.style.height=2*r+"px";m.style.left=rx*100+"%";m.style.top=ry*100+"%";
}
function selectPointer(e){
  if(!state||!state.csf_reference)return;
  e.preventDefault();
  const layer=$("roiLayer"),rect=layer.getBoundingClientRect();
  let rx=(e.clientX-rect.left)/rect.width,ry=(e.clientY-rect.top)/rect.height;
  rx=Math.min(1,Math.max(0,rx));ry=Math.min(1,Math.max(0,ry));
  const [x0,x1,y0,y1]=state.csf_reference.bounds;
  selected={x:x0+rx*(x1-x0),y:y1-ry*(y1-y0),rx,ry};
  drawMarker(rx,ry);
  $("xval").textContent=selected.x.toFixed(1);$("yval").textContent=selected.y.toFixed(1);
  $("calcBtn").disabled=false;$("clearRoiBtn").disabled=false;
  $("csfState").textContent="ROI selected";$("csfState").className="badge success";
  $("selectionStatus").textContent="Drag to reposition or adjust the radius before calculating.";
}
$("roiLayer").addEventListener("pointerdown",e=>{isDragging=true;$("roiLayer").setPointerCapture(e.pointerId);selectPointer(e)});
$("roiLayer").addEventListener("pointermove",e=>{if(isDragging)selectPointer(e)});
$("roiLayer").addEventListener("pointerup",e=>{isDragging=false;try{$("roiLayer").releasePointerCapture(e.pointerId)}catch(_){}});
$("roiLayer").addEventListener("pointercancel",()=>isDragging=false);
$("radiusSlider").addEventListener("input",()=>{$("radiusValue").textContent=Number($("radiusSlider").value).toFixed(1)+" mm";if(selected)drawMarker(selected.rx,selected.ry)});
$("clearRoiBtn").addEventListener("click",()=>{
  selected=null;const m=$("roiLayer").querySelector(".roiMarker");if(m)m.remove();
  $("xval").textContent="—";$("yval").textContent="—";$("calcBtn").disabled=true;$("clearRoiBtn").disabled=true;
  $("csfState").textContent="Awaiting selection";$("csfState").className="badge neutral";$("selectionStatus").textContent="No CSF ROI selected yet.";
});

$("calcBtn").addEventListener("click",async()=>{
  if(!selected||!jobId)return;
  $("calcBtn").disabled=true;$("calcBtn").textContent="Calculating PVMQ…";
  try{
    const r=await fetch(api(`/jobs/${jobId}/pvmq`),{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({x:selected.x,y:selected.y,radius_mm:getRoiRadiusMm()})
    });
    const j=await r.json();if(!r.ok)throw new Error(j.detail||j.error||"PVMQ calculation failed");
    $("resultCard").classList.remove("hidden");unlockStep(5);setActiveStep(5);
    $("pvmq").textContent=Number(j.PVMQ_paper_aligned_equal_weight).toFixed(3);
    $("csfMean").textContent=Number(j.CSF.mean_signal).toFixed(1);
    $("csfCv").textContent=Number(j.CSF.cv).toFixed(3);
    $("csfQc").textContent=j.CSF_QC;
    $("csfRoiImg").src=fileUrl(j.csf_roi_url)+"?t="+Date.now();
    $("pvmqDownload").href=fileUrl(j.pvmq_url);
    $("interpretationText").innerHTML=`<b>Research interpretation:</b> PVMQ = ${Number(j.PVMQ_paper_aligned_equal_weight).toFixed(3)}. The source cohort showed higher PVMQ among patients who developed PJK, but no externally validated universal cutoff is applied here.`;
    $("resultCard").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){alert(e.message);$("calcBtn").disabled=false}
  finally{$("calcBtn").textContent="Calculate PVMQ"}
});

document.querySelectorAll('input[name="analysisMode"]').forEach(r=>r.addEventListener("change",()=>{
  document.querySelectorAll(".modeOption").forEach(x=>x.classList.remove("selected"));r.closest(".modeOption")?.classList.add("selected");
}));

const observed=["uploadCard","reviewCard","metricsCard","csfCard","resultCard"];
const io=new IntersectionObserver(entries=>{
  const v=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!v)return;
  const idx=observed.indexOf(v.target.id)+1;const tab=document.querySelector(`.workflowTab[data-step="${idx}"]`);
  if(tab&&!tab.disabled)setActiveStep(idx);
},{rootMargin:"-140px 0px -55% 0px",threshold:[0,.2,.5]});
observed.forEach(id=>{const e=$(id);if(e)io.observe(e)});


$("configureApiBtn").addEventListener("click",()=>{
  $("apiSetupPanel").classList.toggle("hidden");
  $("apiUrlInput").focus();
});
$("saveApiBtn").addEventListener("click",async()=>{
  const url=normalizeApiUrl($("apiUrlInput").value);
  $("saveApiBtn").disabled=true;
  $("apiSetupMessage").textContent="Testing connection…";
  try{
    const j=await testApiUrl(url);
    API_BASE=url;
    try{localStorage.setItem("SPINEMUSCLE_INFERENCE_URL",url)}catch(_){}
    connection(true,`Connected • MuscleMap ready • dcm2niix ready • API v${j.version||"?"}`);
    $("apiSetupMessage").textContent="Connection saved in this browser.";
    $("apiSetupPanel").classList.add("hidden");
  }catch(e){
    connection(false,"Connection test failed: "+e.message);
    $("apiSetupMessage").textContent=e.message;
  }finally{
    $("saveApiBtn").disabled=false;
  }
});
$("clearApiBtn").addEventListener("click",()=>{
  try{localStorage.removeItem("SPINEMUSCLE_INFERENCE_URL")}catch(_){}
  API_BASE="";
  $("apiUrlInput").value="";
  connection(false,"No inference service is configured.");
  $("apiSetupMessage").textContent="Saved browser configuration cleared.";
});

loadConfig();
