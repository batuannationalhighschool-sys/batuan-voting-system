import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Vote, Calendar, TrendingUp, CheckCircle, LogIn, Trophy, User, Award } from "lucide-react";
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

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get('/candidates'),
  });

  const profileCount = stats?.voterCount ?? 0;
  const votedCount = stats?.votedCount ?? 0;
  const totalVotes = stats?.totalVotes ?? 0;
  const positionCount = stats?.positionCount ?? 0;

  const turnout = profileCount && profileCount > 0 ? ((votedCount) / profileCount * 100).toFixed(1) : "0";

  const topCandidates = useMemo(() => {
    return [...(voteCounts ?? [])].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 6);
  }, [voteCounts]);

  const candidatesMap = useMemo(() => {
    const map = new Map();
    (candidates ?? []).forEach((c) => map.set(c.id, c));
    return map;
  }, [candidates]);

  const maxLeadingVotes = useMemo(() => {
    return Math.max(...topCandidates.map((c) => c.vote_count ?? 0), 1);
  }, [topCandidates]);

  const partyColors = {
    Pagbabago: "bg-primary/10 text-primary border-primary/20",
    "Bagong Pag-asa": "bg-success/10 text-success border-success/20",
    Kabataan: "bg-accent/10 text-accent-foreground border-accent/20",
  };

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
            <div className="relative group mb-8 md:mb-10 animate-scale-in">
              {/* Ambient gold glow halo */}
              <div className="absolute -inset-3 sm:-inset-4 md:-inset-6 rounded-full bg-gradient-to-tr from-gold/40 via-amber-300/30 to-gold/50 blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-500" />
              
              {/* Multi-layered gold medallion bezel */}
              <div className="relative p-2 sm:p-2.5 md:p-3.5 rounded-full bg-gradient-to-b from-amber-200 via-gold to-amber-700 shadow-[0_12px_40px_rgba(217,160,20,0.4)] ring-2 ring-gold/50">
                <div className="p-1 sm:p-1.5 rounded-full bg-[#0a1529] shadow-inner">
                  <img 
                    src={schoolSeal} 
                    alt="Batuan National High School Seal" 
                    className="w-52 h-52 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-full object-cover shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]" 
                  />
                </div>
              </div>
            </div>
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

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 mt-9 animate-fade-in" style={{ animationDelay: "400ms" }}>
              {user ? (
                isAdmin ? (
                  <Link to="/admin" className="px-9 py-3.5 sm:px-10 sm:py-4 rounded-2xl gradient-navy text-primary-foreground font-bold text-base sm:text-lg hover:opacity-90 transition-all shadow-lg hover:scale-105">
                    Admin Dashboard
                  </Link>
                ) : (
                  <Link to="/vote" className="px-9 py-3.5 sm:px-10 sm:py-4 rounded-2xl gradient-gold text-accent-foreground font-bold text-base sm:text-lg shadow-gold hover:opacity-90 transition-all hover:scale-105">
                    {settings?.status === "upcoming" ? "Election Upcoming" : settings?.status === "completed" ? "Election Completed" : "Cast Your Vote"}
                  </Link>
                )
              ) : (
                <Link to="/auth" className="px-9 py-3.5 sm:px-10 sm:py-4 rounded-2xl gradient-gold text-accent-foreground font-bold text-base sm:text-lg shadow-gold hover:opacity-90 transition-all hover:scale-105 flex items-center gap-2.5">
                  <LogIn className="w-5 h-5" />
                  Sign In to Vote
                </Link>
              )}
              <Link to="/candidates" className="px-9 py-3.5 sm:px-10 sm:py-4 rounded-2xl bg-primary-foreground/10 text-primary-foreground font-bold text-base sm:text-lg hover:bg-primary-foreground/15 transition-all hover:scale-105 border border-primary-foreground/15 shadow-lg">
                View Candidates
              </Link>
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

      {/* Leading Candidates */}
      <section className="container py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center gap-2 text-gold font-semibold text-xs sm:text-sm tracking-wider uppercase mb-1.5">
              <Trophy className="w-4 h-4 text-gold animate-bounce" />
              Live Standings
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground">
              Leading Candidates
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
              Top candidates currently leading the vote counts
            </p>
          </div>

          {topCandidates.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-8 sm:p-12 text-center shadow-elegant">
              <div className="w-16 h-16 rounded-full bg-gold/10 text-gold flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground font-display mb-1">No Votes Cast Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Be the first to vote for your preferred student leaders when voting is active!
              </p>
              <Link
                to={user ? "/vote" : "/auth"}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl gradient-gold text-accent-foreground font-semibold text-sm shadow-gold hover:opacity-90 transition-all"
              >
                <Vote className="w-4 h-4" />
                {user ? "Cast Your Vote" : "Sign In to Vote"}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {topCandidates.map((c, i) => {
                const fullCand = candidatesMap.get(c.candidate_id);
                const avatar = fullCand?.avatar_url || c.avatar_url;
                const votePercentage = maxLeadingVotes > 0 
                  ? Math.min(Math.round(((c.vote_count ?? 0) / maxLeadingVotes) * 100), 100) 
                  : 0;

                const rankBadges = [
                  { bg: "gradient-gold text-accent-foreground shadow-gold ring-2 ring-gold/40", label: "1st Place", shortLabel: "1st" },
                  { bg: "bg-slate-300 text-slate-900 shadow-md ring-2 ring-slate-400/40", label: "2nd Place", shortLabel: "2nd" },
                  { bg: "bg-amber-700 text-amber-100 shadow-md ring-2 ring-amber-600/40", label: "3rd Place", shortLabel: "3rd" },
                ];
                const rankInfo = rankBadges[i] || { bg: "bg-muted text-muted-foreground ring-1 ring-border", label: `Rank #${i + 1}`, shortLabel: `#${i + 1}` };

                return (
                  <div
                    key={c.candidate_id}
                    className="group relative bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-elegant hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between overflow-hidden animate-fade-in"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    {/* Ambient top glow on rank 1 */}
                    {i === 0 && (
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
                    )}

                    <div>
                      {/* Top row: Rank badge + Party list badge */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${rankInfo.bg}`}>
                          {i === 0 && <Trophy className="w-3.5 h-3.5" />}
                          {rankInfo.label}
                        </span>

                        {c.party_list && (
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border truncate max-w-[140px] ${
                            partyColors[c.party_list] || "bg-muted text-muted-foreground border-border"
                          }`}>
                            {c.party_list}
                          </span>
                        )}
                      </div>

                      {/* Candidate Avatar & Info */}
                      <div className="flex sm:flex-col items-center sm:text-center gap-4 sm:gap-3 mb-4">
                        <div className="relative shrink-0">
                          <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden flex items-center justify-center ring-4 transition-transform duration-300 group-hover:scale-105 ${
                            i === 0 ? "ring-gold/60 shadow-gold" : "ring-border shadow-md"
                          }`}>
                            {avatar ? (
                              <img
                                src={avatar}
                                alt={c.candidate_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full gradient-navy flex items-center justify-center">
                                <User className="w-9 h-9 text-gold" />
                              </div>
                            )}
                          </div>
                          {i === 0 && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-gold text-accent-foreground p-1 rounded-full shadow">
                              <Trophy className="w-3 h-3" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 sm:w-full">
                          <h3 className="font-display font-bold text-foreground text-base sm:text-lg uppercase tracking-tight truncate">
                            {c.candidate_name}
                          </h3>
                          <p className="text-xs sm:text-sm font-semibold text-gold mt-0.5 truncate">
                            {c.position_title}
                          </p>
                          {(c.grade_level || c.section) && (
                            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                              {[c.grade_level, c.section].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vote progress & count */}
                    <div className="mt-2 pt-3.5 border-t border-border/80">
                      <div className="flex items-baseline justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground font-medium">Votes Cast</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl sm:text-2xl font-display font-extrabold text-foreground">
                            {c.vote_count?.toLocaleString() ?? 0}
                          </span>
                          <span className="text-[11px] text-muted-foreground">votes</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            i === 0 ? "gradient-gold shadow-gold" : "bg-primary"
                          }`}
                          style={{ width: `${votePercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
