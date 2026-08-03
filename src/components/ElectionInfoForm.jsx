import { useState, useEffect } from "react";
import { Save } from "lucide-react";

const DEFAULT_SCHOOL_NAME = "Batuan National High School — Batuan, Bohol, Philippines";

export default function ElectionInfoForm({ settings, onSave, isSaving }) {
  const initialYear = settings?.school_year ?? "";
  const initialDate = settings?.election_date ? String(settings.election_date).slice(0, 10) : "";
  const initialName = settings?.school_name ?? DEFAULT_SCHOOL_NAME;

  const [schoolYear, setSchoolYear] = useState(initialYear);
  const [electionDate, setElectionDate] = useState(initialDate);
  const [schoolName, setSchoolName] = useState(initialName);

  // Keep local state in sync if settings change externally
  useEffect(() => {
    setSchoolYear(settings?.school_year ?? "");
    setElectionDate(settings?.election_date ? String(settings.election_date).slice(0, 10) : "");
    setSchoolName(settings?.school_name ?? DEFAULT_SCHOOL_NAME);
  }, [settings?.school_year, settings?.election_date, settings?.school_name]);

  const isDirty =
    schoolYear !== (settings?.school_year ?? "") ||
    electionDate !== (settings?.election_date ? String(settings.election_date).slice(0, 10) : "") ||
    schoolName !== (settings?.school_name ?? DEFAULT_SCHOOL_NAME);

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
    onSave({
      school_year: schoolYear,
      election_date: electionDate,
      school_name: schoolName.trim() || DEFAULT_SCHOOL_NAME,
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4 text-sm">
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
