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
		"org/mrb/ui5websockets/classes/websocket/type/WebSocketMessageAction",
		"org/mrb/ui5websockets/classes/websocket/type/WebSocketCloseCode",
		"org/mrb/ui5websockets/classes/websocket/WebSocketEventFacade",
		"sap/base/Log",
		"sap/ui/core/ws/WebSocket",
		"sap/ui/core/ws/SapPcpWebSocket",
	],
	/**
	 * @param {typeof sap.ui.base.EventProvider} EventProvider
	 * @param {typeof org.mrb.ui5websockets.classes.websocket.type.WebSocketMessageAction} MessageAction
	 * @param {typeof org.mrb.ui5websockets.classes.websocket.type.WebSocketCloseCode} CloseCode
	 * @param {typeof org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade} WebSocketEventFacade
	 * @param {typeof sap.base.Log} Log
	 * @param {typeof sap.ui.core.ws.WebSocket} WebSocket
	 * @param {typeof sap.ui.core.ws.SapPcpWebSocket} SAPPcPWebSocket
	 */
	(EventProvider,
		MessageAction,
		CloseCode,
		WebSocketEventFacade,
		Log,
		WebSocket,
		SAPPcPWebSocket) => {
		"use strict";

		const ONE_SECOND = 1_000;
		const SIXTEEN_SECONDS = 16_000;
		const TEN_TIMES = 10;

		return EventProvider.extend("org.mrb.ui5websockets.classes.websocket.WebSocketService", /** @lends org.mrb.ui5websockets.classes.websocket.WebSocketService.prototype */{
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
				this._eventingHelper = new WebSocketEventFacade(this);

				this.currentRecconectAttempts = null;
				this.maxReconnectAttempts = TEN_TIMES;

				this.initialReconnectDelay = ONE_SECOND;
				this.currentReconnectDelay = this.initialReconnectDelay;
				this.maximumReconnectDelay = SIXTEEN_SECONDS;

				this.reconnectTimeout = null;
				this.webSocket = null;
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
				// setup WebSocket
				if (!this.webSocket) {
					this.webSocket = usePCP
						? new SAPPcPWebSocket(
							connectionUrl,
							SAPPcPWebSocket.SUPPORTED_PROTOCOLS.v10
						)
						: new WebSocket(connectionUrl);
					// remember setup for reconnection handling
					this.connectionUrl = connectionUrl;
					this.usePcP = usePCP;
				} else {
					// We won't recreate a new WebSocket instance when we already have one.
					// We also do not want to attach our event handlers multiple times.
					// Might need redesign in the future, tricky though due to the WebSocket Instantiation itself.
					// Different points in time where and when we actually have a connection URL vs where 
					// and how we want to create the "WebSocketService" Instance. 
					return;
				}

				this.webSocket.attachOpen(this._onOpen.bind(this));
				this.webSocket.attachError(this._onError.bind(this));
				this.webSocket.attachClose(this._onClose.bind(this));
				this.webSocket.attachMessage(this._onMessage.bind(this));
			},

			/**
			 * Return the EventingHelper/Wrapper
			 * 
			 * @public
			 */
			getEventingHelper() {
				return this._eventingHelper
			},

			/**
			 * Sends a message.
			 * 
			 * @param {string} payload Message to send
			 * @public
			 */
			send(payload) {
				if (!this.webSocket) {
					this._logger.warning(
						"Unable to send WebSocket message. No WebSocket Instance available, setup a connection first."
					);
					return;
				}

				this.webSocket.send(payload);
			},


			/**
			 * Close the WebSocket connection with Code 1000 (Normal Closure, Default used in UI5)
			 * 
			 * @public
			 */
			close() {
				if (!this.webSocket) {
					this._logger.warning(
						"Unable to close WebSocket. No WebSocket Instance available, setup a connection first."
					);
					return;
				}
				this.webSocket.close();
				// Reset some of the internal state
				this.webSocket = null;
				this.currentRecconectAttempts = null;
				this.currentReconnectDelay = this.initialReconnectDelay;
				// In case we're within a reconnect attempt, clear timeout
				clearTimeout(this.reconnectTimeout)
			},

			/**
			 * Reconnect handling.
			 *
			 * The reconnect handling is based on the exponential backoff strategy.
			 * @see {@link https://en.wikipedia.org/wiki/Exponential_backoff|Wikipedia}
			 * Default implementation based on:
			 * @see {@link https://dev.to/jeroendk/how-to-implement-a-random-exponential-backoff-algorithm-in-javascript-18n6|Dev.to}
			 * 
			 * @private
			 */
			_reconnect() {
				this.webSocket = null;
				if (this.currentRecconectAttempts === this.maxReconnectAttempts) {
					this._logger.info("Max amount of reconnects reached.", `Event: "Close"`);
					this.currentRecconectAttempts = null;
					this.currentReconnectDelay = this.initialReconnectDelay;
					return
				}
				if (this.currentReconnectDelay < this.maximumReconnectDelay) {
					this.currentReconnectDelay *= 2;
				}
				this.currentRecconectAttempts += 1;
				this.setupConnection(this.connectionUrl, this.usePcP);
			},

			/**
			 * Cleans up the internals.
			 *
			 * The object must not be used anymore after destroy was called.
			 *
			 * @see sap.ui.base.Object#destroy
			 * @public
			 */
			destroy() {
				this.webSocket = null;
				this._logger = null;
				this.currentRecconectAttempts = null;
				clearTimeout(this.reconnectTimeout)
				EventProvider.destroy.apply(this);
			},

			// WebSocket Event-Handlers
			/**
			 * Internal handler for open-event.
			 *
			 * @private
			 */
			_onOpen(event) {
				this.fireEvent("open", { data: event });
				this.currentReconnectDelay = this.initialReconnectDelay;
				this._logger.info(
					"WebSocket connection opened!",
					`Event: "Open", currentReconnectDelay: ${this.currentReconnectDelay}, initialReconnectDelay:${this.initialReconnectDelay}`
				);
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
					// In case we manually close our connection
					// we do not want to trigger a reconnect!
					this._logger.info("Connection manually closed.", `Event: "Close"`);
					return;
				}
				// eslint-disable-next-line sap-timeout-usage
				this.reconnectTimeout = setTimeout(() => {
					try {
						this._reconnect();
					} catch (error) {
						this._logger.error("An Error occured when trying to reconnect!", error);
					}
				}, this.currentReconnectDelay + Math.floor(Math.random() * 3000));
			},
			/**
			 * Internal handler for message-event.
			 *
			 * @private
			 */
			_onMessage(event) {
				// workaround as "out in the open, there is no PCP Protocol ;)"
				const payload = JSON.parse(event.getParameter('data'));
				const messageContext = payload.pcpFields //event.getParameter("pcpFields");

				if (!messageContext?.action) {
					this._logger.warning(
						"Message arrived without context!",
						`Event: "Message", Missing: 'action'`
					);
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
			}
		});
	}
);
