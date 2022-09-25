/**
 * Simple WS Server
 * 
 * During initial connection build-up we send a greeting message to the UI.
 * Any message after that which has 'Ping' as payload, will just print out "Pong!"
 * while pretending to be a SAP PcP message (as we add some key called 'pcpFields' for context information).
 * 
 * We basically use simple straight up WebSocket but pretend that this one specific message
 * somewhat looks like a PCP one. ^^
 * 
 * UI Port 8080
 * WS Port 8081
 */

const WebSocketServer = require('ws').WebSocketServer

const ws = new WebSocketServer({ port: 8081 });

ws.on('connection', (ws) => {
  console.log('connection opened, hi');

  ws.on('message', (data) => {
    console.log('received: %s', data);
    if (data.toString() !== 'Ping') return
    const payload = JSON.stringify({
      pcpFields: {
        action: "pingpong",
      },
      data: "Pong!"
    })
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
  })
  ws.send(payload);
});