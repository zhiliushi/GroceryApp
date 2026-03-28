import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

export default function AppLayout() {
  const { sidebarCollapsed } = useUiStore();

  return (
    <div className="min-h-screen bg-ga-bg-primary">
      <Sidebar />
      <main
        className={cn(
          'transition-all duration-200 min-h-screen',
          sidebarCollapsed ? 'ml-[60px]' : 'ml-60',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
