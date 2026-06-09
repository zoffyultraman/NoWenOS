# Layout and Routing

## Current Behavior
- `/login` is the public login page.
- All authenticated pages use a shared shell layout with sidebar and header.
- Sidebar currently exposes:
  - Dashboard
  - Storage
  - Docker

## Key Files
- `web/src/components/layout/AppSidebar.tsx`
- `web/src/components/layout/AppHeader.tsx`
- `web/src/components/layout/ShellLayout.tsx`
- `web/src/app/router.tsx`

## Next UI Work
- Add more sidebar entries as pages are completed.
- Add breadcrumbs or active page title if needed later.
- Add user avatar / settings shortcut in header later.
