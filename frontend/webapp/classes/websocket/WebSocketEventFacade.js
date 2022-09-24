sap.ui.define([
	"sap/ui/base/Object",
	"org/mrb/ui5websockets/classes/websocket/type/WebSocketMessageAction"
], (
	Object,
	MessageAction
) => {
	"use strict";

	return Object.extend("org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade", /** @lends org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade.prototype */ {
		/**
		 * @override
		 */
		constructor: function (websocketService) {
			Object.constructor.apply(this);
			this.eventEmitter = websocketService;
		},

		attachSomeEvent(fn, context) {
			this.eventEmitter.attachEvent(MessageAction.SOME_ACTION, fn, context)
		},
		detachSomeEvent(fn, context) {
			this.eventEmitter.detachEvent(MessageAction.SOME_ACTION, fn, context)
		},
		attachPingPong(fn, context) {
			this.eventEmitter.attachEvent(MessageAction.PING_PONG, fn, context)
		},
		detachPingPong(fn, context) {
			this.eventEmitter.detachEvent(MessageAction.PING_PONG, fn, context)
		},
		attachClose(fn, context) {
			this.eventEmitter.attachEvent("close", fn, context)
		},
		detachClose(fn, context) {
			this.eventEmitter.detachEvent("close", fn, context)
		},
	});
});