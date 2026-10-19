import { createFileRoute, Link } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LAGLYFT – digitalt lagkontor för innebandy" },
      { name: "description", content: "Håll koll på närvaro, mål, assist och plus/minus för ditt innebandylag." },
      { property: "og:title", content: "LAGLYFT – digitalt lagkontor för innebandy" },
      { property: "og:description", content: "Närvaro, statistik och plus/minus för ditt innebandylag." },
    ],
  }),
  component: Index,
});

const features = [
  { n: "01", t: "Närvaro", d: "Bocka av vem som är på plats på varje träning och match." },
  { n: "02", t: "Statistik", d: "Mål, assist och poäng per spelare – säsongen i siffror." },
  { n: "03", t: "Plus/minus", d: "Registrera vilka som var på plan vid varje mål, framåt och bakåt." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <section className="relative court-bg overflow-hidden">
        <img src={hero} alt="Innebandyspelare i aktion" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/60 to-transparent" />
        <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col px-6 py-8">
          <nav className="flex items-center justify-between">
            <span className="font-display text-3xl">LAGLYFT</span>
            <Button asChild variant="secondary" size="sm"><Link to="/auth">Logga in</Link></Button>
          </nav>
          <div className="mt-auto pb-10">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] opacity-70">Digitalt lagkontor för innebandy</p>
            <h1 className="text-[clamp(4rem,12vw,10rem)]">Lyft laget.</h1>
            <p className="mt-4 max-w-lg text-lg opacity-80">Närvaro, statistik och plus/minus samlat på ett ställe – byggt för tränare och ledare.</p>
            <Button asChild size="lg" variant="secondary" className="mt-8"><Link to="/lag">Kom igång</Link></Button>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px bg-border md:grid-cols-3">
        {features.map((f) => (
          <div key={f.n} className="bg-background p-8">
            <div className="stat-num text-5xl text-muted-foreground">{f.n}</div>
            <h2 className="mt-4 text-4xl">{f.t}</h2>
            <p className="mt-2 text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
      <footer className="py-10 text-center text-sm text-muted-foreground">Taktiktavla och matchvideo kommer snart.</footer>
    </div>
  );
}
