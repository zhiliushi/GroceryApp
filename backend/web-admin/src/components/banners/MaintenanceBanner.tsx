/**
 * MaintenanceBanner — site-wide banner driven by `app_config/system.maintenance_mode`.
 *
 * Read from the auth store (the `/api/me` response carries the flag for both
 * authenticated and unauthenticated users). Mounted in AppLayout above the
 * outlet so it's visible on every page after sign-in. The login page mounts
 * it too so signed-out users see the banner when they land.
 *
 * When `maintenance_mode=true`, the BACKEND middleware (Phase 5) returns 503
 * for write requests by non-admins. This banner is the user-facing signal for
 * why writes are failing.
 */
import { useAuthStore } from '@/stores/authStore';

export default function MaintenanceBanner() {
  const { user, isAdmin } = useAuthStore();
  if (!user?.maintenance_mode) return null;

  return (
    <div className="bg-yellow-500/15 border-b border-yellow-500/40 px-4 py-2 text-xs text-yellow-100 flex items-start gap-2">
      <span aria-hidden="true">⚠️</span>
      <div className="flex-1">
        <div className="font-semibold text-yellow-50">
          Service in maintenance mode
        </div>
        <div className="mt-0.5 text-yellow-100/80">
          {user.maintenance_message ||
            'Some features are temporarily unavailable while we update the system.'}
          {isAdmin && (
            <span className="ml-1 italic text-yellow-200/70">
              (Admin: writes still work for you.)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
