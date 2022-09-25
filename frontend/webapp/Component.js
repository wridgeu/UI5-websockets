sap.ui.define([
    "sap/ui/core/UIComponent",
    "org/mrb/ui5websockets/model/models",
    "org/mrb/ui5websockets/classes/websocket/WebSocketService"
],
    /**
     * 
     * @param {sap.ui.core.UIComponent} UIComponent 
     * @param {typeof org.mrb.ui5websockets.model.models} models 
     * @param {typeof org.mrb.ui5websockets.classes.websocket.WebSocketService} WebSocketService 
     * @returns {typeof sap.ui.core.UIComponent}
     */
    function (UIComponent, models, WebSocketService) {
        "use strict";

        return UIComponent.extend("org.mrb.ui5websockets.Component", {
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
                UIComponent.prototype.init.apply(this);

                // enable routing
                this.getRouter().initialize();

                // initialize our websocketservice
                this.webSocketService = new WebSocketService();

                // set the device model
                this.setModel(models.createDeviceModel(), "device");
            },

            /**
             * Returns a instance of the WebSocketService
             * @returns {typeof org.mrb.ui5websockets.classes.websocket.WebSocketService}
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
                UIComponent.prototype.destroy.apply(this);
            }
        });
    }
);