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
 * We basically use simple straight up WebSocket but pretend that this one specific message
 * somewhat looks like a PCP one. ^^
 *
 * UI Port 8080
 * WS Port 8081
 */

import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8081 });

wss.on('connection', (ws) => {
  console.log('connection opened, hi');

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

  ws.on('close', (data) => {
    console.log('received: %s', data);
    console.log('connection closed, bye');
  });

  // initial payload as answer for the connection build-up
  const payload = JSON.stringify({
    pcpFields: {
      action: "some-action",
    },
    data: "Hey there from the WebSocket Backend! You have successfully started a connection 🥴"
  });
  ws.send(payload);
});
