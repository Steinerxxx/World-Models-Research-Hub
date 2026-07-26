import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { Layout } from '@/components/Layout';

const Home = lazy(() => import('@/pages/Home'));
const Introduction = lazy(() => import('@/pages/Introduction'));
const Trends = lazy(() => import('@/pages/Trends'));
const Recommendations = lazy(() => import('@/pages/Recommendations'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const Profile = lazy(() => import('@/pages/Profile'));

function AppFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-sm text-muted-foreground">Loading page...</div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <FilterProvider>
          <AuthProvider>
            <FavoritesProvider>
              <BrowserRouter>
                <Suspense fallback={<AppFallback />}>
                  <Routes>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<Home />} />
                      <Route path="introduction" element={<Introduction />} />
                      <Route path="trends" element={<Trends />} />
                      <Route path="recommendations" element={<Recommendations />} />
                      <Route path="login" element={<LoginPage />} />
                      <Route path="register" element={<RegisterPage />} />
                      <Route path="profile" element={<Profile />} />
                    </Route>
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </FavoritesProvider>
          </AuthProvider>
        </FilterProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
