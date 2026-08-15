#!/usr/bin/env node
"use strict";

const { performance } = require("node:perf_hooks");

const args = parseArgs(process.argv.slice(2));
const baseUrl = String(args.url || "http://127.0.0.1:3000").replace(/\/+$/, "");
const users = Math.max(1, Number(args.users || 25));
const durationMs = Math.max(1000, Number(args.duration || 15) * 1000);
const username = String(args.username || "admin");
const password = String(args.password || process.env.INNER_LOAD_TEST_PASSWORD || "");
const timeoutMs = Math.max(1000, Number(args.timeout || 10000));

const routes = [
  { method: "GET", path: "/api/health", auth: false },
  { method: "GET", path: "/api/state", auth: true },
  { method: "GET", path: "/", auth: false },
  { method: "GET", path: "/app.js", auth: false },
  { method: "GET", path: "/styles.css", auth: false },
];

const stats = {
  startedAt: new Date().toISOString(),
  requests: 0,
  ok: 0,
  errors: 0,
  statuses: new Map(),
  latencies: [],
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  console.log(`Load test ${baseUrl} | users=${users} duration=${durationMs / 1000}s`);
  const cookies = await loginClients();
  const endAt = performance.now() + durationMs;
  await Promise.all(Array.from({ length: users }, (_, index) => runUser(index, cookies[index % cookies.length], endAt)));
  printReport();
}

async function loginClients() {
  if (!password) {
    console.log("No password provided; authenticated /api/state requests will be skipped.");
    return [""];
  }
  const cookies = [];
  await Promise.all(Array.from({ length: Math.min(users, 50) }, async () => {
    const response = await timedFetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }, false);
    const cookie = response.headers.get("set-cookie") || "";
    if (response.ok && cookie) cookies.push(cookie.split(";")[0]);
  }));
  console.log(`Authenticated sessions: ${cookies.length}`);
  return cookies.length ? cookies : [""];
}

async function runUser(index, cookie, endAt) {
  let cursor = index % routes.length;
  while (performance.now() < endAt) {
    const route = nextRoute(cursor++, cookie);
    if (!route) continue;
    await timedFetch(route.path, {
      method: route.method,
      headers: cookie ? { Cookie: cookie } : {},
    }, true).catch(() => {});
  }
}

function nextRoute(cursor, cookie) {
  for (let attempt = 0; attempt < routes.length; attempt += 1) {
    const route = routes[(cursor + attempt) % routes.length];
    if (route.auth && !cookie) continue;
    return route;
  }
  return routes[0];
}

async function timedFetch(path, init, record) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, signal: controller.signal });
    await response.arrayBuffer().catch(() => null);
    if (record) {
      const elapsed = performance.now() - start;
      stats.requests += 1;
      stats.latencies.push(elapsed);
      stats.statuses.set(response.status, (stats.statuses.get(response.status) || 0) + 1);
      if (response.ok) stats.ok += 1;
      else stats.errors += 1;
    }
    return response;
  } catch (error) {
    if (record) {
      stats.requests += 1;
      stats.errors += 1;
      stats.statuses.set("network", (stats.statuses.get("network") || 0) + 1);
      stats.latencies.push(performance.now() - start);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function printReport() {
  stats.latencies.sort((a, b) => a - b);
  const seconds = durationMs / 1000;
  const report = {
    startedAt: stats.startedAt,
    users,
    durationSeconds: seconds,
    requests: stats.requests,
    ok: stats.ok,
    errors: stats.errors,
    rps: Number((stats.requests / seconds).toFixed(2)),
    p50ms: percentile(50),
    p95ms: percentile(95),
    p99ms: percentile(99),
    maxMs: Number((stats.latencies.at(-1) || 0).toFixed(1)),
    statuses: Object.fromEntries(stats.statuses),
  };
  console.log(JSON.stringify(report, null, 2));
}

function percentile(value) {
  if (!stats.latencies.length) return 0;
  const index = Math.min(stats.latencies.length - 1, Math.ceil((value / 100) * stats.latencies.length) - 1);
  return Number(stats.latencies[index].toFixed(1));
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
