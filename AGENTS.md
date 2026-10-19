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

## Architecture
- Team data access is scoped by `team_members` + `is_team_member()` RLS; every new team table must check it (why: multi-club ready from day one).
- Signed-in pages live under `src/routes/_authenticated/lag.*` and read via the browser client with queryOptions in `src/lib/queries.ts` (why: RLS enforces access, no server code needed).
- Stat math (points, plus/minus, attendance) lives in pure functions in `src/lib/stats.ts` with tests (why: rules stay verifiable).
