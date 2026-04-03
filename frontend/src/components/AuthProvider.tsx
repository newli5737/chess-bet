'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication on initial load to prevent getting logged out on refresh
    const initAuth = async () => {
      await checkAuth();
      setLoading(false);
    };
    initAuth();
  }, [checkAuth]);

  if (loading) {
    // Optional: Render a lightweight loading screen or just null
    // so we don't flash unauthenticated content
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
         <div className="loader inline-block border-2 border-t-2 border-primary rounded-full w-8 h-8 mb-3 border-t-transparent animate-spin"></div>
         <p className="text-muted-foreground text-sm">Đang xác thực bảo mật...</p>
      </div>
    );
  }

  return <>{children}</>;
}
