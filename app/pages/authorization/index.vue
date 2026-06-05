<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
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
const {
  countdown,
  isCooldownActive,
  COOLDOWN_SECONDS,
  getRemainingSeconds,
  startCountdown,
  restoreCountdown,
} = useVerificationCooldown();

/** 信箱 blur / 還原：若該信箱仍在冷卻期，接續倒數並進入驗證碼步驟 */
const syncCooldownForEmail = (email: string) => {
  if (!email) return 0;
  const remaining = restoreCountdown(email);
  if (remaining > 0) isWaitingForCode.value = true;
  return remaining;
};

const onEmailBlur = () => {
  syncCooldownForEmail(authForm.value.email);
};

// 點擊發送驗證碼
const handleSendCode = async () => {
  const email = authForm.value.email;
  if (!email) {
    ElMessage.warning($t("authorization.form.emailRequired"));
    return;
  }

  // 冷卻中：不呼叫 API，僅還原 UI 倒數（按鈕維持 disabled）
  const remaining = getRemainingSeconds(email);
  if (remaining > 0) {
    restoreCountdown(email);
    isWaitingForCode.value = true;
    return;
  }

  isSendingCode.value = true;
  try {
    const res = await $fetch<{ retryAfter?: number }>(
      `${config.public.apiBase}/auth/send-code`,
      {
        method: "POST",
        body: { email },
      },
    );

    ElMessage.success($t("authorization.form.codeSent"));
    isWaitingForCode.value = true;
    startCountdown(res.retryAfter ?? COOLDOWN_SECONDS, email);
  } catch (error: unknown) {
    const err = error as {
      statusCode?: number;
      status?: number;
      data?: { retryAfter?: number };
    };
    const status = err.statusCode ?? err.status;
    if (status === 429) {
      const retryAfter = err.data?.retryAfter ?? COOLDOWN_SECONDS;
      isWaitingForCode.value = true;
      startCountdown(retryAfter, email);
      return;
    }
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
    return;
  }
  try {
    // 呼叫 API 驗證並註冊 API
    const response = await $fetch<LoginResponse>(
      `${config.public.apiBase}/auth/verify`,
      {
        method: "POST",
        body: {
          username: authForm.value.username,
          email: authForm.value.email,
          password: authForm.value.password,
          code: authForm.value.verificationCode,
        },
      },
    );

    authStore.login(response.access_token, response.user);

    ElMessage.success($t("authorization.form.registrationSuccess"));
    await navigateTo(localePath("/home"));
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
type UFormError = { name?: string; message: string };
type UFormApi = {
  validate: (opts?: {
    name?: string | string[];
    silent?: boolean;
  }) => Promise<typeof authForm.value>;
  getErrors: (name?: string) => UFormError[];
  setErrors: (errors: UFormError[], name?: string) => void;
  clear: (name?: string) => void;
};
const formRef = ref<UFormApi | null>(null);

// DB 唯一性檢查快取（儲存上次驗證結果，相同值不重打 API）
interface FieldCache {
  value: string;
  exists: boolean;
}
const usernameCache = ref<FieldCache | null>(null);
const emailCache = ref<FieldCache | null>(null);

/**
 * 進行中請求去重表（key = "username:value" | "email:value"）
 *
 * 問題：validateRegister 在同一次 blur 可能被觸發兩次（blur + change 事件同時觸發）。
 * 兩次呼叫都在第一次 API 回傳前看到 cache === null，導致重複發送請求。
 *
 * 解法：第一次發出請求時把 Promise 存入此 Map；
 *       同一值的後續呼叫直接取用同一個 Promise（共享結果，只打一次 API）。
 */
const inflightChecks = new Map<string, Promise<boolean>>();

const checkAvailability = (
  field: "username" | "email",
  value: string,
  cache: typeof usernameCache | typeof emailCache,
): Promise<boolean> => {
  // 快取命中：直接回傳上次結果
  if (cache.value?.value === value) return Promise.resolve(cache.value.exists);

  const key = `${field}:${value}`;

  // 已有進行中的相同請求：共用同一 Promise，不重發
  if (inflightChecks.has(key)) return inflightChecks.get(key)!;

  // 發起新請求
  const promise = $fetch<{ exists: boolean }>(
    `${config.public.apiBase}/users/check-availability`,
    { params: { [field]: value } },
  )
    .then(({ exists }) => {
      cache.value = { value, exists };
      return exists;
    })
    .catch(() => false) // API 失敗時不快取，下次重試
    .finally(() => inflightChecks.delete(key));

  inflightChecks.set(key, promise);
  return promise;
};

// ── 登入驗證：只需必填 ──────────────────────────────────────
const validateLogin = (state: typeof authForm.value): UFormError[] => {
  const errors: UFormError[] = [];
  if (!state.username)
    errors.push({
      name: "username",
      message: $t("authorization.form.usernameRequired"),
    });
  if (!state.password)
    errors.push({
      name: "password",
      message: $t("authorization.form.passwordRequired"),
    });
  return errors;
};

// ── 註冊驗證：必填 → 格式 → DB 唯一性（含快取） ──────────────
const validateRegister = async (
  state: typeof authForm.value,
): Promise<UFormError[]> => {
  // 驗證碼步驟只需確認驗證碼有填
  if (isWaitingForCode.value) {
    if (!state.verificationCode)
      return [
        {
          name: "verificationCode",
          message: $t("authorization.form.verificationCodePlaceholder"),
        },
      ];
    return [];
  }

  const errors: UFormError[] = [];
  const dbChecks: Promise<void>[] = [];

  // ── 使用者帳號 ──────────────────────────────────────────────
  if (!state.username) {
    errors.push({
      name: "username",
      message: $t("authorization.form.usernameRequired"),
    });
  } else if (state.username.length < 5) {
    errors.push({
      name: "username",
      message: $t("authorization.form.usernameTooShort"),
    });
  } else {
    // 通過基本檢查，排入 DB 唯一性檢查（共用 inflight Promise，不重發）
    dbChecks.push(
      checkAvailability("username", state.username, usernameCache).then(
        (exists) => {
          if (exists)
            errors.push({
              name: "username",
              message: $t("authorization.form.usernameConflict"),
            });
        },
      ),
    );
  }

  // ── 密碼 ────────────────────────────────────────────────────
  if (!state.password) {
    errors.push({
      name: "password",
      message: $t("authorization.form.passwordRequired"),
    });
  } else if (state.password.length < 6) {
    errors.push({
      name: "password",
      message: $t("authorization.form.passwordTooShort"),
    });
  }

  // ── 確認密碼 ────────────────────────────────────────────────
  if (!state.confirmPassword) {
    errors.push({
      name: "confirmPassword",
      message: $t("authorization.form.confirmPasswordRequired"),
    });
  } else if (state.password && state.confirmPassword !== state.password) {
    errors.push({
      name: "confirmPassword",
      message: $t("authorization.form.passwordMismatch"),
    });
  }

  // ── 電子信箱 ────────────────────────────────────────────────
  if (!state.email) {
    errors.push({
      name: "email",
      message: $t("authorization.form.emailRequired"),
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) {
    errors.push({
      name: "email",
      message: $t("authorization.form.emailInvalid"),
    });
  } else {
    // 通過基本檢查，排入 DB 唯一性檢查（共用 inflight Promise，不重發）
    dbChecks.push(
      checkAvailability("email", state.email, emailCache).then((exists) => {
        if (exists)
          errors.push({
            name: "email",
            message: $t("authorization.form.emailConflict"),
          });
      }),
    );
  }

  // username 與 email 的 DB 檢查並行執行
  if (dbChecks.length > 0) await Promise.all(dbChecks);

  return errors;
};

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
  try {
    await formRef.value?.validate();
  } catch {
    return; // 驗證失敗，停止提交
  }
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

// 綁定選中的 tab
const activeName = ref("login");

const tabs = computed(() => [
  { label: $t("authorization.tabs.login"), value: "login" },
  { label: $t("authorization.tabs.register"), value: "register" },
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
  formRef.value?.clear();
  // 切換 tab 時清除 DB 快取，避免使用舊的驗證結果
  usernameCache.value = null;
  emailCache.value = null;
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
    if (authForm.value.email) {
      syncCooldownForEmail(authForm.value.email);
    }
  } else {
    authForm.value.username = "";
    authForm.value.password = "";
  }
});

onMounted(() => {
  if (activeName.value === "register" && authForm.value.email) {
    syncCooldownForEmail(authForm.value.email);
  }
});
</script>

<!-- <template>
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
</style> -->

<template>
  <div
    class="flex justify-center items-center pl-20 pr-20 min-h-[calc(100dvh-90px)] bg-[#eee] overflow-hidden"
  >
    <div
      class="w-full lg:w-[45vw] min-w-[320px] max-w-3xl rounded-xl overflow-hidden"
    >
      <UTabs
        v-model="activeName"
        :items="tabs"
        class="w-full"
        :ui="{
          root: 'w-full block',
          list: 'flex w-full bg-[#f5f7fa] p-0 rounded-t-3xl overflow-hidden border-b border-[#dcdfe6] h-[52px]',
          trigger:
            'items-center justify-center text-[15px] font-medium rounded-none h-full transition-colors data-[state=active]:bg-white data-[state=active]:text-[#403123] data-[state=active]:border-b-2 data-[state=active]:border-[#403123] data-[state=inactive]:text-[#909399] hover:data-[state=inactive]:text-[#666]',
          indicator: 'hidden',
        }"
      />

      <div class="bg-white px-7 py-7 rounded-b-3xl">
        <h2 class="text-[20px] font-semibold text-[#403123] text-center mb-6">
          {{
            activeName === "register"
              ? $t("authorization.form.register")
              : $t("authorization.form.login")
          }}
        </h2>

        <UForm
          :state="authForm"
          :validate="
            activeName === 'register' ? validateRegister : validateLogin
          "
          ref="formRef"
          @submit="
            activeName === 'login'
              ? handleLogin()
              : isWaitingForCode
                ? handleRegister()
                : handleSendCode()
          "
          class="space-y-5"
        >
          <div
            v-if="
              activeName === 'login' ||
              (activeName === 'register' && !isWaitingForCode)
            "
            class="space-y-5"
          >
            <UFormField
              :label="$t('authorization.form.username')"
              name="username"
              class="w-full"
              :ui="{ error: 'text-red-500 text-xs m-1' }"
            >
              <UInput
                v-model="authForm.username"
                :placeholder="$t('authorization.form.usernamePlaceholder')"
                class="w-full auth-input"
              />
            </UFormField>

            <UFormField
              :label="$t('authorization.form.password')"
              name="password"
              class="w-full"
              :ui="{ error: 'text-red-500 text-xs mt-1' }"
            >
              <UInput
                v-model="authForm.password"
                type="password"
                :placeholder="$t('authorization.form.passwordPlaceholder')"
                class="w-full auth-input"
              />
            </UFormField>

            <template v-if="activeName === 'register'">
              <UFormField
                :label="$t('authorization.form.confirmPassword')"
                name="confirmPassword"
                class="w-full"
                :ui="{ error: 'text-red-500 text-xs mt-1' }"
              >
                <UInput
                  v-model="authForm.confirmPassword"
                  type="password"
                  :placeholder="
                    $t('authorization.form.confirmPasswordPlaceholder')
                  "
                  class="w-full auth-input"
                />
              </UFormField>

              <UFormField
                :label="$t('authorization.form.email')"
                name="email"
                class="w-full"
                :ui="{ error: 'text-red-500 text-xs mt-1' }"
              >
                <UInput
                  v-model="authForm.email"
                  :placeholder="$t('authorization.form.emailPlaceholder')"
                  class="w-full auth-input"
                  @blur="onEmailBlur"
                />
              </UFormField>
            </template>
          </div>

          <div
            v-else-if="activeName === 'register' && isWaitingForCode"
            class="space-y-5"
          >
            <div
              class="flex items-start gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#575757]"
            >
              <UIcon
                name="i-heroicons-envelope"
                class="w-5 h-5 shrink-0 mt-0.5 text-[#575757]"
              />
              <p>
                驗證碼已寄送至
                <strong class="text-[#8295c2]">{{ authForm.email }}</strong>
              </p>
            </div>

            <UFormField name="verificationCode" class="w-full">
              <div class="flex gap-3">
                <UInput
                  v-model="authForm.verificationCode"
                  :placeholder="
                    $t('authorization.form.verificationCodePlaceholder')
                  "
                  maxlength="4"
                  class="flex-1 auth-input tracking-widest text-center"
                />
                <button
                  type="button"
                  :disabled="countdown > 0"
                  @click="handleSendCode"
                  class="h-[50px] px-5 rounded-xl text-[14px] font-medium border border-[#dcdfe6] bg-white text-[#606266] hover:bg-[#f5f5f5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {{
                    countdown > 0
                      ? `${countdown}s`
                      : $t("authorization.form.resendCode")
                  }}
                </button>
              </div>
            </UFormField>
          </div>

          <div
            v-if="errorMessage"
            class="text-center text-red-500 text-[14px] font-medium"
          >
            {{ errorMessage }}
          </div>

          <div class="pt-1">
            <UButton
              v-if="activeName === 'login'"
              type="submit"
              block
              :loading="isLoading"
              class="auth-submit-btn h-[50px] text-[16px] rounded-xl font-medium"
            >
              {{ $t("authorization.form.login") }}
            </UButton>

            <UButton
              v-else-if="!isWaitingForCode"
              type="submit"
              block
              :loading="isLoading"
              :disabled="isCooldownActive"
              class="auth-submit-btn h-[50px] text-[16px] rounded-xl font-medium"
            >
              {{
                isCooldownActive
                  ? `${countdown}s`
                  : $t("authorization.form.sendVerificationCode")
              }}
            </UButton>

            <UButton
              v-else
              type="submit"
              block
              :loading="isLoading"
              class="auth-submit-btn h-[50px] text-[16px] rounded-xl font-medium"
            >
              {{ $t("authorization.form.verifyAndRegister") }}
            </UButton>
          </div>
        </UForm>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "~/assets/scss/variable.scss" as *;

/* 輸入框：高度 + 圓角；移除 .ring 的 box-shadow（含 focus / autofill） */
@mixin auth-input-no-ring {
  outline: none !important;
  box-shadow: none !important;
  --tw-ring-shadow: 0 0 #0000 !important;
  --tw-ring-offset-shadow: 0 0 #0000 !important;
  --tw-shadow: 0 0 #0000 !important;
}

:deep(.auth-input) {
  border: 1px solid #5757578f;
  border-radius: 32px;
  margin-top: 12px;

  input,
  [data-slot="base"] {
    height: 45px;
    font-size: 14px;
    padding: 0 12px;
    border-radius: 12px;
    @include auth-input-no-ring;
  }

  /* Nuxt UI outline 變體的 .ring（box-shadow 實作） */
  .ring,
  [data-slot="base"].ring {
    @include auth-input-no-ring;
  }

  &:focus-within,
  &:focus-within [data-slot="base"],
  &:focus-within input {
    @include auth-input-no-ring;
  }

  [data-slot="base"]:focus,
  [data-slot="base"]:focus-visible,
  input:focus,
  input:focus-visible {
    @include auth-input-no-ring;
  }

  [data-slot="root"] {
    border-radius: 12px;
    overflow: hidden;
    @include auth-input-no-ring;
  }
}

/* 瀏覽器 autofill：不顯示黃/藍底色 */
:deep(.auth-input input:-webkit-autofill),
:deep(.auth-input input:-webkit-autofill:hover),
:deep(.auth-input input:-webkit-autofill:focus),
:deep(.auth-input input:-webkit-autofill:active),
:deep(.auth-input [data-slot="base"]:-webkit-autofill),
:deep(.auth-input [data-slot="base"]:-webkit-autofill:hover),
:deep(.auth-input [data-slot="base"]:-webkit-autofill:focus),
:deep(.auth-input [data-slot="base"]:-webkit-autofill:active) {
  -webkit-box-shadow: 0 0 0 1000px #fff inset !important;
  box-shadow: none !important;
  -webkit-text-fill-color: #333 !important;
  transition: background-color 9999s ease-in-out 0s !important;
}

/* 頁籤容器：強制 100% 寬度，消除 flex items-center 的擠壓效果 */
:deep([data-slot="root"]) {
  width: 100% !important;
  display: block !important;
}

:deep([data-slot="list"]) {
  width: 100% !important;
  padding: 0 !important;

  & > [data-slot="trigger"] {
    flex: 1 1 0% !important;
    width: 50% !important;
    min-width: 0 !important;
    display: flex !important;
  }
}

/* 驗證錯誤訊息：紅色 */
:deep([data-slot="error"]),
:deep(p[id$="-error"]),
:deep(.text-\[var\(--ui-error\)\]) {
  color: #ef502c !important;
  font-size: 12px;
}

/* 提交按鈕：使用原始設計色 */
:deep(.auth-submit-btn) {
  background-color: $secondary-color !important;
  color: #fff !important;
  border-radius: 32px;
  border-color: $secondary-color !important;

  &:hover:not(:disabled) {
    background-color: $secondary-color-hover !important;
    border-color: $secondary-color-hover !important;
  }
}
</style>
