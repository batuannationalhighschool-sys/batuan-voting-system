import { useState, useEffect } from "react";
import { Save, Printer, CheckCircle2 } from "lucide-react";

const DEFAULT_SCHOOL_NAME = "Batuan National High School — Batuan, Bohol, Philippines";

export default function ElectionInfoForm({ settings, onSave, isSaving }) {
  const initialYear = settings?.school_year ?? "";
  const initialDate = settings?.election_date ? String(settings.election_date).slice(0, 10) : "";
  const initialName = settings?.school_name ?? DEFAULT_SCHOOL_NAME;
  const initialPaperSize = settings?.paper_size ?? localStorage.getItem("bnhs_paper_size") ?? "short";

  const [schoolYear, setSchoolYear] = useState(initialYear);
  const [electionDate, setElectionDate] = useState(initialDate);
  const [schoolName, setSchoolName] = useState(initialName);
  const [paperSize, setPaperSize] = useState(initialPaperSize);

  // Keep local state in sync if settings change externally
  useEffect(() => {
    setSchoolYear(settings?.school_year ?? "");
    setElectionDate(settings?.election_date ? String(settings.election_date).slice(0, 10) : "");
    setSchoolName(settings?.school_name ?? DEFAULT_SCHOOL_NAME);
    if (settings?.paper_size) {
      setPaperSize(settings.paper_size);
      try { localStorage.setItem("bnhs_paper_size", settings.paper_size); } catch (_) {}
    }
  }, [settings?.school_year, settings?.election_date, settings?.school_name, settings?.paper_size]);

  const isDirty =
    schoolYear !== (settings?.school_year ?? "") ||
    electionDate !== (settings?.election_date ? String(settings.election_date).slice(0, 10) : "") ||
    schoolName !== (settings?.school_name ?? DEFAULT_SCHOOL_NAME) ||
    paperSize !== (settings?.paper_size ?? localStorage.getItem("bnhs_paper_size") ?? "short");

  // Calculate copyright year preview dynamically based on schoolYear input
  const displayYear = (() => {
    const sy = schoolYear || settings?.school_year;
    if (sy) {
      const parts = sy.split("-");
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last) && last > 1900 && last < 2100) return last;
    }
    if (electionDate) {
      const yr = new Date(electionDate).getFullYear();
      if (!isNaN(yr)) return yr;
    }
    return new Date().getFullYear();
  })();

  const handleSave = (e) => {
    e.preventDefault();
    if (!isDirty || isSaving) return;
    try { localStorage.setItem("bnhs_paper_size", paperSize); } catch (_) {}
    onSave({
      school_year: schoolYear,
      election_date: electionDate,
      school_name: schoolName.trim() || DEFAULT_SCHOOL_NAME,
      paper_size: paperSize,
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 text-sm">
      {/* Print Paper Size Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5 text-gold" />
          Official Results Print Paper Size
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Short Bond Paper */}
          <button
            type="button"
            onClick={() => setPaperSize("short")}
            className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
              paperSize === "short"
                ? "bg-gold/10 border-gold shadow-sm ring-1 ring-gold/40 text-foreground"
                : "bg-muted/40 border-border text-muted-foreground hover:border-gold/50 hover:bg-muted/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  📄 Short Bond Paper
                </p>
                <p className="text-[11px] font-mono mt-0.5 text-muted-foreground">8.5″ × 11″ (Letter)</p>
              </div>
              {paperSize === "short" && (
                <CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-2 leading-tight">
              Compact & continuous layout tailored for standard Letter bond papers (2–3 sheets).
            </p>
          </button>

          {/* Long Bond Paper */}
          <button
            type="button"
            onClick={() => setPaperSize("long")}
            className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
              paperSize === "long"
                ? "bg-gold/10 border-gold shadow-sm ring-1 ring-gold/40 text-foreground"
                : "bg-muted/40 border-border text-muted-foreground hover:border-gold/50 hover:bg-muted/60"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  📜 Long Bond Paper
                </p>
                <p className="text-[11px] font-mono mt-0.5 text-muted-foreground">8.5″ × 13″ (Folio / F4)</p>
              </div>
              {paperSize === "long" && (
                <CheckCircle2 className="w-4 h-4 text-gold shrink-0 mt-0.5" />
              )}
            </div>
            <p className="text-[10.5px] text-muted-foreground mt-2 leading-tight">
              Philippine DepEd standard with extra vertical space for clean, comfortable spacing.
            </p>
          </button>
        </div>
      </div>

      {/* School Year */}
      <div className="space-y-1.5">
        <label htmlFor="school-year-input" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
          School Year
        </label>
        <input
          id="school-year-input"
          type="text"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="e.g. 2025-2026"
          maxLength={20}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      {/* Election Date */}
      <div className="space-y-1.5">
        <label htmlFor="election-date-input" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Election Date
        </label>
        <input
          id="election-date-input"
          type="date"
          value={electionDate}
          onChange={(e) => setElectionDate(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Footer School Name */}
      <div className="space-y-1.5">
        <label htmlFor="school-name-input" className="block text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Footer School Name
        </label>
        <input
          id="school-name-input"
          type="text"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          placeholder={DEFAULT_SCHOOL_NAME}
          maxLength={150}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
        <p className="text-xs text-muted-foreground">
          Displayed in the footer as:{" "}
          <span className="text-foreground font-medium">
            © {displayYear} {schoolName.trim() || DEFAULT_SCHOOL_NAME}
          </span>
        </p>
      </div>

      <button
        type="submit"
        disabled={isSaving || !isDirty}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {isSaving ? (
          <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Save Changes
      </button>
    </form>
  );
}
