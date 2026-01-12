# Vite HMR WebSocket through Cloudflare Sandbox

## TL;DR

**Vite's WebSocket server requires the `Sec-WebSocket-Protocol: vite-hmr` header.** Without it, Vite silently ignores WebSocket upgrade requests and the connection hangs forever.

The Cloudflare Sandbox SDK correctly proxies this header. If your Vite HMR isn't working, check if your proxy layer is stripping it.

## Quick Diagnosis

```bash
# In browser DevTools → Network → WS tab → click the WebSocket request → Headers
# You should see: Sec-WebSocket-Protocol: vite-hmr
```

Or test with curl:

```bash
# WITHOUT subprotocol - will HANG (Vite ignores it)
curl -v -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  "http://your-vite-host:5173/"

# WITH subprotocol - returns 101 Switching Protocols
curl -v -H "Upgrade: websocket" -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Protocol: vite-hmr" \
  "http://your-vite-host:5173/"
```

## The Fix

Ensure your proxy layer (between browser and Cloudflare) forwards the `Sec-WebSocket-Protocol` header.

## Running This Demo

```bash
npm install
npm run dev

curl http://localhost:8787/start-vite   # Starts Vite, returns preview URL
```

Open the preview URL in your browser. If HMR works, you'll see "[vite] connected." in the browser console.

**Key takeaway:** If this demo works but your setup doesn't, check your proxy layer between the browser and Cloudflare - that's likely where the `Sec-WebSocket-Protocol` header is being stripped.

## Why This Happens

Vite's dev server uses WebSocket subprotocols to identify HMR connections. When a WebSocket upgrade request arrives without `Sec-WebSocket-Protocol: vite-hmr`, Vite's WebSocket server simply doesn't respond.
