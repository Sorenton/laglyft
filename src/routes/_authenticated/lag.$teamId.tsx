import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { teamQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/lag/$teamId")({
  component: TeamLayout,
});

const tabs = [
  { to: "/lag/$teamId", label: "Översikt", exact: true },
  { to: "/lag/$teamId/aktiviteter", label: "Aktiviteter", exact: false },
  { to: "/lag/$teamId/spelare", label: "Spelare", exact: false },
  { to: "/lag/$teamId/statistik", label: "Statistik", exact: false },
] as const;

function TeamLayout() {
  const { teamId } = Route.useParams();
  const { data: team } = useSuspenseQuery(teamQuery(teamId));
  return (
    <div className="min-h-screen">
      <header className="court-bg">
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <div className="flex items-center justify-between text-sm">
            <Link to="/lag" className="font-display text-2xl">LAGLYFT</Link>
            <Link to="/lag" className="opacity-70 hover:opacity-100">Byt lag</Link>
          </div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] opacity-60">{team.club}</p>
          <h1 className="text-6xl md:text-7xl">{team.name}</h1>
          <nav className="mt-6 flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                params={{ teamId }}
                activeOptions={{ exact: t.exact }}
                className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-semibold uppercase tracking-wider opacity-60 transition hover:opacity-100 data-[status=active]:border-sidebar-primary data-[status=active]:opacity-100"
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
