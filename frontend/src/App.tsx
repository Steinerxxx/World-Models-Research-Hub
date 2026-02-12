import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import Home from '@/pages/Home';
import Introduction from '@/pages/Introduction';
import Trends from '@/pages/Trends';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import Profile from '@/pages/Profile';

function App() {
  return (
    <ThemeProvider>
      <FilterProvider>
        <AuthProvider>
          <FavoritesProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="introduction" element={<Introduction />} />
                  <Route path="trends" element={<Trends />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </FavoritesProvider>
        </AuthProvider>
      </FilterProvider>
    </ThemeProvider>
  );
}

export default App;
