// 避免使用者透過直接輸入 https://{domain}/admin 的方式直接進入後台管理系統
import { useAuthStore, UserRole } from '@/stores/auth';
import { ElMessage } from 'element-plus';

export default defineNuxtRouteMiddleware((to, form) => {
    const authStore = useAuthStore();

    // 檢查是否登入
    if (!authStore.isLoggedIn) {
        return navigateTo('/authorization')
    }

    // 檢查是否為管理員
    if (authStore.user?.role !== UserRole.ADMIN) {
        if (import.meta.client) {
            ElMessage({
                type: 'error',
                /* 需有多語系 */
                message: '您沒有權限進入後台管理系統'
            })
        }
        return navigateTo('/')
    }
    
})
