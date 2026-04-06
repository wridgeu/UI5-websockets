/**
 * WebSocketService
 * @author Marco Beier
 *
 * "Architectural" Decision: Why do we use `EventProvider`?
 * Because using the EventBus can be way too global and the larger the application becomes
 * the more complex it can be to track down who is publishing and who is subscribing.
 *
 * The way we use this Service now is, by implicitly using a singleton instance (implicit
 * due to it's instantiation on component-level) which can be retrieved in any other controller.
 * Using this instance anyone can attach EventListeners accordingly and react on these events.
 *
 */
sap.ui.define(
    [
        "sap/ui/base/EventProvider",
        "sap/ui/core/ws/SapPcpWebSocket",
        "sap/ui/core/ws/WebSocket",
        "sap/base/Log",
        "org/mrb/ui5websockets/classes/websocket/type/WebSocketMessageAction",
        "org/mrb/ui5websockets/classes/websocket/type/WebSocketCloseCode",
        "org/mrb/ui5websockets/classes/websocket/WebSocketEventFacade",
        "org/mrb/ui5websockets/classes/retry/RetryStrategy",
    ],
    /**
     * @param {typeof sap.ui.base.EventProvider} EventProvider
     * @param {typeof sap.ui.core.ws.SapPcpWebSocket} SAPPcPWebSocket
     * @param {typeof sap.ui.core.ws.WebSocket} WebSocket
     * @param {typeof sap.base.Log} Log
     * @param {typeof org.mrb.ui5websockets.classes.websocket.type.WebSocketMessageAction} MessageAction
     * @param {typeof org.mrb.ui5websockets.classes.websocket.type.WebSocketCloseCode} CloseCode
     * @param {typeof org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade} WebSocketEventFacade
     * @param {typeof org.mrb.ui5websockets.classes.retry.RetryStrategy} RetryStrategy
     */
    (EventProvider, SAPPcPWebSocket, WebSocket, Log, MessageAction, CloseCode, WebSocketEventFacade, RetryStrategy) => {
        "use strict";

        return EventProvider.extend(
            "org.mrb.ui5websockets.classes.websocket.WebSocketService",
            /** @lends org.mrb.ui5websockets.classes.websocket.WebSocketService.prototype */ {
                /**
                 * Initialize the WebSocket Class
                 *
                 * @see sap.ui.base.Object#constructor
                 * @override
                 * @public
                 * @constructor
                 */
                constructor: function () {
                    EventProvider.apply(this);

                    this._logger = Log.getLogger("WebSocketService.js");
                    // could be loaded async in getEventingFacade but we assume it is necessary to use this
                    this._eventingHelper = new WebSocketEventFacade(this);
                    // retry strategy for reconnection with exponential backoff
                    this._retryStrategy = new RetryStrategy();
                    // forward retry lifecycle events through this service's eventing
                    this._retryStrategy.attachEvent("scheduled", (event) => {
                        this.fireEvent("retryScheduled", event.getParameters());
                    });
                    this._retryStrategy.attachEvent("maxAttemptsReached", (event) => {
                        this.fireEvent("retryMaxAttemptsReached", event.getParameters());
                    });
                    this._retryStrategy.attachEvent("reset", () => {
                        this.fireEvent("retryReset");
                    });
                    // internal websocket instance
                    this._webSocket = null;
                },

                /**
                 * Setup/Establish a PCPWebSocket or regular WebSocket connection.
                 *
                 * A connection can only be established when we know the APC-Channel (SICF Path) to connect to.
                 * Thus the earliest this function can be called is within the Login-Controller.
                 *
                 * @param {string} connectionUrl Path to the APC
                 * @param {boolean} [usePCP=true] Optional - indicates if we use the PCP Protocol
                 * @public
                 */
                setupConnection(connectionUrl, usePCP = true) {
                    if (!this._webSocket) {
                        // setup WebSocket
                        this._webSocket = usePCP ? new SAPPcPWebSocket(connectionUrl, SAPPcPWebSocket.SUPPORTED_PROTOCOLS.v10) : new WebSocket(connectionUrl);
                        // remember setup for reconnection handling
                        this._connectionUrl = connectionUrl;
                        this._usePcP = usePCP;
                    } else {
                        // We won't recreate a new WebSocket instance when we already have one.
                        // We also do not want to attach our event handlers multiple times.
                        // Might need redesign in the future, tricky though due to the WebSocket Instantiation itself.
                        // Different points in time where and when we actually have a connection URL vs where
                        // and how we want to create the "WebSocketService" Instance.
                        return;
                    }
                    // forward handling
                    this._webSocket.attachOpen(this._onOpen.bind(this));
                    this._webSocket.attachError(this._onError.bind(this));
                    this._webSocket.attachClose(this._onClose.bind(this));
                    this._webSocket.attachMessage(this._onMessage.bind(this));
                },

                /**
                 * Whether a WebSocket connection is currently active.
                 *
                 * @returns {boolean} `true` if a WebSocket instance exists
                 * @public
                 */
                isConnected() {
                    return this._webSocket !== null;
                },

                /**
                 * Return the EventingFacade/Wrapper
                 *
                 * Can work completely without it by attaching handlers directly
                 * to the WebSocketService-Instance via `attachEvent('eventName', fn, ...)`.
                 *
                 * @returns {org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade} The eventing facade
                 * @public
                 */
                getEventingFacade() {
                    return this._eventingHelper;
                },

                /**
                 * Sends a message.
                 *
                 * @param {string} payload Message to send
                 * @public
                 */
                send(payload) {
                    if (!this._webSocket) {
                        this._logger.warning("Unable to send WebSocket message. No WebSocket Instance available, setup a connection first.");
                        return;
                    }

                    this._webSocket.send(payload);
                },

                /**
                 * Close the WebSocket connection with Code 1000 (Normal Closure, Default used in UI5)
                 *
                 * @public
                 */
                close() {
                    if (!this._webSocket) {
                        this._logger.warning("Unable to close WebSocket. No WebSocket Instance available, setup a connection first.");
                        return;
                    }

                    // In case we're within a reconnect attempt, cancel it
                    this._retryStrategy.cancel();
                    // close the connection
                    this._webSocket.close();
                    // Reset some of the internal state
                    this._webSocket = null;
                },

                /**
                 * Cleanup internals.
                 *
                 * The object must not be used anymore after destroy was called.
                 *
                 * @see sap.ui.base.Object#destroy
                 * @public
                 */
                destroy() {
                    this._webSocket = null;
                    this._logger = null;
                    this._retryStrategy.destroy();
                    EventProvider.prototype.destroy.apply(this);
                },

                /**
                 * Reconnect handling.
                 *
                 * Delegates scheduling to the RetryStrategy which handles
                 * exponential backoff, jitter, and max attempt tracking.
                 *
                 * @private
                 */
                _reconnect() {
                    this._webSocket = null;
                    this.setupConnection(this._connectionUrl, this._usePcP);
                },

                // WebSocket Event-Handlers
                /**
                 * Internal handler for open-event.
                 *
                 * @private
                 */
                _onOpen(event) {
                    this.fireEvent("open", { data: event });
                    this._retryStrategy.reset();
                    this._logger.info("WebSocket connection opened!", `Event: "Open"`);
                },

                /**
                 * Internal handler for error-event.
                 *
                 * @private
                 */
                _onError(event) {
                    this.fireEvent("error", { data: event });
                    this._logger.error("An Error occured!", `Event: "Error"`);
                },

                /**
                 * Internal handler for close-event.
                 *
                 * @private
                 */
                _onClose(event) {
                    this.fireEvent("close", { data: event });
                    this._logger.info("WebSocket connection has been closed!", `Event: "Close"`);
                    if (event.getParameter("code") === CloseCode.NORMAL_CLOSURE) {
                        // In case we close our connection manually,
                        // we do not want to trigger a reconnect!
                        this._logger.info("Connection manually closed.", `Event: "Close"`);
                        return;
                    }
                    this._logger.info("Connection closed abnormally, trying to reconnect.", `Event: "Close"`);
                    const scheduled = this._retryStrategy.schedule(() => {
                        try {
                            this._reconnect();
                        } catch (error) {
                            this._logger.error("An Error occured when trying to reconnect!", error);
                        }
                    });
                    if (!scheduled) {
                        this._logger.warning("Max amount of reconnect attempts reached.");
                    }
                },

                /**
                 * Internal handler for message-event.
                 *
                 * @private
                 */
                _onMessage(event) {
                    // workaround as "out in the open, there is no PCP Protocol ;)"
                    const payload = JSON.parse(event.getParameter("data"));
                    const messageContext = payload.pcpFields; //event.getParameter("pcpFields");

                    if (!messageContext?.action) {
                        this._logger.warning("Message arrived without context!", `Event: "Message", Missing: 'action'`);
                        return;
                    }

                    switch (messageContext.action) {
                        case MessageAction.SOME_ACTION:
                            this.fireEvent(MessageAction.SOME_ACTION, {
                                data: payload.data, //JSON.parse(event.getParameter("data")),
                            });
                            break;
                        case MessageAction.PING_PONG:
                            this.fireEvent(MessageAction.PING_PONG, {
                                data: payload.data, //JSON.parse(event.getParameter("data")),
                            });
                            break;
                        default:
                            this.fireEvent("message", {
                                data: payload.data, //JSON.parse(event.getParameter("data")),
                            });
                            this._logger.warning("No action handler defined!", `Event: "Message"`);
                    }

                    this._logger.info("Message arrived!", `Event: "Message"`);
                },
            },
        );
    },
);
