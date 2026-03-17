#!/usr/bin/env node
/**
 * E2E UI structure check — validates the V2 layout (MenuBar + Sidebar + MainContent).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const assetsDir = path.join(distDir, "assets");

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    return false;
  }
}

const files = fs.readdirSync(assetsDir);
const jsFile = files.find((f) => f.endsWith(".js"));
const cssFile = files.find((f) => f.endsWith(".css"));
assert.ok(jsFile && cssFile, "Build artifacts must exist");

const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), "utf8");
const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), "utf8");
const htmlContent = fs.readFileSync(path.join(distDir, "index.html"), "utf8");

const results = [];

results.push(
  run("E2E-1 HTML entry valid", () => {
    assert.ok(htmlContent.includes('id="root"'));
    assert.ok(htmlContent.includes('.js"'));
    assert.ok(htmlContent.includes('.css"'));
  })
);

results.push(
  run("E2E-2 V2 layout classes in CSS", () => {
    for (const cls of [".app-shell-v2", ".menu-bar", ".sidebar", ".main-content", ".preset-bar", ".result-panel"]) {
      assert.ok(cssContent.includes(cls), `CSS must contain ${cls}`);
    }
  })
);

results.push(
  run("E2E-3 V2 layout classes in JS", () => {
    for (const cls of ["app-shell-v2", "menu-bar", "sidebar", "main-content", "preset-bar", "result-panel"]) {
      assert.ok(jsContent.includes(cls), `JS must reference ${cls}`);
    }
  })
);

results.push(
  run("E2E-4 MenuBar has dropdown menus", () => {
    assert.ok(jsContent.includes("menu-dropdown"), "menu dropdown class");
    assert.ok(jsContent.includes("menu-trigger"), "menu trigger class");
    for (const label of ["工具", "Git", "设置"]) {
      assert.ok(jsContent.includes(label), `Menu label '${label}' must exist`);
    }
  })
);

results.push(
  run("E2E-5 Sidebar has project list", () => {
    assert.ok(jsContent.includes("sidebar-toggle"), "sidebar toggle");
    assert.ok(jsContent.includes("sidebar-collapsed"), "collapsed state");
    assert.ok(jsContent.includes("project-list"), "project list");
  })
);

results.push(
  run("E2E-6 PresetBar has run buttons", () => {
    assert.ok(jsContent.includes("primary-action"), "primary action button");
    assert.ok(jsContent.includes("task-detail-toggle"), "task detail toggle");
  })
);

results.push(
  run("E2E-7 ResultPanel has 4 tabs", () => {
    for (const tab of ["预览", "日志", "时间线", "产物"]) {
      assert.ok(jsContent.includes(tab), `Tab '${tab}' must exist`);
    }
  })
);

results.push(
  run("E2E-8 Old V1 layout NOT used in JS", () => {
    const v1Refs = (jsContent.match(/"app-shell"/g) || []).length;
    assert.strictEqual(v1Refs, 0, "app-shell (v1) should not be in JSX");
  })
);

results.push(
  run("E2E-9 MenuBar menu sections exist", () => {
    for (const section of ["GWS 命令行", "LZC 命令", "Gitea 部署", "初始化团队 Git", "备份到 GitHub"]) {
      assert.ok(jsContent.includes(section), `Section '${section}' must exist`);
    }
  })
);

results.push(
  run("E2E-10 Build size reasonable", () => {
    const jsSize = fs.statSync(path.join(assetsDir, jsFile)).size;
    const cssSize = fs.statSync(path.join(assetsDir, cssFile)).size;
    assert.ok(jsSize < 500 * 1024, `JS < 500KB, got ${jsSize}`);
    assert.ok(cssSize < 100 * 1024, `CSS < 100KB, got ${cssSize}`);
    console.log(`  JS: ${(jsSize / 1024).toFixed(1)} KB, CSS: ${(cssSize / 1024).toFixed(1)} KB`);
  })
);

results.push(
  run("E2E-11 Electron main.js valid", () => {
    require("child_process").execSync("node --check electron/main.js", { cwd: path.join(__dirname, ".."), stdio: "pipe" });
    const shared = require(path.join(__dirname, "..", "electron", "shared.js"));
    assert.ok(typeof shared.slugify === "function");
    assert.ok(typeof shared.scanArtifacts === "function");
  })
);

if (results.every(Boolean)) {
  console.log(`\nE2E UI check passed (${results.length}/${results.length}).`);
  process.exit(0);
}
const passed = results.filter(Boolean).length;
console.error(`\nE2E UI check failed (${passed}/${results.length}).`);
process.exit(1);
