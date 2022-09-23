sap.ui.define([
    "sap/ui/core/UIComponent",
    "org/mrb/ui5websockts/model/models",
    "org/mrb/ui5websockts/websocket/WebSocketService"
],
    function (UIComponent, models, WebSocketService) {
        "use strict";

        return UIComponent.extend("org.mrb.ui5websockts.Component", {
            metadata: {
                manifest: "json"
            },

            /**
             * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
             * @public
             * @override
             */
            init: function () {
                // call the base component's init function
                UIComponent.prototype.init.apply(this, arguments);

                // enable routing
                this.getRouter().initialize();

                // initialize our websocketservice
                this.webSocketService = new WebSocketService();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            },

            /**
             * Returns a instance of the WebSocketService
             * @returns {typeof org.mrb.ui5websockts.websocket.WebSocketService}
             */
            getWebSocketService() {
                return this.webSocketService;
            },

            /**
             * @public
             * @override
             */
            destroy() {
                this.webSocketService.destroy();
                this.webSocketService = null;
                UIComponent.prototype.destroy.apply(this, arguments);
            }
        });
    }
);