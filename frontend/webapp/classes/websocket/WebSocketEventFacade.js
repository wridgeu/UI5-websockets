sap.ui.define(["sap/ui/base/Object", "org/mrb/ui5websockets/classes/websocket/type/WebSocketMessageAction"], (Object, MessageAction) => {
    "use strict";

    // Namespace for action-based events fired by WebSocketService. Mirrors
    // the prefix WebSocketService._onMessage applies when it dispatches,
    // so wire-supplied action strings can never collide with framework
    // event names like "close" / "destroy".
    const ACTION_EVENT_PREFIX = "action:";

    return Object.extend(
        "org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade",
        /** @lends org.mrb.ui5websockets.classes.websocket.WebSocketEventFacade.prototype */ {
            /**
             * @override
             */
            constructor: function (websocketService) {
                Object.apply(this);
                this.eventEmitter = websocketService;
            },

            attachSomeEvent(fn, context) {
                this.eventEmitter.attachEvent(`${ACTION_EVENT_PREFIX}${MessageAction.SOME_ACTION}`, fn, context);
            },
            detachSomeEvent(fn, context) {
                this.eventEmitter.detachEvent(`${ACTION_EVENT_PREFIX}${MessageAction.SOME_ACTION}`, fn, context);
            },
            attachPingPong(fn, context) {
                this.eventEmitter.attachEvent(`${ACTION_EVENT_PREFIX}${MessageAction.PING_PONG}`, fn, context);
            },
            detachPingPong(fn, context) {
                this.eventEmitter.detachEvent(`${ACTION_EVENT_PREFIX}${MessageAction.PING_PONG}`, fn, context);
            },
            attachClose(fn, context) {
                this.eventEmitter.attachEvent("close", fn, context);
            },
            detachClose(fn, context) {
                this.eventEmitter.detachEvent("close", fn, context);
            },
        },
    );
});
