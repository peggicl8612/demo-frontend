<script setup lang="ts">
const localePath = useLocalePath();

await navigateTo(localePath("/home"), { replace: true });
</script>

<template>
  <div />
</template>
