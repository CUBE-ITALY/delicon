<script setup>
import FeedbackHost from "./ui/FeedbackHost.vue";
</script>

<template>
    <RouterView :key="$route.fullPath" />
    <FeedbackHost />
</template>
