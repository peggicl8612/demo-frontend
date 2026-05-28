<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { useAuthStore } from "@/stores/auth";
defineOptions({
  name: "Authorization",
});

// 取得設定的後端網址
const config = useRuntimeConfig();
const authStore = useAuthStore();
const localePath = useLocalePath();

// 表單
const formRef = ref<FormInstance>();

const registerRules = ref<FormRules>({
  username: [
    {
      required: true,
      message: $t("authorization.form.usernameRequired"),
      trigger: "blur",
    },
  ],
  password: [
    {
      required: true,
      message: $t("authorization.form.passwordRequired"),
      trigger: "blur",
    },
    {
      min: 6,
      message: $t("authorization.form.passwordTooShort"),
      trigger: "blur",
    },
  ],
  confirmPassword: [
    {
      required: true,
      message: $t("authorization.form.confirmPasswordRequired"),
      trigger: "blur",
    },
    {
      validator: (rule, value, callback) => {
        if (value !== authForm.value.password) {
          callback(new Error($t("authorization.form.passwordMismatch")));
        } else {
          callback();
        }
      },
    },
  ],
  email: [
    {
      required: true,
      message: $t("authorization.form.emailRequired"),
      trigger: "blur",
    },
  ],
});

const loginRules = ref<FormRules>({
  username: [
    {
      required: true,
      message: $t("authorization.form.usernameRequired"),
      trigger: "blur",
    },
  ],
  password: [
    {
      required: true,
      message: $t("authorization.form.passwordRequired"),
      trigger: "blur",
    },
  ],
});

// 綁定表單的變數
const errorMessage = ref("");
const isLoading = ref(false);
type LoginResponse = {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
  };
};

const handleLogin = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;
  isLoading.value = true;
  errorMessage.value = "";
  try {
    const response: LoginResponse = await $fetch(
      `${config.public.apiBase}/auth/login`,
      {
        method: "POST",
        body: {
          username: authForm.value.username,
          password: authForm.value.password,
        },
      },
    );
    // 登入成功
    authStore.login(response.access_token, response.user);
    // 跳轉回首頁
    await navigateTo(localePath("/home"));
  } catch (error: any) {
    console.error("登入失敗:", error);
    const status = error?.status ?? error?.statusCode;
    if (status === 401) {
      ElMessage.error($t("authorization.form.loginFailed"));
    } else {
      ElMessage.error($t("authorization.form.unknownError"));
    }
  } finally {
    isLoading.value = false;
  }
};

const handleRegister = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;
  /* 未填寫欄位 */
  if (
    !authForm.value.username ||
    !authForm.value.password ||
    !authForm.value.confirmPassword ||
    !authForm.value.email
  ) {
    ElMessage.error($t("authorization.form.completeRegistrationData"));
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    await $fetch(`${config.public.apiBase}/auth/register`, {
      method: "POST",
      body: {
        username: authForm.value.username,
        password: authForm.value.password,
        email: authForm.value.email,
      },
    });
    await handleLogin();
  } catch (error: any) {
    console.error("註冊失敗:", error);
    const status = error?.status ?? error?.statusCode;
    if (status === 409) {
      ElMessage.error($t("authorization.form.userConflict"));
    } else {
      ElMessage.error($t("authorization.form.unknownError"));
    }
  } finally {
    isLoading.value = false;
  }
};

// 綁定選中的 tab
const activeName = ref("login");

const tabs = computed(() => [
  { label: $t("authorization.tabs.login"), name: "login" },
  { label: $t("authorization.tabs.register"), name: "register" },
]);

// 先將資料結構化
const authForm = ref({
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
});

watch(activeName, (tab) => {
  formRef.value?.resetFields();
  if (tab === "register") {
    authForm.value.username = "";
    authForm.value.password = "";
    authForm.value.confirmPassword = "";
    authForm.value.email = "";
  } else {
    authForm.value.username = "";
    authForm.value.password = "";
  }
});
</script>

<template>
  <div class="auth-container">
    <div class="auth-tabs">
      <el-tabs v-model="activeName" type="border-card" class="auth-tabs">
        <el-tab-pane
          v-for="tab in tabs"
          :key="tab.name"
          :label="tab.label"
          :name="tab.name"
        />
      </el-tabs>

      <div class="tab-content">
        <h2 class="form-title">
          {{
            activeName === "register"
              ? $t("authorization.form.register")
              : $t("authorization.form.login")
          }}
        </h2>
        <el-form
          :model="authForm"
          label-position="top"
          :validate-on-rule-change="false"
          :rules="activeName === 'register' ? registerRules : loginRules"
          ref="formRef"
        >
          <el-form-item
            :label="$t('authorization.form.username')"
            prop="username"
          >
            <el-input
              v-model="authForm.username"
              :placeholder="$t('authorization.form.usernamePlaceholder')"
              class="form-input"
            />
          </el-form-item>

          <el-form-item
            :label="$t('authorization.form.password')"
            prop="password"
          >
            <el-input
              v-model="authForm.password"
              type="password"
              show-password
              :placeholder="$t('authorization.form.passwordPlaceholder')"
              class="form-input"
            />
          </el-form-item>

          <template v-if="activeName === 'register'">
            <el-form-item
              :label="$t('authorization.form.confirmPassword')"
              prop="confirmPassword"
            >
              <el-input
                v-model="authForm.confirmPassword"
                type="password"
                show-password
                :placeholder="
                  $t('authorization.form.confirmPasswordPlaceholder')
                "
                class="form-input"
              />
            </el-form-item>

            <el-form-item :label="$t('authorization.form.email')" prop="email">
              <el-input
                v-model="authForm.email"
                :placeholder="$t('authorization.form.emailPlaceholder')"
                class="form-input"
              />
            </el-form-item>
          </template>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
          <template v-if="activeName === 'login'">
            <el-button
              type="primary"
              class="submit-btn"
              :loading="isLoading"
              @click="handleLogin"
            >
              {{ $t("authorization.form.login") }}
            </el-button>
          </template>
          <template v-else>
            <el-button
              type="primary"
              class="submit-btn"
              :loading="isLoading"
              @click="handleRegister"
            >
              {{ $t("authorization.form.register") }}
            </el-button>
          </template>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "~/assets/scss/variable.scss" as *;
.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100dvh - 90px);
  overflow: hidden;
  background-color: $quinary-color;

  .auth-tabs {
    max-width: 55vw;
    width: 100%;

    .tab-content {
      padding: 24px;
      background-color: #fff;
      border-bottom-left-radius: 12px;
      border-bottom-right-radius: 12px;
    }
  }

  .form-title {
    margin-bottom: 24px;
    font-size: 20px;
    font-weight: 600;
    color: $secondary-color;
    text-align: center;
  }

  .form-input {
    height: 50px;
  }

  .submit-btn {
    margin-top: 24px;
    width: 100%;
    height: 50px;
    font-size: 16px;
    border-radius: 12px;
    background-color: $secondary-color;
    color: #fff;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    &:hover {
      background-color: $secondary-color-hover;
    }
  }

  .error-message {
    margin-top: 16px;
    text-align: center;
    color: $primary-color;
    font-size: 14px;
    font-weight: 500;
  }
}
</style>

<style lang="scss">
@use "~/assets/scss/variable.scss" as *;
.auth-tabs.el-tabs--border-card > .el-tabs__header {
  border-top-left-radius: 12px !important;
  border-top-right-radius: 12px !important;
  overflow: hidden;
}

.auth-tabs.el-tabs--border-card > .el-tabs__header .el-tabs__nav-scroll {
  border-top-left-radius: 12px !important;
  border-top-right-radius: 12px !important;
  overflow: hidden;
}

.auth-tabs.el-tabs--border-card > .el-tabs__header .el-tabs__nav {
  width: 100%;
  display: flex;
}

.auth-tabs.el-tabs--border-card > .el-tabs__header .el-tabs__item {
  flex: 1 1 0;
  justify-content: center;
  text-align: center;
}
/* hover  color*/
.auth-tabs.el-tabs--border-card > .el-tabs__header .el-tabs__item:hover {
  color: $tertiary-color !important;
}
.auth-tabs.el-tabs--border-card > .el-tabs__header .el-tabs__item.is-active {
  color: $secondary-color;
}

.el-input__wrapper {
  border-radius: 12px;
}

.auth-tabs.el-tabs--border-card > .el-tabs__content {
  padding: 0 !important;
}

.auth-tabs input:-webkit-autofill,
.auth-tabs input:-webkit-autofill:hover,
.auth-tabs input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
  -webkit-text-fill-color: #333 !important;
}
</style>
