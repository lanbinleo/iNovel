# iNovel Development Notes

## Goal
- Move from file-based editing to a DB-backed novel editor with chapter/paragraph primitives.

## Current Phase (2)
- Focus: chapter-driven editing, navigation, and supporting UI sections.

## Completed (recent)
- Novel and chapter lists wired to DB.
- Chapter editor with title + outline + content.
- Legacy workspace/file-tree UI removed.
- Novel info editing (title/summary) and delete actions for novel/chapter.

## Next Steps (Phase 2)
1. Chapter reorder and batch actions.
2. Outline page (per chapter summary list).
3. Import entry placement and progress feedback.

## Robustness Notes
- Confirm before discarding unsaved changes.
- Auto-save only when a chapter is active.
- Keep DB writes transactional.

## Commands
- `wails dev`
- `wails build`
- `wails generate module`
