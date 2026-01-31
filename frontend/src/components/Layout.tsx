import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-auto w-full relative">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black -z-10 opacity-50 pointer-events-none" />
        <Outlet />
      </main>
    </div>
  );
}
