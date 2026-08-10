import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Vote, BarChart3, Calendar, TrendingUp, CheckCircle, LogIn, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/StatCard";
import schoolSeal from "@/assets/school-seal.jpg";

export default function Index() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin");
    }
  }, [isAdmin, navigate]);

  const { data: settings } = useQuery({
    queryKey: ["election-settings"],
    queryFn: () => api.get('/election-settings'),
  });

  const { data: voteCounts } = useQuery({
    queryKey: ["vote-counts-home"],
    queryFn: () => api.get('/votes/counts'),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get('/stats'),
  });

  const profileCount = stats?.voterCount ?? 0;
  const votedCount = stats?.votedCount ?? 0;
  const totalVotes = stats?.totalVotes ?? 0;
  const positionCount = stats?.positionCount ?? 0;

  const turnout = profileCount && profileCount > 0 ? ((votedCount) / profileCount * 100).toFixed(1) : "0";

  const topCandidates = [...(voteCounts ?? [])].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 5);

  const statusColors = {
    upcoming: "bg-muted text-muted-foreground",
    ongoing: "bg-success/15 text-success",
    completed: "bg-primary/10 text-primary",
  };

  // ── Derive hero text from settings ──────────────────────────────
  // Split election name into "SSLG Election" + "2026" by taking the last
  // whitespace-separated token as the year/suffix and the rest as the label.
  const electionName  = settings?.name ?? "SSLG Election 2026";
  const nameParts     = electionName.trim().split(/\s+/);
  const electionYear  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
  const electionLabel = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : electionName;

  // school_name is stored as the full footer line, e.g.
  // "Batuan National High School — Batuan, Bohol, Philippines"
  // Split on " — " or " - " to get school name vs. location.
  const schoolNameFull = settings?.school_name ?? "Batuan National High School — Batuan, Bohol, Philippines";
  const schoolNameParts = schoolNameFull.split(/\s+[—–-]\s+/);
  const schoolTitle    = schoolNameParts[0]?.trim() ?? "Batuan National High School";
  const schoolLocation = schoolNameParts.length > 1 ? schoolNameParts.slice(1).join(" — ") : "Batuan, Bohol, Philippines";

  return (
    <div>
      {/* Hero */}
      <section className="gradient-hero py-16 md:py-24 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 25% 25%, hsl(45 80% 55%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="container relative">
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
            <img 
              src={schoolSeal} 
              alt="Batuan National High School Seal" 
              className="w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-60 lg:h-60 mb-8 animate-scale-in rounded-full ring-4 ring-gold/40 shadow-2xl object-cover hover:scale-105 transition-transform duration-300" 
            />
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-extrabold text-primary-foreground leading-tight animate-fade-in">
              {electionLabel}{" "}
              <span className="inline-block text-gradient-gold ml-2">{electionYear}</span>
            </h1>
            <p className="text-primary-foreground/70 text-base md:text-lg mt-4 max-w-xl animate-fade-in" style={{ animationDelay: "150ms" }}>
              {schoolTitle} — Supreme Student Learner Government Election System
            </p>
            <p className="text-primary-foreground/50 text-sm mt-1 animate-fade-in" style={{ animationDelay: "200ms" }}>{schoolLocation}</p>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-8 animate-fade-in" style={{ animationDelay: "300ms" }}>
              <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${statusColors[settings?.status ?? "upcoming"]}`}>
                ● Election {settings?.status === "ongoing" ? "In Progress" : settings?.status === "completed" ? "Completed" : "Upcoming"}
              </span>
              <span className="flex items-center gap-1.5 text-primary-foreground/60 text-sm">
                <Calendar className="w-4 h-4" />
                {settings?.election_date ? new Date(settings.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "TBA"}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-8 animate-fade-in" style={{ animationDelay: "400ms" }}>
              {user ? (
                isAdmin ? (
                  <Link to="/admin" className="px-8 py-3 rounded-xl gradient-navy text-primary-foreground font-semibold hover:opacity-90 transition-opacity">Admin Dashboard</Link>
                ) : (
                  <Link to="/vote" className="px-8 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity">
                    {settings?.status === "upcoming" ? "Election Upcoming" : settings?.status === "completed" ? "Election Completed" : "Cast Your Vote"}
                  </Link>
                )
              ) : (
                <Link to="/auth" className="px-8 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Sign In to Vote
                </Link>
              )}
              <Link to="/candidates" className="px-8 py-3 rounded-xl bg-primary-foreground/10 text-primary-foreground font-semibold hover:bg-primary-foreground/15 transition-colors border border-primary-foreground/10">View Candidates</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="container -mt-8 md:-mt-12 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={Users} label="Registered Voters" value={profileCount?.toLocaleString() ?? "0"} delay={0} />
          <StatCard icon={Vote} label="Voters Voted" value={votedCount?.toLocaleString() ?? "0"} variant="gold" delay={100} />
          <StatCard icon={TrendingUp} label="Voter Turnout" value={`${turnout}%`} delay={200} />
          <StatCard icon={CheckCircle} label="Positions" value={positionCount ?? 0} variant="navy" delay={300} />
        </div>
      </section>

      {/* Top Candidates + Quick Actions */}
      <section className="container py-12 md:py-16">
        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">Leading Candidates</h2>
            <div className="space-y-3">
              {topCandidates.length === 0 && <p className="text-muted-foreground text-sm">No votes cast yet.</p>}
              {topCandidates.map((c, i) => (
                <div key={c.candidate_id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4 shadow-elegant animate-slide-in-right" style={{ animationDelay: `${i * 80}ms` }}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? "gradient-gold text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.candidate_name}</p>
                    <p className="text-xs text-muted-foreground">{c.position_title} · {c.party_list}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-foreground">{c.vote_count}</p>
                    <p className="text-xs text-muted-foreground">votes</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-6">Quick Actions</h2>
            <div className="space-y-3">
              {[
                ...(isAdmin 
                  ? [{ to: "/admin", icon: Settings, label: "Admin Dashboard", desc: "Manage the election system", variant: "gold" }]
                  : [{ to: user ? "/vote" : "/auth", icon: Vote, label: "Cast Your Vote", desc: "Select your preferred candidates", variant: "gold" }]
                ),
                { to: "/candidates", icon: Users, label: "View Candidates", desc: "Know your candidates better", variant: "default" },
                { to: "/results", icon: BarChart3, label: "Live Results", desc: "See real-time election updates", variant: "default" },
              ].map((action, i) => (
                <Link key={action.to + i} to={action.to}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-elegant animate-fade-in ${
                    action.variant === "gold" ? "gradient-gold text-accent-foreground border-transparent shadow-gold" : "bg-card border-border text-foreground"
                  }`} style={{ animationDelay: `${i * 100}ms` }}>
                  <action.icon className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-semibold">{action.label}</p>
                    <p className={`text-xs ${action.variant === "gold" ? "opacity-70" : "text-muted-foreground"}`}>{action.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
