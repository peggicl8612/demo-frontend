export default defineNuxtPlugin(async () => {
    const authStore = useAuthStore();
    if (authStore.isLoggedIn && !authStore.user) {
      try {
        await authStore.fetchMe();
      } catch {
        authStore.logout();
      }
    }
  });