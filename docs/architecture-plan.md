# NoWenOS Architecture Plan

## Phase Strategy
- Phase 0: Repository scaffolding, shared conventions, dev tooling
- Phase 1: MVP web NAS panel with safe read-mostly features
- Phase 2: richer storage/sharing and operational workflows
- Phase 3: optional OS-oriented packaging and hardening

## MVP Scope
- Login and session handling
- Dashboard overview
- System info display
- Read-only disk information
- Share directory management
- User management
- File browser with safe operations
- Docker container/app management
- Log viewer
- System settings

## Target Architecture
- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- State: TanStack Query + Zustand
- Forms: React Hook Form + Zod
- Backend: Go + Gin or Fiber
- Database: SQLite
- System integration: Docker Engine API, systemd, Samba/WebDAV/NFS tooling
- Deployment: install.sh + systemd service

## Safety Strategy
- Default read-only for disk layout in v1
- No destructive disk actions without explicit human approval
- Backend system adapter abstraction for all privileged operations
- Explicit change plan before disk, permission, Docker, or systemd mutations