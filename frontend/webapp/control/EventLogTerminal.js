/**
 * EventLogTerminal
 * @author Marco Beier
 *
 * A custom UI5 control that renders an in-app terminal-like event log.
 * It displays timestamped, color-coded log entries in a dark-themed monospace panel,
 * similar to a browser developer console but embedded directly in the application.
 *
 * The control manages its own CSS (loaded from EventLogTerminal.css in the same directory)
 * and handles auto-scrolling to the latest entry. Log entries are stored as an aggregation
 * of EventLogEntry elements, making them part of the UI5 lifecycle.
 *
 * The control uses apiVersion 4 for its renderer, which enables the framework to skip
 * re-rendering of this control when a parent control re-renders, as long as the
 * terminal's own state has not changed.
 *
 * Supported log types and their visual indicators:
 *   - "open"    (green)  - connection established
 *   - "close"   (gray)   - connection closed
 *   - "send"    (blue)   - outgoing message
 *   - "receive" (yellow) - incoming message
 *   - "retry"   (orange) - reconnection attempt
 *   - "error"   (red)    - error occurred
 *   - "info"    (dim)    - informational message
 *
 * Usage in XML Views:
 * ```xml
 * xmlns:control="org.mrb.ui5websockets.control"
 * ...
 * <control:EventLogTerminal id="eventLog" height="300px" />
 * ```
 *
 * Logging from a controller:
 * ```js
 * this.byId("eventLog").log("open", "Connection established.");
 * this.byId("eventLog").clear();
 * ```
 *
 * @see org.mrb.ui5websockets.control.EventLogEntry
 */
sap.ui.define(["sap/ui/core/Control", "sap/ui/dom/includeStylesheet", "./EventLogEntry"], (Control, includeStylesheet, EventLogEntry) => {
    "use strict";

    /** @type {boolean} Whether the control's CSS has already been loaded */
    let bCssLoaded = false;

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

    return Control.extend("org.mrb.ui5websockets.control.EventLogTerminal", {
        metadata: {
            properties: {
                /**
                 * Width of the terminal.
                 * Accepts any valid CSS width value (e.g. "100%", "500px").
                 * Defaults to 100% to fill the available container width.
                 */
                width: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },

                /**
                 * Height of the terminal scroll area.
                 * Accepts any valid CSS height value (e.g. "300px", "50vh").
                 */
                height: { type: "sap.ui.core.CSSSize", defaultValue: "300px" },

                /**
                 * Background color of the terminal.
                 * Accepts any valid CSS color value (e.g. "#1e1e1e", "rgb(30,30,30)").
                 */
                backgroundColor: { type: "sap.ui.core.CSSColor", defaultValue: "#1e1e1e" },

                /**
                 * Default text color of the terminal.
                 * Accepts any valid CSS color value.
                 */
                textColor: { type: "sap.ui.core.CSSColor", defaultValue: "#cccccc" },

                /**
                 * Font size for log entries.
                 * Accepts any valid CSS size value (e.g. "0.8125rem", "13px").
                 */
                fontSize: { type: "sap.ui.core.CSSSize", defaultValue: "0.8125rem" },

                /**
                 * Font family for log entries.
                 * Accepts any valid CSS font-family value.
                 */
                fontFamily: { type: "string", defaultValue: "'Courier New', Consolas, monospace" },
            },
            aggregations: {
                /**
                 * The log entries displayed in the terminal.
                 * Managed internally via the `log()` method. Should not be bound or
                 * modified directly from outside the control.
                 */
                entries: { type: "org.mrb.ui5websockets.control.EventLogEntry", multiple: true, singularName: "entry" },
            },
        },

        /**
         * Initialize the control and load its CSS.
         *
         * The stylesheet is loaded once (on first instantiation) from the
         * same directory as this control file.
         *
         * @override
         */
        init: function () {
            if (!bCssLoaded) {
                const sCssUrl = sap.ui.require.toUrl("org/mrb/ui5websockets/control/EventLogTerminal.css");
                includeStylesheet(sCssUrl);
                bCssLoaded = true;
            }
        },

        /**
         * The renderer for EventLogTerminal.
         *
         * Uses apiVersion 4 for optimal rendering performance. The renderer produces
         * a wrapper div containing a scrollable area with a pre element. Each log entry
         * from the aggregation is rendered as a color-coded span line inside the pre.
         */
        renderer: {
            apiVersion: 4,

            /**
             * @param {sap.ui.core.RenderManager} oRm The render manager
             * @param {org.mrb.ui5websockets.control.EventLogTerminal} oControl This control instance
             */
            render: function (oRm, oControl) {
                oRm.openStart("div", oControl);
                oRm.class("eventLogTerminal");
                oRm.style("width", oControl.getWidth());
                oRm.openEnd();

                oRm.openStart("div");
                oRm.class("eventLogTerminal-scroll");
                oRm.style("height", oControl.getHeight());
                oRm.openEnd();

                oRm.openStart("pre");
                oRm.class("eventLogTerminal-pre");
                oRm.style("background-color", oControl.getBackgroundColor());
                oRm.style("color", oControl.getTextColor());
                oRm.style("font-size", oControl.getFontSize());
                oRm.style("font-family", oControl.getFontFamily());
                oRm.openEnd();

                // Render each log entry
                const aEntries = oControl.getEntries();
                aEntries.forEach((oEntry) => {
                    const sType = oEntry.getType();
                    const config = LOG_TYPES[sType] || LOG_TYPES.info;

                    oRm.openStart("span");
                    oRm.class("eventLogTerminal-timestamp");
                    oRm.openEnd();
                    oRm.text(oEntry.getTimestamp());
                    oRm.close("span");

                    oRm.text(" ");

                    oRm.openStart("span");
                    oRm.class(config.cssClass);
                    oRm.openEnd();
                    oRm.text(`${config.icon} ${oEntry.getMessage()}`);
                    oRm.close("span");

                    oRm.voidStart("br");
                    oRm.voidEnd();
                });

                oRm.close("pre");
                oRm.close("div");
                oRm.close("div");
            },
        },

        /**
         * Called after the control is rendered. Scrolls to the bottom
         * to show the latest log entry.
         *
         * @override
         */
        onAfterRendering: function () {
            this._scrollToBottom();
        },

        /**
         * Append a timestamped, color-coded entry to the terminal.
         *
         * Creates an EventLogEntry element and adds it to the entries aggregation,
         * then appends the rendered line directly to the DOM for performance
         * (avoiding a full re-render on every log call).
         *
         * @param {string} sType One of: open, close, send, receive, retry, error, info
         * @param {string} sMessage The log message text
         * @public
         */
        log(sType, sMessage) {
            const sTimestamp = this._formatTimestamp();

            // Add to aggregation for lifecycle management
            const oEntry = new EventLogEntry({
                type: sType,
                message: sMessage,
                timestamp: sTimestamp,
            });
            // Suppress re-rendering; we append to the DOM directly for performance
            this.addAggregation("entries", oEntry, true);

            // Append directly to the pre element if already rendered
            const pre = this._getPreElement();
            if (pre) {
                const config = LOG_TYPES[sType] || LOG_TYPES.info;
                const span = document.createElement("span");
                span.className = "eventLogTerminal-timestamp";
                span.textContent = sTimestamp;

                const msgSpan = document.createElement("span");
                msgSpan.className = config.cssClass;
                msgSpan.textContent = `${config.icon} ${sMessage}`;

                pre.appendChild(span);
                pre.appendChild(document.createTextNode(" "));
                pre.appendChild(msgSpan);
                pre.appendChild(document.createElement("br"));

                this._scrollToBottom();
            }
        },

        /**
         * Clear all entries from the terminal.
         *
         * Removes all EventLogEntry elements from the aggregation and
         * clears the DOM content.
         *
         * @public
         */
        clear() {
            this.destroyAggregation("entries", true);
            const pre = this._getPreElement();
            if (pre) {
                pre.textContent = "";
            }
        },

        /**
         * Get the pre element inside this control's DOM.
         *
         * @returns {HTMLPreElement|null} The pre element or null if not yet rendered
         * @private
         */
        _getPreElement() {
            const domRef = this.getDomRef();
            if (!domRef) {
                return null;
            }
            return domRef.querySelector(".eventLogTerminal-pre");
        },

        /**
         * Scroll the terminal to the bottom to show the latest entry.
         *
         * @private
         */
        _scrollToBottom() {
            const domRef = this.getDomRef();
            if (!domRef) {
                return;
            }
            const scrollArea = domRef.querySelector(".eventLogTerminal-scroll");
            if (scrollArea) {
                scrollArea.scrollTop = scrollArea.scrollHeight;
            }
        },

        /**
         * Format the current time as HH:MM:SS for log timestamps.
         *
         * @returns {string} Formatted time string
         * @private
         */
        _formatTimestamp() {
            const now = new Date();
            return [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
        },
    });
});
