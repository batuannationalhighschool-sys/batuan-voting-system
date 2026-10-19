import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { BarChart3, Trophy, TrendingUp, Pencil, Check, X, Printer, History, Calendar, Award, ShieldCheck, AlertTriangle, Gavel, MessageSquare, CheckCircle2, Users, FileText, ChevronRight } from "lucide-react";
import schoolSeal from "@/assets/school-seal.jpg";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { supabase } from "@/lib/supabase";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/contexts/AuthContext";
import { useElection } from "@/contexts/ElectionContext";
import { useToast } from "@/hooks/use-toast";

const NEXT_GRADE_REP_MAP = {
  'grade 7': 'grade 8 representative',
  'grade 8': 'grade 9 representative',
  'grade 9': 'grade 10 representative',
  'grade 10': 'grade 11 representative',
  'grade 11': 'grade 12 representative',
};

// Helper: check if a position title matches a specific voter grade level (next-grade representative mapping)
function gradeMatchesPosition(voterGrade, positionTitle) {
  if (!voterGrade || voterGrade === "all") return true;
  const title = positionTitle.toLowerCase();
  if (!title.includes('representative')) return true;
  const key = voterGrade.trim().toLowerCase();
  const allowedRep = NEXT_GRADE_REP_MAP[key];
  if (!allowedRep) return false;
  return title === allowedRep || title.includes(allowedRep.replace(' representative', ''));
}



export default function Results() {
  const [activePosition, setActivePosition] = useState("all");
  const [voterGrade, setVoterGrade] = useState("all");
  const [voterSection, setVoterSection] = useState("all");
  const { user, profile, isAdmin } = useAuth();
  const { setActiveSchoolYear } = useElection();
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

  // ── Print Mode state & modal ──
  // 'candidates': Only Candidates (No numbers, positions & party lists only)
  // 'winners': Only Candidates Winners (Proclamation sheet for each position)
  // 'final': Final Results (Complete system results tally)
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printMode, setPrintMode] = useState("final");

  // Close print modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showPrintModal) {
        setShowPrintModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showPrintModal]);

  const handleTriggerPrint = (mode) => {
    setPrintMode(mode);
    setShowPrintModal(false);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handlePaperSizeChange = (newSize) => {
    setPaperSize(newSize);
    try {
      localStorage.setItem("bnhs_paper_size", newSize);
    } catch (_) {}
  };

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

  // ── Paper size state (short: 8.5x11" Letter, long: 8.5x13" Folio) ──
  const [paperSize, setPaperSize] = useState(() => {
    try {
      return localStorage.getItem("bnhs_paper_size") || "short";
    } catch (_) {
      return "short";
    }
  });

  useEffect(() => {
    if (settings?.paper_size) {
      setPaperSize(settings.paper_size);
      try {
        localStorage.setItem("bnhs_paper_size", settings.paper_size);
      } catch (_) {}
    }
  }, [settings?.paper_size]);

  // ── Position Verifications & Tie Resolutions (Public / Student / Admin) ──
  const { data: liveVerifications } = useQuery({
    queryKey: ["position-verifications"],
    queryFn: () => api.get('/position-verifications'),
    refetchInterval: 15000,
  });

  // ── All registered candidates (for Option 1: ONLY CANDIDATES roster) ──
  const { data: allLiveCandidates } = useQuery({
    queryKey: ["all-candidates-list"],
    queryFn: () => api.get('/candidates'),
  });

  // ── Supabase Realtime: instant vote & verification updates ──
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('live-votes-and-verifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, () => {
        queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
        queryClient.invalidateQueries({ queryKey: ["stats"] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'position_verifications' }, () => {
        queryClient.invalidateQueries({ queryKey: ["position-verifications"] });
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

  const { data: historyVerifications } = useQuery({
    queryKey: ["position-verifications", selectedYear],
    queryFn: () => api.get(`/position-verifications?school_year=${encodeURIComponent(selectedYear)}`),
    enabled: activeTab === "history" && !!selectedYear,
  });

  // Auto-select first year when history loads
  useEffect(() => {
    if (electionHistory && electionHistory.length > 0 && !selectedYear) {
      setSelectedYear(electionHistory[0].school_year);
    }
  }, [electionHistory, selectedYear]);

  // Synchronize activeSchoolYear with ElectionContext so footer year reflects selected election / school year
  useEffect(() => {
    if (activeTab === "history" && selectedYear) {
      setActiveSchoolYear(selectedYear);
    } else if (activeTab === "live") {
      setActiveSchoolYear(settings?.school_year || null);
    }
  }, [activeTab, selectedYear, settings?.school_year, setActiveSchoolYear]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      setActiveSchoolYear(null);
    };
  }, [setActiveSchoolYear]);

  const historyResultsParams = useMemo(() => {
    const p = new URLSearchParams();
    if (historyGradeFilter !== "all") p.set("voter_grade", historyGradeFilter);
    if (historySectionFilter !== "all") p.set("voter_section", historySectionFilter);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
  }, [historyGradeFilter, historySectionFilter]);

  const { data: archivedResults } = useQuery({
    queryKey: ["archived-results", selectedYear, historyGradeFilter, historySectionFilter],
    queryFn: () => api.get(`/election-history/${encodeURIComponent(selectedYear)}/results${historyResultsParams}`),
    enabled: !!selectedYear,
  });

  const { data: archivedVoterGroups } = useQuery({
    queryKey: ["archived-voter-groups", selectedYear],
    queryFn: () => api.get(`/election-history/${encodeURIComponent(selectedYear)}/groups`),
    enabled: !!selectedYear,
  });

  useEffect(() => {
    if (archivedVoterGroups && !archivedVoterGroups.filterSupported) {
      setHistoryGradeFilter("all");
      setHistorySectionFilter("all");
    }
  }, [archivedVoterGroups]);

  // Mutation to save the election name
  const updateName = useMutation({
    mutationFn: async (name) => {
      if (!settings?.id) throw new Error("Election settings not found");
      await api.put(`/election-settings/${settings.id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["election-settings"] });
      toast({ title: "Election name updated!", variant: "success" });
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

  const handleSectionChange = (val) => {
    setVoterSection(val);
    if (val !== "all") {
      // Auto-detect and set the grade level that this section belongs to
      const sectionEntry = allSections.find(s => s.section === val);
      if (sectionEntry?.grade_level && sectionEntry.grade_level !== voterGrade) {
        setVoterGrade(sectionEntry.grade_level);
        // Also reset position filter if incompatible with newly auto-set grade
        if (activePosition !== "all") {
          const posObj = (positions ?? []).find(p => String(p.id) === String(activePosition));
          if (posObj && !gradeMatchesPosition(sectionEntry.grade_level, posObj.title)) {
            setActivePosition("all");
          }
        }
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
    const maxVotes = pos.max_votes ?? 1;
    const posCandidates = (voteCounts ?? [])
      .filter((vc) => vc.position_id === pos.id)
      .sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0));
    const totalPosVotes = posCandidates.reduce((sum, c) => sum + (c.vote_count ?? 0), 0);
    const topVotes = posCandidates[0]?.vote_count ?? 0;
    const hasVotes = topVotes > 0;

    // Tie occurs across the winning threshold (maxVotes).
    // A tie exists if a candidate outside the winning seats (index >= maxVotes)
    // has the exact same vote count as the candidate at the last winning seat (index maxVotes - 1).
    let isTie = false;
    let tiedCandidates = [];
    if (hasVotes && posCandidates.length > maxVotes) {
      const cutoffVotes = posCandidates[maxVotes - 1]?.vote_count ?? 0;
      if (cutoffVotes > 0 && posCandidates[maxVotes]?.vote_count === cutoffVotes) {
        isTie = true;
        tiedCandidates = posCandidates.filter(c => c.vote_count === cutoffVotes);
      }
    }

    return {
      position: pos,
      candidates: posCandidates,
      totalVotes: totalPosVotes,
      topVotes,
      hasVotes,
      maxVotes,
      tiedCandidates,
      isTie,
    };
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
  const schoolTitle = schoolNameParts[0]?.trim() ?? "Batuan National High School";
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
    const groups = Array.from(posMap.values())
      .map(g => ({
        ...g,
        candidates: g.candidates.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
      }))
      .sort((a, b) => a.order - b.order);
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

  // Historical filter options come from the voter roster captured when that
  // election was archived, not from today's profiles or candidate metadata.
  const archivedGradeLevels = archivedVoterGroups?.gradeLevels ?? [];
  const archivedSections = useMemo(() => {
    const groups = archivedVoterGroups?.sections ?? [];
    return [...new Set(groups
      .filter(g => historyGradeFilter === "all" || g.grade_level === historyGradeFilter)
      .map(g => g.section)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));
  }, [archivedVoterGroups, historyGradeFilter]);

  const handleHistoryGradeChange = (val) => {
    setHistoryGradeFilter(val);
    setHistorySectionFilter("all");
    if (val !== "all" && historyPositionFilter !== "all") {
      if (!gradeMatchesPosition(val, historyPositionFilter)) {
        setHistoryPositionFilter("all");
      }
    }
  };

  const handleHistorySectionChange = (val) => {
    setHistorySectionFilter(val);
    if (val !== "all") {
      // Auto-detect and set the grade level that this section belongs to
      const allArchivedSections = archivedVoterGroups?.sections ?? [];
      const sectionEntry = allArchivedSections.find(s => s.section === val);
      if (sectionEntry?.grade_level && sectionEntry.grade_level !== historyGradeFilter) {
        setHistoryGradeFilter(sectionEntry.grade_level);
        if (historyPositionFilter !== "all" && !gradeMatchesPosition(sectionEntry.grade_level, historyPositionFilter)) {
          setHistoryPositionFilter("all");
        }
      }
    }
  };

  const filteredArchivedGrouped = useMemo(() => {
    let groups = archivedGrouped;

    // Filter out representative positions for other grade levels when grade filter is active
    if (historyGradeFilter !== "all") {
      groups = groups.filter(group => gradeMatchesPosition(historyGradeFilter, group.title));
    }

    return groups;
  }, [archivedGrouped, historyGradeFilter]);

  // Apply position filter to archived groups (mirrors live results behavior)
  const displayedArchivedGroups = useMemo(() => {
    if (historyPositionFilter === "all") return filteredArchivedGrouped;
    return filteredArchivedGrouped.filter(g => g.title === historyPositionFilter);
  }, [filteredArchivedGrouped, historyPositionFilter]);

  // Currently selected history election info
  const selectedElection = (electionHistory ?? []).find(e => e.school_year === selectedYear);
  const historyFilterSupported = archivedVoterGroups?.filterSupported
    ?? selectedElection?.voter_filter_available
    ?? false;
  const hasHistoryFilter = historyGradeFilter !== "all" || historySectionFilter !== "all" || historyPositionFilter !== "all";

  // Check if any history exists
  const hasHistory = (electionHistory ?? []).length > 0;

  const isLong = paperSize === "long";

  // ── Normalized candidates for Choice 1 (ONLY CANDIDATE) ──
  // Rule: Strictly candidate names, positions, and parties ONLY. NO NUMBERS AT ALL.
  const printCandidatesData = useMemo(() => {
    if (activeTab === "history") {
      const groups = displayedArchivedGroups.length > 0 ? displayedArchivedGroups : filteredArchivedGrouped;
      return groups.map(g => {
        const sortedCand = [...g.candidates].sort((a, b) =>
          (a.candidate_name || "").localeCompare(b.candidate_name || "")
        );
        return {
          title: g.title,
          candidates: sortedCand.map(c => ({
            name: c.candidate_name,
            party: c.candidate_party || c.party_list || "INDEPENDENT",
            grade: c.candidate_grade,
            section: c.candidate_section,
          })),
        };
      });
    } else {
      const posList = relevantPositions.length > 0 ? relevantPositions : (positions ?? []);
      return posList.map(pos => {
        let candList = (allLiveCandidates ?? []).filter(c => c.position_id === pos.id);
        if (candList.length === 0) {
          candList = (voteCounts ?? [])
            .filter(vc => vc.position_id === pos.id)
            .map(vc => ({
              id: vc.candidate_id,
              name: vc.candidate_name,
              party_list: vc.party_list,
              grade_level: vc.grade_level,
              section: vc.section,
            }));
        }
        const sortedCand = [...candList].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "")
        );
        return {
          title: pos.title,
          candidates: sortedCand.map(c => ({
            name: c.name,
            party: c.party_list || "INDEPENDENT",
            grade: c.grade_level,
            section: c.section,
          })),
        };
      });
    }
  }, [activeTab, displayedArchivedGroups, filteredArchivedGrouped, relevantPositions, positions, allLiveCandidates, voteCounts]);

  // ── Normalized winners for Choice 2 (ONLY CANDIDATES WINNERS) ──
  const printWinnersData = useMemo(() => {
    if (activeTab === "history") {
      const groups = displayedArchivedGroups.length > 0 ? displayedArchivedGroups : filteredArchivedGrouped;
      return groups.map(g => {
        const officialWinners = g.candidates.filter(c => c.is_winner);
        const topCandidate = g.candidates[0];
        let winners = [];
        if (officialWinners.length > 0) {
          winners = officialWinners.map(w => ({
            name: w.candidate_name,
            party: w.candidate_party || w.party_list || "INDEPENDENT",
            voteCount: w.vote_count ?? 0,
            status: "Proclaimed Winner",
          }));
        } else if (topCandidate && (topCandidate.vote_count ?? 0) > 0) {
          winners = [{
            name: topCandidate.candidate_name,
            party: topCandidate.candidate_party || topCandidate.party_list || "INDEPENDENT",
            voteCount: topCandidate.vote_count ?? 0,
            status: "Leading Candidate",
          }];
        }
        return {
          title: g.title,
          totalVotes: g.totalVotes,
          winners,
        };
      });
    } else {
      const list = relevantGrouped.length > 0 ? relevantGrouped : grouped;
      return list.map(g => {
        const posTitle = g.position?.title ?? "Position";
        const maxVotes = g.position?.max_votes ?? g.maxVotes ?? 1;
        const verif = (liveVerifications ?? []).find(
          v => v.position_id === g.position.id || v.position_title === posTitle
        );
        const declaredWinner = verif?.resolved_winner_name;

        let winners = [];
        let isTie = g.isTie && !declaredWinner;

        if (declaredWinner) {
          const found = g.candidates.find(c => c.candidate_name?.toUpperCase() === declaredWinner.toUpperCase());
          winners = [{
            name: declaredWinner,
            party: found?.party_list || "INDEPENDENT",
            voteCount: found?.vote_count ?? 0,
            isDeclaredWinner: true,
            status: "Declared Winner (Tie Resolution)",
          }];
        } else if (!isTie) {
          winners = g.candidates
            .slice(0, maxVotes)
            .filter(c => (c.vote_count ?? 0) > 0)
            .map((c, idx) => ({
              name: c.candidate_name,
              party: c.party_list || "INDEPENDENT",
              voteCount: c.vote_count ?? 0,
              isDeclaredWinner: false,
              status: maxVotes > 1 ? `Proclaimed Winner (Seat ${idx + 1})` : "Proclaimed Winner",
            }));
        }

        return {
          title: posTitle,
          maxVotes,
          totalVotes: g.totalVotes ?? 0,
          winners,
          isTie,
          tiedCandidates: isTie ? g.tiedCandidates : [],
        };
      });
    }
  }, [activeTab, displayedArchivedGroups, filteredArchivedGrouped, relevantGrouped, grouped, liveVerifications]);

  // ── Normalized full results for Choice 3 (FINAL RESULTS) ──
  const printFinalResultsData = useMemo(() => {
    if (activeTab === "history") {
      const groups = displayedArchivedGroups.length > 0 ? displayedArchivedGroups : filteredArchivedGrouped;
      return groups.map(g => {
        const histVerif = (historyVerifications ?? []).find(
          v => v.position_title === g.title || v.position_id === g.candidates[0]?.position_id
        );
        return {
          title: g.title,
          totalVotes: g.totalVotes,
          candidates: g.candidates.map((c, idx) => ({
            name: c.candidate_name,
            party: c.candidate_party || c.party_list || "INDEPENDENT",
            grade: c.candidate_grade,
            section: c.candidate_section,
            voteCount: c.vote_count ?? 0,
            rank: c.rank ?? idx + 1,
            isWinner: c.is_winner || (idx === 0 && (c.vote_count ?? 0) > 0),
          })),
          verification: histVerif,
        };
      });
    } else {
      const list = relevantGrouped.length > 0 ? relevantGrouped : grouped;
      return list.map(g => {
        const posTitle = g.position?.title ?? "Position";
        const maxVotes = g.position?.max_votes ?? g.maxVotes ?? 1;
        const verif = (liveVerifications ?? []).find(
          v => v.position_id === g.position.id || v.position_title === posTitle
        );
        const declaredWinner = verif?.resolved_winner_name;

        return {
          title: posTitle,
          maxVotes,
          totalVotes: g.totalVotes ?? 0,
          isTie: g.isTie,
          tiedCandidates: g.tiedCandidates,
          verification: verif,
          candidates: g.candidates.map((c, idx) => {
            const isDeclared = Boolean(declaredWinner && c.candidate_name?.toUpperCase() === declaredWinner.toUpperCase());
            const isWinner = isDeclared || (idx < maxVotes && (c.vote_count ?? 0) > 0 && !g.isTie);
            const isTied = !isDeclared && g.isTie && g.tiedCandidates?.some(tc => tc.candidate_id === c.candidate_id);
            return {
              name: c.candidate_name,
              party: c.party_list || "INDEPENDENT",
              grade: c.grade_level,
              section: c.section,
              voteCount: c.vote_count ?? 0,
              rank: idx + 1,
              isWinner,
              isDeclared,
              isTied,
            };
          }),
        };
      });
    }
  }, [activeTab, displayedArchivedGroups, filteredArchivedGrouped, relevantGrouped, grouped, liveVerifications, historyVerifications]);

  return (
    <div className="container py-8 md:py-12">
      <style>{`
        @media print {
          /* ── Universal Arial DepEd Print Standard ── */
          body, table, th, td, div, p, span, h1, h2, h3, h4 {
            font-family: Arial, Helvetica, sans-serif !important;
          }
          body {
            background: #fff !important;
            color: #000 !important;
            font-size: ${isLong ? '8pt' : '7.5pt'} !important;
            line-height: ${isLong ? '1.2' : '1.15'} !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          * {
            box-shadow: none !important;
            text-shadow: none !important;
            animation: none !important;
            transition: none !important;
          }

          /* ── Page setup — tailored for Long (8.5x13" Folio) vs Short (8.5x11" Letter) ── */
          @page {
            size: ${isLong ? '8.5in 13in' : '8.5in 11in'};
            margin: ${isLong ? '5.5mm 6.5mm 5.5mm 6.5mm' : '4.5mm 5.5mm 4.5mm 5.5mm'};
          }

          /* ── Container — full width, zero outer padding in print ── */
          .container {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* ── Hide entire screen interface, navbar, footer & modal in print ── */
          .print\\:hidden,
          [class*="print:hidden"],
          header.gradient-navy,
          footer.gradient-navy,
          header,
          footer {
            display: none !important;
          }

          /* ── Show dedicated print document root ── */
          .hidden.print\\:block,
          [class*="hidden"][class*="print:block"] {
            display: block !important;
          }

          .print-document-root {
            display: block !important;
            width: 100% !important;
            background: #fff !important;
            color: #000 !important;
          }

          /* ── Strict pagination controllers ── */
          .break-inside-avoid,
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ── Screen Interactive Interface Wrapper (Hidden during Print) ── */}
      <div className="print:hidden">
      <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-gold" /> Election Results
          </h1>

          {/* Subtitle — editable by admin for live election, shows selected archived election for past elections */}
          <div className="flex items-center gap-2 mt-1">
            {activeTab === "live" && editingName ? (
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
                <p className="text-muted-foreground">
                  {activeTab === "history" ? "Archived results for " : "Live results for "}
                  <span className="font-medium text-foreground">
                    {activeTab === "history"
                      ? (selectedElection?.election_name || (selectedYear ? `SSLG Election (${selectedYear})` : "Past Election"))
                      : electionName}
                  </span>
                </p>
                {activeTab === "live" && isAdmin && (
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
            onClick={() => setShowPrintModal(true)}
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
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Sections</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>{s?.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            {hasVoterFilter && (
              <div className="mt-3 flex items-center gap-4">
                <p className="text-xs text-muted-foreground italic">
                  Showing votes cast by: <span className="text-foreground font-medium">
                    {voterGrade !== "all" ? voterGrade : "All Grades"}
                    {voterSection !== "all" ? ` · ${voterSection.toUpperCase()}` : ""}
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
                  const maxVotes = group.position?.max_votes ?? group.maxVotes ?? 1;
                  const verification = (liveVerifications ?? []).find(v => v.position_id === group.position.id);
                  const isVerified = !!verification;
                  const declaredWinner = verification?.resolved_winner_name;
                  const leadingWinners = group.candidates
                    .slice(0, maxVotes)
                    .filter(c => (c.vote_count ?? 0) > 0);
                  const hasVotes = leadingWinners.length > 0;
                  const runnerUp = group.candidates[maxVotes];
                  const isLiveTie = group.isTie;

                  return (
                    <div key={group.position.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                      isVerified
                        ? "bg-emerald-500/5 border-emerald-500/30"
                        : isLiveTie && isAdmin
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-muted/60 border-border"
                    }`}>
                      <Trophy className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        declaredWinner || (hasVotes && (!isLiveTie || !isAdmin)) ? "text-gold" : "text-muted-foreground/30"
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold truncate">
                            {group.position.title}
                            {maxVotes > 1 && (
                              <span className="ml-1 text-[9px] font-normal text-muted-foreground lowercase">
                                (2 seats)
                              </span>
                            )}
                          </p>
                          {isVerified && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <ShieldCheck className="w-2.5 h-2.5" /> Verified
                            </span>
                          )}
                          {!isVerified && isLiveTie && isAdmin && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <AlertTriangle className="w-2.5 h-2.5" /> Tie
                            </span>
                          )}
                        </div>
                        {declaredWinner ? (
                          <>
                            <p className="text-sm font-semibold text-foreground truncate uppercase">{declaredWinner}</p>
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Official Winner · {isAdmin && verification.decision_type ? verification.decision_type : "Verified / Finalized"}
                            </p>
                          </>
                        ) : leadingWinners.length > 0 ? (
                          <div className="space-y-1.5 mt-0.5">
                            {leadingWinners.map((w, idx) => (
                              <div key={w.candidate_id || w.candidate_name || idx} className="border-b border-border/30 last:border-b-0 pb-1 last:pb-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="text-sm font-semibold text-foreground truncate uppercase">{w.candidate_name}</p>
                                  {maxVotes > 1 && (
                                    <span className="shrink-0 text-[8px] font-bold px-1.5 py-0.2 rounded bg-gold/15 text-gold border border-gold/30 uppercase">
                                      Seat {idx + 1}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {(w.vote_count ?? 0).toLocaleString()} vote{(w.vote_count ?? 0) !== 1 ? "s" : ""}
                                  {maxVotes === 1 && group.candidates.length > 1 && group.candidates[1]?.candidate_name
                                    ? ` · vs ${group.candidates[1].candidate_name.toUpperCase()} (${(group.candidates[1].vote_count ?? 0).toLocaleString()})`
                                    : ""}
                                </p>
                              </div>
                            ))}
                            {maxVotes > 1 && runnerUp && (runnerUp.vote_count ?? 0) > 0 && (
                              <p className="text-[9px] text-muted-foreground/80 italic pt-0.5">
                                Next: {runnerUp.candidate_name.toUpperCase()} ({(runnerUp.vote_count ?? 0).toLocaleString()})
                              </p>
                            )}
                          </div>
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
            {filtered.map((group, gi) => {
              const verification = (liveVerifications ?? []).find(v => v.position_id === group.position.id);
              const isVerified = !!verification;
              const isLiveTie = group.isTie;
              const declaredWinner = verification?.resolved_winner_name;

              return (
                <div
                  key={group.position.id}
                  id={`position-${group.position.id}`}
                  className={`bg-card rounded-xl border overflow-hidden shadow-elegant animate-fade-in transition-all duration-300 ${
                    activePosition !== "all" && String(activePosition) === String(group.position.id)
                      ? "ring-2 ring-gold border-gold shadow-gold-sm scale-[1.01]"
                      : isVerified
                      ? "border-emerald-500/40"
                      : isLiveTie && isAdmin
                      ? "border-amber-500/50"
                      : "border-border"
                  }`}
                  style={{ animationDelay: `${gi * 100}ms` }}
                >
                  <div className="gradient-navy p-4 md:p-5 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-display font-bold text-primary-foreground text-lg">{group.position.title}</h2>
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {isAdmin && verification.is_tie ? "Tie Resolved & Verified" : "Verified / Finalized"}
                          </span>
                        )}
                        {!isVerified && isLiveTie && isAdmin && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/50 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Official Tie Detected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-primary-foreground/50 mt-0.5">
                        {group.totalVotes.toLocaleString()} total votes
                        {hasVoterFilter && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold uppercase tracking-wider">
                            Filtered
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Winner / Status in header */}
                    {declaredWinner ? (
                      <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-gold/30">
                        <Trophy className="w-4 h-4 text-gold" />
                        <div>
                          <p className="text-xs font-bold text-gold uppercase">{declaredWinner}</p>
                          <p className="text-[9px] text-emerald-300 font-medium">
                            {isAdmin ? "Declared Winner" : "Official Winner"}
                          </p>
                        </div>
                      </div>
                    ) : (() => {
                      const maxVotes = group.position?.max_votes ?? group.maxVotes ?? 1;
                      const leadingWinners = group.candidates
                        .slice(0, maxVotes)
                        .filter(c => (c.vote_count ?? 0) > 0);
                      if (leadingWinners.length > 0 && (!isLiveTie || !isAdmin)) {
                        return (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Trophy className="w-4 h-4 text-gold" />
                            <span className="text-sm font-semibold text-gold uppercase">
                              {leadingWinners.map(w => w.candidate_name).join(" & ")}
                            </span>
                            {maxVotes > 1 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold/20 text-gold border border-gold/40">
                                {leadingWinners.length} Winner{leadingWinners.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  <div className="p-4 md:p-5 space-y-4">
                    {group.candidates.length === 0 && <p className="text-muted-foreground text-sm">No candidates registered.</p>}
                    {group.candidates.map((c, ci) => {
                      const maxVotes = group.position?.max_votes ?? group.maxVotes ?? 1;
                      const pct = group.totalVotes ? (((c.vote_count ?? 0) / group.totalVotes) * 100).toFixed(1) : "0";
                      const isTiedCandidate = isAdmin && isLiveTie && group.tiedCandidates.some(tc => tc.candidate_id === c.candidate_id);
                      const isDeclaredWinnerCandidate = declaredWinner && c.candidate_name?.toUpperCase() === declaredWinner.toUpperCase();
                      const isWinnerCandidate = (ci < maxVotes) && (c.vote_count ?? 0) > 0 && (!isLiveTie || !isAdmin);

                      return (
                        <div key={c.candidate_id} className="animate-fade-in" style={{ animationDelay: `${ci * 60}ms` }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-3">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                isDeclaredWinnerCandidate
                                  ? "bg-emerald-500 text-white shadow"
                                  : isWinnerCandidate
                                  ? "gradient-gold text-accent-foreground shadow-sm"
                                  : isTiedCandidate
                                  ? "bg-amber-500 text-white font-bold"
                                  : "bg-muted text-muted-foreground"
                              }`}>
                                {isDeclaredWinnerCandidate ? <Check className="w-3.5 h-3.5" /> : ci + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-foreground text-sm uppercase flex items-center gap-2 flex-wrap">
                                  {c.candidate_name}
                                  {isDeclaredWinnerCandidate && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                      <Award className="w-3 h-3" /> Declared Winner
                                    </span>
                                  )}
                                  {isWinnerCandidate && !isDeclaredWinnerCandidate && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold/15 text-gold border border-gold/30">
                                      <Award className="w-3 h-3" /> {maxVotes > 1 ? `Winner (Seat ${ci + 1})` : "Leading"}
                                    </span>
                                  )}
                                  {isTiedCandidate && !isDeclaredWinnerCandidate && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                      TIE ({c.vote_count ?? 0} votes)
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">{c.party_list}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-display font-bold text-foreground">{(c.vote_count ?? 0).toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground ml-1.5 print:hidden">({pct}%)</span>
                            </div>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${
                                isDeclaredWinnerCandidate
                                  ? "bg-emerald-500"
                                  : isWinnerCandidate
                                  ? "gradient-gold"
                                  : isTiedCandidate
                                  ? "bg-amber-500"
                                  : "bg-navy-light/50"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Official Administrator Verification & Tie Resolution Panel ── */}
                    {isVerified && (
                      <div className="mt-5 pt-4 border-t border-border print:hidden">
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 sm:p-5 space-y-3.5">
                          {/* Header banner */}
                          <div className="flex items-start sm:items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-emerald-500/20">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wide flex items-center gap-2 flex-wrap">
                                  Official Administrator Decision &amp; Verification
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
                                    {isAdmin && verification.is_tie ? "Tie Resolved" : "Verified / Finalized"}
                                  </span>
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Verified by <span className="font-semibold text-foreground">{verification.verified_by_name || "Authorized Administrator"}</span>
                                  {verification.created_at && (
                                    <> on {new Date(verification.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Decision / Action Taken & Declared Winner */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {verification.decision_type && (
                              <div className="p-3 rounded-lg bg-card border border-border">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <Gavel className="w-3.5 h-3.5 text-gold shrink-0" /> Decision / Action Taken
                                </p>
                                <p className="text-xs sm:text-sm font-semibold text-foreground">
                                  {verification.decision_type}
                                </p>
                              </div>
                            )}

                            {declaredWinner ? (
                              <div className="p-3 rounded-lg bg-card border border-gold/40">
                                <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <Trophy className="w-3.5 h-3.5 text-gold shrink-0" /> Declared Official Winner
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-foreground uppercase">
                                  {declaredWinner}
                                </p>
                              </div>
                            ) : verification.decision_type ? (
                              <div className="p-3 rounded-lg bg-card border border-border">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Status
                                </p>
                                <p className="text-xs sm:text-sm font-semibold text-foreground">
                                  Original Vote Tallies Preserved
                                </p>
                              </div>
                            ) : null}
                          </div>

                          {/* Administrator's Comment / Official Statement */}
                          {verification.admin_comment ? (
                            <div className="p-3.5 rounded-lg bg-card border border-border">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-gold shrink-0" /> Administrator's Comment / Official Statement
                              </p>
                              <p className="text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {verification.admin_comment}
                              </p>
                            </div>
                          ) : null}

                          {/* Integrity reassurance note */}
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>Original vote counts above remain intact and unaltered as officially recorded.</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Notice for unverified active tie - Admin view only */}
                    {!isVerified && isLiveTie && isAdmin && (
                      <div className="mt-5 pt-4 border-t border-border print:hidden">
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs sm:text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Official Tie Detected ({group.topVotes} votes each) — Administrator Action Required</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            A tie has occurred between: <strong className="text-foreground">{group.tiedCandidates.map(c => c.candidate_name).join(" and ")}</strong>. Go to <strong>Admin &gt; Settings &gt; Audit &amp; Verification</strong> to manually enter your decision.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Post-election status notice for students and visitors when position is awaiting admin finalization */}
                    {!isVerified && settings?.status === "completed" && !isAdmin && (
                      <div className="mt-5 pt-4 border-t border-border print:hidden">
                        <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            Official results for this position are undergoing administrator review. <span className="font-semibold text-foreground">The position will be marked Verified / Finalized</span> once officially confirmed.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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
              {/* Election Year Selector & Meta */}
              <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-elegant print:hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 max-w-md">
                    <label htmlFor="history-school-year" className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gold" /> Select School Year
                    </label>
                    <select
                      id="history-school-year"
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

                  {selectedElection && (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 bg-muted px-3 py-2 rounded-lg border border-border">
                        <Calendar className="w-3.5 h-3.5 text-gold" />
                        {selectedElection.election_date
                          ? new Date(selectedElection.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                          : "Date not set"}
                      </span>
                      <span className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold text-[10px] uppercase tracking-wider border border-emerald-500/30">
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
              </div>

              {/* Filter Dropdowns (matches Live Results) */}
              <div className="bg-card border border-border rounded-xl p-4 mb-8 shadow-elegant print:hidden">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Filter Results</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="history-position-filter" className="block text-xs text-muted-foreground mb-1.5">Position</label>
                    <select
                      id="history-position-filter"
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

                  <div>
                    <label htmlFor="history-grade-filter" className="block text-xs text-muted-foreground mb-1.5">Grade Level <span className="text-gold/70">(by voter)</span></label>
                    <select
                      id="history-grade-filter"
                      value={historyGradeFilter}
                      onChange={(e) => handleHistoryGradeChange(e.target.value)}
                      disabled={!historyFilterSupported}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">All Grade Levels</option>
                      {archivedGradeLevels.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="history-section-filter" className="block text-xs text-muted-foreground mb-1.5">Section <span className="text-gold/70">(by voter)</span></label>
                    <select
                      id="history-section-filter"
                      value={historySectionFilter}
                      onChange={(e) => handleHistorySectionChange(e.target.value)}
                      disabled={!historyFilterSupported}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">All Sections</option>
                      {archivedSections.map((s) => (
                        <option key={s} value={s}>{s?.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!historyFilterSupported && (
                  <p className="mt-3 text-xs text-muted-foreground italic">
                    Grade and section filtering is unavailable for this older archived election.
                  </p>
                )}

                {(historyGradeFilter !== "all" || historyPositionFilter !== "all" || historySectionFilter !== "all") && (
                  <div className="mt-3 flex items-center gap-4">
                    <p className="text-xs text-muted-foreground italic">
                      Showing votes cast by: <span className="text-foreground font-medium">
                        {historyGradeFilter !== "all" ? historyGradeFilter : "All Grades"}
                        {historySectionFilter !== "all" ? ` · ${historySectionFilter.toUpperCase()}` : ""}
                      </span>
                    </p>
                    <button
                      onClick={() => { setHistoryGradeFilter("all"); setHistorySectionFilter("all"); setHistoryPositionFilter("all"); }}
                      className="text-xs font-medium text-gold hover:text-gold/80 transition-colors"
                    >
                      ✕ Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Winners Summary Card */}
              {displayedArchivedGroups.length > 0 && (
                <div className="bg-card border border-gold/20 rounded-xl p-5 mb-6 shadow-elegant print:hidden">
                  <h3 className="font-display font-bold text-foreground text-base mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-gold" /> Winners Summary
                    {(historyGradeFilter !== "all" || historySectionFilter !== "all" || historyPositionFilter !== "all") && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        —{" "}
                        {historyPositionFilter !== "all" ? historyPositionFilter : "All Positions"}
                        {historyGradeFilter !== "all" ? ` · ${historyGradeFilter}` : ""}
                        {historySectionFilter !== "all" ? ` · ${historySectionFilter.toUpperCase()}` : ""}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayedArchivedGroups.map((group) => {
                      // The API recalculates winners when a voter filter is active.
                      const officialWinners = group.candidates.filter(c => c.is_winner);
                      const topCandidate = group.candidates[0];
                      const topCandidates = officialWinners.length > 0
                        ? officialWinners
                        : (topCandidate && (topCandidate.vote_count ?? 0) > 0 ? [topCandidate] : []);
                      const runnerUp = group.candidates.find(c => !topCandidates.some(w => w.candidate_name === c.candidate_name));

                      return (
                        <div key={group.title} className="flex items-start gap-3 px-3 py-2.5 rounded-lg bg-muted/60 border border-border">
                          <Trophy className={`w-4 h-4 flex-shrink-0 mt-0.5 ${topCandidates.length > 0 && (topCandidates[0].vote_count ?? 0) > 0 ? "text-gold" : "text-muted-foreground/40"}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">{group.title}</p>
                            {topCandidates.length > 0 ? (
                              topCandidates.map(w => (
                                <div key={w.candidate_name}>
                                  <p className="text-sm font-semibold text-foreground truncate uppercase">{w.candidate_name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {(w.vote_count ?? 0).toLocaleString()} vote{(w.vote_count ?? 0) !== 1 ? "s" : ""}
                                    {runnerUp?.candidate_name
                                      ? ` · vs ${runnerUp.candidate_name.toUpperCase()} (${(runnerUp.vote_count ?? 0).toLocaleString()})`
                                      : (w.candidate_grade || w.candidate_section ? ` · ${w.candidate_grade ?? ""}${w.candidate_section ? ` — ${w.candidate_section.toUpperCase()}` : ""}` : "")}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No candidates match filter</p>
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
                  const officialWinners = group.candidates.filter(c => c.is_winner);
                  const topCandidate = group.candidates[0];
                  const winnerDisplay = officialWinners.length > 0
                    ? officialWinners.map(w => w.candidate_name).join(", ")
                    : (topCandidate && (topCandidate.vote_count ?? 0) > 0 ? topCandidate.candidate_name : null);
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
                            {group.totalVotes.toLocaleString()} total votes
                            {hasHistoryFilter && (
                              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-semibold uppercase tracking-wider">
                                Filtered
                              </span>
                            )}
                          </p>
                        </div>
                        {winnerDisplay && (
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-gold" />
                            <span className="text-sm font-semibold text-gold uppercase">
                              {winnerDisplay}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Candidates List */}
                      <div className="p-4 md:p-5 space-y-4">
                        {group.candidates.length === 0 && (
                          <p className="text-muted-foreground text-sm">No candidates in this position.</p>
                        )}
                        {group.candidates.map((c, ci) => {
                          const pct = group.totalVotes > 0
                            ? (((c.vote_count ?? 0) / group.totalVotes) * 100).toFixed(1)
                            : "0";
                          const isLeaderOrWinner = c.is_winner || ci === 0;
                          return (
                            <div key={`${c.candidate_name}-${ci}`} className="animate-fade-in" style={{ animationDelay: `${ci * 60}ms` }}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-3">
                                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isLeaderOrWinner ? "gradient-gold text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                                    {c.rank ?? ci + 1}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-foreground text-sm flex items-center gap-1.5 uppercase">
                                      {c.candidate_name}
                                      {c.is_winner && <Trophy className="w-3.5 h-3.5 text-gold" />}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {c.candidate_party}
                                      {c.candidate_grade && ` · ${c.candidate_grade}`}
                                      {c.candidate_section && ` — ${c.candidate_section.toUpperCase()}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="font-display font-bold text-foreground">{(c.vote_count ?? 0).toLocaleString()}</span>
                                  <span className="text-xs text-muted-foreground ml-1.5 print:hidden">({pct}%)</span>
                                </div>
                              </div>
                              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ${isLeaderOrWinner ? "gradient-gold" : "bg-navy-light/50"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* ── Historical Administrator Verification & Decision Display ── */}
                      {(() => {
                        const histVerif = (historyVerifications ?? []).find(
                          v => v.position_title === group.title || v.position_id === group.candidates[0]?.position_id
                        );
                        if (!histVerif) return null;

                        return (
                          <div className="px-4 pb-4 md:px-5 md:pb-5 print:hidden">
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-500/20">
                                <div className="flex items-center gap-2">
                                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wide">
                                    Official Audit &amp; Administrator Decision
                                  </h4>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30 uppercase">
                                  {isAdmin && histVerif.is_tie ? "Tie Resolved" : "Verified / Finalized"}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {histVerif.decision_type && (
                                  <div className="p-2.5 rounded-lg bg-card border border-border text-xs">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                      <Gavel className="w-3 h-3 text-gold" /> Decision / Action Taken
                                    </p>
                                    <p className="font-semibold text-foreground">{histVerif.decision_type}</p>
                                  </div>
                                )}
                                {histVerif.resolved_winner_name && (
                                  <div className="p-2.5 rounded-lg bg-card border border-gold/40 text-xs">
                                    <p className="text-[10px] font-bold text-gold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                      <Trophy className="w-3 h-3 text-gold" /> Declared Winner
                                    </p>
                                    <p className="font-bold text-foreground uppercase">{histVerif.resolved_winner_name}</p>
                                  </div>
                                )}
                              </div>

                              {histVerif.admin_comment && (
                                <div className="p-3 rounded-lg bg-card border border-border text-xs">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3 text-gold" /> Administrator's Comment
                                  </p>
                                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">{histVerif.admin_comment}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      </div> {/* ── End of Screen Interactive Interface (print:hidden) ── */}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── DEDICATED OFFICIAL PRINT DOCUMENTS (NATURAL COMPACT 2-COLUMN FLOW) ── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block print-document-root">
        {(() => {
          const renderFullHeader = (docTitle) => (
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2.5">
              <div className="flex items-center gap-2.5">
                <img src={schoolSeal} alt={schoolTitle} className="w-12 h-12 rounded-full object-cover border border-black" />
                <div>
                  <p className="text-[7pt] uppercase tracking-wider text-slate-700 leading-tight">Republic of the Philippines · Department of Education</p>
                  <h2 className="text-[11.5pt] font-bold text-black uppercase leading-tight tracking-wide">{schoolTitle}</h2>
                  <p className="text-[7.5pt] text-slate-700 leading-tight">{schoolLocation}</p>
                  <p className="text-[7pt] font-semibold text-slate-900 mt-0.5 uppercase tracking-wide">
                    Supreme Student Learner Government (SSLG) Commission on Elections
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block text-[8.5pt] font-bold uppercase tracking-wider px-2 py-0.5 border border-black bg-slate-100 text-black mb-0.5">
                  {docTitle}
                </span>
                <p className="text-[7.5pt] text-slate-800 leading-tight">
                  <strong>Election:</strong> {activeTab === "history" && selectedElection ? selectedElection.election_name : electionName}
                </p>
                <p className="text-[7.5pt] text-slate-800 leading-tight">
                  <strong>School Year:</strong> {activeTab === "history" && selectedElection ? selectedElection.school_year : (settings?.school_year || "S.Y. 2025-2026")}
                </p>
                <p className="text-[7pt] text-slate-600 leading-tight">
                  Date: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
          );

          const renderSignaturesBlock = () => (
            <div className="grid grid-cols-2 gap-8 mt-5 pt-3 border-t-2 border-black text-[7.5pt] break-inside-avoid page-break-inside-avoid">
              <div>
                <p className="text-slate-600 uppercase font-semibold text-[6.5pt] tracking-wider mb-6">Prepared &amp; Certified By:</p>
                <div className="border-b border-black w-48 mb-0.5"></div>
                <p className="font-bold text-black uppercase text-[8pt]">Election Committee Chairman</p>
                <p className="text-[6.5pt] text-slate-600">SSLG Commission on Elections</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="text-slate-600 uppercase font-semibold text-[6.5pt] tracking-wider mb-6">Attested &amp; Approved By:</p>
                <div className="border-b border-black w-48 mb-0.5"></div>
                <p className="font-bold text-black uppercase text-[8pt]">School Principal / Administrator</p>
                <p className="text-[6.5pt] text-slate-600">{schoolTitle}</p>
              </div>
            </div>
          );

          return (
            <>
              {/* ── CHOICE 1: ONLY CANDIDATES ── */}
              {printMode === "candidates" && (
                <div>
                  {renderFullHeader("Official List of Candidates")}

                  <div className="mb-2 pb-1 border-b border-slate-300">
                    <h3 className="text-[9pt] font-bold text-black uppercase tracking-wider">
                      Certified Official Roster of Candidates
                    </h3>
                    <p className="text-[7pt] text-slate-600">
                      Official list of qualified candidates running for SSLG elective positions and their party affiliations (strictly candidate names &amp; party-lists only):
                    </p>
                  </div>

                  {/* Continuous 2-Column Grid — Fills Page Naturally without artificial empty spaces */}
                  <div className="grid grid-cols-2 gap-2">
                    {printCandidatesData.map((posGroup, idx) => (
                      <div key={posGroup.title || idx} className="border border-black break-inside-avoid page-break-inside-avoid text-[7.5pt]">
                        {/* Position Header */}
                        <div className="bg-slate-100 px-2.5 py-1 border-b border-black flex justify-between items-center">
                          <span className="font-bold text-[8.5pt] text-black uppercase tracking-tight">
                            Position: {posGroup.title}
                          </span>
                          <span className="text-[6.5pt] font-medium text-slate-600 uppercase">
                            {posGroup.candidates.length} Candidate{posGroup.candidates.length !== 1 ? "s" : ""}
                          </span>
                        </div>

                        {/* Candidates List — STRICTLY NO NUMBERS */}
                        {posGroup.candidates.length === 0 ? (
                          <div className="p-1.5 text-[7pt] text-slate-500 italic">No candidates registered.</div>
                        ) : (
                          <table className="w-full text-left border-collapse text-[7.5pt]">
                            <thead>
                              <tr className="border-b border-slate-300 bg-slate-50/50 text-[6.5pt] text-slate-600 uppercase">
                                <th className="py-0.5 px-2 w-1/2 font-semibold">Candidate Name</th>
                                <th className="py-0.5 px-2 w-1/2 font-semibold">Party-List</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {posGroup.candidates.map((c, ci) => (
                                <tr key={`${c.name}-${ci}`}>
                                  <td className="py-1 px-2">
                                    <p className="font-bold text-[8pt] text-black uppercase leading-tight">{c.name}</p>
                                    {(c.grade || c.section) && (
                                      <p className="text-[6.5pt] text-slate-600 font-normal">
                                        {[c.grade, c.section].filter(Boolean).join(" - ")}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-1 px-2 text-[7.5pt] text-slate-800 uppercase font-medium">
                                    {c.party || "INDEPENDENT"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>

                  {renderSignaturesBlock()}
                </div>
              )}

              {/* ── CHOICE 2: ONLY CANDIDATES WINNERS ── */}
              {printMode === "winners" && (
                <div>
                  {renderFullHeader("Official Proclamation of Winners")}

                  <div className="mb-2 pb-1 border-b border-slate-300">
                    <h3 className="text-[9pt] font-bold text-black uppercase tracking-wider">
                      Official Proclamation of Winners
                    </h3>
                    <p className="text-[7pt] text-slate-600">
                      This certifies that the following candidates garnered the winning votes in their respective positions and are hereby proclaimed as the duly elected SSLG Officers:
                    </p>
                  </div>

                  <table className="w-full text-left border-collapse border border-black text-[7.5pt]">
                    <thead>
                      <tr className="bg-slate-100 border-b border-black text-[7pt] text-black uppercase font-bold">
                        <th className="py-1.5 px-2.5 border-r border-black w-[28%]">Position</th>
                        <th className="py-1.5 px-2.5 border-r border-black w-[34%]">Proclaimed Winner</th>
                        <th className="py-1.5 px-2.5 border-r border-black w-[23%]">Party-List</th>
                        <th className="py-1.5 px-2.5 text-right w-[15%]">Total Votes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-[7.5pt]">
                      {printWinnersData.map((pw, pwi) => {
                        if (pw.isTie) {
                          return (
                            <tr key={pw.title || pwi} className="bg-amber-50/40">
                              <td className="py-1.5 px-2.5 border-r border-black font-bold uppercase text-[8pt]">
                                {pw.title}
                              </td>
                              <td colSpan={3} className="py-1.5 px-2.5 text-amber-900 font-semibold text-[7pt]">
                                TIE PENDING RESOLUTION: {pw.tiedCandidates?.map(t => `${t.candidate_name} (${t.vote_count} votes)`).join(" vs ")}
                              </td>
                            </tr>
                          );
                        }

                        if (!pw.winners || pw.winners.length === 0) {
                          return (
                            <tr key={pw.title || pwi}>
                              <td className="py-1.5 px-2.5 border-r border-black font-bold uppercase text-[8pt]">
                                {pw.title}
                              </td>
                              <td colSpan={3} className="py-1.5 px-2.5 text-slate-500 italic text-[7pt]">
                                No votes recorded yet / Pending
                              </td>
                            </tr>
                          );
                        }

                        return pw.winners.map((winner, wi) => (
                          <tr key={`${pw.title}-${winner.name}-${wi}`} className={wi % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                            <td className="py-1.5 px-2.5 border-r border-black font-bold uppercase text-[8pt] align-top">
                              {wi === 0 ? pw.title : ""}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-black font-bold uppercase text-[8.5pt] text-black">
                              {winner.name}
                              {winner.isDeclaredWinner && (
                                <span className="block text-[6.5pt] text-emerald-700 font-semibold">
                                  (Declared Winner via Official Resolution)
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-2.5 border-r border-black uppercase text-[7.5pt] text-slate-800">
                              {winner.party}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-bold text-[8.5pt] text-black">
                              {(winner.voteCount ?? winner.votes ?? 0).toLocaleString()}
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>

                  {renderSignaturesBlock()}
                </div>
              )}

              {/* ── CHOICE 3: FINAL RESULTS ── */}
              {printMode === "final" && (
                <div>
                  {renderFullHeader("Official Final Results Tally")}

                  {/* Continuous 2-Column Grid — Fills Page Naturally without artificial empty spaces */}
                  <div className="grid grid-cols-2 gap-2">
                    {printFinalResultsData.map((group, gi) => (
                      <div key={group.title || gi} className="border border-black break-inside-avoid page-break-inside-avoid text-[7.5pt]">
                        {/* Position Header */}
                        <div className="bg-slate-100 px-2.5 py-1 border-b border-black flex justify-between items-center">
                          <span className="font-bold text-[8.5pt] text-black uppercase tracking-tight">
                            {group.title}
                          </span>
                          <span className="text-[7pt] font-semibold text-slate-700">
                            Total: {(group.totalVotes ?? 0).toLocaleString()} votes
                          </span>
                        </div>

                        {/* Candidates Table */}
                        <table className="w-full text-left border-collapse text-[7.5pt]">
                          <thead>
                            <tr className="border-b border-slate-300 bg-slate-50/50 text-[6.5pt] text-slate-600 uppercase">
                              <th className="py-0.5 px-1.5 w-8 text-center">Rank</th>
                              <th className="py-0.5 px-2">Candidate Name</th>
                              <th className="py-0.5 px-2">Party-List</th>
                              <th className="py-0.5 px-2 text-right">Votes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {group.candidates.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-1.5 px-2 text-[7pt] text-slate-500 italic">No candidates registered.</td>
                              </tr>
                            ) : (
                              group.candidates.map((c, ci) => (
                                <tr key={`${c.name}-${ci}`} className={c.isWinner ? "bg-amber-50/20" : ""}>
                                  <td className="py-1 px-1.5 text-center">
                                    <span className="inline-block w-3.5 h-3.5 rounded-full border border-black text-[6.5pt] font-bold leading-3.5 text-center">
                                      {c.rank || ci + 1}
                                    </span>
                                  </td>
                                  <td className="py-1 px-2">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="font-bold text-[8pt] text-black uppercase leading-tight">{c.name}</span>
                                      {c.isDeclared ? (
                                        <span className="text-[6pt] font-bold px-1 py-0.2 rounded border border-emerald-700 text-emerald-800 bg-emerald-50">
                                          Declared Winner
                                        </span>
                                      ) : c.isWinner ? (
                                        <span className="text-[6pt] font-bold px-1 py-0.2 rounded border border-black bg-slate-100 text-black">
                                          Winner
                                        </span>
                                      ) : c.isTied ? (
                                        <span className="text-[6pt] font-bold px-1 py-0.2 rounded border border-amber-600 text-amber-700 bg-amber-50">
                                          Tie
                                        </span>
                                      ) : null}
                                    </div>
                                    {(c.grade || c.section) && (
                                      <p className="text-[6.5pt] text-slate-500">
                                        {[c.grade, c.section].filter(Boolean).join(" - ")}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-1 px-2 text-[7pt] text-slate-700 uppercase">
                                    {c.party || "INDEPENDENT"}
                                  </td>
                                  <td className="py-1 px-2 text-right font-bold text-[8pt] text-black">
                                    {(c.voteCount ?? 0).toLocaleString()}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>

                        {/* Verification note if present */}
                        {group.verification && (
                          <div className="p-1 bg-slate-50 border-t border-slate-300 text-[6.5pt] text-slate-700 leading-tight">
                            <strong>Audit:</strong> {group.verification.decision_type || "Verified"}
                            {group.verification.resolved_winner_name && ` — Winner: ${group.verification.resolved_winner_name}`}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {renderSignaturesBlock()}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ── PRINT OPTION SELECTION MODAL ── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showPrintModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-fade-in"
          onClick={() => setShowPrintModal(false)}
        >
          <div 
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-xl w-full p-6 text-foreground animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">Print Election Documents</h3>
                  <p className="text-xs text-muted-foreground">Select which official report layout you want to print:</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Choices */}
            <div className="space-y-3 my-5">
              {/* Choice 1: ONLY CANDIDATES */}
              <button
                type="button"
                onClick={() => handleTriggerPrint("candidates")}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-sky-500/60 bg-muted/30 hover:bg-sky-500/5 transition-all group relative flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-foreground group-hover:text-sky-500 transition-colors">
                      1. ONLY CANDIDATES
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
                      Roster Only
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Prints candidates only (no numbers) in a continuous 2-column layout that naturally fills the pages without wasted space (~2 pages).
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-3" />
              </button>

              {/* Choice 2: ONLY CANDIDATES WINNERS */}
              <button
                type="button"
                onClick={() => handleTriggerPrint("winners")}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-gold bg-muted/30 hover:bg-gold/5 transition-all group relative flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-foreground group-hover:text-gold transition-colors">
                      2. ONLY CANDIDATES WINNERS
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/15 text-gold">
                      1 Page
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Prints <strong>exclusively the winning candidates</strong> for each position in an official proclamation sheet (1 page).
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-gold group-hover:translate-x-0.5 transition-all shrink-0 mt-3" />
              </button>

              {/* Choice 3: FINAL RESULTS */}
              <button
                type="button"
                onClick={() => handleTriggerPrint("final")}
                className="w-full text-left p-4 rounded-xl border border-border hover:border-emerald-500/60 bg-muted/30 hover:bg-emerald-500/5 transition-all group relative flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-foreground group-hover:text-emerald-500 transition-colors">
                      3. FINAL RESULTS
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      Full Tally
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Prints the complete system results with all votes and rankings in a continuous 2-column layout that naturally fills the pages without wasted space (~2 pages).
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all shrink-0 mt-3" />
              </button>
            </div>

            {/* Quick Paper Size selector bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border text-xs mb-4">
              <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-gold" /> Selected Paper Size:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePaperSizeChange("short")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    paperSize === "short"
                      ? "bg-card text-foreground shadow-sm border border-gold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Short (8.5×11″)
                </button>
                <button
                  type="button"
                  onClick={() => handlePaperSizeChange("long")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    paperSize === "long"
                      ? "bg-card text-foreground shadow-sm border border-gold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Long (8.5×13″)
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
