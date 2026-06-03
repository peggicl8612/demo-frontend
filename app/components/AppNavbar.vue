<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import IconifyIconOnline from "./icon/iconifyIconOnline";
import { useAuthStore, UserRole } from "@/stores/auth";

defineOptions({
  name: "AppNavbar",
});

const { locale, locales, setLocale } = useI18n();

const isMenuOpen = ref(false);
const toggleMenu = () => (isMenuOpen.value = !isMenuOpen.value);
const closeMenu = () => {
  isMenuOpen.value = false;
};

const authStore = useAuthStore();

const isLangDropdownOpen = ref(false);
const langDropdownRef = ref<HTMLElement | null>(null);

const toggleLangSwitcher = () => {
  isLangDropdownOpen.value = !isLangDropdownOpen.value;
};

type AppLocale = "zh-TW" | "en" | "ja";

const selectLocale = (code: AppLocale) => {
  setLocale(code);
  isLangDropdownOpen.value = false;
};

const onDocumentClick = (e: MouseEvent) => {
  const el = langDropdownRef.value;
  if (el && !el.contains(e.target as Node)) {
    isLangDropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener("click", onDocumentClick);
});

// 當路由改變時，自動收起手機選單與語言下拉
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    closeMenu();
    isLangDropdownOpen.value = false;
  },
);
</script>

<template>
  <header class="navbar">
    <div class="navbar-container">
      <NuxtLink :to="$localePath('/home')" class="logo" @click="closeMenu">
        Neko Space
      </NuxtLink>
      <!-- 桌機版選單 -->
      <nav class="desktop-menu">
        <NuxtLink :to="$localePath('/home')">{{
          $t("components.navbar.home")
        }}</NuxtLink>
        <NuxtLink :to="$localePath('/about')">{{
          $t("components.navbar.about")
        }}</NuxtLink>
        <NuxtLink :to="$localePath('/cats')">{{
          $t("components.navbar.cats")
        }}</NuxtLink>
        <NuxtLink :to="$localePath('/adopt')">{{
          $t("components.navbar.adopt")
        }}</NuxtLink>
        <NuxtLink
          v-if="authStore.isLoggedIn && authStore.user?.role === UserRole.ADMIN"
          :to="$localePath('/admin')"
          >{{ $t("components.navbar.admin") }}</NuxtLink
        >
        <NuxtLink :to="$localePath('/shop')">{{
          $t("components.navbar.shop")
        }}</NuxtLink>
        <NuxtLink v-if="authStore.isLoggedIn" :to="$localePath('/cart')">
          {{ $t("components.navbar.cart") }}</NuxtLink
        >
        <template v-if="!authStore.isLoggedIn">
          <NuxtLink :to="$localePath('/authorization')">{{
            $t("components.navbar.authorization")
          }}</NuxtLink>
        </template>
        <template v-else>
          <NuxtLink :to="$localePath('/member')">{{
            $t("components.navbar.member")
          }}</NuxtLink>
          <div class="desktop-logout-wrapper">
            <button class="desktop-logout-btn" @click="authStore.logout">
              {{ $t("components.navbar.logout") }}
            </button>
          </div>
        </template>

        <div ref="langDropdownRef" class="lang-dropdown">
          <button
            type="button"
            class="lang-icon-btn"
            :aria-expanded="isLangDropdownOpen"
            aria-haspopup="listbox"
            aria-label="語言選單"
            @click.stop="toggleLangSwitcher"
          >
            <IconifyIconOnline
              icon="mdi:earth"
              width="24"
              height="24"
              color="#666"
            />
          </button>
          <Transition name="lang-dropdown">
            <ul
              v-show="isLangDropdownOpen"
              class="lang-dropdown-menu"
              role="listbox"
              aria-label="選擇語言"
            >
              <li
                v-for="loc in locales"
                :key="loc.code"
                role="option"
                :aria-selected="loc.code === locale"
              >
                <button
                  type="button"
                  class="lang-dropdown-item"
                  :class="{ active: loc.code === locale }"
                  @click="selectLocale(loc.code)"
                >
                  {{ loc.name }}
                </button>
              </li>
            </ul>
          </Transition>
        </div>
      </nav>
      <button
        class="hamber-button"
        :class="{ 'is-active': isMenuOpen }"
        @click="toggleMenu"
        aria-label="Menu"
      >
        <span class="line"></span>
        <span class="line"></span>
        <span class="line"></span>
      </button>
    </div>

    <!-- 手機版選單 -->
    <transition name="slide-fade">
      <div v-if="isMenuOpen" class="mobile-menu">
        <nav class="mobile-nav">
          <NuxtLink :to="$localePath('/home')" @click="closeMenu">{{
            $t("components.navbar.home")
          }}</NuxtLink>
          <NuxtLink :to="$localePath('/about')" @click="closeMenu">{{
            $t("components.navbar.about")
          }}</NuxtLink>
          <NuxtLink :to="$localePath('/cats')" @click="closeMenu">{{
            $t("components.navbar.cats")
          }}</NuxtLink>
          <NuxtLink :to="$localePath('/adopt')" @click="closeMenu">{{
            $t("components.navbar.adopt")
          }}</NuxtLink>
          <NuxtLink
            v-if="
              authStore.isLoggedIn && authStore.user?.role === UserRole.ADMIN
            "
            :to="$localePath('/admin')"
            @click="closeMenu"
            >{{ $t("components.navbar.admin") }}</NuxtLink
          >
          <NuxtLink :to="$localePath('/shop')" @click="closeMenu">{{
            $t("components.navbar.shop")
          }}</NuxtLink>
          <NuxtLink
            v-if="authStore.isLoggedIn"
            :to="$localePath('/cart')"
            @click="closeMenu"
            >{{ $t("components.navbar.cart") }}</NuxtLink
          >
          <template v-if="!authStore.isLoggedIn">
            <NuxtLink :to="$localePath('/authorization')">{{
              $t("components.navbar.authorization")
            }}</NuxtLink>
          </template>
          <template v-else>
            <NuxtLink :to="$localePath('/member')">
              {{ $t("components.navbar.member") }}
            </NuxtLink>
            <div class="mobile-logout-wrapper">
              <button @click="authStore.logout()" class="mobile-logout-btn">
                {{ $t("components.navbar.logout") }}
              </button>
            </div>
          </template>

          <div class="mobile-lang">
            <button
              v-for="loc in locales"
              :key="loc.code"
              :class="{ active: loc.code === locale }"
              @click="
                setLocale(loc.code);
                closeMenu();
              "
            >
              {{ loc.name }}
            </button>
          </div>
        </nav>
      </div>
    </transition>
  </header>
</template>

<style lang="scss" scoped>
@use "~/assets/scss/variable.scss" as *;

/* 基礎導覽列樣式 */
.navbar {
  position: fixed;
  top: 0;
  width: 100%;
  height: 70px;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  z-index: 1000;
  border-bottom: 1px solid #eaeaea;

  .navbar-container {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 24px;
    height: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  text-decoration: none;
  color: #333;
}

/* 桌面版選單 */
.desktop-menu {
  display: flex;
  align-items: center;
  gap: 32px;

  a {
    text-decoration: none;
    color: #666;
    transition: color 0.3s;
    &:hover,
    &.router-link-active {
      color: #000;
    }
  }

  .desktop-logout-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #666;
    transition: color 0.3s;
    &:hover {
      color: $secondary-color;
    }
  }

  .lang-dropdown {
    position: relative;
    margin-left: 8px;
    border-left: 1px solid #ccc;
    padding-left: 24px;
  }

  .lang-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    border: none;
    background: transparent;
    color: #666;
    cursor: pointer;
    border-radius: 8px;
    transition:
      color 0.2s,
      background 0.2s;

    &:hover {
      color: #000;
      background: rgba(0, 0, 0, 0.05);
    }

    &[aria-expanded="true"] {
      color: #000;
      background: rgba(0, 0, 0, 0.06);
    }
  }

  .lang-dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 160px;
    margin: 0;
    padding: 6px 0;
    list-style: none;
    background: #fff;
    border: 1px solid #eaeaea;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    z-index: 1100;
  }

  .lang-dropdown-item {
    display: block;
    width: 100%;
    padding: 10px 16px;
    border: none;
    background: none;
    text-align: left;
    font-size: 0.9rem;
    color: #555;
    cursor: pointer;
    transition: background 0.15s;

    &:hover {
      background: #f5f5f5;
    }

    &.active {
      color: #000;
      font-weight: 600;
      background: #f0f0f0;
    }
  }

  .lang-dropdown-enter-active,
  .lang-dropdown-leave-active {
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  .lang-dropdown-enter-from,
  .lang-dropdown-leave-to {
    opacity: 0;
    transform: translateY(-6px);
  }

  @include md-width {
    display: none;
  }
}

/* 漢堡按鈕 (使用 css 畫出三條線) */
.hamber-button {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  width: 30px;
  height: 24px;
  position: relative;
  z-index: 1001; // 確保展開時按鈕還在最上層

  .line {
    position: absolute;
    width: 100%;
    height: 2px;
    background-color: #333;
    transition: all 0.3s ease;
    left: 0;

    &:nth-child(1) {
      top: 0;
    }
    &:nth-child(2) {
      top: 11px;
    }
    &:nth-child(3) {
      top: 22px;
    }
  }

  /* 點擊後的叉叉動畫 */
  &.is-active .line {
    &:nth-child(1) {
      top: 11px;
      transform: rotate(45deg);
    }
    &:nth-child(2) {
      opacity: 0;
    }
    &:nth-child(3) {
      top: 11px;
      transform: rotate(-45deg);
    }
  }

  /* 核心 RWD：小於 md 尺寸時顯示漢堡按鈕 */
  @include md-width {
    display: block;
  }
}

/* 手機版全螢幕選單 */
.mobile-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;

  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 32px;
    text-align: center;
    font-size: 1.5rem;

    a {
      text-decoration: none;
      color: #333;

      &:hover {
        color: $secondary-color;
        transition: all 0.3s ease-in-out;
        transform: scale(1.02);
        font-weight: 500;
      }
    }

    .mobile-lang {
      margin-top: 24px;
      display: flex;
      justify-content: center;
      gap: 16px;
      button {
        cursor: pointer;
        font-size: 1.2rem;
        background: none;
        border: none;
      }
    }
  }

  .mobile-logout-wrapper {
    width: 100%;

    .mobile-logout-btn {
      width: 100%;
      padding: 12px 24px;
      background: $primary-color;
      border-radius: 12px;
      color: #fff;
      border: none;
      cursor: pointer;
      font-size: 18px;

      &:hover {
        background: $secondary-color;
        transition: all 0.3s ease-in-out;
        transform: scale(1.02);
        border-radius: 12px;
      }
    }
  }
}

/* Vue 的 Transition 動畫 */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
