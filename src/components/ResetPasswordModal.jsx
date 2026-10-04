import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, KeyRound, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import api from "@/api/client";

const ADMIN_PASSWORD_MIN_LENGTH = 12;

export default function ResetPasswordModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const resetToken = params.get("reset_token");
      if (resetToken) {
        setToken(resetToken);
        setIsOpen(true);
      }
    } catch {
      // ignore in non-browser env
    }
  }, []);

  const passwordChecks = [
    { label: `At least ${ADMIN_PASSWORD_MIN_LENGTH} characters`, valid: newPassword.length >= ADMIN_PASSWORD_MIN_LENGTH },
    { label: "A lowercase letter", valid: /[a-z]/.test(newPassword) },
    { label: "An uppercase letter", valid: /[A-Z]/.test(newPassword) },
    { label: "A number", valid: /[0-9]/.test(newPassword) },
    { label: "A special character", valid: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const isStrong = passwordChecks.every((c) => c.valid);
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;
  const isValid = Boolean(newPassword && confirmPassword && isStrong && passwordsMatch);

  const handleClose = () => {
    setIsOpen(false);
    // Remove reset_token from URL without reload
    const url = new URL(window.location.href);
    url.searchParams.delete("reset_token");
    window.history.replaceState({}, document.title, url.pathname + (url.search || ""));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    try {
      await api.post("/auth/admin/reset-password", {
        token,
        new_password: newPassword,
      });

      toast({
        title: "Password reset successful!",
        description: "Your administrator password has been updated. A confirmation email was sent to your Gmail.",
        variant: "success",
      });

      handleClose();
    } catch (err) {
      toast({
        title: "Reset failed",
        description: err.message || "Invalid or expired reset link. Please request a new one.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-card rounded-2xl border border-border p-6 md:p-8 shadow-2xl animate-scale-in">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-gold/15 text-gold border border-gold/30">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-display text-foreground">Reset Admin Password</h2>
            <p className="text-xs text-muted-foreground">Enter your new secure administrator password</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-new-password" className="block text-sm font-medium text-foreground mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                id="reset-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={ADMIN_PASSWORD_MIN_LENGTH}
                className="w-full px-4 pr-10 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground mb-2">Password requirements</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {passwordChecks.map(({ label, valid }) => {
                  const status = !newPassword ? "neutral" : valid ? "valid" : "invalid";
                  return (
                    <li
                      key={label}
                      className={`flex items-center gap-1.5 text-xs ${
                        status === "valid" ? "text-success" : status === "invalid" ? "text-red-500" : "text-muted-foreground"
                      }`}
                    >
                      {status === "valid" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : status === "invalid" ? (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 shrink-0 rounded-full border border-current" />
                      )}
                      <span>{label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div>
            <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-foreground mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                minLength={ADMIN_PASSWORD_MIN_LENGTH}
                className="w-full px-4 pr-10 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p className={`mt-1 flex items-center gap-1.5 text-xs ${passwordsMatch ? "text-success" : "text-red-500"}`}>
                {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                {passwordsMatch ? "Passwords match." : "Passwords do not match."}
              </p>
            )}
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-foreground font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl gradient-gold text-accent-foreground font-semibold text-sm shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {loading ? "Updating…" : "Set Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
