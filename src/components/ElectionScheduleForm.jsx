import { useState, useEffect } from "react";
import { Save, Clock, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react";

export default function ElectionScheduleForm({ settings, onSave, isSaving }) {
  const [form, setForm] = useState({
    name: "",
    election_date: "",
    voting_start: "",
    voting_end: "",
    auto_end_enabled: true,
  });

  // Populate form whenever settings change
  useEffect(() => {
    if (!settings) return;
    const rawDate = settings.election_date;
    const dateStr = rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate).slice(0, 10);

    setForm({
      name: settings.name || "",
      election_date: dateStr,
      voting_start: settings.voting_start?.slice(0, 5) || "",
      voting_end: settings.voting_end?.slice(0, 5) || "",
      auto_end_enabled: settings.auto_end_enabled ?? true,
    });
  }, [settings]);

  const isEndPast = (() => {
    if (!form.election_date || !form.voting_end) return false;
    const [year, month, day] = form.election_date.split('-').map(Number);
    const [endH, endM, endS = 0] = form.voting_end.split(':').map(Number);
    const endDateTime = new Date(year, month - 1, day, endH, endM, endS);
    return new Date() >= endDateTime;
  })();

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.election_date || !form.voting_start || !form.voting_end) return;
    onSave({
      name: form.name,
      election_date: form.election_date,
      voting_start: form.voting_start + ":00",
      voting_end: form.voting_end + ":00",
      auto_end_enabled: form.auto_end_enabled,
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Election Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
          maxLength={100}
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Election Date</label>
        <input
          type="date"
          value={form.election_date}
          onChange={(e) => setForm(p => ({ ...p, election_date: e.target.value }))}
          required
          className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Voting Opens</label>
          <input
            type="time"
            value={form.voting_start}
            onChange={(e) => setForm(p => ({ ...p, voting_start: e.target.value }))}
            required
            className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gold" />
            Auto-End At
          </label>
          <input
            type="time"
            value={form.voting_end}
            onChange={(e) => setForm(p => ({ ...p, voting_end: e.target.value }))}
            required
            className={`w-full px-4 py-2.5 rounded-xl bg-background border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
              isEndPast ? 'border-destructive/60 ring-destructive/20' : 'border-gold/50 ring-gold/20'
            }`}
          />
        </div>
      </div>

      {/* Auto-End Mode Switch */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 border border-border">
        <div>
          <p className="text-xs font-semibold text-foreground">Auto-End Election on Schedule</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {form.auto_end_enabled
              ? "Election will automatically complete when the end time is reached."
              : "Manual mode: Election will stay ongoing until you manually click End Election."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm(p => ({ ...p, auto_end_enabled: !p.auto_end_enabled }))}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            form.auto_end_enabled
              ? "bg-gold/20 text-gold border border-gold/30"
              : "bg-muted text-muted-foreground border border-border"
          }`}
        >
          {form.auto_end_enabled ? (
            <>
              <ToggleRight className="w-4 h-4 text-gold" /> Enabled
            </>
          ) : (
            <>
              <ToggleLeft className="w-4 h-4 text-muted-foreground" /> Disabled
            </>
          )}
        </button>
      </div>

      {form.election_date && form.voting_end && (
        <p className={`text-xs rounded-xl px-4 py-2.5 border ${
          isEndPast
            ? "text-destructive bg-destructive/10 border-destructive/20 font-medium"
            : form.auto_end_enabled
            ? "text-gold bg-gold/10 border-gold/20"
            : "text-muted-foreground bg-muted/30 border-border"
        }`}>
          {isEndPast ? (
            <>⚠️ The end time you set (<strong>{form.voting_end}</strong> on <strong>{form.election_date}</strong>) has already passed. Please select a future end time so the election can run.</>
          ) : form.auto_end_enabled ? (
            <>⏰ Election will <strong>automatically end</strong> on <strong>{form.election_date}</strong> at <strong>{form.voting_end}</strong>.</>
          ) : (
            <>🔒 Auto-end is disabled. Election will <strong>remain ongoing</strong> until manually ended by admin.</>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={isSaving}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-gold text-accent-foreground font-medium text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isSaving
          ? <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
          : <Save className="w-4 h-4" />}
        Save Schedule
      </button>
    </form>
  );
}
