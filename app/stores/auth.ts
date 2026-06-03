import { defineStore } from 'pinia'


export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export const useAuthStore = defineStore('auth', () => {

  const config = useRuntimeConfig();

const fetchMe = async () => {
  if (!token.value) {
    user.value = null;
    return null;
  }
  const me = await $fetch<{
    id: string;
    username: string;
    email: string;
    role: UserRole;
  }>(`${config.public.apiBase}/users/me`, {
    headers: {
      Authorization: `Bearer ${token.value}`,
    },
  });
  user.value = {
    id: me.id,
    username: me.username,
    email: me.email,
    role: me.role as UserRole,
  };
  return user.value;
};

  
  // 使用 useCookie 儲存 token，這樣重整網頁時狀態不會消失
  const token = useCookie<string | null>('auth_token', {
    default: () => null,
    watch: true // 監聽 cookie 變化
  })
  
  // 使用者的基本資料（來自後端 /auth/login 回傳）
  const user = ref<{ id: string; username: string; email: string; role: UserRole } | null>(null)

  // 計算屬性：判斷是否已登入
  const isLoggedIn = computed(() => !!token.value)

  // 登入動作 (後續會串接後端 API)
  const login = async (newToken: string, userData: { id: string; username: string; email: string; role: UserRole }) => {
    token.value = newToken
    user.value = userData
  }

  // 登出動作
  const logout = () => {
    token.value = null
    user.value = null
    // 登出後導回登入頁
    const localePath = useLocalePath()
    navigateTo(localePath('/authorization'))
  }

  return {
    token,
    user,
    isLoggedIn,
    login,
    logout,
    fetchMe
  }
})