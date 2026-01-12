import { getSandbox, proxyToSandbox, type Sandbox } from "@cloudflare/sandbox";

export { Sandbox } from "@cloudflare/sandbox";

interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
}

const DEV_PORT = 5173;
const HOSTNAME = "localhost:8787";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const sandboxResponse = await proxyToSandbox(request, env);
    if (sandboxResponse) return sandboxResponse;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    }

    const sandbox = getSandbox(env.Sandbox, "my-sandbox");

    if (url.pathname === "/start-vite") {
      return startVite(sandbox);
    }

    return new Response("Endpoints:\n  /start-vite - Start Vite dev server\n");
  },
};

async function startVite(sandbox: Sandbox) {
  await sandbox.exec("mkdir -p /app");

  await sandbox.writeFile(
    "/app/package.json",
    JSON.stringify({
      name: "vite-test",
      type: "module",
      scripts: { dev: "vite" },
      dependencies: { vite: "^6.0.0" },
    }),
  );

  await sandbox.writeFile(
    "/app/index.html",
    `<!DOCTYPE html>
<html>
<head><title>Vite HMR Test</title></head>
<body>
  <h1>Vite HMR Test</h1>
  <p>Check browser console for HMR status</p>
  <script type="module" src="/main.js"></script>
</body>
</html>`,
  );

  await sandbox.writeFile(
    "/app/main.js",
    'console.log("HMR is " + (import.meta.hot ? "enabled" : "disabled"));',
  );

  const installResult = await sandbox.exec("cd /app && npm install", {
    timeout: 120000,
  });
  if (installResult.exitCode !== 0) {
    return Response.json(
      {
        success: false,
        error: "npm install failed",
        stderr: installResult.stderr,
      },
      { status: 500 },
    );
  }

  const process = await sandbox.startProcess("npm run dev -- --host 0.0.0.0", {
    cwd: "/app",
  });
  await process.waitForPort(DEV_PORT);

  const portResult = await sandbox.exposePort(DEV_PORT, { hostname: HOSTNAME });

  return Response.json({
    success: true,
    preview_url: portResult.url,
  });
}
