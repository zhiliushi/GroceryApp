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
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[40px]',
        isActive
          ? 'bg-white/20 text-white font-semibold'
          : 'text-white/70 hover:bg-white/10 hover:text-white',
      )}
    >
      <span className="text-base flex-shrink-0">{item.icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span className="bg-white/20 text-white text-xs font-medium rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
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
          <button onClick={() => setSidebarOpen(false)} className="text-xl flex-shrink-0 text-white md:hidden">✕</button>
          <span className="font-bold text-white">GroceryApp</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {!sidebarCollapsed && (
            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">General</div>
          )}
          {generalNav.map((item) => (
            <NavLink key={item.path} item={item} collapsed={sidebarCollapsed} onClick={handleNavClick} />
          ))}
          {isAdmin && (
            <>
              {!sidebarCollapsed && (
                <div className="px-3 py-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-white/50">Admin</div>
              )}
              {adminNav.map((item) => (
                <NavLink key={item.path} item={item} collapsed={sidebarCollapsed} onClick={handleNavClick} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-ga-border px-3 py-3">
          {!sidebarCollapsed && (
            <div className="text-xs text-white/60 truncate mb-2">{user?.email || '—'}</div>
          )}
          <button onClick={signOut} className={cn('text-white/70 hover:text-white text-xs transition-colors', sidebarCollapsed && 'text-center w-full')}>
            {sidebarCollapsed ? '🚪' : 'Sign Out'}
          </button>
        </div>
      </aside>
    </>
  );
}
