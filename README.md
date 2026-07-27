# SpineDx-Tx AI

A deployable Next.js demonstration of physician-controlled clinical decision support for lumbar symptom–imaging concordance and treatment pathway review.

## Important limitation

This is an educational prototype. It is not a medical device, does not provide autonomous diagnosis, and has not been clinically validated. Do not enter protected health information into a public deployment.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy with GitHub and Vercel

1. Create a new GitHub repository.
2. Upload all files in this project to the repository root.
3. In Vercel, select **Add New → Project**.
4. Import the GitHub repository.
5. Keep the detected framework as **Next.js** and select **Deploy**.

No environment variables or database are required for this demonstration.

## Current functionality

- Structured lumbar case intake
- Red-flag escalation logic
- Symptom–imaging side and level concordance
- Ranked alternative considerations
- Missing-information detection
- Treatment pathway display
- Decompression-versus-fusion support statement
- Printable clinician summary
- Fully client-side processing; no entered data are intentionally persisted

## Architecture

- Next.js App Router
- TypeScript
- React client component
- Transparent deterministic rules in `lib/decisionEngine.ts`
- No external AI API in the MVP

## Recommended next steps before clinical use

1. Replace illustrative rules with an expert-approved knowledge base.
2. Add authentication, audit logs, role-based access, and a HIPAA-appropriate hosting architecture.
3. Add formal data definitions and FHIR/DICOM interfaces.
4. Validate against a blinded multidisciplinary reference panel.
5. Complete legal, privacy, cybersecurity, clinical governance, and regulatory review.
6. Keep all recommendations physician-confirmed and version-controlled.
