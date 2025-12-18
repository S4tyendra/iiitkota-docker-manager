import { Toaster } from "@/components/ui/sonner";
import { ServiceList } from "@/components/ServiceList";
import { ServiceForm } from "@/components/ServiceForm";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { ImagePuller } from "@/components/ImagePuller";
import { ModeToggle } from "@/components/mode-toggle";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import Login from "@/pages/Login";
import Users from "@/pages/Users";
import { Button } from "@/components/ui/button";
import { Users as UsersIcon, LogOut } from "lucide-react";
import type { JSX } from "react";

// Wrapper for protected routes
const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

// Wrapper for Admin routes
const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  // If not admin, maybe redirect to home?
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

function AppContent() {
  const { isAuthenticated, isAdmin, logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isAuthenticated && (
        <header className="border-b">
          <div className="container mx-auto py-4 px-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold flex items-center gap-2">
                Orchestr8
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link to="/" className="hover:text-primary">Dashboard</Link>
                {isAdmin && (
                  <Link to="/users" className="hover:text-primary flex items-center gap-1">
                    <UsersIcon className="h-4 w-4" /> Users
                  </Link>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                {user?.username}
              </span>
              <ModeToggle />
              <ImagePuller />
              <ServiceForm />
              <SettingsDrawer />
              <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className={isAuthenticated ? "container mx-auto py-8 px-4" : ""}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={
            <RequireAuth>
              <div className="grid gap-8">
                <ServiceList />
              </div>
            </RequireAuth>
          } />
          <Route path="/users" element={
            <RequireAuth>
              <RequireAdmin>
                <Users />
              </RequireAdmin>
            </RequireAuth>
          } />
        </Routes>
      </main>

      <Toaster />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;