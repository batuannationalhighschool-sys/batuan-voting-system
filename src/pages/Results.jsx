import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { BarChart3, Trophy, TrendingUp, Pencil, Check, X, Printer, History, Calendar, Award } from "lucide-react";
import schoolSeal from "@/assets/school-seal.jpg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { supabase } from "@/lib/supabase";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

// Helper: check if a position title matches a specific grade level (word-boundary safe)
function gradeMatchesPosition(grade, positionTitle) {
  if (!grade || grade === "all") return true;
  const title = positionTitle.toLowerCase();
  if (!title.includes('representative')) return true;
  const gradeNum = grade.replace(/\D/g, '');
  if (!gradeNum) return title.includes(grade.toLowerCase());
  return new RegExp(`grade\\s*${gradeNum}\\b`, 'i').test(title);
}

export default function Results() {
  const [activePosition, setActivePosition] = useState("all");
  const [voterGrade, setVoterGrade] = useState("all");
  const [voterSection, setVoterSection] = useState("all");
  const { user, profile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef(null);

  // ── Tab state: "live" or "history" ──
  const [activeTab, setActiveTab] = useState("live");
  const [selectedYear, setSelectedYear] = useState("");
  const [historyPositionFilter, setHistoryPositionFilter] = useState("all");
  const [historyGradeFilter, setHistoryGradeFilter] = useState("all");
  const [historySectionFilter, setHistorySectionFilter] = useState("all");

  // Scroll to active position in Live tab
  useEffect(() => {
    if (activePosition !== "all") {
      const el = document.getElementById(`position-${activePosition}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activePosition]);

  // Scroll to active position in History tab
  useEffect(() => {
    if (historyPositionFilter !== "all") {
      const el = document.getElementById(`archived-position-${historyPositionFilter}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [historyPositionFilter]);

  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: () => api.get('/positions'),
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
    refetchInterval: 30000,
  });

  // Voter groups for dropdown options (grade levels & sections from voter profiles)
  const { data: voterGroups } = useQuery({
    queryKey: ["voter-groups"],
    queryFn: () => api.get('/voters/groups'),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats", voterGrade, voterSection],
    queryFn: () => api.get(`/stats${voteCountParams}`),
    refetchInterval: 30000,
  });

  const { data: settings } = useQuery({
    queryKey: ["election-settings"],
    queryFn: () => api.get('/election-settings'),
  });

  // ── Supabase Realtime: instant vote updates ──
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('live-votes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
      })
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ── Election History queries ──
  const { data: electionHistory } = useQuery({
    queryKey: ["election-history"],
    queryFn: () => api.get('/election-history'),
  });

  // Auto-select first year when history loads
  useEffect(() => {
    if (electionHistory && electionHistory.length > 0 && !selectedYear) {
      setSelectedYear(electionHistory[0].school_year);
    }
  }, [electionHistory, selectedYear]);

  const { data: archivedResults } = useQuery({
    queryKey: ["archived-results", selectedYear],
    queryFn: () => api.get(`/election-history/${encodeURIComponent(selectedYear)}/results`),
    enabled: !!selectedYear,
  });

  // Mutation to save the election name
  const updateName = useMutation({
    mutationFn: async (name) => {
      if (!settings?.id) throw new Error("Election settings not found");
      await api.put(`/election-settings/${settings.id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-settings"] });
      toast({ title: "Election name updated!" });
      setEditingName(false);
    },
    onError: (err) => {
      toast({ title: "Failed to update name", description: err.message, variant: "destructive" });
    },
  });

  const handleStartEditName = () => {
    setNameInput(settings?.name ?? "");
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    updateName.mutate(trimmed);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSaveName();
    if (e.key === "Escape") setEditingName(false);
  };

  const gradeLevels = voterGroups?.gradeLevels ?? [];
  const allSections = voterGroups?.sections ?? [];

  // Filter sections to those matching selected grade level
  const sections = useMemo(() => {
    if (voterGrade === "all") return [...new Set(allSections.map(s => s.section))];
    return allSections.filter(s => s.grade_level === voterGrade).map(s => s.section);
  }, [allSections, voterGrade]);

  const handleGradeChange = (val) => {
    setVoterGrade(val);
    setVoterSection("all");
    if (val !== "all" && activePosition !== "all") {
      const posObj = (positions ?? []).find(p => String(p.id) === String(activePosition));
      if (posObj && !gradeMatchesPosition(val, posObj.title)) {
        setActivePosition("all");
      }
    }
  };

  const votedCount = stats?.votedCount ?? 0;
  const profileCount = stats?.voterCount ?? 0;
  const turnout = profileCount && profileCount > 0 ? ((votedCount) / profileCount * 100).toFixed(1) : "0";

  const relevantPositions = useMemo(() => {
    if (voterGrade === "all") return positions ?? [];
    return (positions ?? []).filter(p => gradeMatchesPosition(voterGrade, p.title));
  }, [positions, voterGrade]);

  const grouped = (positions ?? []).map((pos) => {
    const posCandidates = (voteCounts ?? [])
      .filter((vc) => vc.position_id === pos.id)
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
    const totalPosVotes = posCandidates.reduce((sum, c) => sum + (c.vote_count ?? 0), 0);
    return { position: pos, candidates: posCandidates, totalVotes: totalPosVotes };
  });

  const relevantGrouped = useMemo(() => {
    if (voterGrade === "all") return grouped;
    return grouped.filter(g => gradeMatchesPosition(voterGrade, g.position.title));
  }, [grouped, voterGrade]);

  const filtered = activePosition === "all"
    ? relevantGrouped
    : relevantGrouped.filter(g => String(g.position.id) === String(activePosition));
  const hasVoterFilter = voterGrade !== "all" || voterSection !== "all";

  const electionName = settings?.name ?? "SSLG Election 2026";

  const schoolNameFull = settings?.school_name ?? "Batuan National High School — Batuan, Bohol, Philippines";
  const schoolNameParts = schoolNameFull.split(/\s+[—–-]\s+/);
  const schoolTitle    = schoolNameParts[0]?.trim() ?? "Batuan National High School";
  const schoolLocation = schoolNameParts.length > 1 ? schoolNameParts.slice(1).join(" — ") : "Batuan, Bohol, Philippines";

  // ── Group archived results by position ──
  const archivedGrouped = useMemo(() => {
    if (!archivedResults || archivedResults.length === 0) return [];
    const posMap = new Map();
    for (const row of archivedResults) {
      if (!posMap.has(row.position_title)) {
        posMap.set(row.position_title, {
          title: row.position_title,
          order: row.position_order,
          candidates: [],
          totalVotes: 0,
        });
      }
      const group = posMap.get(row.position_title);
      group.candidates.push(row);
      group.totalVotes += row.vote_count ?? 0;
    }
    const groups = Array.from(posMap.values()).sort((a, b) => a.order - b.order);
    return groups;
  }, [archivedResults]);

  // Distinct position titles in archived results (filtered by grade level if active)
  const archivedPositionTitles = useMemo(() => {
    let groups = archivedGrouped;
    if (historyGradeFilter !== "all") {
      groups = groups.filter(g => gradeMatchesPosition(historyGradeFilter, g.title));
    }
    return groups.map(g => g.title);
  }, [archivedGrouped, historyGradeFilter]);

  // Distinct grade levels from archived candidate results
  const archivedGradeLevels = useMemo(() => {
    if (!archivedResults) return [];
    const grades = [...new Set(archivedResults.map(r => r.candidate_grade).filter(Boolean))];
    return grades.sort();
  }, [archivedResults]);

  // Distinct sections from archived candidate results (filtered by selected grade)
  const archivedSections = useMemo(() => {
    if (!archivedResults) return [];
    const filtered = historyGradeFilter === "all"
      ? archivedResults
      : archivedResults.filter(r => r.candidate_grade === historyGradeFilter);
    const sects = [...new Set(filtered.map(r => r.candidate_section).filter(Boolean))];
    return sects.sort();
  }, [archivedResults, historyGradeFilter]);

  const handleHistoryGradeChange = (val) => {
    setHistoryGradeFilter(val);
    setHistorySectionFilter("all");
    if (val !== "all" && historyPositionFilter !== "all") {
      if (!gradeMatchesPosition(val, historyPositionFilter)) {
        setHistoryPositionFilter("all");
      }
    }
  };

  const filteredArchivedGrouped = useMemo(() => {
    let groups = archivedGrouped;

    // Filter out representative positions for other grade levels when grade filter is active
    if (historyGradeFilter !== "all") {
      groups = groups.filter(group => gradeMatchesPosition(historyGradeFilter, group.title));
    }

    // Apply grade/section filter to candidates within each group
    if (historyGradeFilter !== "all" || historySectionFilter !== "all") {
      groups = groups.map(group => {
        const matchedCandidates = group.candidates.filter(c => {
          if (historyGradeFilter !== "all" && c.candidate_grade !== historyGradeFilter) return false;
          if (historySectionFilter !== "all" && c.candidate_section !== historySectionFilter) return false;
          return true;
        });
        const unmatchedCandidates = group.candidates.filter(c => !matchedCandidates.includes(c));
        const reordered = [...matchedCandidates, ...unmatchedCandidates];
        return { ...group, candidates: reordered, filteredCandidates: matchedCandidates };
      });
    }

    return groups;
  }, [archivedGrouped, historyGradeFilter, historySectionFilter]);

  // Apply position filter to archived groups (mirrors live results behavior)
  const displayedArchivedGroups = useMemo(() => {
    if (historyPositionFilter === "all") return filteredArchivedGrouped;
    return filteredArchivedGrouped.filter(g => g.title === historyPositionFilter);
  }, [filteredArchivedGrouped, historyPositionFilter]);

  const hasHistoryFilter = historyGradeFilter !== "all" || historySectionFilter !== "all";

  // Currently selected history election info
  const selectedElection = (electionHistory ?? []).find(e => e.school_year === selectedYear);

  // Check if any history exists
  const hasHistory = (electionHistory ?? []).length > 0;

  return (
    <div className="container py-8 md:py-12">
      <style>{`
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
          }
          .container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .bg-card {
            background: #fff !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid;
            margin-bottom: 1.5rem !important;
          }
          .gradient-navy {
            background: #f8fafc !important;
            border-bottom: 2px solid #000 !important;
            color: #000 !important;
          }
          .gradient-navy h2, .gradient-navy p, .gradient-navy span {
            color: #000 !important;
          }
          .text-gold, .text-primary-foreground, .text-primary-foreground/50 {
            color: #000 !important;
          }
          .gradient-gold {
            background: #e2e8f0 !important;
            color: #000 !important;
          }
          .bg-muted {
            background: #f1f5f9 !important;
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      {/* Print-only letterhead / Header */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-8">
        <div className="flex items-center gap-4">
          <img src={schoolSeal} alt={schoolTitle} className="w-16 h-16 rounded-full object-cover border border-slate-200" />
          <div>
            <h2 className="text-xl font-bold font-display text-slate-900 leading-tight">{schoolTitle}</h2>
            <p className="text-xs text-slate-500 font-medium">{schoolLocation}</p>
            <p className="text-xs text-slate-400 mt-0.5">Supreme Student Learner Government Election System</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">Official Results Tally</p>
          <p>Election: <span className="font-semibold text-slate-800">{activeTab === "history" && selectedElection ? selectedElection.election_name : electionName}</span></p>
          <p>Tally Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
      </div>

      <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-gold" /> Election Results
          </h1>

          {/* Subtitle — editable by admin, read-only for everyone else */}
          <div className="flex items-center gap-2 mt-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">Live results for</span>
                <input
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={100}
                  className="px-2.5 py-1 rounded-lg bg-background border border-ring text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
                />
                <button
                  onClick={handleSaveName}
                  disabled={updateName.isPending}
                  className="p-1 rounded-md text-success hover:bg-success/10 transition-colors"
                  title="Save"
                >
                  {updateName.isPending
                    ? <div className="w-4 h-4 border-2 border-success/30 border-t-success rounded-full animate-spin" />
                    : <Check className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <p className="text-muted-foreground">Live results for <span className="font-medium text-foreground">{electionName}</span></p>
                {isAdmin && (
                  <button
                    onClick={handleStartEditName}
                    className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-gold hover:bg-gold/10 transition-all"
                    title="Edit election name"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-semibold text-sm shadow-gold hover:opacity-90 transition-opacity print:hidden"
          >
            <Printer className="w-4 h-4" /> Print Results Tally
          </button>
        )}
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-8 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === "live" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BarChart3 className="w-4 h-4" /> Live Results
          {isRealtimeConnected && (
            <span className="relative flex h-2 w-2" title="Real-time updates active">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === "history" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          <History className="w-4 h-4" /> Past Elections
          {hasHistory && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gold/15 text-gold">
              {(electionHistory ?? []).length}
            </span>
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── LIVE RESULTS TAB ── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "live" && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-8 print:hidden">
            <StatCard icon={TrendingUp} label="Voter Turnout" value={`${turnout}%`} variant="gold" />
            <StatCard icon={BarChart3} label="Voters Voted" value={profileCount > 0 ? `${votedCount.toLocaleString()} / ${profileCount.toLocaleString()}` : votedCount?.toLocaleString() ?? "0"} delay={100} />
            <StatCard icon={Trophy} label="Positions" value={relevantPositions.length} variant="navy" delay={200} />
          </div>

          {/* Filter Dropdowns */}
          <div className="bg-card border border-border rounded-xl p-4 mb-8 shadow-elegant print:hidden">
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
                  {relevantPositions.map((p) => (
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

          {/* Live Winners Summary */}
          {filtered.length > 0 && (
            <div className="bg-card border border-gold/20 rounded-xl p-5 mb-8 shadow-elegant print:hidden animate-fade-in">
              <h3 className="font-display font-bold text-foreground text-base mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-gold" /> Winners Summary
                {(voterGrade !== "all" || voterSection !== "all" || activePosition !== "all") && (
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    —{" "}
                    {activePosition !== "all"
                      ? (positions ?? []).find(p => String(p.id) === String(activePosition))?.title ?? "Selected Position"
                      : "All Positions"}
                    {voterGrade !== "all" ? ` · ${voterGrade}` : ""}
                    {voterSection !== "all" ? ` · ${voterSection}` : ""}
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((group) => {
                  const topCandidate = group.candidates[0];
                  const hasVotes = topCandidate && (topCandidate.vote_count ?? 0) > 0;
                  return (
                    <div key={group.position.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/60 border border-border">
                      <Trophy className={`w-4 h-4 flex-shrink-0 mt-0.5 ${hasVotes ? "text-gold" : "text-muted-foreground/30"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{group.position.title}</p>
                        {hasVotes ? (
                          <>
                            <p className="text-sm font-semibold text-foreground truncate uppercase">{topCandidate.candidate_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {(topCandidate.vote_count ?? 0).toLocaleString()} vote{topCandidate.vote_count !== 1 ? "s" : ""}
                              {group.candidates.length > 1 && group.candidates[1]?.candidate_name
                                ? ` · vs ${group.candidates[1].candidate_name.toUpperCase()} (${(group.candidates[1].vote_count ?? 0).toLocaleString()})`
                                : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No votes yet</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {filtered.map((group, gi) => (
              <div
                key={group.position.id}
                id={`position-${group.position.id}`}
                className={`bg-card rounded-xl border overflow-hidden shadow-elegant animate-fade-in transition-all duration-300 ${
                  activePosition !== "all" && String(activePosition) === String(group.position.id)
                    ? "ring-2 ring-gold border-gold shadow-gold-sm scale-[1.01]"
                    : "border-border"
                }`}
                style={{ animationDelay: `${gi * 100}ms` }}
              >
                <div className="gradient-navy p-4 md:p-5 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-display font-bold text-primary-foreground text-lg">{group.position.title}</h2>
                    <p className="text-xs text-primary-foreground/50">
                      {group.totalVotes.toLocaleString()} total votes
                      {hasVoterFilter && (
                        <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold uppercase tracking-wider">
                          Filtered
                        </span>
                      )}
                    </p>
                  </div>
                  {group.candidates[0] && (group.candidates[0].vote_count ?? 0) > 0 && (
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-gold" />
                      <span className="text-sm font-semibold text-gold uppercase">{group.candidates[0].candidate_name}</span>
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
                              <p className="font-semibold text-foreground text-sm uppercase">{c.candidate_name}</p>
                              <p className="text-xs text-muted-foreground">{c.party_list}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-display font-bold text-foreground">{(c.vote_count ?? 0).toLocaleString()}</span>
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
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── PAST ELECTIONS TAB ── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className="animate-fade-in">
          {!hasHistory ? (
            /* Empty state */
            <div className="bg-card rounded-xl border border-border p-12 text-center shadow-elegant">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display font-bold text-foreground text-lg mb-2">No Past Elections</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                No election results have been archived yet. Once an election is completed and archived by the administrator, past results will appear here.
              </p>
            </div>
          ) : (
            <>
              {/* History Header Card */}
              <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-elegant">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* School Year */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Select School Year
                    </p>
                    <select
                      value={selectedYear}
                      onChange={(e) => {
                        setSelectedYear(e.target.value);
                        setHistoryPositionFilter("all");
                        setHistoryGradeFilter("all");
                        setHistorySectionFilter("all");
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {(electionHistory ?? []).map((e) => (
                        <option key={e.school_year} value={e.school_year}>
                          {e.election_name} — S.Y. {e.school_year}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Position */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Filter by Position</p>
                    <select
                      value={historyPositionFilter}
                      onChange={(e) => setHistoryPositionFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">All Positions</option>
                      {archivedPositionTitles.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Grade */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Filter by Grade</p>
                    <select
                      value={historyGradeFilter}
                      onChange={(e) => handleHistoryGradeChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">All Grades</option>
                      {archivedGradeLevels.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter by Section */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Filter by Section</p>
                    <select
                      value={historySectionFilter}
                      onChange={(e) => setHistorySectionFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">All Sections</option>
                      {archivedSections.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active filter indicator */}
                {(historyGradeFilter !== "all" || historySectionFilter !== "all") && (
                  <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground italic">
                      Showing candidates from: <span className="text-foreground font-medium">
                        {historyGradeFilter !== "all" ? historyGradeFilter : "All Grades"}
                        {historySectionFilter !== "all" ? ` · ${historySectionFilter}` : ""}
                      </span>
                    </p>
                    <button
                      onClick={() => { setHistoryGradeFilter("all"); setHistorySectionFilter("all"); }}
                      className="text-xs font-medium text-gold hover:text-gold/80 transition-colors"
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}

                {selectedElection && (
                  <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {selectedElection.election_date
                        ? new Date(selectedElection.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "Date not set"}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                      Archived
                    </span>
                    <span className="text-muted-foreground/60">
                      Archived on {selectedElection.archived_at
                        ? new Date(selectedElection.archived_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </span>
                  </div>
                )}
              </div>

              {/* Winners Summary Card */}
              {displayedArchivedGroups.length > 0 && (
                <div className="bg-card border border-gold/20 rounded-xl p-5 mb-6 shadow-elegant">
                  <h3 className="font-display font-bold text-foreground text-base mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-gold" /> Winners Summary
                    {(historyGradeFilter !== "all" || historySectionFilter !== "all" || historyPositionFilter !== "all") && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        —{" "}
                        {historyPositionFilter !== "all" ? historyPositionFilter : "All Positions"}
                        {historyGradeFilter !== "all" ? ` · ${historyGradeFilter}` : ""}
                        {historySectionFilter !== "all" ? ` · ${historySectionFilter}` : ""}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayedArchivedGroups.map((group) => {
                      // Always show official winners from the archived data
                      const officialWinners = group.candidates.filter(c => c.is_winner);
                      const topCandidates = officialWinners.length > 0 ? officialWinners : [];

                      return (
                        <div key={group.title} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/60 border border-border">
                          <Trophy className={`w-4 h-4 flex-shrink-0 mt-0.5 ${topCandidates.length > 0 ? "text-gold" : "text-muted-foreground/40"}`} />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{group.title}</p>
                            {topCandidates.length > 0 ? (
                              topCandidates.map(w => (
                                <div key={w.candidate_name}>
                                  <p className="text-sm font-semibold text-foreground truncate uppercase">{w.candidate_name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {(w.vote_count ?? 0).toLocaleString()} vote{(w.vote_count ?? 0) !== 1 ? "s" : ""}
                                    {(w.candidate_grade || w.candidate_section) && ` · ${w.candidate_grade ?? ""}${w.candidate_section ? ` — ${w.candidate_section}` : ""}`}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No candidates for this filter</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Full Results by Position */}
              <div className="space-y-6">
                {displayedArchivedGroups.map((group, gi) => {
                  const filteredSet = new Set((group.filteredCandidates ?? []).map(c => c.candidate_name));

                  // Always use all candidates with their real vote counts
                  const allCandidates = group.candidates;
                  const allTotal = allCandidates.reduce((sum, c) => sum + (c.vote_count ?? 0), 0);

                  // Official winners from the archived data
                  const officialWinners = allCandidates.filter(c => c.is_winner);

                  return (
                    <div
                      key={group.title}
                      id={`archived-position-${group.title}`}
                      className="bg-card rounded-xl border overflow-hidden shadow-elegant animate-fade-in transition-all duration-300 border-border"
                      style={{ animationDelay: `${gi * 100}ms` }}
                    >
                      {/* Position Header */}
                      <div className="gradient-navy p-4 md:p-5 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h2 className="font-display font-bold text-primary-foreground text-lg">{group.title}</h2>
                          <p className="text-xs text-primary-foreground/50">
                            {allTotal.toLocaleString()} total votes
                            {hasHistoryFilter && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold uppercase tracking-wider">
                                Filtered
                              </span>
                            )}
                          </p>
                        </div>
                        {officialWinners.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-gold" />
                            <span className="text-sm font-semibold text-gold uppercase">
                              {officialWinners.map(w => w.candidate_name).join(", ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Candidates List */}
                      <div className="p-4 md:p-5 space-y-4">
                        {allCandidates.length === 0 && (
                          <p className="text-muted-foreground text-sm">No candidates in this position.</p>
                        )}
                        {allCandidates.map((c, ci) => {
                          const pct = allTotal > 0
                            ? (((c.vote_count ?? 0) / allTotal) * 100).toFixed(1)
                            : "0";
                          const isWinner = c.is_winner;
                          // Candidate matches the active grade/section filter
                          const isMatch = hasHistoryFilter && filteredSet.has(c.candidate_name);

                          return (
                            <div key={`${c.candidate_name}-${ci}`} className="animate-fade-in" style={{ animationDelay: `${ci * 60}ms` }}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-3">
                                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isWinner ? "gradient-gold text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {c.rank}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-foreground text-sm flex items-center gap-1.5 uppercase">
                                      {c.candidate_name}
                                      {isWinner && <Trophy className="w-3 h-3 text-gold" />}
                                      {isMatch && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 font-bold uppercase tracking-wide normal-case">
                                          {historyGradeFilter !== "all" ? historyGradeFilter : ""}{historySectionFilter !== "all" ? ` ${historySectionFilter}` : ""}
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {c.candidate_party}
                                      {c.candidate_grade && ` · ${c.candidate_grade}`}
                                      {c.candidate_section && ` — ${c.candidate_section}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-display font-bold text-foreground">{(c.vote_count ?? 0).toLocaleString()}</span>
                                  <span className="text-xs text-muted-foreground ml-1.5">({pct}%)</span>
                                </div>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${isWinner ? "gradient-gold" : "bg-navy-light/50"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Print-only signature block */}
      <div className="hidden print:grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-300 text-sm">
        <div>
          <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">Prepared By:</p>
          <div className="mt-8 border-b border-slate-400 w-56 h-5"></div>
          <p className="text-xs font-semibold text-slate-800 mt-1">Election Committee Chairman</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <p className="text-slate-500 text-xs uppercase tracking-wide font-semibold">Attested By:</p>
          <div className="mt-8 border-b border-slate-400 w-56 h-5"></div>
          <p className="text-xs font-semibold text-slate-800 mt-1">School Principal / Admin Representative</p>
        </div>
      </div>
    </div>
  );
}
