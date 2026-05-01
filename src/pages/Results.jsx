import { useState, useMemo } from "react";
import { BarChart3, Trophy, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";

export default function Results() {
  const [activePosition, setActivePosition] = useState("all");
  const [voterGrade, setVoterGrade] = useState("all");
  const [voterSection, setVoterSection] = useState("all");
  const { user, profile, isAdmin } = useAuth();

  const gradeLevel = !isAdmin && user ? profile?.grade_level : null;
  const posQueryParams = gradeLevel
    ? `?grade_level=${encodeURIComponent(gradeLevel)}`
    : '';

  const { data: positions } = useQuery({
    queryKey: ["positions", gradeLevel],
    queryFn: () => api.get(`/positions${posQueryParams}`),
  });

  // Build vote count query params based on voter filters
  const voteCountParams = useMemo(() => {
    const p = new URLSearchParams();
    if (voterGrade !== "all") p.set("voter_grade", voterGrade);
    if (voterSection !== "all") p.set("voter_section", voterSection);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [voterGrade, voterSection]);

  const { data: voteCounts } = useQuery({
    queryKey: ["vote-counts", voterGrade, voterSection],
    queryFn: () => api.get(`/votes/counts${voteCountParams}`),
    refetchInterval: 10000,
  });

  // Voter groups for dropdown options (grade levels & sections from voter profiles)
  const { data: voterGroups } = useQuery({
    queryKey: ["voter-groups"],
    queryFn: () => api.get('/voters/groups'),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => api.get('/stats'),
  });

  const gradeLevels = voterGroups?.gradeLevels ?? [];
  const allSections = voterGroups?.sections ?? [];

  // Filter sections to those matching selected grade level
  const sections = useMemo(() => {
    if (voterGrade === "all") return allSections.map(s => s.section);
    return allSections.filter(s => s.grade_level === voterGrade).map(s => s.section);
  }, [allSections, voterGrade]);

  const handleGradeChange = (val) => {
    setVoterGrade(val);
    setVoterSection("all");
  };

  const votedCount = stats?.votedCount ?? 0;
  const profileCount = stats?.voterCount ?? 0;
  const turnout = profileCount && profileCount > 0 ? ((votedCount) / profileCount * 100).toFixed(1) : "0";

  const grouped = (positions ?? []).map((pos) => {
    const posCandidates = (voteCounts ?? [])
      .filter((vc) => vc.position_id === pos.id)
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
    const totalPosVotes = posCandidates.reduce((sum, c) => sum + (c.vote_count ?? 0), 0);
    return { position: pos, candidates: posCandidates, totalVotes: totalPosVotes };
  });

  const filtered = activePosition === "all" ? grouped : grouped.filter((g) => g.position.id === activePosition);
  const hasVoterFilter = voterGrade !== "all" || voterSection !== "all";

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-gold" /> Election Results
        </h1>
        <p className="text-muted-foreground mt-1">Live results for SSLG Election 2026</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8">
        <StatCard icon={TrendingUp} label="Voter Turnout" value={`${turnout}%`} variant="gold" />
        <StatCard icon={BarChart3} label="Voters Voted" value={votedCount?.toLocaleString() ?? "0"} delay={100} />
        <StatCard icon={Trophy} label="Positions" value={(positions ?? []).length} variant="navy" delay={200} />
      </div>

      {/* Filter Dropdowns */}
      <div className="bg-card border border-border rounded-xl p-4 mb-8 shadow-elegant">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Filter Results</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="results-position-filter" className="block text-xs text-muted-foreground mb-1.5">Position</label>
            <select
              id="results-position-filter"
              value={activePosition}
              onChange={(e) => setActivePosition(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Positions</option>
              {(positions ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="results-grade-filter" className="block text-xs text-muted-foreground mb-1.5">Grade Level <span className="text-gold/70">(by voter)</span></label>
            <select
              id="results-grade-filter"
              value={voterGrade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Grade Levels</option>
              {gradeLevels.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="results-section-filter" className="block text-xs text-muted-foreground mb-1.5">Section <span className="text-gold/70">(by voter)</span></label>
            <select
              id="results-section-filter"
              value={voterSection}
              onChange={(e) => setVoterSection(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Sections</option>
              {sections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {hasVoterFilter && (
          <div className="mt-3 flex items-center gap-4">
            <p className="text-xs text-muted-foreground italic">
              Showing votes cast by: <span className="text-foreground font-medium">
                {voterGrade !== "all" ? voterGrade : "All Grades"}
                {voterSection !== "all" ? ` · ${voterSection}` : ""}
              </span>
            </p>
            <button
              onClick={() => { setVoterGrade("all"); setVoterSection("all"); setActivePosition("all"); }}
              className="text-xs font-medium text-gold hover:text-gold/80 transition-colors"
            >
              ✕ Clear
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {filtered.map((group, gi) => (
          <div key={group.position.id} className="bg-card rounded-xl border border-border overflow-hidden shadow-elegant animate-fade-in" style={{ animationDelay: `${gi * 100}ms` }}>
            <div className="gradient-navy p-4 md:p-5 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="font-display font-bold text-primary-foreground text-lg">{group.position.title}</h2>
                <p className="text-xs text-primary-foreground/50">{group.totalVotes} total votes</p>
              </div>
              {group.candidates[0] && (
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold text-gold">{group.candidates[0].candidate_name}</span>
                </div>
              )}
            </div>
            <div className="p-4 md:p-5 space-y-4">
              {group.candidates.length === 0 && <p className="text-muted-foreground text-sm">No candidates registered.</p>}
              {group.candidates.map((c, ci) => {
                const pct = group.totalVotes ? (((c.vote_count ?? 0) / group.totalVotes) * 100).toFixed(1) : "0";
                return (
                  <div key={c.candidate_id} className="animate-fade-in" style={{ animationDelay: `${ci * 60}ms` }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${ci === 0 ? "gradient-gold text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{ci + 1}</span>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{c.candidate_name}</p>
                          <p className="text-xs text-muted-foreground">{c.party_list}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-display font-bold text-foreground">{c.vote_count}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${ci === 0 ? "gradient-gold" : "bg-navy-light/50"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
