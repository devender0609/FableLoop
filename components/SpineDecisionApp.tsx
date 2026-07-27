"use client";

import { useMemo, useState } from "react";
import { CaseInput, evaluateCase } from "@/lib/decisionEngine";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><h2>{title}</h2>{children}</section>;
}

export default function SpineDecisionApp() {
  const [data, setData] = useState<CaseInput>(initialCase);
  const [showResults, setShowResults] = useState(true);
  const result = useMemo(() => evaluateCase(data), [data]);
  const update = <K extends keyof CaseInput>(key: K, value: CaseInput[K]) => setData(prev => ({ ...prev, [key]: value }));

  return (
    <main>
      <header className="hero">
        <div>
          <div className="eyebrow">CLINICAL DECISION-SUPPORT PROTOTYPE</div>
          <h1>SpineDx-Tx AI</h1>
          <p>Structured symptom–imaging concordance and treatment-pathway support for lumbar degenerative conditions.</p>
        </div>
        <div className="safety">Not for autonomous diagnosis, ordering, or surgical authorization. Do not enter identifiable patient information in this demonstration.</div>
      </header>

      <div className="layout">
        <form className="form" onSubmit={(e) => { e.preventDefault(); setShowResults(true); }}>
          <Section title="Patient and symptoms">
            <div className="grid">
              <Field label="Age"><input type="number" value={data.age} onChange={e => update("age", Number(e.target.value))} /></Field>
              <Field label="Duration (months)"><input type="number" value={data.symptomDurationMonths} onChange={e => update("symptomDurationMonths", Number(e.target.value))} /></Field>
              <Field label="Symptom side"><select value={data.side} onChange={e => update("side", e.target.value as CaseInput["side"])}><option>right</option><option>left</option><option>bilateral</option></select></Field>
              <Field label="Pain pattern"><select value={data.painPattern} onChange={e => update("painPattern", e.target.value as CaseInput["painPattern"])}><option>L4</option><option>L5</option><option>S1</option><option value="claudication">claudication</option><option value="axial">axial</option></select></Field>
              <Field label={`Back pain: ${data.backPain}/10`}><input type="range" min="0" max="10" value={data.backPain} onChange={e => update("backPain", Number(e.target.value))} /></Field>
              <Field label={`Leg pain: ${data.legPain}/10`}><input type="range" min="0" max="10" value={data.legPain} onChange={e => update("legPain", Number(e.target.value))} /></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.walkingLimit} onChange={e => update("walkingLimit", e.target.checked)} /> Walking is limited by symptoms</label>
            <Field label="Patient’s primary goal"><input value={data.patientGoal} onChange={e => update("patientGoal", e.target.value)} /></Field>
          </Section>

          <Section title="Examination">
            <div className="grid">
              <Field label="Motor deficit"><select value={data.motorDeficit} onChange={e => update("motorDeficit", e.target.value as CaseInput["motorDeficit"])}><option>none</option><option>L4</option><option>L5</option><option>S1</option></select></Field>
              <Field label="Sensory deficit"><select value={data.sensoryDeficit} onChange={e => update("sensoryDeficit", e.target.value as CaseInput["sensoryDeficit"])}><option>none</option><option>L4</option><option>L5</option><option>S1</option></select></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.hipExamAbnormal} onChange={e => update("hipExamAbnormal", e.target.checked)} /> Hip examination abnormal</label>
          </Section>

          <Section title="Imaging">
            <div className="grid">
              <Field label="Level"><select value={data.imagingLevel} onChange={e => update("imagingLevel", e.target.value as CaseInput["imagingLevel"])}><option>L3-4</option><option>L4-5</option><option>L5-S1</option><option>multilevel</option></select></Field>
              <Field label="Imaging side"><select value={data.imagingSide} onChange={e => update("imagingSide", e.target.value as CaseInput["imagingSide"])}><option>right</option><option>left</option><option>bilateral</option></select></Field>
              <Field label="Finding"><select value={data.imagingFinding} onChange={e => update("imagingFinding", e.target.value as CaseInput["imagingFinding"])}><option value="disc">disc herniation</option><option value="central-stenosis">central stenosis</option><option value="lateral-recess">lateral recess</option><option value="foraminal">foraminal stenosis</option></select></Field>
              <Field label="Severity"><select value={data.stenosisSeverity} onChange={e => update("stenosisSeverity", e.target.value as CaseInput["stenosisSeverity"])}><option>mild</option><option>moderate</option><option>severe</option></select></Field>
              <Field label="Dynamic instability"><select value={data.dynamicInstability} onChange={e => update("dynamicInstability", e.target.value as CaseInput["dynamicInstability"])}><option>unknown</option><option>absent</option><option>present</option></select></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.spondylolisthesis} onChange={e => update("spondylolisthesis", e.target.checked)} /> Degenerative spondylolisthesis</label>
          </Section>

          <Section title="Prior care and red flags">
            <div className="grid">
              <Field label="Injection response"><select value={data.injectionResponse} onChange={e => update("injectionResponse", e.target.value as CaseInput["injectionResponse"])}><option value="not-tried">not tried</option><option>none</option><option>temporary</option><option>sustained</option></select></Field>
            </div>
            <label className="check"><input type="checkbox" checked={data.completedPT} onChange={e => update("completedPT", e.target.checked)} /> Structured physical therapy completed</label>
            <label className="check"><input type="checkbox" checked={data.progressiveWeakness} onChange={e => update("progressiveWeakness", e.target.checked)} /> Progressive weakness</label>
            <label className="check"><input type="checkbox" checked={data.bowelBladderChange} onChange={e => update("bowelBladderChange", e.target.checked)} /> New bowel/bladder dysfunction</label>
            <label className="check"><input type="checkbox" checked={data.saddleAnesthesia} onChange={e => update("saddleAnesthesia", e.target.checked)} /> Saddle anesthesia</label>
            <label className="check"><input type="checkbox" checked={data.feverOrInfectionRisk} onChange={e => update("feverOrInfectionRisk", e.target.checked)} /> Fever or material infection risk</label>
          </Section>

          <button className="primary" type="submit">Generate decision-support summary</button>
        </form>

        {showResults && <aside className="results">
          <div className={`urgency ${result.urgency}`}><strong>{result.urgency.toUpperCase()}</strong> review pathway</div>
          <div className="score-card"><div><span>Concordance</span><strong>{result.concordanceScore}</strong><small>/100</small></div><div className="meter"><i style={{ width: `${result.concordanceScore}%` }} /></div></div>
          <Section title="Most likely clinical pattern"><p className="diagnosis">{result.primaryDiagnosis}</p><p>{result.summary}</p></Section>
          <Section title="Supporting findings"><ul>{result.support.map(x => <li key={x}>{x}</li>)}</ul></Section>
          <Section title="Contradictions and uncertainty"><ul>{result.contradictions.length ? result.contradictions.map(x => <li key={x}>{x}</li>) : <li>No major contradiction entered.</li>}</ul></Section>
          <Section title="Missing information"><ul>{result.missing.length ? result.missing.map(x => <li key={x}>{x}</li>) : <li>No major missing element identified by this prototype.</li>}</ul></Section>
          <Section title="Alternative considerations"><ol>{result.alternatives.map(x => <li key={x}>{x}</li>)}</ol></Section>
          <Section title="Treatment pathways"><ul>{result.treatmentOptions.map(x => <li key={x}>{x}</li>)}</ul><div className="fusion"><strong>Decompression vs fusion</strong><p>{result.fusionAssessment}</p></div></Section>
          <button className="secondary" onClick={() => window.print()}>Print clinician summary</button>
        </aside>}
      </div>
      <footer>Prototype rules are illustrative and require formal clinical governance, expert review, validation, cybersecurity review, and regulatory assessment before any patient-care use.</footer>
    </main>
  );
}
