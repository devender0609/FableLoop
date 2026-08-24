# SpineMuscle AI v14.1 — GitHub + Vercel Cloud Package

This repository contains everything needed for the **web interface** and the **real MRI inference service**.

## Architecture

```text
User browser
    |
    | DICOM upload (direct)
    v
Inference container
dcm2niix + MuscleMap + metrics + PVMQ
    ^
    | job status / QC images / results
    |
Vercel-hosted SpineMuscle UI
```

The Vercel site and inference service still appear to the user as one workflow. The separate inference service is an implementation detail.

## Repository layout

```text
/
├─ index.html                 Vercel frontend
├─ assets/
│  ├─ styles.css
│  └─ app.js
├─ api/
│  └─ config.js               exposes INFERENCE_API_URL to the frontend
├─ config.js                  local-development fallback
├─ vercel.json
├─ package.json
├─ inference/
│  ├─ app.py                  FastAPI job/inference service
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ railway.toml
│  ├─ render.yaml
│  └─ README.md
└─ scripts/
   ├─ push_to_github.ps1
   └─ vercel_deploy.ps1
```

## Important: Vercel alone is not the model server

The working prototype depends on `dcm2niix`, PyTorch/MuscleMap, downloaded model parameters, and multi-minute inference. The **frontend is Vercel-ready**, but the real segmentation must run on a container/VM/GPU service.

Do not deploy only the Vercel frontend and expect segmentation to run until `INFERENCE_API_URL` points to a working inference service.

---

# Deployment order

## 1. Push this folder to GitHub

From PowerShell inside the extracted folder:

```powershell
git init
git add .
git commit -m "SpineMuscle AI v14 cloud"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/SpineMuscle.git
git push -u origin main
```

A helper script is also included:

```powershell
.\scripts\push_to_github.ps1 -RepoUrl "https://github.com/YOUR_USERNAME/SpineMuscle.git"
```

## 2. Deploy the inference service

Use the **same GitHub repository** on a Docker-capable hosting provider.

The Dockerfile is:

```text
inference/Dockerfile
```

### Railway

Create a new Railway project from the GitHub repo and point deployment to the Dockerfile. The included `inference/railway.toml` documents the intended configuration.

### Render

The included `inference/render.yaml` can be used as a starting blueprint.

After deployment, confirm:

```text
https://YOUR-INFERENCE-SERVICE/health
```

returns a JSON response with:

```text
"ok": true
"dcm2niix": true
"mm_segment": true
```

Copy the inference service URL.

## 3. Deploy the frontend to Vercel

Import the same GitHub repository into Vercel.

Set this environment variable:

```text
INFERENCE_API_URL=https://YOUR-INFERENCE-SERVICE
```

Then deploy.

Vercel will host `index.html` and the static assets. `/api/config` reads the environment variable and sends only the inference URL to the browser.

## 4. Restrict CORS

After your Vercel URL is known, set this environment variable on the inference service:

```text
ALLOWED_ORIGINS=https://YOUR-VERCEL-DOMAIN.vercel.app
```

For initial development only, `*` is supported.

---

# What v14 does

- complete DICOM folder upload;
- direct upload to inference service;
- asynchronous job processing;
- real progress stages instead of a frozen screen;
- dcm2niix conversion;
- real MuscleMap abdomen segmentation;
- PVMQ-focused mode: four superior stacks, 75% overlap;
- full mode: five stacks, 90% overlap;
- segmentation QC overlays;
- multifidus/erector-spinae CSA and T2 signal measurements;
- paper-aligned four-level PVMQ numerator;
- draggable L3 CSF ROI;
- PVMQ calculation;
- metrics and PVMQ CSV export;
- paper-context interpretation without inventing a universal cutoff or individual PJK probability.

---

# Paper alignment

The app is designed to follow the supplied PVMQ manuscript's measurement concept:

- axial T2 MRI;
- L1/2 through L4/5;
- bilateral multifidus and erector spinae;
- four-level signal averaging;
- normalization to L3 CSF.

Implementation differences remain:

- automated MuscleMap masks instead of validated expert PACS contours;
- automated/provisional level mapping;
- operational CSF ROI implementation.

Therefore outputs are labeled **research-QC**, not clinically validated predictions.

---

# Performance

The slow part is MuscleMap inference.

For faster deployment:
- choose the default PVMQ-focused mode;
- use 75% sliding-window overlap;
- use a persistent inference instance so model weights remain cached;
- consider a GPU-backed container if compatible with your MuscleMap/PyTorch deployment.

The frontend uses job polling so the Vercel page remains responsive while inference runs.

---

# Security / PHI

This is a research prototype and does not include authentication, HIPAA controls, encryption-key management, audit logging, BAA coverage, retention policy, or automatic DICOM de-identification.

Do **not** deploy identifiable clinical DICOMs to a public prototype server.

Before clinical use, add:
- authentication and authorization;
- DICOM de-identification;
- encrypted storage/transport controls;
- access logging;
- explicit retention/deletion policy;
- infrastructure and contractual controls appropriate to your institution.

---

# Local frontend testing

Install the Vercel CLI:

```powershell
npm install
npm run dev
```

Set:

```text
INFERENCE_API_URL=http://localhost:8080
```

in `.env.local`, or temporarily edit `config.js`:

```javascript
window.SPINE_INFERENCE_URL = "http://localhost:8080";
```

For the backend, see `inference/README.md`.


## v14.1 inference connection fix

The Vercel page no longer depends exclusively on `INFERENCE_API_URL`.

If the environment variable is missing or wrong:

1. Open the deployed SpineMuscle page.
2. Click **Configure** beside “Inference service unavailable”.
3. Paste the public inference-service URL.
4. Click **Save & test**.

The URL is stored only in that browser's `localStorage` and the app verifies:

- `/health` is reachable;
- `dcm2niix` is available;
- `mm_segment` is available.

For production, still set `INFERENCE_API_URL` in Vercel:

**Project → Settings → Environment Variables → Add**

Then redeploy. Vercel environment variables take effect on a new deployment.

The manual browser configuration is intended for deployment testing and troubleshooting.
