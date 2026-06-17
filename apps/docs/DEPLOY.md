# Deploying the documentation site

The documentation site is deployed by [Dokploy](https://dokploy.com) on a VPS, built from
the `Dockerfile` in this directory. It is not deployed to Vercel.

## Dokploy application settings

Create a Dokploy **Application** with the **Dockerfile** build type and these settings:

- **Repository**: `https://github.com/mariokreitz/verbatra`, branch `main`.
- **Build Type**: Dockerfile.
- **Docker Context Path**: `.` (the repository root). The build copies the whole monorepo
  because the pnpm lockfile and workspace manifests live at the root.
- **Dockerfile Path**: `apps/docs/Dockerfile`.
- **Build Stage**: leave empty. The image's final `runner` stage is the one to run.
- **Port**: `3000`. Set this when you create the domain so Dokploy routes to the
  container's exposed port.
- **Domain**: `verbatra.kreitz-webdev.de`, with HTTPS (Let's Encrypt) enabled.

## Build architecture

The image must be built on the same CPU architecture it runs on. The standalone build
traces sharp's native binary for the build platform, so a cross-architecture build would
ship the wrong binary. Dokploy satisfies this by building the image on the amd64 VPS,
which matches the runtime; do not cross-build it on a different architecture.

## Runtime environment

No runtime environment variables are required. The site reads no API keys, and `PORT` and
`HOSTNAME` are already set in the image, which listens on `0.0.0.0:3000`.

## Health check

The image declares a `HEALTHCHECK` that requests `/` and expects a `200`. Mirror this in
Dokploy with an HTTP health check on `/` if you want Dokploy to track container health too.

## Redeploying

Push to `main` to trigger an automatic deployment if auto-deploy is enabled for the
application; otherwise open the application in Dokploy and click **Deploy**. Each deploy
rebuilds the image from the Dockerfile.
