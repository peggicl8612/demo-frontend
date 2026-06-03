const STORAGE_KEY = "auth:verification-cooldown";
const COOLDOWN_SECONDS = 60;

interface CooldownRecord {
  email: string;
  expiresAt: number;
}

/** 驗證碼發送 60 秒冷卻：localStorage 持久化 + 倒數計時 */
export function useVerificationCooldown() {
  const countdown = ref(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const stopTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const getStored = (): CooldownRecord | null => {
    if (!import.meta.client) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CooldownRecord;
    } catch {
      return null;
    }
  };

  const saveStorage = (email: string, seconds: number = COOLDOWN_SECONDS) => {
    if (!import.meta.client) return;
    const record: CooldownRecord = {
      email,
      expiresAt: Date.now() + seconds * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  };

  const clearStorage = () => {
    if (!import.meta.client) return;
    localStorage.removeItem(STORAGE_KEY);
  };

  const getRemainingSeconds = (email: string): number => {
    const stored = getStored();
    if (!stored || stored.email !== email) return 0;
    const remaining = Math.ceil((stored.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  };

  const tick = () => {
    stopTimer();
    if (countdown.value <= 0) {
      countdown.value = 0;
      return;
    }
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        stopTimer();
        clearStorage();
      }
    }, 1000);
  };

  const startCountdown = (seconds: number, email?: string) => {
    countdown.value = Math.max(0, Math.floor(seconds));
    if (email && countdown.value > 0) saveStorage(email, countdown.value);
    if (countdown.value > 0) tick();
    else stopTimer();
  };

  /** 從 localStorage 還原剩餘秒數並啟動倒數，回傳剩餘秒數 */
  const restoreCountdown = (email: string): number => {
    const remaining = getRemainingSeconds(email);
    if (remaining > 0) {
      countdown.value = remaining;
      tick();
    } else {
      countdown.value = 0;
      stopTimer();
      const stored = getStored();
      if (stored?.email === email) clearStorage();
    }
    return remaining;
  };

  const isCooldownActive = computed(() => countdown.value > 0);

  onScopeDispose(() => stopTimer());

  return {
    countdown,
    isCooldownActive,
    COOLDOWN_SECONDS,
    getRemainingSeconds,
    startCountdown,
    restoreCountdown,
    clearStorage,
  };
}
