import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

export default function AppLayout() {
  const { sidebarCollapsed, setSidebarOpen } = useUiStore();

  return (
    <div className="min-h-screen bg-ga-bg-primary">
      <Sidebar />

      {/* Mobile top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-ga-bg-sidebar flex items-center px-4 z-20">
        <button onClick={() => setSidebarOpen(true)} className="text-xl mr-3 text-white">☰</button>
        <span className="font-bold text-white text-sm">GroceryApp</span>
      </div>

      <main
        className={cn(
          'transition-all duration-200 min-h-screen',
          // Desktop: offset by sidebar width
          sidebarCollapsed ? 'md:ml-[60px]' : 'md:ml-60',
          // Mobile: no sidebar margin, top padding for mobile header
          'ml-0 pt-12 md:pt-0',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
