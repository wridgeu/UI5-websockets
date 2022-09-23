sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} BaseController
     * @param {typeof sap.m.MessageBox} MessageBox
     * @param {typeof sap.m.MessageToast} MessageToast
     */
    (BaseController, MessageBox, MessageToast) => {
        "use strict";

        return BaseController.extend("org.mrb.ui5websockts.controller.MainView", {
            /**
             * @override
             */
            onInit: function () {
                this.wsService = this.getWebSocketService();
                // could be an entirely different controller from the "login"
                const wsEventingHelper = this.wsService.getEventingHelper()
                wsEventingHelper.attachSomeEvent(this.myHandlerMethod, this)
                wsEventingHelper.attachPingPong(this.myPingHandlerMethod, this)
                wsEventingHelper.attachClose(this.myCloseHandlerMethod, this)
            },

            /**
             * Establish a connection to the locally running WS (NodeJS) Server
             */
            setup() {
                // could be some sort of "login"-view
                this.wsService.setupConnection("//localhost:8081/", false)
            },

            /**
             * Send some message (anything).
             */
            sendPing() {
                this.wsService.send("Ping")
            },
            /**
             * Close the connection.
             */
            closeConnection() {
                this.wsService.close()
            },

            myHandlerMethod(event) {
                MessageBox.show(event.getParameter('data'))
            },

            myPingHandlerMethod(event) {
                MessageToast.show(event.getParameter('data'))
            },

            myCloseHandlerMethod() {
                MessageToast.show("Connection closed!")
            }
        });
    });
