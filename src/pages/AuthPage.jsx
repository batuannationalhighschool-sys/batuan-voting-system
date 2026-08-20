import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Eye, EyeOff, GraduationCap, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import schoolSeal from "@/assets/school-seal.jpg";

export default function AuthPage() {
  const [lrn, setLrn] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error, must_change_password, isAdmin } = await signIn(lrn, password);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else if (must_change_password) {
      toast({ title: "Welcome!", description: "Please change your password to continue." });
      navigate("/change-password");
    } else {
      toast({ title: "Welcome back!" });
      if (isAdmin) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-block relative group mb-4">
            <div className="absolute -inset-2 rounded-full bg-gold/20 blur-lg opacity-70 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-1.5 rounded-full bg-gradient-to-b from-amber-200 via-gold to-amber-600 shadow-gold shadow-lg">
              <img src={schoolSeal} alt="BNHS Seal" className="w-32 h-32 md:w-36 md:h-36 rounded-full object-cover shadow-md" />
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Welcome
          </h1>
          <p className="text-muted-foreground text-sm mt-1">BNHS SSLG Election System</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-elegant animate-scale-in space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">LRN (Learner Reference Number)</label>
            <div className="relative">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={lrn}
                onChange={(e) => setLrn(e.target.value)}
                placeholder="Enter your LRN"
                required
                maxLength={50}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl gradient-gold text-accent-foreground font-semibold shadow-gold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Your account is created by the administrator. Use your LRN as your default password for first-time login.
          </p>
        </form>
      </div>
    </div>
  );
}
