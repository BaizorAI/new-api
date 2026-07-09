/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
/**
 * Layout constants and configurations
 */

/**
 * Animation variants for mobile drawer
 */
export const MOBILE_DRAWER_ANIMATION = {
  overlay: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  },
  drawer: {
    hidden: { opacity: 0, y: 100 },
    visible: {
      opacity: 1,
      y: 0,
      rotate: 0,
      transition: {
        type: 'spring',
        damping: 15,
        stiffness: 200,
        staggerChildren: 0.03,
      },
    },
    exit: {
      opacity: 0,
      y: 100,
      transition: { duration: 0.1 },
    },
  },
  menuItem: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
} as const

/**
 * Cycling background color classes for sidebar node items.
 * Applied by index so adjacent items get distinct hues.
 */
export const SIDEBAR_NODE_COLORS = [
  'bg-blue-50/60 dark:bg-blue-950/30',
  'bg-violet-50/60 dark:bg-violet-950/30',
  'bg-emerald-50/60 dark:bg-emerald-950/30',
  'bg-amber-50/60 dark:bg-amber-950/30',
  'bg-rose-50/60 dark:bg-rose-950/30',
  'bg-sky-50/60 dark:bg-sky-950/30',
] as const

/**
 * Cycling icon (text) color classes for sidebar item icons.
 * Applied by index so adjacent items get distinct hues.
 */
export const SIDEBAR_ICON_COLORS = [
  'text-sky-500',
  'text-violet-500',
  'text-emerald-500',
  'text-amber-500',
  'text-rose-500',
  'text-pink-500',
  'text-cyan-500',
  'text-indigo-500',
] as const

/**
 * Mobile drawer configuration
 */
export const MOBILE_DRAWER_CONFIG = {
  overlayTransitionDuration: 0.2,
  drawerClassName:
    'fixed inset-x-0 bottom-3 z-50 mx-auto w-[95%] rounded-xl border border-border bg-background p-4 shadow-lg md:hidden',
  overlayClassName: 'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
} as const
