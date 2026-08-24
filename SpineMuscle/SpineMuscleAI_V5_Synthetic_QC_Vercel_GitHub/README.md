# SpineMuscle AI V4 — Research Prototype

Static GitHub/Vercel-ready prototype for evidence-grounded preoperative lumbar MRI muscle–bone phenotype review.

## V4 changes
- Accepts de-identified DICOM, JPG, JPEG, and PNG inputs.
- JPG/PNG inputs display directly in the in-browser study preview.
- Screenshots/montages are explicitly labeled non-DICOM and **never generate quantitative MRI measurements automatically**.
- DICOM is treated as the preferred future quantitative input; browser rendering/segmentation still requires an imaging engine.
- Real uploads reset all measurement cards to **Not measured / Awaiting**.
- Manual signal-intensity entry remains available for independently measured PVMQ/VBQ values.
- Synthetic demo case remains separate from patient imaging.

## Deploy
This is a static app. Push all files to GitHub and import the repository into Vercel with Framework Preset `Other`. No build command is required.

## Clinical status
Research prototype only. Not for clinical diagnosis or treatment decisions. No validated automated segmentation or individual PJK/PJF probability model is included.


## V5 synthetic QC mode
If all 8 files from `SpineMuscleAI_Sample_Lumbar_DICOM.zip` are selected together, **Run analysis workflow** returns clearly labeled synthetic fixture results so the full UI can be tested. These are not pixel-derived or clinical measurements. Real DICOM studies still require a connected validated imaging/segmentation backend.
