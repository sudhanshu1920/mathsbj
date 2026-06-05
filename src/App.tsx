import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import WelcomePage from "./pages/WelcomePage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isGuest } from "./lib/guest";

const queryClient = new QueryClient();

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (user || guest) return <Index />;
  if (authMode) return <AuthPage initialMode={authMode} onBack={() => setAuthMode(null)} />;
  return <WelcomePage onAuthRequested={(m) => setAuthMode(m)} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Gate />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
