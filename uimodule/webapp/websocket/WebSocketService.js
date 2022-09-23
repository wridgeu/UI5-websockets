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
		"./type/WebSocketMessageAction",
		"./type/WebSocketCloseCode",
		"./WebSocketEventFacade",
		"sap/base/Log",
		"sap/ui/core/ws/WebSocket",
		"sap/ui/core/ws/SapPcpWebSocket",
	],
	/**
	 * @param {typeof sap.ui.base.EventProvider} EventProvider
	 * @param {typeof org.mrb.ui5websockts.websocket.type.WebSocketMessageAction} MessageAction
	 * @param {typeof org.mrb.ui5websockts.websocket.type.WebSocketCloseCode} CloseCode
	 * @param {typeof org.mrb.ui5websockts.websocket.WebSocketEventFacade} WebSocketEventFacade
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

		return EventProvider.extend("org.mrb.ui5websockts.websocket.WebSocketService", {
			/**
			 * Initialize the WebSocket Class
			 *
			 * @override
			 * @public
			 * @constructor
			 */
			constructor: function () {
				EventProvider.apply(this, arguments);
				this._logger = Log.getLogger("WebSocketService.js");
				this.eventingHelper = new WebSocketEventFacade(this);
				this.maxReconnectAttempts = TEN_TIMES;
				this.initialReconnectDelay = ONE_SECOND;
				this.maximumReconnectDelay = SIXTEEN_SECONDS;
				this.currentReconnectDelay = this.initialReconnectDelay;
				this.currentRecconectAttempts = null;
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
			 */
			setupConnection(connectionUrl, usePCP = true) {
				// setup WebSocket
				if (!this.webSocket) {
					this.connectionUrl = connectionUrl;
					this.usePcP = usePCP;
					this.webSocket = usePCP
						? new SAPPcPWebSocket(
							connectionUrl,
							SAPPcPWebSocket.SUPPORTED_PROTOCOLS.v10
						)
						: new WebSocket(connectionUrl);
				} else {
					return;
				}

				this.webSocket.attachOpen((event) => {
					this.fireEvent("open", { data: event });
					this.currentReconnectDelay = this.initialReconnectDelay;
					this._logger.info(
						"WebSocket connection opened!",
						`Event: "Open", currentReconnectDelay: ${this.currentReconnectDelay}, initialReconnectDelay:${this.initialReconnectDelay}`
					);
				});

				this.webSocket.attachError((event) => {
					this.fireEvent("error", { data: event });
					this._logger.error("An Error occured!", `Event: "Error"`);
				});

				this.webSocket.attachClose((event) => {
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
				});

				this.webSocket.attachMessage((event) => {
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
				});
			},

			/**
			 * Return the eventingHelper
			 */
			getEventingHelper() {
				return this.eventingHelper
			},

			/**
			 * Send something via WS
			 */
			send(payload) {
				if (!this.webSocket) return
				this.webSocket.send(payload);
			},


			/**
			 * Close the WebSocket connection with Code 1001 (Going Away)
			 */
			close() {
				if (!this.webSocket) return
				this.webSocket.close(CloseCode.NORMAL_CLOSURE);
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
			 */
			_reconnect() {
				this.webSocket = null;
				if (this.currentReconnectDelay < this.maximumReconnectDelay) {
					this.currentReconnectDelay *= 2;
				}
				if (this.currentRecconectAttempts === this.maxReconnectAttempts) {
					this._logger.info("Max amount of reconnects reached.", `Event: "Close"`);
					this.currentRecconectAttempts = null;
					this.currentReconnectDelay = this.initialReconnectDelay;
					return
				}
				this.currentRecconectAttempts += 1;
				this.setupConnection(this.connectionUrl, this.usePcP);
			},

			/**
			 * Destroy the object.
			 */
			destroy() {
				this.webSocket = null;
				this._logger = null;
				this.currentRecconectAttempts = null;
				clearTimeout(this.reconnectTimeout)
				EventProvider.destroy.apply(this, arguments);
			},
		});
	}
);
