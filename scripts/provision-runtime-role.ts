import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { Client } from "pg";

const LOGIN_ROLE = "balkanguess_worker";
const PERMISSION_ROLE = "balkanguess_runtime";
const switchCloudflare = process.argv.includes("--switch-cloudflare");

if (!switchCloudflare) {
  throw new Error("Pass --switch-cloudflare to provision the login and hand it directly to the Worker.");
}

function runtimeConnectionUrl(adminConnectionUrl: string, password: string) {
  const url = new URL(adminConnectionUrl);
  const [, projectRef] = decodeURIComponent(url.username).split(".");
  if (!projectRef || !url.hostname.endsWith(".pooler.supabase.com")) {
    throw new Error("DATABASE_URL must be a Supabase shared-pooler URL whose username includes the project reference.");
  }
  url.port = "6543";
  url.username = `${LOGIN_ROLE}.${projectRef}`;
  url.password = password;
  return url.toString();
}

async function formattedSql(client: Client, template: string, ...values: string[]) {
  const placeholders = values.map((_, index) => `$${index + 2}::text`).join(", ");
  const result = await client.query<{ sql: string }>(`SELECT format($1::text, ${placeholders}) AS sql`, [template, ...values]);
  return result.rows[0].sql;
}

async function uploadWorkerSecret(connectionUrl: string) {
  const child = spawn(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js",
    "secret", "put", "DATABASE_URL",
    "--config", "wrangler.jsonc",
  ], { shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => { output += String(chunk); });
  child.stderr.on("data", chunk => { output += String(chunk); });
  child.stdin.end(`${connectionUrl}\n`);
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (exitCode !== 0) throw new Error(`Wrangler could not update DATABASE_URL.\n${output}`);
  console.log(output.trim());
}

const adminConnectionUrl = process.env.DATABASE_URL;
if (!adminConnectionUrl) throw new Error("DATABASE_URL is required and must contain the administrative Supabase session-pooler URL.");
const password = randomBytes(32).toString("base64url");
const workerConnectionUrl = runtimeConnectionUrl(adminConnectionUrl, password);
const admin = new Client({ connectionString: adminConnectionUrl, connectionTimeoutMillis: 10_000 });

await admin.connect();
try {
  const exists = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [LOGIN_ROLE]);
  if (exists.rowCount) throw new Error(`${LOGIN_ROLE} already exists; refusing to rotate an active credential implicitly.`);
  const createRole = await formattedSql(
    admin,
    "CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5",
    LOGIN_ROLE,
    password,
  );
  await admin.query(createRole);
  await admin.query(`GRANT ${PERMISSION_ROLE} TO ${LOGIN_ROLE}`);
  await admin.query(`ALTER ROLE ${LOGIN_ROLE} SET statement_timeout = '10s'`);
  await admin.query(`ALTER ROLE ${LOGIN_ROLE} SET idle_in_transaction_session_timeout = '10s'`);
} finally {
  await admin.end();
}

const runtime = new Client({ connectionString: workerConnectionUrl, connectionTimeoutMillis: 10_000 });
try {
  await runtime.connect();
  const identity = await runtime.query<{ current_user: string }>("SELECT current_user");
  if (identity.rows[0]?.current_user !== LOGIN_ROLE) throw new Error("The transaction pooler did not authenticate the new Worker login.");
  await runtime.query("SELECT * FROM public.read_daily_statistics($1, $2)", [new Date().toISOString().slice(0, 10), "club-mix"]);
  try {
    await runtime.query('SELECT "playerHash" FROM public."DailyResult" LIMIT 1');
    throw new Error("The Worker login unexpectedly has direct access to player hashes.");
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "42501") throw error;
  }
} catch (error) {
  const cleanup = new Client({ connectionString: adminConnectionUrl, connectionTimeoutMillis: 10_000 });
  await cleanup.connect();
  try {
    await cleanup.query(`DROP ROLE IF EXISTS ${LOGIN_ROLE}`);
  } finally {
    await cleanup.end();
  }
  throw error;
} finally {
  await runtime.end().catch(() => undefined);
}

await uploadWorkerSecret(workerConnectionUrl);
console.log(`Cloudflare DATABASE_URL now uses ${LOGIN_ROLE}; the generated password was not written to disk or output.`);
