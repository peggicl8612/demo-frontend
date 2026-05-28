<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
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

// 驗證碼相關狀態
const isWaitingForCode = ref(false); // 控制是否顯示驗證碼輸入框
const isSendingCode = ref(false); // 防止重複點擊發送按鈕
const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

// 倒數計時核心
const startCountdown = () => {
  countdown.value = 60;
  if (timer) clearInterval(timer);

  timer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      if (timer) clearInterval(timer);
    }
  }, 1000);
};

// 點擊發送驗證碼
const handleSendCode = async () => {
  if (!authForm.value.email) {
    ElMessage.warning($t("authorization.form.emailRequired"));
    return;
  }

  isSendingCode.value = true;
  try {
    await $fetch(`${config.public.apiBase}/auth/send-code`, {
      method: "POST",
      body: {
        email: authForm.value.email,
      },
    });

    ElMessage.success($t("authorization.form.codeSent"));
    isWaitingForCode.value = true;
    startCountdown();
  } catch (error: any) {
    ElMessage.error($t("authorization.form.codeSendFailed"));
  } finally {
    isSendingCode.value = false;
  }
};
/* 取代原本的 handleRegister */
const handleRegister = async () => {
  if (
    !authForm.value.username ||
    !authForm.value.password ||
    !authForm.value.confirmPassword ||
    !authForm.value.email
  ) {
    ElMessage.error($t("authorization.form.completeRegistrationData"));
    return;
  }

  if (authForm.value.password !== authForm.value.confirmPassword) {
    ElMessage.error($t("authorization.form.passwordMismatch"));
  }
  try {
    // 呼叫 API 驗證並註冊 API
    const response = await $fetch(`${config.public.apiBase}/auth/verify`, {
      method: "POST",
      body: {
        username: authForm.value.username,
        email: authForm.value.email,
        password: authForm.value.password,
        code: authForm.value.verificationCode,
      },
    });

    ElMessage.success($t("authorization.form.registrationSuccess"));
  } catch (error: any) {
    const status = error?.response?.status;
    if (status === 400) {
      ElMessage.error($t("authorization.form.verificationFailed"));
    } else if (status === 409) {
      ElMessage.error($t("authorization.form.userConflict"));
    } else {
      ElMessage.error($t("authorization.form.unknownError"));
    }
  }
};

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

/* const handleRegister = async () => {
  const valid = await formRef.value?.validate();
  if (!valid) return;
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
}; */

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
  verificationCode: "",
});

watch(activeName, (tab) => {
  formRef.value?.resetFields();
  // 進入 isWaitingForCode 狀態 時不要清空 email資料

  if (tab === "register") {
    authForm.value.username = "";
    authForm.value.password = "";
    authForm.value.confirmPassword = "";

    // 只有在尚未進入驗證碼步驟時才清 email
    if (!isWaitingForCode.value) {
      authForm.value.email = "";
    }
    authForm.value.verificationCode = "";
  } else {
    authForm.value.username = "";
    authForm.value.password = "";
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
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
          <div
            v-if="
              activeName === 'login' ||
              (activeName === 'register' && !isWaitingForCode)
            "
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

              <el-form-item
                :label="$t('authorization.form.email')"
                prop="email"
              >
                <el-input
                  v-model="authForm.email"
                  :placeholder="$t('authorization.form.emailPlaceholder')"
                  class="form-input"
                />
              </el-form-item>
            </template>
          </div>

          <div
            v-else-if="activeName === 'register' && isWaitingForCode"
            class="verification-step"
          >
            <div class="verify-alert">
              <el-icon><i-ep-message-box /></el-icon>
              <p>
                驗證碼已寄送至
                <strong class="verify-alert-text-email">{{
                  authForm.email
                }}</strong>
              </p>
            </div>

            <el-form-item prop="verificationCode" class="verification-form">
              <el-row :gutter="10" align="middle">
                <el-col :span="18">
                  <el-input
                    v-model="authForm.verificationCode"
                    :placeholder="
                      $t('authorization.form.verificationCodePlaceholder')
                    "
                    class="form-input"
                    maxlength="4"
                  />
                </el-col>
                <el-col :span="6">
                  <el-button
                    style="width: 100%"
                    :disabled="countdown > 0"
                    @click="handleSendCode"
                  >
                    {{
                      countdown > 0
                        ? `${countdown}s`
                        : $t("authorization.form.resendCode")
                    }}
                  </el-button>
                </el-col>
              </el-row>
            </el-form-item>
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>

          <div class="submit-section" style="margin-top: 20px">
            <el-button
              v-if="activeName === 'login'"
              type="primary"
              class="submit-btn"
              :loading="isLoading"
              @click="handleLogin"
            >
              {{ $t("authorization.form.login") }}
            </el-button>

            <el-button
              v-else-if="!isWaitingForCode"
              type="primary"
              class="submit-btn"
              :loading="isLoading"
              @click="handleSendCode"
            >
              {{ $t("authorization.form.sendVerificationCode") }}
            </el-button>

            <el-button
              v-else
              type="primary"
              class="submit-btn"
              :loading="isLoading"
              @click="handleRegister"
            >
              {{ $t("authorization.form.verifyAndRegister") }}
            </el-button>
          </div>
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
    max-width: 45vw;
    width: 100%;
    height: auto;
    border-radius: 12px;

    .tab-content {
      padding: 28px;
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

.verification-form {
  height: auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.verification-step {
  width: 100%;
  padding: 0px;
}

.verify-alert {
  padding-left: 10px;
}
.verify-alert-text-email {
  color: rgba(122, 144, 232, 0.796);
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

.el-form-item__content {
  display: block;
  justify-content: center;
  align-items: center;
}
</style>
