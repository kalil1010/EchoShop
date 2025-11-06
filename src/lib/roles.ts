import type { UserRole } from '@/types/user'

export const DEFAULT_ROLE: UserRole = 'user'

const ROLE_MAP: Record<string, UserRole> = {
  user: 'user',
  vendor: 'vendor',
  owner: 'owner',
  admin: 'owner',
}

export function normaliseRole(value: unknown): UserRole {
  if (typeof value === 'string') {
    const roleKey = value.trim().toLowerCase()
    if (roleKey in ROLE_MAP) {
      return ROLE_MAP[roleKey]
    }
  }
  return DEFAULT_ROLE
}

export type PortalKey = 'customer' | 'vendor' | 'owner'

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

export interface PortalNotice {
  tone: NoticeTone
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  helperText?: string
}

export interface PortalToastNotice {
  title: string
  description?: string
  variant: 'default' | 'success' | 'warning' | 'error' | 'destructive'
}

export interface PortalDenial {
  toast: PortalToastNotice
  banner?: PortalNotice
  redirect?: string
  requiresLogout?: boolean
}

export interface RoleMeta {
  id: UserRole
  label: string
  shortLabel: string
  defaultRoute: string
  onboardingRoute: string
  welcomeTitle: string
  welcomeSubtitle: string
  icon: string
}

export const ROLE_META: Record<UserRole, RoleMeta> = {
  user: {
    id: 'user',
    label: 'Customer',
    shortLabel: 'Customer',
    defaultRoute: '/',
    onboardingRoute: '/profile',
    welcomeTitle: 'Welcome back!',
    welcomeSubtitle: 'Explore outfits, manage your style profile, and discover curated looks.',
    icon: 'sparkles',
  },
  vendor: {
    id: 'vendor',
    label: 'Vendor',
    shortLabel: 'Vendor',
    defaultRoute: '/atlas',
    onboardingRoute: '/atlas',
    welcomeTitle: 'Welcome, Vendor!',
    welcomeSubtitle: 'Upload products, track listings, and manage your marketplace presence here.',
    icon: 'store',
  },
  owner: {
    id: 'owner',
    label: 'Owner',
    shortLabel: 'Owner',
    defaultRoute: '/downtown/dashboard',
    onboardingRoute: '/downtown/dashboard',
    welcomeTitle: 'Hello, Owner!',
    welcomeSubtitle: 'Oversee the marketplace, approvals, and vendor growth from this console.',
    icon: 'shield',
  },
  admin: {
    id: 'owner',
    label: 'Owner',
    shortLabel: 'Owner',
    defaultRoute: '/downtown/dashboard',
    onboardingRoute: '/downtown/dashboard',
    welcomeTitle: 'Hello, Owner!',
    welcomeSubtitle: 'Oversee the marketplace, approvals, and vendor growth from this console.',
    icon: 'shield',
  },
}

export interface PortalConfig {
  key: PortalKey
  label: string
  entryRoute: string
  allowedRoles: UserRole[]
  defaultRedirect: string
  denialByRole: Partial<Record<UserRole, PortalDenial>>
}

export const PORTAL_CONFIG: Record<PortalKey, PortalConfig> = {
  customer: {
    key: 'customer',
    label: 'Customer experience',
    entryRoute: '/',
    allowedRoles: ['user', 'vendor', 'owner'],
    defaultRedirect: '/',
    denialByRole: {},
  },
  vendor: {
    key: 'vendor',
    label: 'Vendor dashboard',
    entryRoute: '/atlas',
    allowedRoles: ['vendor'],
    defaultRedirect: '/atlas',
    denialByRole: {
      owner: {
        requiresLogout: true,
        toast: {
          variant: 'error',
          title: 'Access denied',
          description: 'You were signed out of the vendor console.',
        },
        banner: {
          tone: 'warning',
          title: 'Owner account detected',
          description:
            'It looks like you tried to log in through the vendor console with an owner account. Continue to the Downtown owner console instead.',
          actionLabel: 'Go to Owner Console',
          actionHref: '/downtown',
        },
      },
      user: {
        requiresLogout: true,
        toast: {
          variant: 'warning',
          title: 'Access denied',
          description: 'Vendor tools are available only to approved vendors.',
        },
        banner: {
          tone: 'info',
          title: 'Request vendor upgrade',
          description:
            'You currently have a customer account. Submit a vendor application to unlock marketplace tools.',
          actionLabel: 'Request Vendor Access',
          actionHref: '/vendor/hub',
          helperText: 'We will notify you once a system owner reviews your request.',
        },
      },
    },
  },
  owner: {
    key: 'owner',
    label: 'Owner console',
    entryRoute: '/downtown',
    allowedRoles: ['owner'],
    defaultRedirect: '/downtown/dashboard',
    denialByRole: {
      vendor: {
        requiresLogout: true,
        toast: {
          variant: 'warning',
          title: 'Access denied',
          description: 'Owner console access requires an owner account.',
        },
        banner: {
          tone: 'warning',
          title: 'Owner console restricted',
          description:
            'Your account is set up for vendor operations. Continue to the Atlas vendor dashboard to manage products.',
          actionLabel: 'Open Vendor Portal',
          actionHref: '/atlas',
        },
      },
      user: {
        requiresLogout: true,
        toast: {
          variant: 'warning',
          title: 'Access denied',
          description: 'Sign in as an owner to reach this console.',
        },
        banner: {
          tone: 'info',
          title: 'Customer account detected',
          description:
            'Only verified owners can access the Downtown console. Continue with the customer experience or request elevated access from support.',
          actionLabel: 'Return to Dashboard',
          actionHref: '/',
        },
      },
    },
  },
}

export interface PortalAccessResult {
  portal: PortalConfig
  allowed: boolean
  denial?: PortalDenial
}

export function getPortalAccess(role: UserRole, portalKey: PortalKey): PortalAccessResult {
  const portal = PORTAL_CONFIG[portalKey]
  const allowed = portal.allowedRoles.includes(role)
  if (allowed) {
    return { portal, allowed: true }
  }
  const denial = portal.denialByRole[role] ?? {
    toast: {
      variant: 'warning',
      title: 'Access denied',
      description: 'You do not have permission to open this area.',
    },
    redirect: portal.defaultRedirect,
  }
  return { portal, allowed: false, denial }
}

export function getDefaultRouteForRole(role: UserRole): string {
  const meta = ROLE_META[role]
  return meta?.defaultRoute ?? ROLE_META[DEFAULT_ROLE].defaultRoute
}

export function resolvePortalFromPath(pathname: string): PortalKey {
  if (pathname.startsWith('/downtown') || pathname.startsWith('/api/admin')) return 'owner'
  if (
    pathname.startsWith('/atlas') ||
    pathname.startsWith('/dashboard/vendor') ||
    pathname.startsWith('/api/vendor')
  ) {
    return 'vendor'
  }
  return 'customer'
}

export function getRoleMeta(role: UserRole | null | undefined): RoleMeta {
  // Ensure we always return a valid RoleMeta
  if (!role || !(role in ROLE_META)) {
    return ROLE_META[DEFAULT_ROLE]
  }
  const meta = ROLE_META[role]
  // Double-check all required fields exist
  if (!meta || !meta.welcomeTitle || !meta.welcomeSubtitle) {
    return ROLE_META[DEFAULT_ROLE]
  }
  return meta
}
