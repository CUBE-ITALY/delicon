import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
    plugins: [vue()],
    // Path relativi nel build: l'app gira sia da un server web sia dentro
    // la WebView Capacitor (servita da https://localhost/).
    base: "./",
    // Versione unica dell'app (package.json), letta anche dal build Android.
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version)
    },
    test: {
        environment: "node",
        setupFiles: ["./tests/setup.js"]
    }
});
