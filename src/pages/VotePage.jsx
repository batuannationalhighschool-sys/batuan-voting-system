import { useState } from "react";
import { Vote, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, ShieldAlert, Clock, Calendar } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import CandidateCard from "@/components/CandidateCard";
import { useNavigate } from "react-router-dom";

export default function VotePage() {
  const [selections, setSelections] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const { user, profile, refreshProfile, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const gradeLevel = profile?.grade_level;
  const queryParams = gradeLevel
    ? `?grade_level=${encodeURIComponent(gradeLevel)}`
    : '';

  const { data: settings } = useQuery({
    queryKey: ["election-settings"],
    queryFn: () => api.get('/election-settings'),
    refetchInterval: 10000,
  });

  const { data: positions } = useQuery({
    queryKey: ["positions", gradeLevel],
    queryFn: () => api.get(`/positions${queryParams}`),
    enabled: !!user,
  });

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get('/candidates'),
    enabled: !!user,
  });

  const submitVotes = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const votes = [];
      for (const [positionId, candIds] of Object.entries(selections)) {
        for (const candidateId of (candIds || [])) {
          if (candidateId) votes.push({ candidate_id: candidateId, position_id: positionId });
        }
      }
      if (votes.length === 0) throw new Error("No votes selected");
      await api.post('/votes', { votes });
    },
    onSuccess: () => {
      setSubmitted(true);
      refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["vote-counts"] });
      queryClient.invalidateQueries({ queryKey: ["vote-counts-home"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast({ title: "Vote submitted!", description: "Your vote for SSLG Election 2026 has been recorded securely." });
    },
    onError: (err) => {
      const msg = err.message?.includes("duplicate") || err.message?.includes("already voted")
        ? "You have already voted for one of the selected candidates."
        : err.message;
      toast({ title: "Vote failed", description: msg, variant: "destructive" });
    },
  });

  if (!user) {
    return (
      <div className="container py-16 text-center animate-fade-in">
        <ShieldAlert className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Authentication Required</h1>
        <p className="text-muted-foreground mb-6">Please sign in to cast your vote.</p>
        <button onClick={() => navigate("/auth")} className="px-6 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold">Sign In</button>
      </div>
    );
  }

  if (isAdmin) {
    return (
      <div className="container py-16 text-center animate-fade-in">
        <ShieldAlert className="w-16 h-16 text-gold mx-auto mb-4 flex justify-center" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Admin Access Restricted</h1>
        <p className="text-muted-foreground mb-6">As an administrator, you are not allowed to cast a vote.</p>
        <button onClick={() => navigate("/admin")} className="px-6 py-3 rounded-xl gradient-navy text-primary-foreground font-semibold">Go to Admin Dashboard</button>
      </div>
    );
  }

  // ── Trappings: Check Election Status ────────────────────────────────
  const electionStatus = settings?.status ?? 'upcoming';

  if (electionStatus === 'upcoming') {
    const formattedDate = settings?.election_date
      ? new Date(settings.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "TBA";
    const startTime = settings?.voting_start?.slice(0, 5) || "08:00";
    const endTime = settings?.voting_end?.slice(0, 5) || "16:00";

    return (
      <div className="container py-16 text-center animate-fade-in max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6 text-gold ring-8 ring-gold/5">
          <Clock className="w-10 h-10" />
        </div>
        <span className="px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground border border-border inline-block mb-3">
          Election Upcoming
        </span>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
          Voting Is Not Open Yet
        </h1>
        <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto">
          The administrator has set this election as <strong className="text-foreground">Upcoming</strong>. You can cast your vote as soon as the election is triggered by the administrator.
        </p>

        <div className="bg-card rounded-2xl border border-border p-6 mb-8 shadow-elegant text-left space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Election Details</p>
          <div className="flex items-center justify-between text-sm py-1.5 border-b border-border">
            <span className="text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4 text-gold" /> Election Date</span>
            <span className="font-semibold text-foreground">{formattedDate}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-1.5 border-b border-border">
            <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-gold" /> Scheduled Voting Hours</span>
            <span className="font-semibold text-foreground">{startTime} — {endTime}</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <button onClick={() => navigate("/candidates")} className="px-6 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity">
            View Candidates
          </button>
          <button onClick={() => navigate("/")} className="px-6 py-3 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted transition-colors">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (electionStatus === 'completed') {
    return (
      <div className="container py-16 text-center animate-fade-in max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6 text-destructive ring-8 ring-destructive/5">
          <AlertCircle className="w-10 h-10" />
        </div>
        <span className="px-3.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-destructive/15 text-destructive border border-destructive/30 inline-block mb-3">
          Election Completed
        </span>
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
          Voting Has Ended
        </h1>
        <p className="text-muted-foreground text-base mb-8 max-w-md mx-auto">
          Voting for <strong className="text-foreground">{settings?.name || "SSLG Election"}</strong> is officially closed. Thank you to everyone who participated!
        </p>

        <div className="flex flex-wrap justify-center gap-4">
          <button onClick={() => navigate("/results")} className="px-6 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity">
            View Election Results
          </button>
          <button onClick={() => navigate("/candidates")} className="px-6 py-3 rounded-xl bg-card border border-border text-foreground font-semibold hover:bg-muted transition-colors">
            View Candidates
          </button>
        </div>
      </div>
    );
  }

  const hasVoted = profile?.has_voted;

  if (hasVoted) {
    return (
      <div className="container py-16 text-center animate-fade-in">
        <CheckCircle2 className="w-16 h-16 text-gold mx-auto mb-4" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">You've Already Voted</h1>
        <p className="text-muted-foreground mb-6">
          Thank you for participating in the SSLG Election! You can view the results below.
        </p>
        <button onClick={() => navigate("/results")} className="px-6 py-3 rounded-xl gradient-navy text-primary-foreground font-semibold">View Results</button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="container py-16 md:py-24">
        <div className="max-w-lg mx-auto text-center animate-scale-in">
          <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center mx-auto mb-6 shadow-gold">
            <CheckCircle2 className="w-10 h-10 text-accent-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">Vote Submitted!</h1>
          <p className="text-muted-foreground mb-2">Thank you for participating in the SSLG Election 2026.</p>
          <div className="mt-8 p-4 bg-card rounded-xl border border-border">
            <p className="text-sm font-medium text-foreground mb-3">Your Selections:</p>
            {Object.entries(selections).flatMap(([posId, candIds]) => {
              const pos = (positions ?? []).find((p) => p.id === posId);
              return (candIds || []).map((candId, idx) => {
                const cand = (candidates ?? []).find((c) => c.id === candId);
                return (
                  <div key={`${posId}-${idx}`} className="flex justify-between py-1.5 text-sm border-b border-border last:border-0">
                    <span className="text-muted-foreground">{pos?.title}{(pos?.max_votes ?? 1) > 1 ? ` (${idx + 1})` : ''}</span>
                    <span className="font-medium text-foreground uppercase">{cand?.name}</span>
                  </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    );
  }

  const handleSelect = (positionId, candidateId, maxVotes) => {
    setSelections((prev) => {
      const existing = prev[positionId] ?? [];
      if (existing.includes(candidateId)) {
        return { ...prev, [positionId]: existing.filter((id) => id !== candidateId) };
      } else {
        if (existing.length >= maxVotes) {
          const pos = (positions ?? []).find(p => p.id === positionId);
          toast({
            title: `Max ${maxVotes} selection${maxVotes > 1 ? 's' : ''}`,
            description: `You can only choose up to ${maxVotes} candidate${maxVotes > 1 ? 's' : ''} for ${pos?.title}. Deselect one first.`,
            variant: "destructive",
          });
          return prev;
        }
        return { ...prev, [positionId]: [...existing, candidateId] };
      }
    });
  };

  const totalSelected = Object.values(selections).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);

  return (
    <div className="container py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground flex items-center gap-3">
            <Vote className="w-8 h-8 text-gold" /> Cast Your Vote
          </h1>
          <p className="text-muted-foreground mt-1">Select your preferred candidate for each position</p>
          {gradeLevel && (
            <p className="text-xs text-gold mt-1">Grade Representative shown for your grade: <span className="font-semibold">{gradeLevel}</span></p>
          )}
        </div>

        <div className="space-y-12 mb-12">
          {(positions ?? []).map((pos) => {
            const maxVotes = pos.max_votes ?? 1;
            const positionCandidates = (candidates ?? []).filter((c) => c.position_id === pos.id);
            const currentSelections = selections[pos.id] ?? [];

            return (
              <div key={pos.id} className="animate-fade-in">
                <div className="bg-card rounded-xl border border-border p-6 mb-6 shadow-elegant sticky top-20 z-20 backdrop-blur-md bg-card/90">
                  <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">{pos.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    {maxVotes > 1
                      ? `Select up to ${maxVotes} candidates — ${currentSelections.length} / ${maxVotes} chosen`
                      : 'Select one candidate'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {positionCandidates.map((c, i) => (
                    <CandidateCard 
                      key={c.id} 
                      candidate={c} 
                      positionTitle={pos.title} 
                      selectable 
                      selected={currentSelections.includes(c.id)} 
                      onSelect={() => handleSelect(pos.id, c.id, maxVotes)} 
                      delay={i * 40} 
                    />
                  ))}
                  {positionCandidates.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-muted/50 rounded-xl border border-dashed border-border">
                      <p className="text-muted-foreground">No candidates for this position</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {(positions ?? []).length === 0 && (
            <div className="text-center py-16 bg-card rounded-xl border border-border shadow-elegant animate-fade-in">
              <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No positions available to vote for.</p>
            </div>
          )}
        </div>

        {/* Bottom Submit Action */}
        {(positions ?? []).length > 0 && (
          <div className="mt-12 bg-card p-6 rounded-2xl border border-border shadow-elegant flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-center sm:text-left">
              <span className="font-medium text-foreground">{totalSelected} vote{totalSelected !== 1 ? 's' : ''} selected</span>
              <p className="text-xs text-muted-foreground">Review your choices carefully before submitting.</p>
            </div>

            <button 
              onClick={() => submitVotes.mutate()} 
              disabled={submitVotes.isPending}
              className="flex items-center gap-2 px-8 py-3 rounded-xl gradient-gold text-accent-foreground font-bold text-base shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              {submitVotes.isPending 
                ? <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" /> 
                : <CheckCircle2 className="w-5 h-5" />}
              Submit Final Vote
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
