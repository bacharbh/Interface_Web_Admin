# Animal Detail Migration Plan

## Goal
Unify the two animal detail implementations into a single `AnimalDetail.tsx` architecture while keeping the existing routes working:

- `/animals/:id` remains the primary operational detail route
- `/animal/:id` remains as a compatibility alias during migration

## Current Surface

- `src/pages/Animals/AnimalDetail.tsx`
  - Real-time operational detail page
  - Uses `collar_id`
  - Shows vitals, GPS, alerts, PDF report export

- `src/pages/Animals/AnimalProfile.tsx`
  - Clinical/profile-oriented detail page
  - Uses mixed `sheepId` + `collar_id`
  - Shows tabs, medical history, documents, notes, navigation arrows

- `src/pages/Animals/AnimalProfile.jsx`
  - Modal quick-view profile
  - Props-driven (`animal`, `onClose`)
  - Uses a different animal vocabulary (`tag`, `currentCollar`, `collars`)

## Target Architecture

1. Introduce a normalized animal DTO.
2. Move all detail rendering to one unified `AnimalDetail.tsx` shell.
3. Keep legacy entry points as wrappers or aliases.
4. Phase out duplicate data assumptions (`sheepId`, `collar_id`, `tag`) by using one adapter layer.
5. Replace mock-only sections with backend-backed services incrementally.

## Migration Phases

### Phase 1 - Normalize data
- Create a single adapter layer for animal identity and metrics.
- Resolve:
  - `collar_id`
  - `sheepId`
  - `tag`
  - `currentCollar`
- Standardize to one internal shape before rendering.

### Phase 2 - Build unified page shell
- Extract shared sections:
  - header / identity
  - vitals
  - GPS panel
  - alert history
  - documents
  - notes
  - navigation
- Keep current route behavior untouched.

### Phase 3 - Preserve route compatibility
- Keep `/animals/:id` and `/animal/:id` active.
- Route both to the unified page or a thin alias wrapper.
- Maintain old URLs for bookmarks and external links.

### Phase 4 - Remove duplication
- Deprecate the legacy page-specific implementations.
- Keep only the modal quick-view if a lightweight popup is still needed.

### Phase 5 - Connect real services
- Replace mock medical history, notes, and document lists.
- Wire persistence and history endpoints.
- Add test coverage for route aliases and data normalization.

## Deliverables

- One normalized animal model
- One unified detail page
- Two route aliases preserved
- One optional modal quick-view component
