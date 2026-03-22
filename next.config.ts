import { defineConfig } from './src/libs/next/config/define-config';

const isVercel = !!process.env.VERCEL_ENV;

// Exclusions that should apply to all builds (Vercel and Docker)
const outputFileTracingExcludes = {
  '*': [
    'node_modules/.pnpm/@napi-rs+canvas-*-musl*',
    'node_modules/.pnpm/@img+sharp-libvips-*musl*',
    // Exclude SPA/desktop/mobile build artifacts from serverless functions
    'public/spa/**',
    'dist/desktop/**',
    'dist/mobile/**',
    'apps/desktop/**',
    'packages/database/migrations/**',
  ],
};

const vercelConfig = {
  // Vercel serverless optimization: exclude musl binaries from all routes
  // Vercel uses Amazon Linux (glibc), not Alpine Linux (musl)
  // This saves ~45MB (29MB canvas-musl + 16MB sharp-musl) per serverless function
  outputFileTracingExcludes,
};

const nextConfig = defineConfig({
  // Always apply exclusions for Docker builds too
  outputFileTracingExcludes,
  ...(isVercel ? vercelConfig : {}),
});

// Force standalone output root to this project directory.
// Without this, Next.js detects ~/package-lock.json as workspace root,
// producing deep standalone paths (.next/standalone/RustRoverProjects/minkhub/)
// that break Turbopack hashed-module symlinks after rsync.
nextConfig.outputFileTracingRoot = import.meta.dirname;

export default nextConfig;
