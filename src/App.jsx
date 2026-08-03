import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ElectionProvider } from "@/contexts/ElectionContext";
import Layout from "@/components/Layout";
import Index from "./pages/Index";
import Candidates from "./pages/Candidates";
import VotePage from "./pages/VotePage";
import Results from "./pages/Results";
import Admin from "./pages/Admin";
import AuthPage from "./pages/AuthPage";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// BNHS Election App — SSLG & Classroom Officers
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <ElectionProvider>
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/change-password" element={<ChangePassword />} />
                <Route path="/candidates" element={<Candidates />} />
                <Route path="/vote" element={<VotePage />} />
                <Route path="/results" element={<Results />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </ElectionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
