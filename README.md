# FableLoop

Deployable MVP: a short idea becomes a narrated, character-consistent, branching story.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app works without a key in demonstration mode. Add `OPENAI_API_KEY` for original story generation.

## GitHub + Vercel

1. Extract the ZIP and push its contents to a new GitHub repository.
2. Import the repository into Vercel.
3. Add `OPENAI_API_KEY` in Project Settings → Environment Variables.
4. Optionally add `OPENAI_MODEL` (default `gpt-4.1-mini`).
5. Deploy. Never expose the API key with a `NEXT_PUBLIC_` prefix.

## Included

- Prompt-to-story server route with safe structured output
- Five-scene player, recurring character anchors and branching choice
- Browser speech narration and responsive interface
- Local story library and next-episode continuation
- Working demo fallback when AI is not configured

This MVP intentionally uses visual-direction scenes rather than costly video rendering. Production can add an image/video provider, user accounts, database storage, moderation, consent-based sharing and generation credits.
