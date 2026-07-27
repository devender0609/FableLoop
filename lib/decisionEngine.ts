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
  clinicalPattern: string;
  imagingAssociation: string;
  concordanceLabel: "low" | "indeterminate" | "moderate" | "high";
  matchedDomains: number;
  assessableDomains: number;
  support: string[];
  contradictions: string[];
  missing: string[];
  alternatives: string[];
  treatmentOptions: string[];
  fusionAssessment: string;
  summary: string;
  clinicalChecks: { label: string; status: "met" | "review" | "missing" }[];
};

type Root = "L3" | "L4" | "L5" | "S1";

function expectedRoots(input: CaseInput): Root[] {
  // This is an anatomic compatibility aid, not a diagnostic rule. Dermatomes and
  // myotomes overlap, and central/multilevel stenosis cannot be localized from a
  // single dropdown selection.
  if (input.imagingLevel === "multilevel" || input.imagingFinding === "central-stenosis") {
    return ["L3", "L4", "L5", "S1"];
  }

  const exitingRoot: Record<Exclude<CaseInput["imagingLevel"], "multilevel">, Root> = {
    "L3-4": "L3",
    "L4-5": "L4",
    "L5-S1": "L5",
  };
  const traversingRoot: Record<Exclude<CaseInput["imagingLevel"], "multilevel">, Root> = {
    "L3-4": "L4",
    "L4-5": "L5",
    "L5-S1": "S1",
  };

  return input.imagingFinding === "foraminal"
    ? [exitingRoot[input.imagingLevel]]
    : [traversingRoot[input.imagingLevel]];
}

function sideCompatibility(input: CaseInput): "match" | "partial" | "mismatch" {
  if (input.side === input.imagingSide) return "match";
  if (input.imagingSide === "bilateral" && input.side !== "bilateral") return "partial";
  if (input.side === "bilateral" && input.imagingSide !== "bilateral") return "partial";
  return "mismatch";
}

function findingLabel(finding: CaseInput["imagingFinding"]): string {
  return {
    disc: "disc herniation",
    "central-stenosis": "central canal stenosis",
    "lateral-recess": "lateral recess stenosis",
    foraminal: "foraminal stenosis",
  }[finding];
}

export function validateCase(input: CaseInput): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(input.age) || input.age < 18 || input.age > 100) errors.push("Enter an age between 18 and 100 years.");
  if (!Number.isFinite(input.symptomDurationMonths) || input.symptomDurationMonths < 0 || input.symptomDurationMonths > 240) errors.push("Enter symptom duration between 0 and 240 months.");
  if (![input.backPain, input.legPain].every(v => Number.isFinite(v) && v >= 0 && v <= 10)) errors.push("Pain scores must be between 0 and 10.");
  if (!input.patientGoal.trim()) errors.push("Document the patient’s primary functional goal.");
  return errors;
}

export function evaluateCase(input: CaseInput): DecisionOutput {
  const support: string[] = [];
  const contradictions: string[] = [];
  const missing: string[] = [];
  const alternatives: string[] = [];

  // Safety triage is intentionally conservative. The tool does not diagnose CES,
  // infection, or another emergency; it only escalates entered warning features.
  const possibleCes = input.bowelBladderChange || input.saddleAnesthesia;
  const urgency: DecisionOutput["urgency"] = possibleCes ? "emergency" : (input.progressiveWeakness || input.feverOrInfectionRisk) ? "urgent" : "routine";
  const urgencyReason = possibleCes
    ? "New bladder/bowel dysfunction or saddle sensory change may represent cauda equina or another compressive emergency. Arrange immediate clinician assessment and urgent imaging according to the local emergency pathway."
    : input.progressiveWeakness
      ? "Progressive motor weakness requires expedited clinician assessment; timing and imaging depend on severity and trajectory."
      : input.feverOrInfectionRisk
        ? "Fever or material infection risk with spine symptoms requires expedited assessment for infection and other serious causes."
        : "No urgent feature was entered. This does not exclude serious disease when history or examination is incomplete.";

  let matchedDomains = 0;
  let assessableDomains = 0;

  const side = sideCompatibility(input);
  assessableDomains += 1;
  if (side === "match") {
    matchedDomains += 1;
    support.push("Symptom laterality and the selected imaging laterality agree.");
  } else if (side === "partial") {
    contradictions.push("Laterality is only partially concordant; bilateral symptoms and unilateral imaging, or vice versa, require level-by-level review.");
  } else {
    contradictions.push("Symptom laterality does not match the selected imaging abnormality.");
  }

  const roots = expectedRoots(input);
  const isRootPattern = ["L3", "L4", "L5", "S1"].includes(input.painPattern);
  if (isRootPattern) {
    assessableDomains += 1;
    if (roots.includes(input.painPattern as Root)) {
      matchedDomains += 1;
      support.push(`The entered ${input.painPattern} pattern is anatomically compatible with the selected ${input.imagingLevel} ${findingLabel(input.imagingFinding)}.`);
    } else {
      contradictions.push(`The entered ${input.painPattern} pattern is not the usual root relationship for the selected ${input.imagingLevel} ${findingLabel(input.imagingFinding)}. Dermatomal overlap is common, so review the full examination and images.`);
    }
  } else if (input.painPattern === "claudication") {
    assessableDomains += 1;
    if (input.walkingLimit && ["central-stenosis", "lateral-recess"].includes(input.imagingFinding)) {
      matchedDomains += 1;
      support.push("Walking- or standing-limited symptoms are compatible with a stenotic syndrome, but vascular and musculoskeletal mimics still require consideration.");
    } else {
      contradictions.push("The selected claudication pattern is not adequately supported by the entered walking history or imaging type.");
    }
  } else {
    contradictions.push("Predominantly axial low-back pain is nonspecific; the selected imaging finding should not be labeled the pain generator from these fields alone.");
  }

  if (input.motorDeficit !== "none") {
    assessableDomains += 1;
    if (roots.includes(input.motorDeficit)) {
      matchedDomains += 1;
      support.push(`The entered motor deficit is compatible with the selected ${input.motorDeficit} root, recognizing overlap between myotomes.`);
    } else {
      contradictions.push("The motor finding does not localize to the expected root relationship for the selected lesion.");
    }
  } else {
    support.push("No focal motor deficit was entered; a normal motor examination does not exclude radiculopathy or stenosis.");
  }

  if (input.sensoryDeficit !== "none") {
    assessableDomains += 1;
    if (roots.includes(input.sensoryDeficit)) {
      matchedDomains += 1;
      support.push("The entered sensory finding is compatible with the selected root relationship, recognizing dermatomal overlap and limited specificity.");
    } else {
      contradictions.push("The sensory finding does not localize to the expected root relationship for the selected lesion.");
    }
  }

  assessableDomains += 1;
  if (input.hipExamAbnormal) {
    contradictions.push("An abnormal hip examination raises a competing pain generator or hip–spine syndrome.");
    alternatives.push("Hip pathology or hip–spine syndrome");
  } else {
    matchedDomains += 1;
    support.push("No competing hip examination abnormality was entered.");
  }

  if (input.stenosisSeverity === "severe") {
    support.push("Severe narrowing was selected on imaging; severity alone does not prove that the finding is symptomatic.");
  } else if (input.stenosisSeverity === "mild" && (input.motorDeficit !== "none" || input.legPain >= 7)) {
    contradictions.push("Marked symptoms or objective deficit with only mild reported narrowing should prompt image review and consideration of another level or diagnosis.");
  }

  if (input.injectionResponse === "temporary" || input.injectionResponse === "sustained") {
    support.push("A targeted injection produced benefit, but injection response is not sufficiently specific to establish the symptomatic level by itself.");
  }
  if (input.injectionResponse === "sustained") {
    support.push("Meaningful sustained benefit may favor continued nonsurgical management when neurologic status is stable and the patient’s goals are being met.");
  }

  if (input.walkingLimit) alternatives.push("Vascular claudication when exertional features, pulses, or vascular history are concerning");
  alternatives.push("Peripheral neuropathy or focal peripheral nerve entrapment when examination is non-dermatomal or electrodiagnostic clarification is needed");
  alternatives.push("Sacroiliac, facet-mediated, or myofascial pain when symptoms are predominantly axial or non-radicular");

  if (input.spondylolisthesis && input.dynamicInstability === "unknown") {
    missing.push("Instability has not been characterized. Review standing radiographs and consider dynamic views only when the result is expected to change the operative plan.");
  }
  if (!input.completedPT && urgency === "routine") {
    missing.push("Prior nonsurgical care is incomplete or not documented. This is a workflow check, not a universal prerequisite for surgery.");
  }
  if (input.painPattern === "claudication" && !input.walkingLimit) {
    missing.push("Clarify symptom provocation and relief with standing, walking, sitting, and flexion before labeling neurogenic claudication.");
  }
  if (input.hipExamAbnormal) {
    missing.push("Clarify groin pain, hip range of motion, provocative testing, and whether hip imaging or diagnostic injection would change management.");
  }
  if (input.imagingLevel === "multilevel" || input.imagingFinding === "central-stenosis") {
    missing.push("A single root label is insufficient for multilevel or central disease; document the actual levels, sides, and zones of compression.");
  }

  const ratio = assessableDomains ? matchedDomains / assessableDomains : 0;
  const concordanceLabel: DecisionOutput["concordanceLabel"] =
    contradictions.length >= 3 || ratio < 0.4 ? "low" :
    ratio < 0.6 ? "indeterminate" :
    ratio < 0.85 ? "moderate" : "high";

  const clinicalPattern = input.painPattern === "claudication"
    ? "Possible neurogenic claudication syndrome"
    : input.painPattern === "axial"
      ? "Predominantly axial low-back pain pattern"
      : `Possible ${input.painPattern} radicular pattern`;
  const imagingAssociation = `${input.imagingLevel} ${findingLabel(input.imagingFinding)} (${input.imagingSide}, ${input.stenosisSeverity})`;

  const treatmentOptions: string[] = [];
  if (urgency === "emergency") {
    treatmentOptions.push("Stop the routine pathway and arrange immediate emergency evaluation under the local cauda equina/compressive-neurologic protocol.");
  } else if (urgency === "urgent") {
    treatmentOptions.push("Arrange expedited clinician review and targeted diagnostic workup for the entered neurologic or infection concern.");
  } else {
    if (!input.completedPT) treatmentOptions.push("Consider individualized nonsurgical care when neurologically safe; the appropriate components depend on diagnosis, prior response, contraindications, and patient goals.");
    if (input.injectionResponse === "not-tried" && concordanceLabel !== "high") treatmentOptions.push("A selective injection may be considered only when its result would materially change management; do not treat response as a definitive diagnostic test.");
    if (input.injectionResponse === "sustained") treatmentOptions.push("Continue observation or nonsurgical care while meaningful benefit persists and neurologic status remains stable.");
    if ((concordanceLabel === "moderate" || concordanceLabel === "high") && input.legPain >= input.backPain && input.completedPT && input.injectionResponse !== "sustained") {
      treatmentOptions.push("A surgical consultation for decompression may be reasonable after direct image review, confirmation of the clinical syndrome, discussion of alternatives, and shared decision-making.");
    }
    if (concordanceLabel === "low" || concordanceLabel === "indeterminate") treatmentOptions.push("Reconcile the clinical–imaging mismatch before an invasive procedure or level-specific authorization.");
  }

  let fusionAssessment = "Do not infer a fusion indication from stenosis severity alone. Review instability, deformity, foraminal collapse, anticipated facet resection, prior surgery, mechanical symptoms, bone health, and patient-specific risk.";
  if (input.dynamicInstability === "present") {
    fusionAssessment = "Documented motion may support considering fusion in context, but no single instability checkbox establishes an indication. Confirm measurement quality, symptoms, deformity, decompression-related destabilization, and patient-specific risks.";
  } else if (input.spondylolisthesis && input.dynamicInstability === "unknown") {
    fusionAssessment = "The decompression-versus-fusion decision remains unresolved. Stable low-grade degenerative spondylolisthesis may be managed with decompression alone in selected patients; fusion may be considered when instability, deformity, foraminal collapse, or expected iatrogenic instability is clinically important.";
  } else if (input.dynamicInstability === "absent") {
    fusionAssessment = "Absence of documented dynamic instability may favor considering decompression alone in selected leg-predominant cases, but operative choice still depends on slip characteristics, foraminal disease, deformity, facet resection, prior surgery, and patient factors.";
  }

  const clinicalChecks: DecisionOutput["clinicalChecks"] = [
    { label: "Urgent neurologic and infection features reviewed", status: urgency === "routine" ? "met" : "review" },
    { label: "Clinical and imaging laterality reconciled", status: side === "match" ? "met" : "review" },
    { label: "Root/level relationship reviewed", status: contradictions.some(x => x.includes("usual root") || x.includes("expected root")) ? "review" : "met" },
    { label: "Competing hip source considered", status: input.hipExamAbnormal ? "review" : "met" },
    { label: "Prior nonsurgical care documented", status: input.completedPT ? "met" : "missing" },
    { label: "Patient goal documented", status: input.patientGoal.trim() ? "met" : "missing" },
    { label: "Instability characterized when relevant", status: input.spondylolisthesis && input.dynamicInstability === "unknown" ? "missing" : "met" },
  ];

  const summary = `${clinicalPattern} with an entered imaging association of ${imagingAssociation}. Concordance is classified as ${concordanceLabel} based on ${matchedDomains} of ${assessableDomains} assessable domains; this is a transparent checklist classification, not a validated probability, diagnosis, or treatment recommendation.`;

  return {
    urgency,
    urgencyReason,
    clinicalPattern,
    imagingAssociation,
    concordanceLabel,
    matchedDomains,
    assessableDomains,
    support,
    contradictions,
    missing,
    alternatives,
    treatmentOptions,
    fusionAssessment,
    summary,
    clinicalChecks,
  };
}
