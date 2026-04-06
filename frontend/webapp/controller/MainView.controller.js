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
                const terminal = this.byId("eventLog");

                // Wire up WebSocket and retry events to the terminal via connectSource.
                // All events from the service (including forwarded retry lifecycle events)
                // are automatically logged without manual _logToTerminal calls.
                terminal.connectSource(this.wsService, {
                    open: { type: "open", message: "Connection opened." },
                    error: { type: "error", message: "WebSocket error occurred." },
                    close: {
                        type: "close",
                        message: (oEvent) => {
                            const data = oEvent.getParameter("data");
                            const code = data ? data.getParameter("code") : "unknown";
                            return `Connection closed (code: ${code}).`;
                        },
                    },
                    retryScheduled: {
                        type: "retry",
                        message: (oEvent) => {
                            const attempt = oEvent.getParameter("attempt");
                            const delay = oEvent.getParameter("delay");
                            return `Retry #${attempt} scheduled in ${delay}ms...`;
                        },
                    },
                    retryMaxAttemptsReached: { type: "error", message: "Max retry attempts reached. Giving up." },
                    retryReset: { type: "info", message: "Retry strategy reset (connection recovered)." },
                });

                // Facade events still need manual handlers for UI feedback (MessageBox, Toast)
                const facade = this.wsService.getEventingFacade();
                facade.attachSomeEvent(this._onSomeEvent, this);
                facade.attachPingPong(this._onPingPong, this);

                terminal.log("info", "Application initialized. Click 'Initialize a WS Connection' to start.");
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
             * Test the retry mechanism by forcefully dropping the connection.
             *
             * Sends a "Terminate" command to the backend which causes the server
             * to call `ws.terminate()`, killing the connection without a close handshake.
             * This results in a close event with code 1006 (Abnormal Closure) on the
             * frontend, simulating a network failure or server crash.
             */
            testRetryFrontend() {
                this._logToTerminal("retry", "Sending 'Terminate' to backend (server will kill connection without close frame)...");
                this.wsService.send("Terminate");
            },

            /**
             * Clear the event log terminal.
             */
            clearLog() {
                this.byId("eventLog").clear();
                this._logToTerminal("info", "Log cleared.");
            },

            // -- Facade Event Handlers (for UI feedback) --

            /**
             * @param {sap.ui.base.Event} event The event object
             * @private
             */
            _onSomeEvent(event) {
                const data = event.getParameter("data");
                this._logToTerminal("receive", `some-action: "${data}"`);
                MessageBox.show(data);
            },

            /**
             * @param {sap.ui.base.Event} event The event object
             * @private
             */
            _onPingPong(event) {
                const data = event.getParameter("data");
                this._logToTerminal("receive", `pingpong: "${data}"`);
                MessageToast.show(data);
            },

            // -- Terminal Logging --

            /**
             * Log a message to the in-app EventLogTerminal control.
             *
             * Used for user-initiated actions (button clicks, manual messages).
             * WebSocket and RetryStrategy events are logged automatically via connectSource.
             *
             * @param {string} sType One of: open, close, send, receive, retry, error, info
             * @param {string} sMessage The log message text
             * @private
             */
            _logToTerminal(sType, sMessage) {
                const terminal = this.byId("eventLog");
                if (terminal) {
                    terminal.log(sType, sMessage);
                }
            },
        });
    },
);
