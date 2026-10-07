<!--
  Intestazione: fascia scura in entrambi i temi, come la testata di un modulo.
  Il sottotitolo sta sopra il titolo, in piccolo (es. "Trasporto 0000000873"
  sopra "Consegna 0002"). Nei titoli gli zeri iniziali dei codici sono attenuati.
-->
<script setup>
import Icon from "./Icon.vue";
import BrandMark from "./BrandMark.vue";
import CodeText from "./CodeText.vue";
import { t } from "../i18n/index.js";
import { theme, toggleTheme } from "./theme.js";

defineProps({
    title:    { type: String, required: true },
    subtitle: { type: String, default: "" },
    back:     { type: Boolean, default: false },
    brand:    { type: Boolean, default: false }
});

defineEmits(["back"]);
</script>

<template>
    <header class="app-header">
        <div class="app-header__inner">
            <button
                v-if="back"
                type="button"
                class="btn btn-quiet btn-icon"
                :aria-label="t('app.back')"
                @click="$emit('back')"
            >
                <Icon name="chevron-left" :size="26" />
            </button>

            <h1 v-if="brand" class="wordmark">
                <BrandMark :size="30" />
                <span>{{ title }}</span>
            </h1>
            <div v-else class="titles">
                <p v-if="subtitle" class="subtitle"><CodeText :text="subtitle" /></p>
                <h1 class="title"><CodeText :text="title" /></h1>
            </div>

            <slot name="actions" />

            <button
                type="button"
                class="btn btn-quiet btn-icon"
                :aria-label="theme === 'dark' ? t('app.themeLight') : t('app.themeDark')"
                @click="toggleTheme"
            >
                <Icon name="contrast" :size="24" class="theme-icon" :class="{ 'is-dark': theme === 'dark' }" />
            </button>
        </div>
    </header>
</template>

<style scoped>
.app-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--head);
    color: var(--on-head);
    padding-top: env(safe-area-inset-top);
}

.app-header__inner {
    max-width: var(--page-max);
    margin: 0 auto;
    min-height: var(--head-h);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px 4px 6px;
}

.app-header .btn-quiet {
    color: var(--on-head);
}

.app-header .btn-quiet:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
}

.app-header :focus-visible {
    outline-color: var(--signal);
}

.wordmark {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-left: 12px;
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 1.375rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
}

.titles {
    flex: 1;
    min-width: 0;
    padding: 0 6px;
}

.subtitle {
    font-family: var(--font-cond);
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--on-head-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.title {
    font-family: var(--font-cond);
    font-weight: 700;
    font-size: 1.625rem;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Tema scuro: il disco si capovolge, la metà piena passa a sinistra. */
.theme-icon {
    transition: transform 0.2s ease;
}

.theme-icon.is-dark {
    transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
    .theme-icon { transition: none; }
}
</style>
