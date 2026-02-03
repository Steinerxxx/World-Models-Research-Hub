import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { Layout } from '@/components/Layout';
import Home from '@/pages/Home';
import Introduction from '@/pages/Introduction';
import Trends from '@/pages/Trends';

function App() {
  return (
    <ThemeProvider>
      <FilterProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="introduction" element={<Introduction />} />
              <Route path="trends" element={<Trends />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </FilterProvider>
    </ThemeProvider>
  );
}

export default App;
