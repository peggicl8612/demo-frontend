<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<style lang="scss">
@use "~/assets/scss/variable.scss" as *;

@font-face {
  font-family: "Roboto Mono";
  src: url("~/assets/fonts/RobotoMono/RobotoMono-VariableFont_wght.ttf")
    format("truetype");
  font-weight: 100 700;
  font-style: normal;
  font-display: swap;
}

html,
body,
#__nuxt {
  font-family: "Roboto Mono", monospace;
}
</style>
