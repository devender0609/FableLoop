export type CaseInput = {
  age: number;
  symptomDurationMonths: number;
  side: "right" | "left" | "bilateral";
  painPattern: "L3" | "L4" | "L5" | "S1" | "claudication" | "axial";
  backPain: number;
  legPain: number;
  walkingLimit: boolean;
  motorDeficit: "none" | "L3" | "L4" | "L5" | "S1";
  sensoryDeficit: "none" | "L3" | "L4" | "L5" | "S1";
  imagingLevel: "L3-4" | "L4-5" | "L5-S1" | "multilevel";
  imagingSide: "right" | "left" | "bilateral";
  imagingFinding: "disc" | "central-stenosis" | "lateral-recess" | "foraminal";
  stenosisSeverity: "mild" | "moderate" | "severe";
  spondylolisthesis: boolean;
  dynamicInstability: "unknown" | "absent" | "present";
  completedPT: boolean;
  injectionResponse: "not-tried" | "none" | "temporary" | "sustained";
  progressiveWeakness: boolean;
  bowelBladderChange: boolean;
  saddleAnesthesia: boolean;
  feverOrInfectionRisk: boolean;
  hipExamAbnormal: boolean;
  patientGoal: string;
};

export type DecisionOutput = {
  urgency: "routine" | "urgent" | "emergency";
  urgencyReason: string;
  primaryDiagnosis: string;
  alternatives: string[];
  concordanceScore: number;
  concordanceLabel: "poor" | "uncertain" | "moderate" | "strong";
  support: string[];
  contradictions: string[];
  missing: string[];
  treatmentOptions: string[];
  fusionAssessment: string;
  summary: string;
  clinicalChecks: { label: string; status: "met" | "review" | "missing" }[];
};

function expectedRoots(input: CaseInput): string[] {
  if (input.imagingLevel === "multilevel") return ["L3", "L4", "L5", "S1"];
  if (input.imagingFinding === "central-stenosis") return ["L3", "L4", "L5", "S1"];

  const exitingRoot: Record<Exclude<CaseInput["imagingLevel"], "multilevel">, string> = {
    "L3-4": "L3",
    "L4-5": "L4",
    "L5-S1": "L5",
  };
  const traversingRoot: Record<Exclude<CaseInput["imagingLevel"], "multilevel">, string> = {
    "L3-4": "L4",
    "L4-5": "L5",
    "L5-S1": "S1",
  };

  return input.imagingFinding === "foraminal"
    ? [exitingRoot[input.imagingLevel]]
    : [traversingRoot[input.imagingLevel]];
}

function sideMatches(symptomSide: CaseInput["side"], imagingSide: CaseInput["imagingSide"]): boolean {
  if (symptomSide === imagingSide) return true;
  if (imagingSide === "bilateral") return true;
  return false;
}

function findingLabel(finding: CaseInput["imagingFinding"]): string {
  const labels: Record<CaseInput["imagingFinding"], string> = {
    disc: "disc herniation",
    "central-stenosis": "central canal stenosis",
    "lateral-recess": "lateral recess stenosis",
    foraminal: "foraminal stenosis",
  };
  return labels[finding];
}

export function validateCase(input: CaseInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.age) || input.age < 18 || input.age > 100) errors.push("Enter an age between 18 and 100 years.");
  if (!Number.isFinite(input.symptomDurationMonths) || input.symptomDurationMonths < 0 || input.symptomDurationMonths > 240) errors.push("Enter symptom duration between 0 and 240 months.");
  if (input.backPain < 0 || input.backPain > 10 || input.legPain < 0 || input.legPain > 10) errors.push("Pain scores must be between 0 and 10.");
  if (!input.patientGoal.trim()) errors.push("Document the patient’s primary functional goal.");
  return errors;
}

export function evaluateCase(input: CaseInput): DecisionOutput {
  const support: string[] = [];
  const contradictions: string[] = [];
  const missing: string[] = [];
  let score = 15;

  const emergency = input.bowelBladderChange || input.saddleAnesthesia;
  const urgent = input.progressiveWeakness || input.feverOrInfectionRisk;
  const urgency: DecisionOutput["urgency"] = emergency ? "emergency" : urgent ? "urgent" : "routine";
  const urgencyReason = emergency
    ? "Possible cauda equina or other compressive emergency requires immediate clinician assessment."
    : input.progressiveWeakness
      ? "Progressive motor weakness requires expedited clinician assessment."
      : input.feverOrInfectionRisk
        ? "Possible spinal infection requires expedited clinical and diagnostic review."
        : "No entered emergency or urgent red flags were identified.";

  if (sideMatches(input.side, input.imagingSide)) {
    score += input.side === "bilateral" && input.imagingSide === "bilateral" ? 16 : 18;
    support.push("Symptom laterality is compatible with the imaging abnormality.");
  } else {
    contradictions.push("Symptom laterality does not match the selected imaging abnormality.");
  }

  const roots = expectedRoots(input);
  if (["L3", "L4", "L5", "S1"].includes(input.painPattern)) {
    if (roots.includes(input.painPattern)) {
      score += 22;
      support.push(`The ${input.painPattern} symptom pattern is anatomically compatible with ${input.imagingLevel} ${findingLabel(input.imagingFinding)}.`);
    } else {
      contradictions.push(`The selected ${input.painPattern} pattern is not the expected root for ${input.imagingLevel} ${findingLabel(input.imagingFinding)}.`);
    }
  } else if (input.painPattern === "claudication") {
    if (input.walkingLimit && ["central-stenosis", "lateral-recess"].includes(input.imagingFinding)) {
      score += 20;
      support.push("Walking-limited neurogenic claudication is compatible with lumbar canal or lateral recess stenosis.");
    } else {
      contradictions.push("The entered claudication pattern is not fully supported by the selected imaging finding or walking history.");
    }
  } else {
    contradictions.push("Predominantly axial pain is nonspecific and does not by itself establish a symptomatic nerve-root lesion.");
  }

  if (input.motorDeficit !== "none") {
    if (roots.includes(input.motorDeficit)) {
      score += 16;
      support.push(`Motor deficit localizes to the expected ${input.motorDeficit} root.`);
    } else {
      contradictions.push("Motor deficit localizes to a different root than the selected imaging lesion.");
    }
  } else {
    support.push("No focal motor deficit was entered.");
  }

  if (input.sensoryDeficit !== "none") {
    if (roots.includes(input.sensoryDeficit)) {
      score += 10;
      support.push("Sensory findings support the same nerve-root localization.");
    } else {
      contradictions.push("Sensory findings localize to a different root than the selected imaging lesion.");
    }
  }

  if (input.stenosisSeverity === "severe") {
    score += 9;
    support.push("Imaging demonstrates severe anatomic narrowing.");
  } else if (input.stenosisSeverity === "moderate") {
    score += 5;
    support.push("Imaging demonstrates moderate anatomic narrowing.");
  } else if (input.legPain >= 6 || input.motorDeficit !== "none") {
    contradictions.push("Only mild imaging disease is reported despite clinically important symptoms or deficit.");
  }

  if (input.injectionResponse === "temporary" || input.injectionResponse === "sustained") {
    score += 6;
    support.push("Response to a targeted injection supports the suspected pain generator, although it is not independently diagnostic.");
  }
  if (input.injectionResponse === "sustained") {
    support.push("Sustained injection benefit may support continued observation if function and neurologic status remain acceptable.");
  }

  if (input.hipExamAbnormal) contradictions.push("An abnormal hip examination suggests a competing hip pain generator or hip–spine syndrome.");
  if (input.side === "bilateral" && input.imagingSide !== "bilateral") contradictions.push("Bilateral symptoms are not fully explained by a unilateral imaging lesion.");

  score -= Math.min(24, contradictions.length * 6);
  score = Math.max(0, Math.min(100, score));

  const concordanceLabel: DecisionOutput["concordanceLabel"] = score >= 80 ? "strong" : score >= 60 ? "moderate" : score >= 40 ? "uncertain" : "poor";
  const clinicalPattern = input.painPattern === "claudication"
    ? "neurogenic claudication"
    : input.painPattern === "axial"
      ? "mechanical low-back pain"
      : `${input.painPattern} radiculopathy`;
  const primaryDiagnosis = `${clinicalPattern} associated with ${input.imagingLevel} ${findingLabel(input.imagingFinding)}`;

  const alternatives = [
    input.hipExamAbnormal ? "Hip pathology or hip–spine syndrome" : "Hip pathology if groin pain, restricted motion, or provocative testing is present",
    "Peripheral neuropathy or focal peripheral nerve entrapment",
    input.walkingLimit ? "Vascular claudication if pulses, vascular history, or exertional pattern are concerning" : "Sacroiliac, facet-mediated, or myofascial pain",
  ];

  if (input.spondylolisthesis && input.dynamicInstability === "unknown") {
    missing.push("Dynamic instability is unknown; obtain standing flexion-extension radiographs only if the result would change decompression-versus-fusion planning.");
  }
  if (!input.completedPT && urgency === "routine") missing.push("A documented trial of structured nonsurgical care is incomplete or was not entered.");
  if (!input.patientGoal.trim()) missing.push("The patient’s primary functional goal has not been documented.");
  if (input.painPattern === "claudication" && !input.walkingLimit) missing.push("Clarify walking and standing tolerance because claudication was selected without a walking limitation.");
  if (input.hipExamAbnormal) missing.push("Clarify hip range of motion, groin pain, and whether hip imaging or a diagnostic injection is needed.");

  const treatmentOptions: string[] = [];
  if (urgency === "emergency") {
    treatmentOptions.push("Immediate physician assessment and emergency diagnostic pathway; do not delay for routine decision-support completion.");
  } else if (urgency === "urgent") {
    treatmentOptions.push("Expedited physician assessment and targeted diagnostic workup based on the red flag entered.");
  } else {
    if (!input.completedPT) treatmentOptions.push("Complete or optimize evidence-based nonsurgical care when neurologically safe.");
    if (input.injectionResponse === "not-tried" && concordanceLabel !== "strong") treatmentOptions.push("Consider a selective diagnostic/therapeutic injection when the symptomatic level remains uncertain and the result would change management.");
    if (input.injectionResponse === "sustained") treatmentOptions.push("Continue observation or nonsurgical care while meaningful benefit persists and neurologic status remains stable.");
    if (score >= 60 && input.legPain >= input.backPain && input.completedPT && input.injectionResponse !== "sustained") {
      treatmentOptions.push("Surgical decompression may be reasonable after physician confirmation of concordant pathology, failed appropriate nonsurgical care, and shared decision-making.");
    }
    if (score < 60) treatmentOptions.push("Reconcile the clinical–imaging mismatch before committing to an invasive treatment pathway.");
  }

  let fusionAssessment = "Fusion is not supported by stenosis alone; assess instability, deformity, foraminal collapse, planned facet resection, mechanical back pain, bone health, and patient risk.";
  if (input.dynamicInstability === "present") {
    fusionAssessment = "Fusion may be supported because dynamic instability is documented. Confirm that symptoms, mechanical pain, planned decompression, bone health, and patient-specific risk justify the added procedure.";
  } else if (input.spondylolisthesis && input.dynamicInstability === "unknown") {
    fusionAssessment = "Fusion cannot be finalized because instability has not been assessed. Decompression alone versus fusion should remain an open decision until the missing information is reviewed.";
  } else if (input.dynamicInstability === "absent") {
    fusionAssessment = "Current entries favor considering decompression without fusion when symptoms are leg-predominant and adequate decompression can be achieved without destabilization.";
  }

  const clinicalChecks: DecisionOutput["clinicalChecks"] = [
    { label: "Red flags reviewed", status: urgency === "routine" ? "met" : "review" },
    { label: "Clinical–imaging laterality", status: sideMatches(input.side, input.imagingSide) ? "met" : "review" },
    { label: "Root/level localization", status: contradictions.some(x => x.includes("expected root") || x.includes("different root")) ? "review" : "met" },
    { label: "Prior nonsurgical care", status: input.completedPT ? "met" : "missing" },
    { label: "Patient goal documented", status: input.patientGoal.trim() ? "met" : "missing" },
    { label: "Instability assessed when relevant", status: input.spondylolisthesis && input.dynamicInstability === "unknown" ? "missing" : "met" },
  ];

  const summary = `${primaryDiagnosis}. Clinical–imaging concordance is ${score}/100 (${concordanceLabel}). ${urgencyReason} This prototype organizes entered findings and does not establish a diagnosis or treatment plan.`;

  return { urgency, urgencyReason, primaryDiagnosis, alternatives, concordanceScore: score, concordanceLabel, support, contradictions, missing, treatmentOptions, fusionAssessment, summary, clinicalChecks };
}
