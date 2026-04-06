/**
 * Simple WS Server
 *
 * During initial connection build-up we send a greeting message to the UI.
 * Any message after that which has 'Ping' as payload, will just print out "Pong!"
 * while pretending to be a SAP PcP message (as we add some key called 'pcpFields' for context information).
 *
 * Sending 'Disconnect' will cause the server to drop the connection with an
 * abnormal close code (1001 - Going Away), which triggers the retry mechanism
 * on the frontend side.
 *
 * The server tracks how many times a client address has connected to differentiate
 * between initial connections and reconnections in the greeting message.
 *
 * We basically use simple straight up WebSocket but pretend that this one specific message
 * somewhat looks like a PCP one. ^^
 *
 * UI Port 8080
 * WS Port 8081
 */

import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8081 });

/** @type {Map<string, number>} Track connection count per client address */
const connectionCounts = new Map();

wss.on('connection', (ws, req) => {
  const clientAddress = req.socket.remoteAddress;
  const count = (connectionCounts.get(clientAddress) || 0) + 1;
  connectionCounts.set(clientAddress, count);

  const isReconnect = count > 1;
  console.log(`${isReconnect ? 'reconnection' : 'connection'} opened (#${count}), hi`);

  ws.on('message', (data) => {
    const message = data.toString();
    console.log('received: %s', message);

    if (message === 'Disconnect') {
      console.log('client requested disconnect, closing with 1001');
      ws.close(1001, 'Going Away');
      return;
    }

    if (message !== 'Ping') return;
    const payload = JSON.stringify({
      pcpFields: {
        action: "pingpong",
      },
      data: "Pong!"
    });
    ws.send(payload);
    console.log('sent: %s', payload);
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
    : "Hey there from the WebSocket Backend! You have successfully started a connection.";

  const payload = JSON.stringify({
    pcpFields: {
      action: "some-action",
    },
    data: greetingMessage
  });
  ws.send(payload);
});
