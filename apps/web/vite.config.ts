import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  // Only relevant when apps/web runs as its own Railway service (see
  // VITE_API_URL in api/client.ts) — `vite preview` serves the production
  // build and must bind Railway's assigned $PORT on all interfaces, not
  // just localhost.
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    // Vite blocks unrecognized Host headers by default (DNS-rebinding
    // protection). Railway assigns a *.up.railway.app domain per service,
    // so allow the whole subdomain rather than hardcoding one that'll break
    // if the service is ever recreated with a new generated name.
    allowedHosts: [".up.railway.app"],
  },
});
