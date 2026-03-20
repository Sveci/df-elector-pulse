import { defineConfig, splitVendorChunkPlugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import compression from "vite-plugin-compression2";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const projectId = env.VITE_SUPABASE_PROJECT_ID || "gzqzfqmmudxcnwkjjgux";
  const fallbackUrl = projectId ? `https://${projectId}.supabase.co` : "";

  const supabaseUrl = env.VITE_SUPABASE_URL || fallbackUrl;
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cXpmcW1tdWR4Y253a2pqZ3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDY4NDQsImV4cCI6MjA4ODQ4Mjg0NH0.Fu2XyqGpMhG9zAaWsWuKobzAnORJ32G2LnMX2G32EXk";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      splitVendorChunkPlugin(),
      mode === "development" && componentTagger(),
      // Gzip + Brotli compression for production
      mode === "production" &&
        compression({ algorithms: ["gzip"], exclude: [/\.(png|jpg|webp|svg|gif)$/] }),
      mode === "production" &&
        compression({
          algorithms: ["brotliCompress"],
          exclude: [/\.(png|jpg|webp|svg|gif)$/],
        }),
    ].filter(Boolean),
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectId),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    build: {
      target: "es2020",
      minify: "esbuild",
      sourcemap: false,
      // Chunk size warning at 400kb (default 500kb)
      chunkSizeWarningLimit: 400,
      rollupOptions: {
        output: {
          // Manual chunk splitting for large vendor libraries
          manualChunks: {
            // React core
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            // UI framework
            "vendor-ui": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-popover",
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-switch",
            ],
            // Data fetching
            "vendor-query": ["@tanstack/react-query"],
            // Supabase
            "vendor-supabase": ["@supabase/supabase-js"],
            // Charts (heavy)
            "vendor-charts": ["recharts"],
            // Maps (heavy)
            "vendor-maps": ["leaflet", "react-leaflet"],
            // Date utilities
            "vendor-date": ["date-fns"],
            // Animation
            "vendor-animation": ["framer-motion"],
            // Icons (can be large)
            "vendor-icons": ["lucide-react"],
            // Excel/PDF export
            "vendor-export": ["jspdf", "html2canvas"],
          },
        },
      },
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@tanstack/react-query",
        "@supabase/supabase-js",
      ],
    },
    // Enable CSS code splitting
    css: {
      devSourcemap: mode === "development",
    },
  };
});