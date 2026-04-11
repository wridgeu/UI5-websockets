/**
 * Simple WS Server with dual-mode support: native SAP PCP v1.0 and plain
 * WebSocket frames.
 *
 * Each connection independently uses one of two modes, decided during the
 * handshake based on the client's `Sec-WebSocket-Protocol` header:
 *
 * - **PCP mode** — the client offered `v10.pcp.sap.com` and we echoed it.
 *   We encode outgoing messages with `pcp.encode` and decode inbound frames
 *   with `pcp.decode`, so we interoperate directly with
 *   `sap.ui.core.ws.SapPcpWebSocket`. The application action travels in a
 *   custom `action` header field (since `pcp-action` is fixed to `MESSAGE`
 *   per the spec).
 *
 * - **Plain mode** — the client offered no subprotocol at all (e.g. a raw
 *   `WebSocket` from the browser, or `curl`/`wscat`). We imitate PCP
 *   context by wrapping each outbound message in a small JSON envelope of
 *   the form `{ "pcpFields": { "action": "..." }, "data": "..." }`. The
 *   frontend can read the same `action` and `data` fields and dispatch on
 *   them, so both modes drive identical UX. Inbound plain frames are
 *   treated as raw text — the demo only sends bare command strings
 *   (`Ping`/`Disconnect`/`Terminate`) over plain WS.
 *
 * Clients that offer only non-PCP subprotocols are rejected by their own
 * runtime per RFC 6455 §4.2.2, because we never echo a value we do not
 * understand.
 *
 * In both modes the special body strings `Ping`, `Disconnect` and
 * `Terminate` drive the same behavior: `Ping` echoes a pong, `Disconnect`
 * closes with 1001 (Going Away) to exercise the frontend retry strategy,
 * and `Terminate` kills the socket without a close handshake (code 1006
 * on the client). The server tracks per-client connection counts so the
 * greeting distinguishes initial connects from reconnects.
 *
 * UI Port 8080
 * WS Port 8081
 */

import { WebSocketServer } from 'ws';
import { encode, decode, SUBPROTOCOL } from './pcp.js';

const wss = new WebSocketServer({
  port: 8081,
  handleProtocols: (protocols) => {
    // `protocols` is a Set of the values from the client's
    // `Sec-WebSocket-Protocol` header. `ws` only invokes this callback
    // when the client actually offered something — connections with no
    // subprotocol bypass it entirely. Returning `false` here makes `ws`
    // omit the response header; clients that offered an unrelated
    // subprotocol will then fail the handshake themselves per RFC 6455.
    return protocols.has(SUBPROTOCOL) ? SUBPROTOCOL : false;
  },
});

/** @type {Map<string, number>} Track connection count per client address */
const connectionCounts = new Map();

wss.on('connection', (ws, req) => {
  const clientAddress = req.socket.remoteAddress;
  const count = (connectionCounts.get(clientAddress) || 0) + 1;
  connectionCounts.set(clientAddress, count);

  const isReconnect = count > 1;
  const isPcp = ws.protocol === SUBPROTOCOL;
  const mode = isPcp ? 'pcp' : 'plain';
  console.log(`${isReconnect ? 'reconnection' : 'connection'} opened (#${count}, mode=${mode}), hi`);

  // Build a frame in the right shape for this connection. In PCP mode the
  // application action travels as a custom header field. In plain mode we
  // mimic PCP context with a tiny JSON envelope so the frontend can drive
  // the same action-based dispatch over a regular WebSocket.
  const frame = (action, body) =>
    isPcp ? encode({ fields: { action }, body }) : JSON.stringify({ pcpFields: { action }, data: body });

  // Pull the body out of an inbound frame regardless of mode. PCP's decoder
  // already body-only-falls-back, but we route plain mode through the
  // identity path so logs and behavior stay symmetric.
  const bodyOf = (raw) => (isPcp ? decode(raw).body : raw);

  ws.on('message', (data) => {
    const raw = data.toString();
    const body = bodyOf(raw);
    console.log(`received (${mode}):`, body);

    if (body === 'Disconnect') {
      console.log('client requested disconnect, closing with 1001');
      ws.close(1001, 'Going Away');
      return;
    }

    if (body === 'Terminate') {
      console.log('client requested terminate, killing connection without close frame');
      ws.terminate();
      return;
    }

    if (body !== 'Ping') return;

    const payload = frame('pingpong', 'Pong!');
    ws.send(payload);
    console.log(`sent (${mode}):`, payload);
  });

  ws.on('close', (code) => {
    console.log('close code: %s', code);
    // Reset connection tracker on normal closure (1000)
    // so the next connection is treated as a fresh start
    if (code === 1000) {
      connectionCounts.delete(clientAddress);
      console.log('normal closure, reset connection tracker');
    }
    console.log('connection closed, bye');
  });

  // greeting message differs for initial vs reconnection
  const greetingMessage = isReconnect
    ? `Welcome back! Reconnection #${count - 1} successful.`
    : 'Hey there from the WebSocket Backend! You have successfully started a connection.';

  ws.send(frame('some-action', greetingMessage));
});
