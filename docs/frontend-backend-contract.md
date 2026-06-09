# Frontend Backend Contract

## General
- All API requests use prefix /api/v1.
- Responses should return JSON with a predictable structure.
- Successful responses can use a top-level data envelope when helpful.
- Error responses should include a human-readable message.

## MVP Endpoints
- POST /api/v1/auth/login
- GET /api/v1/system/info
- GET /api/v1/storage/disks
- GET /api/v1/docker/containers
- GET /api/v1/docker/images
- GET /api/v1/files/browse?path=...
- GET /api/v1/users

## Auth
- Initial implementation can use a simple token flow.
- Frontend should store session state in client-side state manager.
- Backend should validate all protected endpoints before executing system operations.

## System Safety
- Read endpoints may list disks, containers, users, and logs.
- Mutation endpoints must validate input carefully.
- Dangerous operations must not execute automatically without explicit approval and confirmation workflow.