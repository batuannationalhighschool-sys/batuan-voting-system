import { User, CheckCircle2 } from "lucide-react";

export default function CandidateCard({
  candidate,
  positionTitle,
  selectable = false,
  selected = false,
  onSelect,
  showVotes = false,
  voteCount = 0,
  maxVotes = 1,
  rank,
  delay = 0,
}) {
  const partyColors = {
    Pagbabago: "bg-primary/10 text-primary border-primary/20",
    "Bagong Pag-asa": "bg-success/10 text-success border-success/20",
    Kabataan: "bg-accent/10 text-accent-foreground border-accent/20",
  };

  return (
    <div
      onClick={() => selectable && onSelect?.(candidate.id)}
      className={`group relative bg-card rounded-xl border overflow-hidden transition-all duration-300 animate-fade-in ${
        selectable ? "cursor-pointer hover:shadow-elegant hover:-translate-y-1" : "shadow-elegant"
      } ${selected ? "ring-2 ring-gold border-gold shadow-gold" : "border-border"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {rank && (
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full gradient-gold flex items-center justify-center">
          <span className="text-xs font-bold text-accent-foreground">#{rank}</span>
        </div>
      )}
      {selected && (
        <div className="absolute top-3 right-3">
          <CheckCircle2 className="w-6 h-6 text-gold fill-gold/20" />
        </div>
      )}
      <div className="p-5">
        <div className="w-44 h-44 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-4 ring-4 ring-border">
          {candidate.avatar_url ? (
            <img src={candidate.avatar_url}
              alt={candidate.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-navy flex items-center justify-center">
              <User className="w-12 h-12 text-gold" />
            </div>
          )}
        </div>
        <div className="text-center">
          <h3 className="font-display font-bold text-foreground text-lg uppercase">{candidate.name}</h3>
          {positionTitle && <p className="text-sm font-semibold text-gold mt-0.5">{positionTitle}</p>}
          <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground">
            <span>{candidate.grade_level}</span>
            <span>·</span>
            <span>{candidate.section}</span>
          </div>
          {candidate.election_type !== 'classroom' && candidate.party_list && (
          <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-medium border ${partyColors[candidate.party_list] || "bg-muted text-muted-foreground border-border"}`}>
            {candidate.party_list}
          </span>
          )}
          {candidate.motto && <p className="text-xs text-muted-foreground italic mt-3 leading-relaxed">"{candidate.motto}"</p>}
        </div>
        {showVotes && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground font-medium">Total Votes</span>
              <span className="font-bold text-foreground font-display text-lg">{voteCount}</span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full gradient-gold rounded-full transition-all duration-1000" style={{ width: `${maxVotes > 0 ? Math.min((voteCount / maxVotes) * 100, 100) : 0}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
