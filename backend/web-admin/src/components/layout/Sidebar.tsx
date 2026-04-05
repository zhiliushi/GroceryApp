import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/utils/cn';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  badge?: number;
}

const generalNav: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/shopping-lists', label: 'Shopping Lists', icon: '📋' },
  { path: '/meals', label: 'Meals', icon: '🍳' },
  { path: '/foodbanks', label: 'Foodbanks', icon: '📍' },
  { path: '/analytics', label: 'Analytics', icon: '📈' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const adminNav: NavItem[] = [
  { path: '/products', label: 'Products', icon: '🏷️' },
  { path: '/users', label: 'Users', icon: '👥' },
  { path: '/contributed-products', label: 'Contributed', icon: '📥' },
  { path: '/needs-review', label: 'Needs Review', icon: '⚠️' },
  { path: '/price-records', label: 'Price Records', icon: '💰' },
  { path: '/admin-settings', label: 'Admin Settings', icon: '🔧' },
];

function NavLink({ item, collapsed, onClick }: { item: NavItem; collapsed: boolean; onClick?: () => void }) {
  const location = useLocation();
  const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        isActive
          ? 'bg-ga-accent/15 text-ga-accent border-l-2 border-ga-accent font-medium -ml-[2px]'
          : 'text-ga-text-secondary hover:bg-ga-bg-hover hover:text-ga-text-primary',
      )}
    >
      <span className="text-base flex-shrink-0">{item.icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span className="bg-yellow-500 text-black text-xs font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export default function Sidebar() {
  const { isAdmin, user, signOut } = useAuthStore();
  const { sidebarCollapsed, sidebarOpen, toggleSidebar, setSidebarOpen } = useUiStore();

  const handleNavClick = () => setSidebarOpen(false);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-ga-bg-sidebar border-r border-ga-border flex flex-col transition-all duration-200 z-40',
          // Desktop: always visible
          'hidden md:flex',
          sidebarCollapsed ? 'md:w-[60px]' : 'md:w-60',
          // Mobile: slide-in overlay when open
          sidebarOpen && '!flex w-60',
        )}
      >
        <div className="flex items-center gap-2 px-4 py-4 border-b border-ga-border">
          <button onClick={toggleSidebar} className="text-xl flex-shrink-0 hover:scale-110 transition-transform hidden md:block">🛒</button>
          <button onClick={() => setSidebarOpen(false)} className="text-xl flex-shrink-0 md:hidden">✕</button>
          <span className="font-bold text-ga-text-primary">GroceryApp</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {!sidebarCollapsed && (
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ga-text-secondary">General</div>
          )}
          {generalNav.map((item) => (
            <NavLink key={item.path} item={item} collapsed={sidebarCollapsed} onClick={handleNavClick} />
          ))}
          {isAdmin && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 py-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-ga-text-secondary">Admin</div>
              )}
              {adminNav.map((item) => (
                <NavLink key={item.path} item={item} collapsed={sidebarCollapsed} onClick={handleNavClick} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-ga-border px-3 py-3">
          {!sidebarCollapsed && (
            <div className="text-xs text-ga-text-secondary truncate mb-2">{user?.email || '—'}</div>
          )}
          <button onClick={signOut} className={cn('text-red-400 hover:text-red-300 text-xs transition-colors', sidebarCollapsed && 'text-center w-full')}>
            {sidebarCollapsed ? '🚪' : 'Sign Out'}
          </button>
        </div>
      </aside>
    </>
  );
}
