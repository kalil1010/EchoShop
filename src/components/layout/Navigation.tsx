'use client'

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Shirt,
  MessageCircle,
  User,
  LogOut,
  Menu,
  X,
  Home,
  Palette,
  Image as ImageIcon,
  ShoppingBag,
  Store,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { normaliseRole } from '@/lib/roles';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresAuth?: boolean;
  tourId?: string;
}

export function Navigation() {
  const { user, userProfile, logout, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { href: '/', label: 'Home', icon: Home },
      { href: '/outfit', label: 'Outfit Suggestions', icon: Sparkles, requiresAuth: true, tourId: 'nav-outfit' },
      { href: '/closet', label: 'My Closet', icon: Shirt, requiresAuth: true, tourId: 'nav-my-closet' },
      { href: '/chat', label: 'Echo Shop Chat', icon: MessageCircle, requiresAuth: true },
      { href: '/image-generator', label: 'Image Lab', icon: ImageIcon, requiresAuth: true },
      { href: '/analyzer', label: 'Color Analyzer', icon: Palette },
      { href: '/marketplace', label: 'Marketplace', icon: ShoppingBag },
      { href: '/profile', label: 'Profile', icon: User, requiresAuth: true, tourId: 'nav-profile' },
    ];
    return items;
  }, []);

  const normalisedRole = normaliseRole(userProfile?.role ?? user?.role)
  if (normalisedRole === 'owner') {
    return null
  }

  // Filter nav items based on role
  // Vendors should only see: Home, Marketplace, Profile (no regular user services)
  const visibleNavItems = useMemo(() => {
    if (normalisedRole === 'vendor') {
      // Vendors only see: Home, Marketplace, Profile
      return navItems.filter((item) => 
        item.href === '/' || 
        item.href === '/marketplace' || 
        item.href === '/profile'
      )
    }
    // Regular users see all items (filtered by auth requirement)
    return navItems.filter((item) => !item.requiresAuth || !!user)
  }, [navItems, normalisedRole, user])

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-2">
            <Sparkles className="h-8 w-8 text-purple-600" />
            <span className="text-xl font-bold text-gray-900">Echo Shop</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.tourId}
                className="flex items-center space-x-1 text-gray-600 hover:text-purple-600 transition-colors"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-2">
                <Link href="/profile" className="hidden md:inline-block">
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src={(userProfile?.photoURL as string) || (user.photoURL as string) || ''} />
                    <AvatarFallback>
                      {userProfile?.displayName?.[0] || user.email?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden md:flex"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </div>
            ) : (
              <>
                <Link href="/vendor/login" className="hidden md:inline-block">
                  <Button variant="outline" size="sm">
                    Vendor Login
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button disabled={loading}>{loading ? 'Checking...' : 'Sign In'}</Button>
                </Link>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="space-y-2">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={item.tourId}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-purple-600 hover:bg-gray-50 rounded-md transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
              {user ? (
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-purple-600 hover:bg-gray-50 rounded-md transition-colors w-full text-left"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              ) : (
                <>
                  <Link
                    href="/vendor/login"
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-purple-600 hover:bg-gray-50 rounded-md transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Store className="h-4 w-4" />
                    <span>Vendor Login</span>
                  </Link>
                  <Link
                    href="/auth"
                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-purple-600 hover:bg-gray-50 rounded-md transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    <span>{loading ? 'Checking...' : 'Sign In'}</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}



