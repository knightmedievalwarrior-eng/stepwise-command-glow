<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- All task/customer data lives client-side in `src/lib/session-store.ts` (sessionStorage for working data, localStorage for non-personal history only); never add server persistence — privacy-first requirement.
- Task types, steps, fields, validation and totals are declared in `src/lib/tasks/definitions.ts`; add new task types there so wizard, review and execution pick them up generically.
- Command routing is local-first: `src/lib/intent.ts` decides command vs question; only questions go to `/api/chat` (streaming AI route in `src/server/ai/`).
- Bot execution goes through `src/lib/runner.ts` (`startRun` callbacks); swap its internals for an n8n webhook/stream later without touching the UI.
- Completing a run must call `finishTask`, which deletes the task data and records the history entry in one step.
- AI chat replies render via Streamdown without the mermaid plugin; mermaid's graphlib/dagre chunks caused a blank screen in production builds.
