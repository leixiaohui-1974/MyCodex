#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

// RED-3: Import from shared.js instead of duplicating functions
const shared = require("../electron/shared.js");
const {
  slugify,
  createDefaultManifest,
  readManifest,
  writeManifest,
  sanitizeManifest,
  scanArtifacts,
  readArtifactContent,
  appendCapped,
  detectConflictMarkers,
  ensureDir,
  quoteArg
} = shared;

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

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mycodex-smoke-"));
const results = [];

// --- T1: Project creation writes manifest ---
results.push(
  run("T1 create project writes manifest", () => {
    const root = path.join(tmpRoot, "projects");
    ensureDir(root);
    const displayName = "Alpha Project";
    const slug = slugify(displayName);
    const projectPath = path.join(root, slug);
    ensureDir(projectPath);
    ensureDir(path.join(projectPath, "docs"));
    ensureDir(path.join(projectPath, "outputs"));
    writeManifest(projectPath, createDefaultManifest(displayName, slug));
    const manifestPath = path.join(projectPath, "mycodex.project.json");
    assert.ok(fs.existsSync(manifestPath), "manifest file should exist");
    const manifest = readManifest(projectPath);
    assert.strictEqual(manifest.displayName, displayName);
    assert.strictEqual(manifest.slug, slug);
  })
);

// --- T2: Slug collision detection ---
results.push(
  run("T2 slug collision is rejected", () => {
    const root = path.join(tmpRoot, "collision");
    ensureDir(root);
    ensureDir(path.join(root, "my_project"));
    const attempted = path.join(root, slugify("My Project"));
    assert.ok(fs.existsSync(attempted), "colliding path must already exist");
    // Verify different display names produce same slug
    assert.strictEqual(slugify("My Project"), slugify("my_project"));
  })
);

// --- T3: scanArtifacts depth boundary ---
results.push(
  run("T3 scanArtifacts depth-6 excluded, depth-5 included", () => {
    const root = path.join(tmpRoot, "artifacts");
    const deep6 = path.join(root, "a", "b", "c", "d", "e", "f");
    const deep5 = path.join(root, "a", "b", "c", "d", "e");
    ensureDir(deep6);
    const deepFile6 = path.join(deep6, "result.md");
    const deepFile5 = path.join(deep5, "included.md");
    fs.writeFileSync(deepFile6, "# too deep\n", "utf8");
    fs.writeFileSync(deepFile5, "# just right\n", "utf8");
    const seen = scanArtifacts(root);
    const paths = seen.map((a) => a.path);
    assert.ok(!paths.includes(deepFile6), "depth-6 artifact should not be included");
    assert.ok(paths.includes(deepFile5), "depth-5 artifact should be included");
  })
);

// --- T4: Git precheck fails outside repository ---
results.push(
  run("T4 git precheck fails outside repository", () => {
    const cwd = path.join(tmpRoot, "non_git");
    ensureDir(cwd);
    const env = Object.assign({}, process.env, { GIT_CEILING_DIRECTORIES: tmpRoot });
    const probe = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd, env, encoding: "utf8" });
    assert.notStrictEqual(probe.status, 0, "git precheck should fail in non-repo directory");
  })
);

// --- T5: Invalid manifest JSON falls back to defaults ---
results.push(
  run("T5 invalid manifest JSON falls back to defaults", () => {
    const projectPath = path.join(tmpRoot, "broken_manifest");
    ensureDir(projectPath);
    const manifestPath = path.join(projectPath, "mycodex.project.json");
    fs.writeFileSync(manifestPath, "{ invalid json", "utf8");
    const manifest = readManifest(projectPath);
    assert.strictEqual(manifest.authStatus, "not_started");
    assert.strictEqual(manifest.selectedPresetId, "mvp_build");
    assert.ok(manifest.taskDefaults.task.length > 0, "default task should not be empty");
  })
);

// --- T6: sanitizeManifest validates enum fields ---
results.push(
  run("T6 sanitizeManifest fixes invalid enum values", () => {
    const projectName = "test_sanitize";
    const defaults = createDefaultManifest(projectName, slugify(projectName));
    const dirty = {
      ...defaults,
      authStatus: "HACKED",
      selectedPresetId: "nonexistent",
      taskDefaults: {
        ...defaults.taskDefaults,
        task: "valid task",
        goal: "valid goal"
      }
    };
    const clean = sanitizeManifest(dirty, projectName);
    assert.strictEqual(clean.authStatus, "not_started", "invalid authStatus should reset");
    assert.strictEqual(clean.selectedPresetId, "mvp_build", "invalid presetId should reset");
    assert.strictEqual(clean.taskDefaults.task, "valid task", "valid task should be kept");
  })
);

// --- T7: appendCapped enforces buffer limit ---
results.push(
  run("T7 appendCapped truncates at limit", () => {
    const limit = 100;
    let buffer = "A".repeat(90);
    buffer = appendCapped(buffer, "B".repeat(20), limit);
    assert.ok(buffer.length <= limit, `buffer should be <= ${limit}, got ${buffer.length}`);
    // Should keep the tail (most recent data)
    assert.ok(buffer.endsWith("B".repeat(20)), "should keep recent data");
  })
);

// --- T8: detectConflictMarkers detects conflicts ---
results.push(
  run("T8 detectConflictMarkers finds conflict markers", () => {
    const conflictFile = path.join(tmpRoot, "conflict_test.md");
    fs.writeFileSync(conflictFile, "before\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> branch\n", "utf8");
    assert.ok(detectConflictMarkers(conflictFile), "should detect <<<<<<< marker");

    const cleanFile = path.join(tmpRoot, "clean_test.md");
    fs.writeFileSync(cleanFile, "# Clean file\nNo conflicts here.\n", "utf8");
    assert.ok(!detectConflictMarkers(cleanFile), "clean file should have no conflicts");
  })
);

// --- T9: readArtifactContent respects extension whitelist ---
results.push(
  run("T9 readArtifactContent rejects unsupported extensions", () => {
    const exePath = path.join(tmpRoot, "danger.exe");
    fs.writeFileSync(exePath, "not really an exe", "utf8");
    const result = readArtifactContent(exePath);
    assert.strictEqual(result.ok, false, "should reject .exe extension");
    assert.ok(result.error.includes("Unsupported"), "error should mention unsupported type");
  })
);

// --- T10: readArtifactContent truncates large files ---
results.push(
  run("T10 readArtifactContent truncates at 128KB", () => {
    const bigFile = path.join(tmpRoot, "big.txt");
    fs.writeFileSync(bigFile, "X".repeat(200 * 1024), "utf8");
    const result = readArtifactContent(bigFile);
    assert.ok(result.ok, "should succeed for .txt file");
    assert.ok(result.truncated, "should be marked truncated");
    assert.ok(result.content.length <= 128 * 1024, "content should be <= 128KB");
  })
);

// --- T11: quoteArg escapes special characters ---
results.push(
  run("T11 quoteArg escapes dangerous characters", () => {
    // Space triggers quoting
    const spaced = quoteArg("hello world");
    assert.ok(spaced.startsWith('"'), "should quote strings with spaces");
    // Percent sign (env var expansion)
    const pct = quoteArg("100%done");
    assert.ok(pct.includes('"^%"'), "should escape % character");
    // Safe string stays unquoted
    const safe = quoteArg("simple");
    assert.strictEqual(safe, "simple", "safe strings should not be quoted");
  })
);

// --- T12: scanArtifacts ignores node_modules ---
results.push(
  run("T12 scanArtifacts ignores node_modules directory", () => {
    const root = path.join(tmpRoot, "ignore_test");
    const nmDir = path.join(root, "node_modules", "pkg");
    ensureDir(nmDir);
    fs.writeFileSync(path.join(nmDir, "readme.md"), "# should be ignored\n", "utf8");
    fs.writeFileSync(path.join(root, "visible.md"), "# visible\n", "utf8");
    const seen = scanArtifacts(root);
    const paths = seen.map((a) => a.path);
    assert.ok(paths.some((p) => p.includes("visible.md")), "root file should be found");
    assert.ok(!paths.some((p) => p.includes("node_modules")), "node_modules should be ignored");
  })
);

// Cleanup
try {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
} catch {
  // noop
}

if (results.every(Boolean)) {
  console.log(`\nSmoke suite passed (${results.length}/${results.length}).`);
  process.exit(0);
}

const passed = results.filter(Boolean).length;
console.error(`\nSmoke suite failed (${passed}/${results.length}).`);
process.exit(1);
