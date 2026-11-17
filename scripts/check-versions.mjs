#!/usr/bin/env node
// 校验 package.json / Cargo.toml / tauri.conf.json 三处版本号一致。
// 应用内更新以 tauri.conf.json 的 version 为准，版本号不一致会导致新版本无法推送。
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf-8");

const versions = {
  "package.json": JSON.parse(read("package.json")).version,
  "src-tauri/tauri.conf.json": JSON.parse(read("src-tauri/tauri.conf.json")).version,
  "src-tauri/Cargo.toml": /^version\s*=\s*"([^"]+)"/m.exec(read("src-tauri/Cargo.toml"))?.[1],
};

const entries = Object.entries(versions);
const expected = entries[0][1];
const mismatched = entries.filter(([, version]) => version !== expected);

for (const [file, version] of entries) {
  console.log(`${version === expected ? "OK  " : "FAIL"} ${file}: ${version ?? "(未找到)"}`);
}

if (!expected || mismatched.length > 0) {
  console.error("\n版本号不一致，请把三处都改成同一个版本后再发布。");
  process.exit(1);
}

const tag = process.argv[2];
if (tag && tag.replace(/^v/, "") !== expected) {
  console.error(`\n标签 ${tag} 与版本号 ${expected} 不一致。`);
  process.exit(1);
}

console.log(`\n版本号一致：v${expected}`);
