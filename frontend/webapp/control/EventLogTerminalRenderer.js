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
 *
 * Log types are aligned with UI5 log levels (error, warning, info, debug, trace)
 * plus additional semantic types (success, input, output) for common use cases.
 * Unknown types fall back to "info" styling.
 */
sap.ui.define([], () => {
    "use strict";

    /**
     * Icon and CSS class mapping for each log entry type.
     *
     * Types are intentionally generic and not tied to any specific domain.
     * Domain-specific semantics (e.g. "connection opened") are expressed
     * through the message text and the type mapping in `connectSource`.
     *
     * @type {Object<string, {icon: string, cssClass: string}>}
     */
    const LOG_TYPES = Object.freeze({
        /** Positive outcome, successful operation */
        success: { icon: "\u2714", cssClass: "eventLogTerminal-success" },
        /** Error condition, aligns with sap.base.Log.Level.ERROR */
        error: { icon: "\u2716", cssClass: "eventLogTerminal-error" },
        /** Warning condition, aligns with sap.base.Log.Level.WARNING */
        warning: { icon: "\u26A0", cssClass: "eventLogTerminal-warning" },
        /** Informational message, aligns with sap.base.Log.Level.INFO */
        info: { icon: "\u2022", cssClass: "eventLogTerminal-info" },
        /** Debug-level detail, aligns with sap.base.Log.Level.DEBUG */
        debug: { icon: "\u2023", cssClass: "eventLogTerminal-debug" },
        /** Trace-level detail, aligns with sap.base.Log.Level.TRACE */
        trace: { icon: "\u00B7", cssClass: "eventLogTerminal-trace" },
        /** Outgoing data (sent message, request) */
        input: { icon: "\u25B6", cssClass: "eventLogTerminal-input" },
        /** Incoming data (received message, response) */
        output: { icon: "\u25C0", cssClass: "eventLogTerminal-output" },
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

            // Render each log entry from the aggregation.
            // Use the control's renderer API to resolve custom log types.
            const api = oControl._getRendererApi();
            const aEntries = oControl.getEntries();
            aEntries.forEach((oEntry) => {
                const config = api.getLogTypeConfig(oEntry.getType());
                this.renderEntry(oRm, oEntry, config);
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
         * @param {{icon: string, cssClass: string}} [oConfig] Optional type config override (for custom types)
         */
        renderEntry: function (oRm, oEntry, oConfig) {
            const config = oConfig || LOG_TYPES[oEntry.getType()] || LOG_TYPES.info;

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
