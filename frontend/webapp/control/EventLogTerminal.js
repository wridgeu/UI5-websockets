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
 * The renderer lives in a separate file (EventLogTerminalRenderer.js) and uses apiVersion 4
 * for optimal rendering performance.
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
 * <control:EventLogTerminal id="eventLog" height="300px" autoScroll="true" />
 * ```
 *
 * Logging from a controller:
 * ```js
 * this.byId("eventLog").log("open", "Connection established.");
 * this.byId("eventLog").clear();
 * ```
 *
 * @see org.mrb.ui5websockets.control.EventLogEntry
 * @see org.mrb.ui5websockets.control.EventLogTerminalRenderer
 */
sap.ui.define(
    ["sap/ui/core/Control", "sap/ui/core/ResizeHandler", "sap/ui/dom/includeStylesheet", "./EventLogEntry", "./EventLogTerminalRenderer"],
    (Control, ResizeHandler, includeStylesheet, EventLogEntry, EventLogTerminalRenderer) => {
        "use strict";

        /** @type {boolean} Whether the control's CSS has already been loaded */
        let bCssLoaded = false;

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
                     * Whether the terminal should automatically scroll to the bottom
                     * when new entries are added and the content overflows the visible area.
                     * When false, the user must manually scroll to see new entries.
                     * Scrolling only occurs when content actually exceeds the visible area.
                     */
                    autoScroll: { type: "boolean", defaultValue: true },

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

            renderer: EventLogTerminalRenderer,

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
                /** @private */
                this._sResizeHandlerId = null;
                /** @private */
                this._fnOnResize = this._onResize.bind(this);
                /**
                 * Custom log type overrides registered via `registerLogType`.
                 * Takes precedence over the default types in the renderer.
                 * @private
                 * @type {Object<string, {icon: string, cssClass: string}>}
                 */
                this._mCustomLogTypes = {};
                /**
                 * Tracks connected event sources for automatic cleanup on destroy.
                 * Uses WeakRef to avoid holding strong references to sources that
                 * may be destroyed before this control. If a source is garbage collected,
                 * its entries are silently skipped during cleanup.
                 * @private
                 * @type {Array<{sourceRef: WeakRef<sap.ui.base.EventProvider>, event: string, handler: function}>}
                 */
                this._aConnectedSources = [];
            },

            /**
             * Called after the control is rendered.
             * Registers a ResizeHandler (once) and scrolls to the bottom
             * if autoScroll is enabled.
             *
             * @override
             */
            onAfterRendering: function () {
                if (!this._sResizeHandlerId) {
                    this._sResizeHandlerId = ResizeHandler.register(this, this._fnOnResize);
                }

                if (this.getAutoScroll()) {
                    this._scrollToBottom();
                }
            },

            /**
             * Cleanup on control destruction.
             * Deregisters the ResizeHandler and disconnects all event sources.
             *
             * @override
             */
            exit: function () {
                if (this._sResizeHandlerId) {
                    ResizeHandler.deregister(this._sResizeHandlerId);
                    this._sResizeHandlerId = null;
                }
                this.disconnectAllSources();
            },

            /**
             * Register a custom log type with its own icon and CSS class.
             *
             * Custom types take precedence over the built-in types (success, error,
             * warning, info, debug, trace, input, output). This allows consumers to
             * define domain-specific log types at the application level.
             *
             * The icon can be either a Unicode character (e.g. "\u25B6") or a
             * UI5 icon URI (e.g. "sap-icon://accept"). When a UI5 icon URI is used,
             * the renderer will create an `sap.ui.core.Icon` inline.
             *
             * Usage:
             * ```js
             * terminal.registerLogType("retry", { icon: "\u21BB", cssClass: "myApp-logRetry" });
             * terminal.registerLogType("connect", { icon: "sap-icon://connected", cssClass: "myApp-logConnect" });
             * ```
             *
             * @param {string} sType The log type name
             * @param {{icon: string, cssClass: string}} oConfig The icon and CSS class for this type
             * @public
             */
            registerLogType(sType, oConfig) {
                this._mCustomLogTypes[sType] = oConfig;
            },

            /**
             * Resolve a log type to its icon and CSS class configuration.
             *
             * Checks custom types first, then falls back to the renderer's built-in types.
             *
             * @param {string} sType The log type name
             * @returns {{icon: string, cssClass: string}} The type configuration
             * @private
             */
            _getLogTypeConfig(sType) {
                return this._mCustomLogTypes[sType] || EventLogTerminalRenderer.getLogTypeConfig(sType);
            },

            /**
             * Connect an EventProvider as a log source.
             *
             * Attaches to the specified events on the source and automatically logs
             * them to the terminal. All connections are tracked and cleaned up when
             * the control is destroyed or when `disconnectSource` / `disconnectAllSources`
             * is called.
             *
             * The `mEventMapping` maps event names to either a log type string or an
             * object with `type` and `message` (string or formatter function).
             *
             * Usage:
             * ```js
             * // Simple mapping: event name -> log type (message is the event name)
             * terminal.connectSource(wsService, {
             *     "open": "open",
             *     "close": "close",
             *     "error": "error"
             * });
             *
             * // Advanced mapping: custom message per event
             * terminal.connectSource(wsService, {
             *     "open": { type: "open", message: "Connection established." },
             *     "close": { type: "close", message: function(oEvent) {
             *         return "Closed with code " + oEvent.getParameter("code");
             *     }}
             * });
             *
             * // Connect RetryStrategy events
             * terminal.connectSource(retryStrategy, {
             *     "scheduled": { type: "retry", message: function(oEvent) {
             *         return "Retry #" + oEvent.getParameter("attempt") + " in " + oEvent.getParameter("delay") + "ms";
             *     }},
             *     "maxAttemptsReached": { type: "error", message: "Max retry attempts reached." },
             *     "reset": { type: "info", message: "Retry strategy reset." }
             * });
             * ```
             *
             * @param {sap.ui.base.EventProvider} oSource The event source to connect
             * @param {Object<string, string|{type: string, message: string|function}>} mEventMapping Event-to-log mapping
             * @public
             */
            connectSource(oSource, mEventMapping) {
                const oSourceRef = new WeakRef(oSource);
                const aEvents = Object.keys(mEventMapping);
                aEvents.forEach((sEvent) => {
                    const vConfig = mEventMapping[sEvent];
                    const sType = typeof vConfig === "string" ? vConfig : vConfig.type;
                    const vMessage = typeof vConfig === "string" ? sEvent : vConfig.message;

                    const fnHandler = (oEvent) => {
                        // Check if the source is still alive before logging
                        if (oSourceRef.deref()) {
                            const sMessage = typeof vMessage === "function" ? vMessage(oEvent) : vMessage;
                            this.log(sType, sMessage);
                        }
                    };

                    oSource.attachEvent(sEvent, fnHandler);
                    this._aConnectedSources.push({ sourceRef: oSourceRef, event: sEvent, handler: fnHandler });
                });
            },

            /**
             * Disconnect a specific event source, removing all event listeners
             * that were registered via `connectSource`.
             *
             * @param {sap.ui.base.EventProvider} oSource The event source to disconnect
             * @public
             */
            disconnectSource(oSource) {
                this._aConnectedSources = this._aConnectedSources.filter((oEntry) => {
                    const oRef = oEntry.sourceRef.deref();
                    if (oRef === oSource) {
                        oRef.detachEvent(oEntry.event, oEntry.handler);
                        return false;
                    }
                    // Also remove entries whose source has been garbage collected
                    if (!oRef) {
                        return false;
                    }
                    return true;
                });
            },

            /**
             * Disconnect all event sources that were registered via `connectSource`.
             * Silently skips sources that have already been garbage collected.
             *
             * Called automatically on control destruction.
             *
             * @public
             */
            disconnectAllSources() {
                this._aConnectedSources.forEach((oEntry) => {
                    const oRef = oEntry.sourceRef.deref();
                    if (oRef) {
                        oRef.detachEvent(oEntry.event, oEntry.handler);
                    }
                });
                this._aConnectedSources = [];
            },

            /**
             * Handle resize events from the ResizeHandler.
             * Re-evaluates scroll position when the terminal is resized.
             *
             * @private
             */
            _onResize: function () {
                if (this.getAutoScroll()) {
                    this._scrollToBottom();
                }
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
                    const config = this._getLogTypeConfig(sType);

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

                    if (this.getAutoScroll()) {
                        this._scrollToBottom();
                    }
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
             * Scroll the terminal to the bottom, but only if the content
             * actually overflows the visible area.
             *
             * @private
             */
            _scrollToBottom() {
                const domRef = this.getDomRef();
                if (!domRef) {
                    return;
                }
                const scrollArea = domRef.querySelector(".eventLogTerminal-scroll");
                if (scrollArea && scrollArea.scrollHeight > scrollArea.clientHeight) {
                    scrollArea.scrollTop = scrollArea.scrollHeight;
                }
            },

            /**
             * Format the current time as HH:MM:SS for log timestamps.
             * Uses the Temporal API (available in Chrome 144+, Firefox 139+)
             * for modern, unambiguous time formatting.
             *
             * @returns {string} Formatted time string
             * @private
             */
            _formatTimestamp() {
                const now = Temporal.Now.plainTimeISO();
                return `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}:${String(now.second).padStart(2, "0")}`;
            },
        });
    },
);
