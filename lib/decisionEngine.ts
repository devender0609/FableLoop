export type CaseInput = {
  age: number;
  symptomDurationMonths: number;
  side: "right" | "left" | "bilateral";
  painPattern: "L4" | "L5" | "S1" | "claudication" | "axial";
  backPain: number;
  legPain: number;
  walkingLimit: boolean;
  motorDeficit: "none" | "L4" | "L5" | "S1";
  sensoryDeficit: "none" | "L4" | "L5" | "S1";
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
  primaryDiagnosis: string;
  alternatives: string[];
  concordanceScore: number;
  support: string[];
  contradictions: string[];
  missing: string[];
  treatmentOptions: string[];
  fusionAssessment: string;
  summary: string;
};

const rootForLevel: Record<CaseInput["imagingLevel"], string[]> = {
  "L3-4": ["L4"],
  "L4-5": ["L5"],
  "L5-S1": ["S1"],
  multilevel: ["L4", "L5", "S1"],
};

export function evaluateCase(input: CaseInput): DecisionOutput {
  const support: string[] = [];
  const contradictions: string[] = [];
  const missing: string[] = [];
  let score = 20;

  const redFlagCount = [input.progressiveWeakness, input.bowelBladderChange, input.saddleAnesthesia, input.feverOrInfectionRisk].filter(Boolean).length;
  const urgency: DecisionOutput["urgency"] = input.bowelBladderChange || input.saddleAnesthesia
    ? "emergency"
    : input.progressiveWeakness || input.feverOrInfectionRisk
      ? "urgent"
      : "routine";

  if (input.side === input.imagingSide || input.imagingSide === "bilateral") {
    score += 18;
    support.push("Symptom side matches the imaging abnormality.");
  } else {
    contradictions.push("Symptom side does not match the imaging abnormality.");
  }

  const expectedRoots = rootForLevel[input.imagingLevel];
  if (input.painPattern !== "axial" && input.painPattern !== "claudication" && expectedRoots.includes(input.painPattern)) {
    score += 20;
    support.push(`The ${input.painPattern} symptom pattern is anatomically compatible with ${input.imagingLevel} disease.`);
  } else if (input.painPattern === "claudication" && ["central-stenosis", "lateral-recess"].includes(input.imagingFinding)) {
    score += 18;
    support.push("The walking-limited claudication pattern is compatible with lumbar stenosis.");
  } else if (input.painPattern === "axial") {
    contradictions.push("Predominantly axial pain is less specific for nerve-root compression.");
  } else {
    contradictions.push("The symptom distribution is not clearly explained by the selected imaging level.");
  }

  if (input.motorDeficit !== "none") {
    if (expectedRoots.includes(input.motorDeficit)) {
      score += 16;
      support.push(`Motor deficit is concordant with the expected ${input.motorDeficit} root.`);
    } else {
      contradictions.push("Motor deficit localizes to a different root than the selected imaging level.");
    }
  } else {
    missing.push("No objective motor deficit is documented; confirm a complete lower-extremity motor examination.");
  }

  if (input.sensoryDeficit !== "none" && expectedRoots.includes(input.sensoryDeficit)) {
    score += 10;
    support.push("Sensory findings support the same nerve-root localization.");
  }

  if (input.stenosisSeverity === "severe") {
    score += 10;
    support.push("Imaging demonstrates severe anatomic narrowing.");
  } else if (input.stenosisSeverity === "mild") {
    contradictions.push("Only mild imaging disease is reported despite clinically important symptoms.");
  }

  if (input.injectionResponse === "temporary" || input.injectionResponse === "sustained") {
    score += 6;
    support.push("Response to a targeted injection supports the suspected pain generator.");
  }

  if (input.hipExamAbnormal) {
    contradictions.push("An abnormal hip examination suggests a possible competing pain generator.");
  }

  score = Math.max(0, Math.min(100, score));

  const rootLabel = input.painPattern === "claudication" ? "neurogenic claudication" : input.painPattern === "axial" ? "mechanical low-back pain" : `${input.painPattern} radiculopathy`;
  const primaryDiagnosis = `${rootLabel} associated with ${input.imagingLevel} ${input.imagingFinding.replaceAll("-", " ")}`;

  const alternatives = [
    input.hipExamAbnormal ? "Hip pathology or hip–spine syndrome" : "Hip pathology if groin pain or restricted motion is present",
    "Peripheral neuropathy or focal peripheral nerve entrapment",
    input.walkingLimit ? "Vascular claudication if pulses or vascular history are concerning" : "Sacroiliac or myofascial pain",
  ];

  if (input.spondylolisthesis && input.dynamicInstability === "unknown") {
    missing.push("Dynamic instability is unknown; consider standing flexion-extension radiographs if the result would change decompression-versus-fusion planning.");
  }
  if (!input.completedPT && urgency === "routine") {
    missing.push("A documented trial of structured nonsurgical care is incomplete.");
  }
  if (!input.patientGoal.trim()) {
    missing.push("The patient’s primary functional goal has not been documented.");
  }

  const treatmentOptions: string[] = [];
  if (urgency === "emergency") {
    treatmentOptions.push("Immediate physician assessment and emergency diagnostic pathway.");
  } else {
    treatmentOptions.push("Continue or optimize nonsurgical care when neurologically safe.");
    treatmentOptions.push("Consider a targeted diagnostic/therapeutic injection when the symptomatic level remains uncertain.");
    if (score >= 60 && input.legPain >= input.backPain && input.completedPT) {
      treatmentOptions.push("Surgical decompression may be reasonable after physician review and confirmation of concordant pathology.");
    }
  }

  let fusionAssessment = "Fusion is not automatically supported by stenosis alone.";
  if (input.dynamicInstability === "present") {
    fusionAssessment = "Fusion may be supported because dynamic instability is documented; integrate mechanical back pain, planned facet resection, bone health, and patient risk.";
  } else if (input.spondylolisthesis && input.dynamicInstability === "unknown") {
    fusionAssessment = "Fusion cannot be finalized because instability has not been assessed. Decompression alone versus fusion should remain an open decision.";
  } else if (input.dynamicInstability === "absent") {
    fusionAssessment = "Current data favor considering decompression without fusion when symptoms are leg-predominant and adequate decompression can be achieved without destabilization.";
  }

  const summary = `${primaryDiagnosis}. Concordance is ${score}/100. ${redFlagCount ? "One or more red flags require escalation." : "No entered emergency red flags were identified."} This prototype provides decision support only and does not establish a diagnosis or treatment plan.`;

  return { urgency, primaryDiagnosis, alternatives, concordanceScore: score, support, contradictions, missing, treatmentOptions, fusionAssessment, summary };
}
