import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRight, Target, Mail, Activity, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import SiteFooter from "@/components/SiteFooter";

const FEATURES = [
  { icon: Target, title: "AI Buy / Hold / Sell zones", body: "Every stock you follow gets clear price levels to buy, hold or trim — with the reasoning behind each number." },
  { icon: Mail, title: "Weekly Debrief", body: "A Monday recap of your week: biggest movers, what drove them, risks to watch and upcoming events." },
  { icon: Activity, title: "Portfolio Pulse", body: "See how $1,000 in your portfolio stacks up against the S&P 500 and Nasdaq, plus simple risk metrics." },
  { icon: GitCompare, title: "AI Compare", body: "Put 2–8 stocks head to head on growth, margins, market size and valuation, with real market peers." },
];

const Landing = () => {
  const { search, hash } = useLocation();
  // Old links (/?tab=…) and sign-in returns belong to the app.
  if (search || hash.includes("access_token")) return <Navigate to={`/app${search}${hash}`} replace />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="mx-auto w-full max-w-5xl px-6 py-5 flex items-center justify-between">
        <span className="font-serif text-lg tracking-wide">STOCKLYAI</span>
        <Button asChild variant="outline" size="sm"><Link to="/app">Open the app</Link></Button>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-12 pb-16 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary mb-4">AI-powered stock portfolio analytics</p>
          <h1 className="font-serif text-4xl md:text-6xl leading-tight max-w-3xl mx-auto">
            Know when to buy, hold, or sell the stocks you follow.
          </h1>
          <p className="mt-5 text-muted-foreground max-w-2xl mx-auto text-base md:text-lg">
            StocklyAI watches your portfolio with live prices and gives every stock clear AI price zones, a weekly debrief and side‑by‑side comparisons.
          </p>
          <div className="mt-8 flex flex-col items-center gap-2">
            <Button asChild size="lg" className="gap-2 text-base px-8">
              <Link to="/app">Try it free — no sign-up <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <span className="text-xs text-muted-foreground">Starts with a ready-made portfolio. Not financial advice.</span>
          </div>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-5xl px-6 pb-20">
          <h2 id="features" className="sr-only">Features</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="rounded-sm border border-border bg-secondary/20 p-6">
                <Icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-serif text-lg mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="secondary" className="gap-2"><Link to="/app">Open StocklyAI <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Landing;
