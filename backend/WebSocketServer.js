/**
 * Simple WS Server with native PCP support.
 *
 * Speaks the SAP Push Channel Protocol (PCP) v1.0 subprotocol
 * (`v10.pcp.sap.com`) so it can interoperate directly with
 * `sap.ui.core.ws.SapPcpWebSocket` on the UI5 side without any JSON shim.
 *
 * Behaviour:
 * - During the WebSocket handshake we accept the `v10.pcp.sap.com` subprotocol
 *   when the client offers it. If the client offers nothing, we still serve
 *   plain frames so curl-style clients can connect.
 * - On connect we send a greeting PCP message with the custom field
 *   `action: some-action`.
 * - Incoming messages are decoded as PCP. The body is matched against the
 *   commands `Ping`, `Disconnect`, `Terminate`. `Ping` echoes a `pingpong`
 *   PCP message back, `Disconnect` closes with code 1001 (Going Away) to
 *   exercise the frontend retry strategy, `Terminate` kills the socket
 *   without a close handshake (resulting in code 1006 on the client).
 * - The server tracks how many times a client address has connected so the
 *   greeting can distinguish initial connects from reconnects.
 *
 * UI Port 8080
 * WS Port 8081
 */

import { WebSocketServer } from 'ws';
import { encode, decode, SUBPROTOCOL } from './pcp.js';

const wss = new WebSocketServer({
  port: 8081,
  handleProtocols: (protocols) => {
    // `protocols` is a Set in current versions of `ws`. Negotiate PCP
    // when the client offers it; otherwise let the connection proceed
    // without a subprotocol (returning false accepts without selection).
    if (protocols && typeof protocols.has === 'function' && protocols.has(SUBPROTOCOL)) {
      return SUBPROTOCOL;
    }
    return false;
  },
});

/** @type {Map<string, number>} Track connection count per client address */
const connectionCounts = new Map();

wss.on('connection', (ws, req) => {
  const clientAddress = req.socket.remoteAddress;
  const count = (connectionCounts.get(clientAddress) || 0) + 1;
  connectionCounts.set(clientAddress, count);

  const isReconnect = count > 1;
  console.log(`${isReconnect ? 'reconnection' : 'connection'} opened (#${count}, subprotocol="${ws.protocol || ''}"), hi`);

  ws.on('message', (data) => {
    const raw = data.toString();
    const { pcpFields, body } = decode(raw);
    console.log('received pcp:', { pcpFields, body });

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

    const payload = encode({
      fields: { action: 'pingpong' },
      body: 'Pong!',
    });
    ws.send(payload);
    console.log('sent pcp:', payload);
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

  const greeting = encode({
    fields: { action: 'some-action' },
    body: greetingMessage,
  });
  ws.send(greeting);
});
