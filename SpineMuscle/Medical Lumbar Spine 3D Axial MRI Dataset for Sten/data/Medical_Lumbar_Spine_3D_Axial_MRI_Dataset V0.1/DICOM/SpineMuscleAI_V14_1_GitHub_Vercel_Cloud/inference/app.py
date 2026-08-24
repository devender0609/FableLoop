import os, json, math, shutil, subprocess, time, uuid, threading, traceback
from pathlib import Path
from typing import List
import numpy as np
import pandas as pd
import nibabel as nib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

APP_VERSION="14.0"
WORK_ROOT=Path(os.environ.get("SPINEMUSCLE_WORKDIR","/tmp/spinemuscle"))
WORK_ROOT.mkdir(parents=True,exist_ok=True)

LABELS={1:"Right Multifidus",2:"Left Multifidus",3:"Right Erector Spinae",4:"Left Erector Spinae",5:"Right Psoas Major",6:"Left Psoas Major",7:"Right Quadratus Lumborum",8:"Left Quadratus Lumborum"}
PVMQ_LABELS=[1,2,3,4]
LEVELS_5=["L1/2","L2/3","L3/4","L4/5","L5/S1"]
PVMQ_LEVELS=["L1/2","L2/3","L3/4","L4/5"]

app=FastAPI(title="SpineMuscle Inference API",version=APP_VERSION)
origins=[x.strip() for x in os.environ.get("ALLOWED_ORIGINS","*").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins or ["*"],allow_credentials=False,allow_methods=["*"],allow_headers=["*"])

jobs={}
jobs_lock=threading.Lock()

def safe_name(n):
    return Path(n.replace("\\","/")).name.replace("..","_")

def write_job(job_id,**kwargs):
    with jobs_lock:
        jobs.setdefault(job_id,{})
        jobs[job_id].update(kwargs)
        jobs[job_id]["updated_at"]=time.time()

def read_job(job_id):
    with jobs_lock:
        return dict(jobs.get(job_id,{}))

def run(cmd,cwd=None):
    p=subprocess.run([str(x) for x in cmd],cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if p.returncode!=0:
        raise RuntimeError(f"Command failed ({p.returncode}): {' '.join(map(str,cmd))}\n{p.stdout[-8000:]}")
    return p.stdout

def json_safe(obj):
    if isinstance(obj,dict):return {str(k):json_safe(v) for k,v in obj.items()}
    if isinstance(obj,(list,tuple)):return [json_safe(v) for v in obj]
    if isinstance(obj,np.ndarray):return obj.tolist()
    if isinstance(obj,np.generic):return obj.item()
    if isinstance(obj,Path):return str(obj)
    if isinstance(obj,float) and (math.isnan(obj) or math.isinf(obj)):return None
    return obj

def stem_nii(p):
    return p.name[:-7] if p.name.endswith(".nii.gz") else p.stem

def load3d(p):
    img=nib.load(str(p));a=np.squeeze(np.asanyarray(img.dataobj))
    if a.ndim!=3:raise ValueError(f"{p.name}: expected 3D image, got {a.shape}")
    return img,a

def center_world_z(img):
    s=img.shape[:3];ijk=np.array([(s[0]-1)/2,(s[1]-1)/2,(s[2]-1)/2,1.0])
    return float((img.affine@ijk)[2])

def display_window(a):
    v=a[np.isfinite(a)]
    if not v.size:return 0,1
    lo,hi=np.percentile(v,[1,99]);return float(lo),float(max(hi,lo+1))

def find_seg(imgp):
    base=stem_nii(imgp)+"_dseg"
    for ext in [".nii.gz",".nii"]:
        p=imgp.parent/(base+ext)
        if p.exists():return p
    hits=list(imgp.parent.glob(base+"*.nii*"))
    return hits[0] if hits else None

def overlay(mri,seg,level,out):
    k=mri.shape[2]//2;im=mri[:,:,k].T;sg=seg[:,:,k].T;lo,hi=display_window(im)
    fig,ax=plt.subplots(figsize=(6.5,6.5));ax.imshow(im,cmap="gray",origin="lower",vmin=lo,vmax=hi)
    ax.imshow(np.ma.masked_where(sg==0,sg),cmap="tab10",origin="lower",alpha=.37,vmin=1,vmax=10)
    ax.set_title(f"{level} | central slice {k}");ax.axis("off");fig.tight_layout();fig.savefig(out,dpi=140);plt.close(fig)
    return k

def csf_reference(img,data,out,crop_half=100):
    k=data.shape[2]//2;sl=data[:,:,k].T;ny,nx=sl.shape;cx,cy=nx//2,ny//2
    x0=max(0,cx-crop_half);x1=min(nx,cx+crop_half);y0=max(0,cy-crop_half);y1=min(ny,cy+crop_half)
    crop=sl[y0:y1,x0:x1];lo,hi=display_window(crop)
    fig=plt.figure(figsize=(6,6),frameon=False);ax=fig.add_axes([0,0,1,1]);ax.imshow(crop,cmap="gray",origin="lower",vmin=lo,vmax=hi);ax.axis("off")
    fig.savefig(out,dpi=160,bbox_inches="tight",pad_inches=0);plt.close(fig)
    return {"slice":int(k),"bounds":[int(x0),int(x1),int(y0),int(y1)]}

def csf_measure(img,data,x,y,radius_mm,outpng,maskout):
    k=data.shape[2]//2;sl=data[:,:,k].T;spacing=float(np.mean(img.header.get_zooms()[:2]));r=max(2.0,radius_mm/max(spacing,1e-9))
    yy,xx=np.ogrid[:sl.shape[0],:sl.shape[1]];mask=((xx-x)**2+(yy-y)**2)<=r**2;vals=sl[mask];vals=vals[np.isfinite(vals)]
    if vals.size<5:raise ValueError("CSF ROI contains too few pixels.")
    mean=float(vals.mean());sd=float(vals.std());cv=float(sd/abs(mean)) if mean else float("inf")
    lo,hi=display_window(sl);fig,ax=plt.subplots(figsize=(7,7));ax.imshow(sl,cmap="gray",origin="lower",vmin=lo,vmax=hi)
    ax.add_patch(plt.Circle((x,y),r,fill=False,linewidth=2));ax.plot([x],[y],marker="+",markersize=13);ax.set_title(f"L3 CSF ROI | mean={mean:.2f} SD={sd:.2f} CV={cv:.3f}")
    ax.set_xlabel("X pixel");ax.set_ylabel("Y pixel");fig.tight_layout();fig.savefig(outpng,dpi=150);plt.close(fig)
    m=np.zeros(data.shape,dtype=np.uint8);m[:,:,k]=mask.T.astype(np.uint8);nib.save(nib.Nifti1Image(m,img.affine,img.header),str(maskout))
    return {"x":float(x),"y":float(y),"slice_index":int(k),"radius_mm":float(radius_mm),"mean_signal":mean,"sd_signal":sd,"cv":cv,"n_pixels":int(vals.size)}

def analyze_worker(job_id,job_dir,mode):
    t0=time.time()
    try:
        upload=job_dir/"upload";nii=job_dir/"nifti";qc=job_dir/"qc"
        nii.mkdir(exist_ok=True);qc.mkdir(exist_ok=True)
        write_job(job_id,status="running",stage="convert",progress=22,message="Converting DICOM series to NIfTI…")

        dcm2niix=shutil.which("dcm2niix")
        mm=shutil.which("mm_segment")
        if not dcm2niix:raise RuntimeError("dcm2niix is not installed in the inference container.")
        if not mm:raise RuntimeError("mm_segment is not installed in the inference container.")

        run([dcm2niix,"-z","y","-f","%p_%s_i%5r","-o",str(nii),str(upload)])
        niftis=sorted([p for p in nii.glob("*.nii*") if "_dseg" not in p.name])
        if not niftis:raise RuntimeError("No NIfTI volumes were created.")

        preliminary=[]
        for p in niftis:
            im,data=load3d(p);preliminary.append({"path":p,"img":im,"data":data,"z":center_world_z(im)})
        preliminary.sort(key=lambda r:r["z"],reverse=True)

        if mode=="full_quality":
            selected=preliminary[:5];overlap="90";mode_label="Full 5-level / 90% overlap"
        else:
            selected=preliminary[:4] if len(preliminary)>=4 else preliminary;overlap="75";mode_label="PVMQ-focused / 75% overlap"

        for i,r in enumerate(selected,1):
            p=r["path"]
            write_job(job_id,status="running",stage="segment",progress=30+int(45*i/max(1,len(selected))),message=f"Segmenting MRI stack {i} of {len(selected)}…")
            if not find_seg(p):
                run([mm,"-i",str(p),"-r","abdomen","-c","auto","-s",overlap],cwd=str(nii))
            if not find_seg(p):
                raise RuntimeError(f"MuscleMap did not create a segmentation for {p.name}.")

        write_job(job_id,status="running",stage="metrics",progress=82,message="Calculating muscle measurements and QC overlays…")

        recs=[]
        for r0 in selected:
            sg=find_seg(r0["path"])
            recs.append({"path":r0["path"],"img":r0["img"],"data":r0["data"],"seg_path":sg,"z":r0["z"]})

        if len(preliminary)>=5 and len(recs)>=4:
            labels=LEVELS_5[:len(recs)] if mode=="full_quality" else PVMQ_LEVELS[:len(recs)]
            mapping=("PROVISIONAL: five stacks mapped superior→inferior to L1/2–L5/S1; human confirmation required."
                     if mode=="full_quality" else
                     "PROVISIONAL: four superior stacks mapped to L1/2–L4/5 for PVMQ; human confirmation required.")
            for r,l in zip(recs,labels):r["level"]=l
        else:
            for i,r in enumerate(recs,1):r["level"]=f"Stack {i}"
            mapping=f"{len(recs)} analyzed stack(s); exact lumbar level mapping requires review."

        csa_rows=[];level_signal=[];overlays=[];l3=None
        for r in recs:
            _,seg=load3d(r["seg_path"]);seg=np.rint(seg).astype(np.int16)
            k=overlay(r["data"],seg,r["level"],qc/f"{r['level'].replace('/','-')}.png")
            overlays.append({"level":r["level"],"url":f"/jobs/{job_id}/files/qc/{r['level'].replace('/','-')}.png"})
            px_area=float(np.prod(r["img"].header.get_zooms()[:2]));per={}
            for lab,name in LABELS.items():
                mask=seg[:,:,k]==lab;n=int(mask.sum());vals=r["data"][:,:,k][mask];vals=vals[np.isfinite(vals)]
                mean_si=float(vals.mean()) if vals.size else None;per[lab]=mean_si
                csa_rows.append({"level":r["level"],"muscle":name,"label":lab,"CSA_cm2":float(n*px_area/100.0),"mean_signal":mean_si})
            if r["level"] in PVMQ_LEVELS:
                vals=[per[x] for x in PVMQ_LABELS if per.get(x) is not None]
                if len(vals)==4:level_signal.append({"level":r["level"],"equal_weight_mean_SI":float(np.mean(vals))})
            if r["level"]=="L3/4":l3=r

        four=float(np.mean([x["equal_weight_mean_SI"] for x in level_signal])) if len(level_signal)==4 else None
        if four is None or l3 is None:raise RuntimeError("Four-level PVMQ muscle signal or L3/4 reference could not be established.")

        pd.DataFrame(csa_rows).to_csv(job_dir/"metrics.csv",index=False)
        ref=csf_reference(l3["img"],l3["data"],qc/"csf_reference.png")
        result={
            "case_id":job_id,"files_uploaded":len([p for p in upload.rglob("*") if p.is_file()]),
            "nifti_stacks":len(niftis),"analyzed_stacks":len(recs),"analysis_mode":mode_label,
            "mapping_status":mapping,"overlays":overlays,"csa_rows":csa_rows,"level_signal":level_signal,
            "four_level_equal_weight_mean_muscle_SI":four,"csf_reference":ref,
            "csf_pixel_spacing_mm":[float(x) for x in l3["img"].header.get_zooms()[:2]],
            "csf_reference_url":f"/jobs/{job_id}/files/qc/csf_reference.png",
            "metrics_url":f"/jobs/{job_id}/files/metrics.csv",
            "elapsed_seconds":round(time.time()-t0,1)
        }
        (job_dir/"result.json").write_text(json.dumps(json_safe(result),indent=2))
        write_job(job_id,status="ready",stage="ready",progress=100,message="Analysis ready for review.",result=json_safe(result))
    except Exception as e:
        write_job(job_id,status="error",stage="error",progress=100,message="Analysis stopped.",error=f"{e}",trace=traceback.format_exc()[-8000:])

class PVMQRequest(BaseModel):
    x: float
    y: float
    radius_mm: float = 3.0

@app.get("/health")
def health():
    return {"ok":True,"version":APP_VERSION,"dcm2niix":bool(shutil.which("dcm2niix")),"mm_segment":bool(shutil.which("mm_segment"))}

@app.post("/jobs")
async def create_job(files: List[UploadFile]=File(...), mode: str=Form("pvmq_fast")):
    if mode not in ("pvmq_fast","full_quality"):mode="pvmq_fast"
    job_id=uuid.uuid4().hex[:16];job_dir=WORK_ROOT/job_id;upload=job_dir/"upload";upload.mkdir(parents=True,exist_ok=True)
    for f in files:
        name=(f.filename or "image.dcm").replace("\\","/").lstrip("/")
        parts=[p for p in Path(name).parts if p not in ("..",".")]
        rel=Path(*parts) if parts else Path("image.dcm")
        dst=upload/rel;dst.parent.mkdir(parents=True,exist_ok=True)
        with open(dst,"wb") as out:
            while True:
                chunk=await f.read(1024*1024)
                if not chunk:break
                out.write(chunk)
    write_job(job_id,status="queued",stage="queued",progress=20,message="Upload complete. Job queued.")
    threading.Thread(target=analyze_worker,args=(job_id,job_dir,mode),daemon=True).start()
    return {"job_id":job_id,"status":"queued"}

@app.get("/jobs/{job_id}")
def job_status(job_id:str):
    j=read_job(job_id)
    if not j:raise HTTPException(404,"Job not found")
    return json_safe(j)

@app.post("/jobs/{job_id}/pvmq")
def calculate_pvmq(job_id:str,req:PVMQRequest):
    job_dir=WORK_ROOT/job_id;result_path=job_dir/"result.json"
    if not result_path.exists():raise HTTPException(409,"Analysis is not ready.")
    result=json.loads(result_path.read_text())
    nii=job_dir/"nifti"
    niftis=sorted([p for p in nii.glob("*.nii*") if "_dseg" not in p.name])
    prelim=[]
    for p in niftis:
        im,data=load3d(p);prelim.append({"path":p,"img":im,"data":data,"z":center_world_z(im)})
    prelim.sort(key=lambda r:r["z"],reverse=True)
    if len(prelim)<3:raise HTTPException(400,"L3/4 stack unavailable.")
    l3=prelim[2]
    try:
        csf=csf_measure(l3["img"],l3["data"],req.x,req.y,req.radius_mm,job_dir/"qc"/"csf_roi.png",job_dir/"CSF_ROI_mask.nii.gz")
    except Exception as e:raise HTTPException(400,str(e))
    numerator=float(result["four_level_equal_weight_mean_muscle_SI"])
    pvmq=float(numerator/csf["mean_signal"])
    out={"PVMQ_paper_aligned_equal_weight":pvmq,"CSF":csf,
         "CSF_QC":"PASS operational homogeneity check" if csf["cv"]<=0.30 else "REVIEW: heterogeneous ROI",
         "csf_roi_url":f"/jobs/{job_id}/files/qc/csf_roi.png","pvmq_url":f"/jobs/{job_id}/files/PVMQ_result.csv",
         "research_status":"Research-QC only; no validated universal risk cutoff applied."}
    pd.DataFrame([{"PVMQ_paper_aligned_equal_weight":pvmq,"four_level_equal_weight_mean_muscle_SI":numerator,
                   "CSF_mean_SI":csf["mean_signal"],"CSF_SD":csf["sd_signal"],"CSF_CV":csf["cv"],"status":"RESEARCH_QC"}]).to_csv(job_dir/"PVMQ_result.csv",index=False)
    return json_safe(out)

@app.get("/jobs/{job_id}/files/{folder}/{filename}")
def get_file(job_id:str,folder:str,filename:str):
    if folder not in ("qc",):raise HTTPException(404,"Invalid folder")
    p=WORK_ROOT/job_id/folder/Path(filename).name
    if not p.exists():raise HTTPException(404,"File not found")
    return FileResponse(p)

@app.get("/jobs/{job_id}/files/{filename}")
def get_root_file(job_id:str,filename:str):
    allowed={"metrics.csv","PVMQ_result.csv"}
    if filename not in allowed:raise HTTPException(404,"File not found")
    p=WORK_ROOT/job_id/filename
    if not p.exists():raise HTTPException(404,"File not found")
    return FileResponse(p,filename=filename)
