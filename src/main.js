import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.js";
import { initTheme } from "./ui/theme.js";
import { startOutboxRetry } from "./app/outbox.js";
import { initBackButton } from "./app/backButton.js";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";

initTheme();

createApp(App).use(router).mount("#app");

// Tasto indietro di Android (no-op in browser).
initBackButton(router);

// Retry automatico degli esiti in attesa: avvio, primo piano, rete ritrovata.
startOutboxRetry();
