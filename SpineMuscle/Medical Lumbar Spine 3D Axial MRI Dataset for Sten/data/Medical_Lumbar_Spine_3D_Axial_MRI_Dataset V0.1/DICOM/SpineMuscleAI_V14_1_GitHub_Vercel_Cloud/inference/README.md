# SpineMuscle inference service

This service is the compute layer for the Vercel frontend.

It runs:

1. `dcm2niix`
2. official MuscleMap `mm_segment`
3. segmentation QC overlay generation
4. CSA and T2 signal extraction
5. paper-aligned PVMQ numerator
6. user-confirmed L3 CSF normalization

## Why this is separate from Vercel

MRI conversion and neural-network segmentation are long-running, compute-heavy jobs. The browser uploads directly to this container service and then polls job status. Vercel only hosts the UI/config endpoint.

## Docker test

```bash
docker build -t spinemuscle-inference ./inference
docker run --rm -p 8080:8080 -e ALLOWED_ORIGINS=http://localhost:3000 spinemuscle-inference
```

Health:

```text
http://localhost:8080/health
```

## Deployment

You can deploy the `inference` Dockerfile to a persistent container platform such as Railway, Render, Fly.io, a VM, or a GPU container provider.

For a prototype, CPU is acceptable but slow. GPU-backed infrastructure is preferable if supported by the MuscleMap/PyTorch installation.

### Required environment variables

`ALLOWED_ORIGINS`

For the first test you can use `*`. For a public deployment, restrict it to your Vercel domain, for example:

```text
https://spinemuscle.vercel.app
```

`SPINEMUSCLE_WORKDIR` is optional. Defaults to `/tmp/spinemuscle`.

## First inference

MuscleMap may download pretrained model parameters from Zenodo on first use. This makes the first analysis slower. Subsequent runs on the same persistent instance should use the cached model.
