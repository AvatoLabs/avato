export const tokens = {
    // Spacing
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        xxl: 48,
    },

    // Radii
    radius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
        full: 9999,
    },

    // Icon styling
    icon: {
        strokeWidth: 1.25, // Ultra-thin
        size: {
            sm: 16,
            md: 20,
            lg: 24,
            xl: 28,
        }
    },

    // Opacities for surface layering (monochrome)
    opacity: {
        hover: 'bg-foreground/5',
        active: 'active:bg-foreground/10',
        surface: 'bg-foreground/5 dark:bg-white/5',
        surfaceElevated: 'bg-foreground/10 dark:bg-white/10',
    },

    // Typography
    typography: {
        weight: {
            regular: '400',
            medium: '500', // Downgraded from 600
            semibold: '600', // Downgraded from bold/700
        }
    }
};
