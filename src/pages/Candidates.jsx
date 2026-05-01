import { useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "@/api/client";
import CandidateCard from "@/components/CandidateCard";

export default function Candidates() {
  const [search, setSearch] = useState("");
  const [activePosition, setActivePosition] = useState("all");
  const [activeParty, setActiveParty] = useState("all");

  const { data: positions } = useQuery({
    queryKey: ["positions"],
    queryFn: () => api.get('/positions'),
  });

  const { data: candidates } = useQuery({
    queryKey: ["candidates"],
    queryFn: () => api.get('/candidates'),
  });

  const partyLists = Array.from(new Set((candidates ?? []).map((c) => c.party_list).filter(Boolean)));

  const filtered = (candidates ?? []).filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.party_list.toLowerCase().includes(search.toLowerCase());
    const matchesPosition = activePosition === "all" || c.position_id === activePosition;
    const matchesParty = activeParty === "all" || c.party_list === activeParty;
    return matchesSearch && matchesPosition && matchesParty;
  });

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Candidates</h1>
        <p className="text-muted-foreground mt-1">Meet the candidates running for SSLG positions</p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search candidates..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 sm:max-w-xs">
            <label htmlFor="position-filter" className="block text-xs font-semibold text-muted-foreground mb-1.5">Position:</label>
            <select 
              id="position-filter"
              value={activePosition} 
              onChange={(e) => setActivePosition(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
            >
              <option value="all">All Positions</option>
              {(positions ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {partyLists.length > 0 && (
            <div className="flex-1 sm:max-w-xs">
              <label htmlFor="party-filter" className="block text-xs font-semibold text-muted-foreground mb-1.5">Party List:</label>
              <select 
                id="party-filter"
                value={activeParty} 
                onChange={(e) => setActiveParty(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring shadow-sm"
              >
                <option value="all">All Parties</option>
                {partyLists.map((party) => (
                  <option key={party} value={party}>{party}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {filtered.map((candidate, i) => {
          const pos = (positions ?? []).find((p) => p.id === candidate.position_id);
          return <CandidateCard key={candidate.id} candidate={candidate} positionTitle={pos?.title} delay={i * 60} />;
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <p className="text-muted-foreground text-lg">No candidates found</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
