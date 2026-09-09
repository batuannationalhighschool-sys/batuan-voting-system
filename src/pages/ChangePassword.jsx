import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import schoolSeal from "@/assets/school-seal.jpg";
import { ADMIN_PASSWORD_MIN_LENGTH, getAdminPasswordPolicyErrors } from "@/lib/password-policy";

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const { changePassword, user, isAdmin, mustChangePassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="container py-16 text-center animate-fade-in">
        <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-display font-bold text-foreground mb-2">Authentication Required</h1>
        <p className="text-muted-foreground mb-6">Please sign in first.</p>
        <button onClick={() => navigate("/auth")} className="px-6 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold">Sign In</button>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isAdmin) {
      const policyErrors = getAdminPasswordPolicyErrors(newPassword);
      if (policyErrors.length > 0) {
        toast({
          title: "Password is not strong enough",
          description: `Use ${policyErrors.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
    } else if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Must be at least 6 characters.", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please make sure both passwords are the same.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { error } = await changePassword(newPassword);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated!", description: "Your new password has been set successfully." });
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <img src={schoolSeal} alt="BNHS Seal" className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-gold/20 shadow-elegant" />
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Change Your Password
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mustChangePassword
              ? "For your security, please set a new password before continuing."
              : "Update your account password."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-elegant animate-scale-in space-y-4">
          {mustChangePassword && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-gold/10 border border-gold/20 mb-2">
              <ShieldCheck className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <p className="text-sm text-foreground">
                This is your first login. Your default password must be changed for security.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5 cursor-default select-none">New Password</label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
                minLength={isAdmin ? ADMIN_PASSWORD_MIN_LENGTH : 6}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground pr-10"
              />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5 cursor-default select-none">Confirm Password</label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                minLength={isAdmin ? ADMIN_PASSWORD_MIN_LENGTH : 6}
                className="w-full px-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground pr-10"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords do not match.</p>
          )}

          {isAdmin && (
            <p className="text-xs text-muted-foreground">
              Admin passwords must be at least {ADMIN_PASSWORD_MIN_LENGTH} characters and include uppercase, lowercase, a number, and a special character.
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Set New Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
