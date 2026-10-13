import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LazyMotion, MotionConfig } from "framer-motion";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import WelcomePage from "./pages/WelcomePage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import AppErrorBoundary from "./components/AppErrorBoundary.tsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isGuest } from "./lib/guest";
import { offlineOnlyMode, supabaseConfigured } from "./integrations/supabase/client.ts";

const queryClient = new QueryClient();

const loadMotionFeatures = () => import("./lib/motionFeatures").then((m) => m.default);


const Gate = () => {
  const { user, loading } = useAuth();
  const [guest, setGuestState] = useState(() => isGuest());
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);

  useEffect(() => {
    const onChange = () => setGuestState(isGuest());
    window.addEventListener('guest-updated', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('guest-updated', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  // AuthProvider can enable guest mode before this child effect subscribes to
  // guest-updated. Re-read persisted state when auth initialization completes
  // so a fresh install enters the app without requiring a second launch.
  useEffect(() => {
    if (!loading) setGuestState(isGuest());
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // Offline-only builds must enter the local app directly, independent of storage availability.
  if (offlineOnlyMode || user || guest) return <Index />;
  if (authMode) return <AuthPage initialMode={authMode} onBack={() => setAuthMode(null)} />;
  return <WelcomePage onAuthRequested={(m) => setAuthMode(m)} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LazyMotion features={loadMotionFeatures} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppErrorBoundary>
              <Routes>
              <Route path="/" element={<Gate />} />
              <Route path="/auth" element={supabaseConfigured ? <AuthPage /> : <Navigate to="/" replace />} />
              <Route path="/reset-password" element={supabaseConfigured ? <ResetPasswordPage /> : <Navigate to="/" replace />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </AppErrorBoundary>
          </AuthProvider>
        </BrowserRouter>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  </QueryClientProvider>
);

export default App;
