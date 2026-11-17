#!/usr/bin/env node
// 发版分两步：
//   bump —— 同步版本号、校验、测试并本地提交（可反复重来，不碰远端）
//   tag  —— 校验版本号一致后打标签并推送，触发 release 流水线
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

const HELP = `用法：
  bun run release:bump [patch|minor|major|x.y.z] [选项]   同步版本号 → 校验 → 测试 → 本地提交
  bun run release:tag [选项]                              校验版本号 → 打标签 → 推送

bump 选项：
  --dry-run    预览，不修改文件、不提交
  --yes, -y    跳过确认
  --no-test    跳过类型检查与 cargo test

tag 选项：
  --dry-run    预览，不打标签、不推送
  --yes, -y    跳过确认
  --no-push    只创建本地标签`;

const FILES = {
  pkg: "package.json",
  cargo: "src-tauri/Cargo.toml",
  lock: "src-tauri/Cargo.lock",
  conf: "src-tauri/tauri.conf.json",
  readme: "README.md",
};

const log = (message) => console.log(message);
const warn = (message) => console.warn(`  ! ${message}`);

function step(index, total, message) {
  console.log(`\n[${index}/${total}] ${message}`);
}

function capture(cmd, args, cwd = ROOT) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (result.error) {
    return { ok: false, stdout: "", stderr: result.error.message };
  }
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function must(cmd, args, cwd = ROOT) {
  const result = capture(cmd, args, cwd);
  if (!result.ok) {
    throw new Error(`\`${cmd} ${args.join(" ")}\` 执行失败：${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function stream(cmd, args, cwd = ROOT) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.error) {
    throw new Error(`\`${cmd}\` 无法执行：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`\`${cmd} ${args.join(" ")}\` 失败（退出码 ${result.status}）`);
  }
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("-")));
  const positional = argv.filter((arg) => !arg.startsWith("-"));
  return {
    target: positional[0] ?? "patch",
    dryRun: flags.has("--dry-run"),
    yes: flags.has("--yes") || flags.has("-y"),
    noTest: flags.has("--no-test"),
    noPush: flags.has("--no-push"),
    help: flags.has("--help") || flags.has("-h"),
  };
}

function currentVersion() {
  return JSON.parse(readFileSync(path.join(ROOT, FILES.pkg), "utf8")).version;
}

function computeVersion(current, target) {
  if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(target)) {
    if (target === current) {
      throw new Error(`目标版本 ${target} 与当前版本相同`);
    }
    return target;
  }
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!match) {
    throw new Error(`无法识别当前版本号 ${current}`);
  }
  const [major, minor, patch] = match.slice(1).map(Number);
  if (target === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (target === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  if (target === "major") {
    return `${major + 1}.0.0`;
  }
  throw new Error(`未知的版本参数 ${target}，可用 patch / minor / major 或具体版本号`);
}

function replaceVersion(relPath, pattern, next, dryRun) {
  const abs = path.join(ROOT, relPath);
  const before = readFileSync(abs, "utf8");
  const regex = new RegExp(pattern, "m");
  if (!regex.test(before)) {
    throw new Error(`无法在 ${relPath} 中定位版本号`);
  }
  const after = before.replace(regex, (_match, prefix, suffix) => `${prefix}${next}${suffix}`);
  if (after === before) {
    log(`  · ${relPath} 已是 ${next}`);
    return;
  }
  if (!dryRun) {
    writeFileSync(abs, after);
  }
  log(`  ${dryRun ? "将修改" : "已修改"} ${relPath}`);
}

function assertRepo() {
  must("git", ["rev-parse", "--git-dir"]);
  const branch = must("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch === "HEAD") {
    throw new Error("当前处于 detached HEAD 状态，请先切回分支");
  }
  return branch;
}

function assertClean() {
  if (must("git", ["status", "--porcelain"])) {
    throw new Error("工作区有未提交的改动，请先提交后再执行（发布提交应只包含版本号）");
  }
}

function assertTagAbsent(tag) {
  if (capture("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`]).ok) {
    throw new Error(`本地已存在标签 ${tag}，请先运行 \`bun run release:bump\` 升级版本号`);
  }
  const remoteTag = capture("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]);
  if (remoteTag.ok && remoteTag.stdout) {
    throw new Error(`远端已存在标签 ${tag}，请先运行 \`bun run release:bump\` 升级版本号`);
  }
}

function detectRepo() {
  const url = capture("git", ["remote", "get-url", "origin"]).stdout.replace(/\s+/g, "");
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(url);
  return match ? `${match[1]}/${match[2]}` : "";
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function bump(opts) {
  step(1, 5, "检查环境");
  const branch = assertRepo();
  const current = currentVersion();
  const next = computeVersion(current, opts.target);
  const tag = `v${next}`;
  if (!opts.dryRun) {
    assertClean();
  }
  log(`  分支 ${branch}｜${current} → ${next}（标签 ${tag}）`);
  if (opts.dryRun) {
    log("  dry-run：不修改文件、不提交");
  }

  step(2, 5, "更新版本号");
  replaceVersion(FILES.pkg, '^(\\s*"version":\\s*")[^"]*(")', next, opts.dryRun);
  replaceVersion(FILES.conf, '^(\\s*"version":\\s*")[^"]*(")', next, opts.dryRun);
  replaceVersion(FILES.cargo, '^(version\\s*=\\s*")[^"]*(")', next, opts.dryRun);
  replaceVersion(
    FILES.lock,
    '(name = "folding-blade-toolbox"\\r?\\nversion = ")[^"]*(")',
    next,
    opts.dryRun,
  );
  replaceVersion(FILES.readme, "(当前版本：`)[^`]*(`)", next, opts.dryRun);

  step(3, 5, "校验与测试");
  if (opts.dryRun) {
    log(`  · node scripts/check-versions.mjs ${tag}`);
    log("  · bun run typecheck");
    log("  · cargo test（src-tauri）");
  } else {
    stream(process.execPath, ["scripts/check-versions.mjs", tag]);
    if (opts.noTest) {
      log("  已跳过测试（--no-test）");
    } else {
      stream("bun", ["run", "typecheck"]);
      stream("cargo", ["test"], path.join(ROOT, "src-tauri"));
    }
  }

  step(4, 5, "本地提交");
  if (opts.dryRun) {
    log(`  · git add -A && git commit -m "chore: release ${tag}"`);
    log(`\ndry-run 结束。正式执行后可以再运行 \`bun run release:tag\` 推送。`);
    return;
  }
  if (!opts.yes && !(await confirm(`\n将提交版本号改动（${tag}），继续？(y/N) `))) {
    throw new Error("已取消。版本号文件已修改，可用 `git checkout -- .` 还原");
  }
  stream("git", ["add", "-A"]);
  stream("git", ["commit", "-m", `chore: release ${tag}`]);
  log(`  已提交 ${tag}`);

  step(5, 5, "下一步");
  log(`  确认无误后运行：bun run release:tag`);
  log("  该命令会校验版本号、打标签并推送，触发发布流水线。");
}

async function tag(opts) {
  step(1, 4, "检查环境与版本号");
  const branch = assertRepo();
  const version = currentVersion();
  const target = `v${version}`;
  assertTagAbsent(target);
  const head = must("git", ["log", "-1", "--format=%h %s"]);
  log(`  分支 ${branch}｜标签 ${target}`);
  log(`  HEAD ${head}`);
  if (opts.dryRun) {
    log("  dry-run：不打标签、不推送");
  }
  stream(process.execPath, ["scripts/check-versions.mjs", target]);

  step(2, 4, "创建标签");
  if (opts.dryRun) {
    log(`  · git tag ${target}`);
  } else {
    if (!opts.yes && !(await confirm(`\n将创建标签 ${target} 并推送，继续？(y/N) `))) {
      throw new Error("已取消");
    }
    stream("git", ["tag", target]);
    log(`  已创建标签 ${target}`);
  }

  step(3, 4, "推送");
  const repo = detectRepo();
  if (opts.dryRun || opts.noPush) {
    log(`  · git push origin HEAD`);
    log(`  · git push origin ${target}`);
    log(`\n${opts.dryRun ? "dry-run 结束。" : "已跳过推送（--no-push）。"}`);
    return;
  }
  stream("git", ["push", "origin", "HEAD"]);
  stream("git", ["push", "origin", target]);
  log("  已推送分支与标签");

  step(4, 4, "后续");
  if (repo) {
    log(`  流水线：https://github.com/${repo}/actions/workflows/release.yml`);
    log(`  审批后发布草稿：https://github.com/${repo}/releases`);
  } else {
    log("  请到仓库的 Actions 页面审批，并在 Releases 页面发布草稿。");
  }
  warn("草稿 Release 必须手动 Publish，否则客户端拿不到更新");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") {
    log(HELP);
    return;
  }
  const opts = parseArgs(rest);
  if (opts.help) {
    log(HELP);
    return;
  }
  if (command === "bump") {
    await bump(opts);
    return;
  }
  if (command === "tag") {
    await tag(opts);
    return;
  }
  throw new Error(`未知命令 ${command}，可用 bump / tag`);
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
