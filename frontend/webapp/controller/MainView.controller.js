sap.ui.define(
    ["./BaseController", "sap/m/MessageBox", "sap/m/MessageToast"],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} BaseController
     * @param {typeof sap.m.MessageBox} MessageBox
     * @param {typeof sap.m.MessageToast} MessageToast
     */
    (BaseController, MessageBox, MessageToast) => {
        "use strict";

        return BaseController.extend("org.mrb.ui5websockets.controller.MainView", {
            /**
             * @override
             */
            onInit: function () {
                this.wsService = this.getWebSocketService();
                // could be an entirely different controller from the "login"
                const facade = this.wsService.getEventingFacade();
                facade.attachSomeEvent(this._onSomeEvent, this);
                facade.attachPingPong(this._onPingPong, this);
                facade.attachClose(this._onWsClose, this);

                // attach to lower-level events for logging
                this.wsService.attachEvent("open", this._onWsOpen, this);
                this.wsService.attachEvent("error", this._onWsError, this);

                this._logToTerminal("info", "Application initialized. Click 'Initialize a WS Connection' to start.");
            },

            // -- Button Handlers --

            /**
             * Establish a connection to the locally running WS (NodeJS) Server
             */
            setup() {
                this._logToTerminal("info", "Connecting to ws://localhost:8081/ ...");
                // could be some sort of "login"-view
                this.wsService.setupConnection("//localhost:8081/", false);
            },

            /**
             * Send some message (anything).
             */
            sendPing() {
                this._logToTerminal("send", "Sent: Ping");
                this.wsService.send("Ping");
            },

            /**
             * Close the connection (normal closure, code 1000).
             */
            closeConnection() {
                this._logToTerminal("info", "Closing connection (normal closure)...");
                this.wsService.close();
            },

            /**
             * Test the retry mechanism by asking the backend to drop the connection.
             *
             * Sends a "Disconnect" command to the backend which causes the server
             * to close the connection with code 1001 (Going Away). This triggers
             * an abnormal close event on the frontend, which the RetryStrategy
             * picks up and begins reconnection attempts with exponential backoff.
             */
            testRetryBackend() {
                this._logToTerminal("retry", "Sending 'Disconnect' to backend (server will drop connection with code 1001)...");
                this.wsService.send("Disconnect");
            },

            /**
             * Test the retry mechanism by closing the connection from the frontend
             * with an abnormal close code (1001).
             *
             * This bypasses the WebSocketService's `close()` method (which uses code 1000
             * for normal closure) and directly closes the underlying WebSocket with a
             * non-1000 code to simulate an unexpected disconnect.
             */
            testRetryFrontend() {
                this._logToTerminal("retry", "Closing connection from frontend with abnormal code 1001...");
                // Access the internal WebSocket to close with a non-normal code.
                // The service's own close() uses 1000 which would not trigger a retry.
                if (this.wsService._webSocket) {
                    this.wsService._webSocket.close(1001, "Frontend-initiated abnormal close for testing");
                } else {
                    this._logToTerminal("error", "No active WebSocket connection to close.");
                }
            },

            /**
             * Clear the event log terminal.
             */
            clearLog() {
                this.byId("eventLog").clear();
                this._logToTerminal("info", "Log cleared.");
            },

            // -- WebSocket Event Handlers --

            /** @private */
            _onWsOpen() {
                this._logToTerminal("open", "Connection opened.");
            },

            /** @private */
            _onWsError() {
                this._logToTerminal("error", "WebSocket error occurred.");
            },

            /** @private */
            _onWsClose(event) {
                const data = event.getParameter("data");
                const code = data ? data.getParameter("code") : "unknown";
                this._logToTerminal("close", `Connection closed (code: ${code}).`);

                // Only show retry info for abnormal closures (not 1000)
                if (code !== 1000) {
                    this._logToTerminal("retry", "Abnormal close detected. RetryStrategy will attempt to reconnect...");
                }
            },

            /** @private */
            _onSomeEvent(event) {
                const data = event.getParameter("data");
                this._logToTerminal("receive", `some-action: "${data}"`);
                MessageBox.show(data);
            },

            /** @private */
            _onPingPong(event) {
                const data = event.getParameter("data");
                this._logToTerminal("receive", `pingpong: "${data}"`);
                MessageToast.show(data);
            },

            // -- Terminal Logging --

            /**
             * Log a message to the in-app EventLogTerminal control.
             *
             * @param {string} type One of: open, close, send, receive, retry, error, info
             * @param {string} message The log message text
             * @private
             */
            _logToTerminal(type, message) {
                const terminal = this.byId("eventLog");
                if (terminal) {
                    terminal.log(type, message);
                }
            },
        });
    },
);
