import { defineConfig, splitVendorChunkPlugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import compression from "vite-plugin-compression2";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
      compression({ algorithm: "gzip", exclude: [/\.(png|jpg|webp|svg|gif)$/] }),
    mode === "production" &&
      compression({
        algorithm: "brotliCompress",
        exclude: [/\.(png|jpg|webp|svg|gif)$/],
      }),
  ].filter(Boolean),
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
}));
