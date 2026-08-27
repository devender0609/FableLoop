# FableLoop Cinema v2

FableLoop converts a short concept into an acted AI micro-movie—not a narrated story. It creates a screenplay and character bible, generates connected cinematic shots with native dialogue and sound, merges them, and returns one downloadable MP4.

## What is real

- Screenplay and shot planning are automatic.
- Every shot is submitted to a real fal.ai video model.
- The default model is Kling Video v3 Pro with native audio.
- Render jobs are asynchronous and individually tracked.
- Completed shots are merged through the fal.ai FFmpeg endpoint.
- The result is a real MP4 video.

No prerecorded demonstration is presented as generated output. Without FAL_KEY, planning works but paid rendering is disabled.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Environment variables:

```text
FAL_KEY=required_for_video
FAL_VIDEO_MODEL=fal-ai/kling-video/v3/pro/text-to-video
OPENAI_API_KEY=optional_but_recommended_for_screenplays
OPENAI_MODEL=gpt-4.1-mini
```

Keys are server-only. Never prefix them with NEXT_PUBLIC_ and never commit .env.local.

## GitHub and Vercel

1. Push the extracted source to GitHub.
2. Import the repository into Vercel.
3. Add FAL_KEY under Vercel Project Settings → Environment Variables.
4. Add OPENAI_API_KEY for stronger screenplay development.
5. Deploy.

The included vercel.json selects the standard Next.js production build.

## Honest production limitations

- Video generation is probabilistic; identity and spatial continuity can drift.
- Native dialogue quality varies by model and prompt.
- Provider URLs may expire; a commercial version should copy MP4s to durable storage.
- Keep the browser tab open during this MVP's client-orchestrated render.
- Commercial launch requires accounts, persistent jobs, storage, moderation, consent, billing and webhooks.
- Each retry incurs provider cost.

## API routes

- POST /api/movie/plan — screenplay, cast bible and shot prompts
- POST /api/movie/submit — submit a real video shot
- GET /api/movie/status — poll a shot or merge job
- POST /api/movie/merge — assemble completed shots
- GET /api/movie/config — provider configuration state
