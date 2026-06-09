# NoWenOS Agent Guide

## Project Goal
NoWenOS is a lightweight self-hosted NAS management system designed first as a web management panel for Debian / Ubuntu Server, not as a full OS.

Phase 1 targets an MVP web UI with safe management features, avoiding destructive disk operations in early versions.

## Tech Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + Zustand
- Backend: Go + Gin or Fiber + SQLite
- System Services: Docker + Docker Compose + systemd
- File Sharing: Samba / WebDAV / NFS
- Deployment Target: Debian / Ubuntu Server

## Repository Layout
- web/ - React frontend
- server/ - Go backend
- deploy/ - deployment assets
- scripts/ - helper scripts
- docs/ - planning and notes

## Frontend Rules
- Use feature-based modules under web/src/features/.
- Do not put all business logic inside page components.
- Encapsulate API calls in web/src/api/.
- Use TanStack Query for server state and Zustand for client state.
- Use React Hook Form + Zod for form handling and validation.
- Prefer small reusable UI components from web/src/components/ui/.

## Backend Rules
- Keep HTTP handlers thin and push logic into domain / service packages.
- System interactions must go through a system adapter layer.
- Encapsulate shell / process execution and always validate inputs.
- Use structured errors and consistent JSON API responses.
- Prefer SQLite for v1 metadata storage with explicit migration support.

## API Rules
- All frontend API calls must use a shared HTTP client wrapper.
- Backend must expose versioned REST endpoints, recommended prefix /api/v1.
- Mutations that touch system state must be explicit and auditable.

## Safety Rules
- Never auto-execute destructive disk or OS commands without explicit human approval.
- Forbidden direct auto-execution examples:
  - rm -rf
  - mkfs.*
  - fdisk
  - parted
  - wipefs
  - dd
  - btrfs / zpool destructive operations
  - bulk ownership / permission changes on system paths
  - Docker destructive prune actions
  - direct edits to /etc/fstab
- All privileged system operations must be wrapped in a safe adapter abstraction and return machine-readable errors.

## Change Rules
- Before editing a module, read related code and configuration first.
- For disk, permission, Docker, or systemd changes, provide a change plan before implementation.
- Prefer minimal, focused changes over broad refactors.
- Add documentation or README updates when behavior changes.