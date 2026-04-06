/**
 * EventLogTerminalRenderer
 * @author Marco Beier
 *
 * Renderer for the EventLogTerminal custom control.
 * Uses apiVersion 4 for optimal rendering performance, which allows the
 * framework to skip re-rendering this control when a parent re-renders,
 * as long as the terminal's own state has not changed.
 *
 * The renderer produces semantic HTML: a root div, a scrollable div container,
 * and a pre element containing individual span elements for each log entry.
 * All text output uses the RenderManager's `text()` method for automatic
 * XSS-safe escaping.
 */
sap.ui.define([], () => {
    "use strict";

    /**
     * Icon and CSS class mapping for each log entry type.
     * @type {Object<string, {icon: string, cssClass: string}>}
     */
    const LOG_TYPES = Object.freeze({
        open: { icon: "\u25B6", cssClass: "eventLogTerminal-open" },
        close: { icon: "\u2715", cssClass: "eventLogTerminal-close" },
        send: { icon: "\u25B6", cssClass: "eventLogTerminal-send" },
        receive: { icon: "\u25C0", cssClass: "eventLogTerminal-receive" },
        retry: { icon: "\u21BB", cssClass: "eventLogTerminal-retry" },
        error: { icon: "\u2716", cssClass: "eventLogTerminal-error" },
        info: { icon: "\u2022", cssClass: "eventLogTerminal-info" },
    });

    /**
     * @memberof org.mrb.ui5websockets.control
     */
    const EventLogTerminalRenderer = {
        apiVersion: 4,

        /**
         * Renders the EventLogTerminal control.
         *
         * @param {sap.ui.core.RenderManager} oRm The render manager
         * @param {org.mrb.ui5websockets.control.EventLogTerminal} oControl The control instance
         */
        render: function (oRm, oControl) {
            oRm.openStart("div", oControl).class("eventLogTerminal").style("width", oControl.getWidth()).openEnd();

            oRm.openStart("div")
                .class("eventLogTerminal-scroll")
                .style("height", oControl.getHeight())
                .style("background-color", oControl.getBackgroundColor())
                .style("color", oControl.getTextColor())
                .style("font-size", oControl.getFontSize())
                .style("font-family", oControl.getFontFamily())
                .openEnd();

            oRm.openStart("pre").class("eventLogTerminal-pre").openEnd();

            // Render each log entry from the aggregation
            const aEntries = oControl.getEntries();
            aEntries.forEach((oEntry) => {
                this.renderEntry(oRm, oEntry);
            });

            oRm.close("pre");
            oRm.close("div");
            oRm.close("div");
        },

        /**
         * Renders a single EventLogEntry inside the pre element.
         *
         * @param {sap.ui.core.RenderManager} oRm The render manager
         * @param {org.mrb.ui5websockets.control.EventLogEntry} oEntry The entry element
         */
        renderEntry: function (oRm, oEntry) {
            const sType = oEntry.getType();
            const config = LOG_TYPES[sType] || LOG_TYPES.info;

            oRm.openStart("span").class("eventLogTerminal-timestamp").openEnd();
            oRm.text(oEntry.getTimestamp());
            oRm.close("span");

            oRm.text(" ");

            oRm.openStart("span").class(config.cssClass).openEnd();
            oRm.text(`${config.icon} ${oEntry.getMessage()}`);
            oRm.close("span");

            oRm.voidStart("br").voidEnd();
        },

        /**
         * Returns the LOG_TYPES mapping for use by the control's direct DOM append.
         *
         * @param {string} sType The log entry type
         * @returns {{icon: string, cssClass: string}} The type configuration
         */
        getLogTypeConfig: function (sType) {
            return LOG_TYPES[sType] || LOG_TYPES.info;
        },
    };

    return EventLogTerminalRenderer;
});
