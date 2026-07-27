"use client";

import { FormEvent, ReactNode, useMemo, useRef, useState } from "react";
import { CaseInput, evaluateCase, validateCase } from "@/lib/decisionEngine";

const initialCase: CaseInput = {
  age: 66,
  symptomDurationMonths: 8,
  side: "right",
  painPattern: "L5",
  backPain: 4,
  legPain: 8,
  walkingLimit: true,
  motorDeficit: "L5",
  sensoryDeficit: "L5",
  imagingLevel: "L4-5",
  imagingSide: "right",
  imagingFinding: "lateral-recess",
  stenosisSeverity: "severe",
  spondylolisthesis: true,
  dynamicInstability: "unknown",
  completedPT: true,
  injectionResponse: "temporary",
  progressiveWeakness: false,
  bowelBladderChange: false,
  saddleAnesthesia: false,
  feverOrInfectionRisk: false,
  hipExamAbnormal: false,
  patientGoal: "Walk for 30 minutes without severe leg pain",
};

const emptyCase: CaseInput = {
  ...initialCase,
  age: 18,
  symptomDurationMonths: 0,
  backPain: 0,
  legPain: 0,
  walkingLimit: false,
  motorDeficit: "none",
  sensoryDeficit: "none",
  stenosisSeverity: "mild",
  spondylolisthesis: false,
  dynamicInstability: "unknown",
  completedPT: false,
  injectionResponse: "not-tried",
  patientGoal: "",
};

function Field({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: ReactNode }) {
  return <label className="field"><span>{label}{required && <b className="required"> *</b>}</span>{children}{help && <small>{help}</small>}</label>;
}

function Section({ title, step, children }: { title: string; step?: number; children: ReactNode }) {
  return <section className="panel">{step && <div className="step">Step {step}</div>}<h2>{title}</h2>{children}</section>;
}

export default function SpineDecisionApp() {
  const [data, setData] = useState<CaseInput>(initialCase);
  const [submittedData, setSubmittedData] = useState<CaseInput | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const resultsRef = useRef<HTMLElement>(null);
  const result = useMemo(() => submittedData ? evaluateCase(submittedData) : null, [submittedData]);
  const isStale = submittedData ? JSON.stringify(data) !== JSON.stringify(submittedData) : false;

  const update = <K extends keyof CaseInput>(key: K, value: CaseInput[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
    if (errors.length) setErrors([]);
  };

  const generate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateCase(data);
    setErrors(validationErrors);
    if (validationErrors.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmittedData({ ...data });
    setGeneratedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const reset = () => {
    setData(emptyCase);
    setSubmittedData(null);
    setErrors([]);
  };

  return (
    <main>
      <header className="hero">
        <div>
          <div className="eyebrow">CLINICAL DECISION-SUPPORT PROTOTYPE</div>
          <h1>SpineDx-Tx AI</h1>
          <p>Structured symptom–imaging concordance and treatment-pathway support for lumbar degenerative conditions.</p>
        </div>
        <div className="safety"><strong>Demonstration only</strong><br />Not for autonomous diagnosis, ordering, or surgical authorization. Do not enter identifiable patient information.</div>
      </header>

      {errors.length > 0 && <div className="error-summary" role="alert"><strong>Please correct the following:</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}

      <div className="toolbar">
        <span>Adult lumbar degenerative pathway</span>
        <div><button type="button" className="text-button" onClick={() => setData(initialCase)}>Load example</button><button type="button" className="text-button" onClick={reset}>Clear form</button></div>
      </div>

      <div className="layout">
        <form className="form" onSubmit={generate} noValidate>
          <Section title="Patient and symptoms" step={1}>
            <div className="grid">
              <Field label="Age" required><input type="number" min="18" max="100" value={data.age} onChange={e => update("age", Number(e.target.value))} /></Field>
              <Field label="Duration (months)" required><input type="number" min="0" max="240" value={data.symptomDurationMonths} onChange={e => update("symptomDurationMonths", Number(e.target.value))} /></Field>
              <Field label="Symptom side"><select value={data.side} onChange={e => update("side", e.target.value as CaseInput["side"])}><option value="right">Right</option><option value="left">Left</option><option value="bilateral">Bilateral</option></select></Field>
              <Field label="Clinical pain pattern"><select value={data.painPattern} onChange={e => update("painPattern", e.target.value as CaseInput["painPattern"])}><option>L3</option><option>L4</option><option>L5</option><option>S1</option><option value="claudication">Neurogenic claudication</option><option value="axial">Predominantly axial</option></select></Field>
              <Field label={`Back pain: ${data.backPain}/10`}><input aria-label="Back pain severity" type="range" min="0" max="10" value={data.backPain} onChange={e => update("backPain", Number(e.target.value))} /></Field>
              <Field label={`Leg pain: ${data.legPain}/10`}><input aria-label="Leg pain severity" type="range" min="0" max="10" value={data.legPain} onChange={e => update("legPain", Number(e.target.value))} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.walkingLimit} onChange={e => update("walkingLimit", e.target.checked)} /> Walking or standing is limited by symptoms</label>
            <Field label="Patient’s primary functional goal" required help="Use a measurable goal when possible."><input value={data.patientGoal} placeholder="Example: Walk 30 minutes without severe leg pain" onChange={e => update("patientGoal", e.target.value)} /></Field>
          </Section>

          <Section title="Examination" step={2}>
            <div className="grid">
              <Field label="Motor deficit"><select value={data.motorDeficit} onChange={e => update("motorDeficit", e.target.value as CaseInput["motorDeficit"])}><option value="none">No focal deficit</option><option>L3</option><option>L4</option><option>L5</option><option>S1</option></select></Field>
              <Field label="Sensory deficit"><select value={data.sensoryDeficit} onChange={e => update("sensoryDeficit", e.target.value as CaseInput["sensoryDeficit"])}><option value="none">No focal deficit</option><option>L3</option><option>L4</option><option>L5</option><option>S1</option></select></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.hipExamAbnormal} onChange={e => update("hipExamAbnormal", e.target.checked)} /> Hip examination suggests a competing pain generator</label>
          </Section>

          <Section title="Imaging" step={3}>
            <div className="grid">
              <Field label="Level"><select value={data.imagingLevel} onChange={e => update("imagingLevel", e.target.value as CaseInput["imagingLevel"])}><option>L3-4</option><option>L4-5</option><option>L5-S1</option><option value="multilevel">Multilevel</option></select></Field>
              <Field label="Imaging side"><select value={data.imagingSide} onChange={e => update("imagingSide", e.target.value as CaseInput["imagingSide"])}><option value="right">Right</option><option value="left">Left</option><option value="bilateral">Bilateral</option></select></Field>
              <Field label="Dominant finding"><select value={data.imagingFinding} onChange={e => update("imagingFinding", e.target.value as CaseInput["imagingFinding"])}><option value="disc">Disc herniation</option><option value="central-stenosis">Central stenosis</option><option value="lateral-recess">Lateral recess stenosis</option><option value="foraminal">Foraminal stenosis</option></select></Field>
              <Field label="Severity"><select value={data.stenosisSeverity} onChange={e => update("stenosisSeverity", e.target.value as CaseInput["stenosisSeverity"])}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></Field>
              <Field label="Dynamic instability"><select value={data.dynamicInstability} onChange={e => update("dynamicInstability", e.target.value as CaseInput["dynamicInstability"])}><option value="unknown">Not assessed / unknown</option><option value="absent">Absent</option><option value="present">Present</option></select></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.spondylolisthesis} onChange={e => update("spondylolisthesis", e.target.checked)} /> Degenerative spondylolisthesis</label>
          </Section>

          <Section title="Prior care and safety screen" step={4}>
            <div className="grid">
              <Field label="Targeted injection response"><select value={data.injectionResponse} onChange={e => update("injectionResponse", e.target.value as CaseInput["injectionResponse"])}><option value="not-tried">Not tried</option><option value="none">No benefit</option><option value="temporary">Temporary benefit</option><option value="sustained">Sustained benefit</option></select></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.completedPT} onChange={e => update("completedPT", e.target.checked)} /> Structured physical therapy or equivalent nonsurgical care completed</label>
            <div className="red-flag-box"><strong>Urgent safety screen</strong>
              <label className="check"><input type="checkbox" checked={data.progressiveWeakness} onChange={e => update("progressiveWeakness", e.target.checked)} /> Progressive motor weakness</label>
              <label className="check"><input type="checkbox" checked={data.bowelBladderChange} onChange={e => update("bowelBladderChange", e.target.checked)} /> New urinary retention or bowel/bladder dysfunction</label>
              <label className="check"><input type="checkbox" checked={data.saddleAnesthesia} onChange={e => update("saddleAnesthesia", e.target.checked)} /> Saddle anesthesia</label>
              <label className="check"><input type="checkbox" checked={data.feverOrInfectionRisk} onChange={e => update("feverOrInfectionRisk", e.target.checked)} /> Fever, bacteremia, immunosuppression, or material infection risk</label>
            </div>
          </Section>

          <div className="submit-bar">
            <button className="primary" type="submit">Generate decision-support summary</button>
            <span>Required fields are marked *</span>
          </div>
        </form>

        <aside className="results" ref={resultsRef} aria-live="polite">
          {!result && <div className="empty-results"><div className="empty-icon">✓</div><h2>Ready to review</h2><p>Complete the structured case and select <strong>Generate decision-support summary</strong>. Results are generated from a fixed snapshot so they do not change silently while you edit.</p></div>}
          {result && <>
            {isStale && <div className="stale-banner">Inputs changed after the last analysis. Generate again to update the summary.</div>}
            <div className={`urgency ${result.urgency}`}><div><strong>{result.urgency.toUpperCase()} REVIEW PATHWAY</strong><span>{result.urgencyReason}</span></div></div>
            <div className="score-card"><div className="score-heading"><div><span>Clinical–imaging concordance</span><strong>{result.matchedDomains}</strong><small>/{result.assessableDomains} domains</small></div><b className={`label ${result.concordanceLabel}`}>{result.concordanceLabel}</b></div><div className="meter"><i style={{ width: `${result.assessableDomains ? (result.matchedDomains / result.assessableDomains) * 100 : 0}%` }} /></div><small>Transparent checklist classification—not a validated probability, diagnosis, or surgical indication.</small></div>
            <Section title="Clinical checks"><div className="checks">{result.clinicalChecks.map(check => <div key={check.label}><span className={`status-dot ${check.status}`} />{check.label}<b>{check.status}</b></div>)}</div></Section>
            <Section title="Clinical pattern and imaging association"><p className="diagnosis">{result.clinicalPattern}</p><p><strong>Entered imaging association:</strong> {result.imagingAssociation}</p><p>{result.summary}</p></Section>
            <Section title="Supporting findings"><ul>{result.support.map(x => <li key={x}>{x}</li>)}</ul></Section>
            <Section title="Contradictions and uncertainty"><ul>{result.contradictions.length ? result.contradictions.map(x => <li key={x}>{x}</li>) : <li>No major contradiction was identified from the entered fields.</li>}</ul></Section>
            <Section title="Missing information"><ul>{result.missing.length ? result.missing.map(x => <li key={x}>{x}</li>) : <li>No major missing element was identified by the current rules.</li>}</ul></Section>
            <Section title="Alternative considerations"><ol>{result.alternatives.map(x => <li key={x}>{x}</li>)}</ol></Section>
            <Section title="Treatment pathways"><ul>{result.treatmentOptions.map(x => <li key={x}>{x}</li>)}</ul><div className="fusion"><strong>Decompression versus fusion</strong><p>{result.fusionAssessment}</p></div></Section>
            <div className="result-actions"><button className="secondary" type="button" onClick={() => window.print()}>Print clinician summary</button><span>Generated at {generatedAt}</span></div>
          </>}
        </aside>
      </div>
      <footer>Prototype rules are illustrative and require clinical governance, expert review, validation, cybersecurity review, privacy controls, and regulatory assessment before patient-care use.</footer>
    </main>
  );
}
