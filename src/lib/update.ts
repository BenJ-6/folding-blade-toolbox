import { computed, reactive } from "vue";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "@/lib/backend";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "latest"
  | "available"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

export interface UpdateState {
  phase: UpdatePhase;
  /** 远端版本号 */
  version: string;
  notes: string;
  downloaded: number;
  contentLength: number;
  error: string;
  checkedAt: number | null;
}

const state = reactive<UpdateState>({
  phase: "idle",
  version: "",
  notes: "",
  downloaded: 0,
  contentLength: 0,
  error: "",
  checkedAt: null,
});

let pending: Update | null = null;

const hasUpdate = computed(() => ["available", "downloading", "ready"].includes(state.phase));

const progressPercent = computed(() =>
  state.contentLength > 0
    ? Math.min(100, Math.round((state.downloaded / state.contentLength) * 100))
    : 0,
);

function describeError(error: unknown): string {
  const raw = (error instanceof Error ? error.message : String(error ?? "")).trim();
  if (/signature|verif/i.test(raw)) {
    return "更新包签名校验失败，已中止安装。可前往项目主页手动下载最新版本。";
  }
  if (/public ?key|pubkey|invalid key/i.test(raw)) {
    return "更新通道尚未配置签名公钥，暂时无法检查更新。";
  }
  if (/valid release json|release data/i.test(raw)) {
    return "更新服务暂时没有可用的版本信息（Release 可能还是草稿），请稍后再试。";
  }
  if (/\b404\b|not found|no such/i.test(raw)) {
    return "更新服务尚未发布版本信息，请稍后再试。";
  }
  if (/timeout|timed out|dns|connect|network|tls|proxy|request/i.test(raw)) {
    return "无法连接更新服务器，请检查网络或代理后重试。";
  }
  return raw || "检查更新失败，请稍后重试。";
}

async function releasePending(): Promise<void> {
  if (!pending) {
    return;
  }
  const update = pending;
  pending = null;
  try {
    await update.close();
  } catch {
    // 资源释放失败不影响用户操作
  }
}

export interface CheckUpdateOptions {
  /** 静默检查：失败时不暴露错误，也不改变界面状态 */
  silent?: boolean;
}

async function checkForUpdate(options: CheckUpdateOptions = {}): Promise<void> {
  if (state.phase === "checking" || state.phase === "downloading" || state.phase === "installing") {
    return;
  }
  if (!isTauri()) {
    state.phase = "error";
    state.error = "浏览器预览模式不支持应用内更新，请使用桌面版。";
    return;
  }

  state.phase = "checking";
  state.error = "";
  try {
    const update = await check({ timeout: 15000 });
    state.checkedAt = Date.now();
    if (!update) {
      await releasePending();
      state.phase = "latest";
      state.version = "";
      state.notes = "";
      return;
    }
    await releasePending();
    pending = update;
    state.version = update.version;
    state.notes = update.body?.trim() || "";
    state.phase = "available";
  } catch (error) {
    if (options.silent) {
      state.phase = pending ? "available" : "idle";
      return;
    }
    state.phase = "error";
    state.error = describeError(error);
  }
}

async function downloadUpdate(): Promise<void> {
  if (!pending || state.phase === "downloading") {
    return;
  }
  state.phase = "downloading";
  state.downloaded = 0;
  state.contentLength = 0;
  state.error = "";
  try {
    await pending.download((event) => {
      if (event.event === "Started") {
        state.contentLength = event.data.contentLength ?? 0;
      } else if (event.event === "Progress") {
        state.downloaded += event.data.chunkLength;
      }
    });
    state.phase = "ready";
  } catch (error) {
    state.phase = "error";
    state.error = describeError(error);
  }
}

async function installUpdate(): Promise<void> {
  if (!pending) {
    return;
  }
  state.phase = "installing";
  state.error = "";
  try {
    // Windows 在启动安装器后会直接退出进程，这里的后续代码只在 macOS / Linux 生效
    await pending.install();
    await relaunch();
  } catch (error) {
    state.phase = "error";
    state.error = describeError(error);
  }
}

export function useUpdate() {
  return {
    state,
    hasUpdate,
    progressPercent,
    checkForUpdate,
    downloadUpdate,
    installUpdate,
  };
}
