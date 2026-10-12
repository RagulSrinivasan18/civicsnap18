import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/issues", label: "Community Issues" },
  { to: "/track", label: "Track a Report" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Camera className="h-5 w-5" />
          </span>
          <span className="font-display text-xl">CivicSnap</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {n.label}
            </Link>
          ))}
          <Button asChild className="ml-2">
            <Link to="/report">Report a Problem</Link>
          </Button>
        </nav>
        <button className="md:hidden" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="border-t px-4 py-3 md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">
              {n.label}
            </Link>
          ))}
          <Button asChild className="mt-2 w-full">
            <Link to="/report" onClick={() => setOpen(false)}>Report a Problem</Link>
          </Button>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-navy text-navy-foreground">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="font-display text-lg">CivicSnap</p>
          <p className="mt-2 text-sm opacity-80">Citizen reporting for safer, cleaner neighbourhoods.</p>
        </div>
        <p className="text-sm opacity-80">
          CivicSnap is a community platform, not a government service. Complaints are forwarded only by an
          administrator through verified official channels.
        </p>
        <p className="text-sm opacity-80">Records marked "Demo" are sample data for demonstration.</p>
      </div>
    </footer>
  );
}
