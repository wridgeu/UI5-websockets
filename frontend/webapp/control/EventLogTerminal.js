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
 * Built-in log types (aligned with sap.base.Log.Level):
 *   - "success" (green)  - positive outcome, successful operation
 *   - "error"   (red)    - error condition
 *   - "warning" (orange) - warning, attention needed
 *   - "info"    (neutral)- informational message
 *   - "debug"   (dim)    - debug-level detail
 *   - "trace"   (v.dim)  - trace-level detail
 *   - "input"   (blue)   - outgoing data (sent message, request)
 *   - "output"  (yellow) - incoming data (received message, response)
 *
 * Custom types can be registered via `registerLogType()`.
 * Unknown types fall back to "info" styling.
 *
 * Usage in XML Views:
 * ```xml
 * xmlns:control="org.mrb.ui5websockets.control"
 * ...
 * <control:EventLogTerminal id="eventLog" height="300px" autoScroll="true" />
 * ```
 *
 * Declarative binding (entries populated from a model):
 * ```xml
 * <control:EventLogTerminal entries="{/logEntries}">
 *     <control:EventLogEntry type="{type}" message="{message}" timestamp="{timestamp}" />
 * </control:EventLogTerminal>
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
    [
        "sap/ui/core/Control",
        "sap/ui/core/ResizeHandler",
        "sap/ui/dom/includeStylesheet",
        "sap/ui/base/ManagedObjectMetadata",
        "./EventLogEntry",
        "./EventLogTerminalRenderer",
    ],
    (Control, ResizeHandler, includeStylesheet, ManagedObjectMetadata, EventLogEntry, EventLogTerminalRenderer) => {
        "use strict";

        /** @type {boolean} Whether the control's CSS has already been loaded */
        let bCssLoaded = false;

        return Control.extend("org.mrb.ui5websockets.control.EventLogTerminal", {
            /**
             * Enable Extended Change Detection for the `entries` aggregation.
             *
             * When a list binding is created for `entries`, the framework calls
             * `enableExtendedChangeDetection` on the binding (see
             * `ManagedObjectBindingSupport._bindAggregation`). The binding then
             * attaches a `.diff` array to the contexts returned by `getContexts`,
             * and `updateEntries` consumes that diff for efficient incremental
             * DOM updates instead of re-rendering all entries.
             *
             * This follows the same pattern as `sap.f.GridContainer` and
             * `sap.m.GrowingEnablement` (which sets the flag on `sap.m.ListBase`).
             *
             * @see sap.ui.base.ManagedObject#bUseExtendedChangeDetection
             * @type {boolean}
             * @protected
             */
            bUseExtendedChangeDetection: true,

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
                     *
                     * Can be populated imperatively via the `log()` method, reactively
                     * via `connectSource()`, or declaratively via aggregation binding.
                     *
                     * When bound, the control uses Extended Change Detection (ECD) to
                     * efficiently apply diffs: only inserted or deleted entries touch
                     * the DOM, existing entries are left untouched.
                     *
                     * Declarative binding example:
                     * ```xml
                     * <EventLogTerminal entries="{/logEntries}">
                     *     <EventLogEntry type="{type}" message="{message}" timestamp="{timestamp}" />
                     * </EventLogTerminal>
                     * ```
                     *
                     * When a binding is active, `log()` and `clear()` operate on the
                     * bound model so that the model remains the single source of truth.
                     */
                    entries: {
                        type: "org.mrb.ui5websockets.control.EventLogEntry",
                        multiple: true,
                        singularName: "entry",
                        bindable: "bindable",
                    },
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
                 * Registry of connected event sources and their handlers.
                 * Uses a WeakMap so the terminal does not prevent sources from
                 * being garbage collected if they are destroyed before the terminal.
                 * @private
                 * @type {WeakMap<sap.ui.base.EventProvider, Array<{event: string, handler: function}>>}
                 */
                this._mSourceHandlers = new WeakMap();
                /**
                 * Tracks connected sources for iteration in disconnectAllSources.
                 * WeakMap is not iterable, so we maintain a parallel array of WeakRefs
                 * to the source objects. This array is only used for iteration and
                 * does not prevent garbage collection.
                 * @private
                 * @type {Array<WeakRef<sap.ui.base.EventProvider>>}
                 */
                this._aSourceRefs = [];
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
             * Icons should be Unicode characters (e.g. "\u25B6", "\u21BB", "\u2714").
             * The terminal renders log entries inside a monospace `<pre>` element,
             * which means `sap-icon://` URIs are not supported as they would require
             * inline `sap.ui.core.Icon` controls that break the monospace text layout.
             * Unicode characters integrate naturally with the terminal's text-based rendering.
             *
             * The CSS class is applied to the message span element and can reference
             * either a class from the control's own CSS, a UI5 theme class, or a
             * custom application-level class.
             *
             * Usage:
             * ```js
             * terminal.registerLogType("retry", { icon: "\u21BB", cssClass: "myApp-logRetry" });
             * terminal.registerLogType("connect", { icon: "\u2714", cssClass: "myApp-logConnect" });
             * ```
             *
             * @param {string} sType The log type name
             * @param {{icon: string, cssClass: string}} oConfig Unicode icon character and CSS class for this type
             * @public
             */
            registerLogType(sType, oConfig) {
                this._mCustomLogTypes[sType] = oConfig;
                this.invalidate();
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
             * Returns the renderer API contract.
             *
             * Formalizes which private methods the renderer is allowed to call,
             * making the dependency between control and renderer explicit.
             * This prevents accidental coupling to other internals.
             *
             * @returns {{getLogTypeConfig: function(string): {icon: string, cssClass: string}}} The renderer API
             * @private
             */
            _getRendererApi() {
                return {
                    getLogTypeConfig: (sType) => this._getLogTypeConfig(sType),
                };
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
                // Disconnect any previous registration for the same source
                // to avoid leaking the old event handlers.
                if (this._mSourceHandlers.has(oSource)) {
                    this.disconnectSource(oSource);
                }

                const aHandlers = [];
                const aEvents = Object.keys(mEventMapping);
                aEvents.forEach((sEvent) => {
                    const vConfig = mEventMapping[sEvent];
                    const sType = typeof vConfig === "string" ? vConfig : vConfig.type;
                    const vMessage = typeof vConfig === "string" ? sEvent : vConfig.message;

                    const fnHandler = (oEvent) => {
                        const sMessage = typeof vMessage === "function" ? vMessage(oEvent) : vMessage;
                        this.log(sType, sMessage);
                    };

                    oSource.attachEvent(sEvent, fnHandler);
                    aHandlers.push({ event: sEvent, handler: fnHandler });
                });

                // Store handlers in WeakMap (keyed by source, does not prevent GC)
                this._mSourceHandlers.set(oSource, aHandlers);
                // Track the source reference for iteration in disconnectAllSources
                this._aSourceRefs.push(new WeakRef(oSource));
            },

            /**
             * Disconnect a specific event source, removing all event listeners
             * that were registered via `connectSource`.
             *
             * @param {sap.ui.base.EventProvider} oSource The event source to disconnect
             * @public
             */
            disconnectSource(oSource) {
                const aHandlers = this._mSourceHandlers.get(oSource);
                if (aHandlers) {
                    aHandlers.forEach((oEntry) => {
                        oSource.detachEvent(oEntry.event, oEntry.handler);
                    });
                    this._mSourceHandlers.delete(oSource);
                }
                // Prune the source refs array (remove this source and any GC'd refs)
                this._aSourceRefs = this._aSourceRefs.filter((oRef) => {
                    const oSrc = oRef.deref();
                    return oSrc && oSrc !== oSource;
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
                this._aSourceRefs.forEach((oRef) => {
                    const oSource = oRef.deref();
                    if (oSource) {
                        const aHandlers = this._mSourceHandlers.get(oSource);
                        if (aHandlers) {
                            aHandlers.forEach((oEntry) => {
                                oSource.detachEvent(oEntry.event, oEntry.handler);
                            });
                            this._mSourceHandlers.delete(oSource);
                        }
                    }
                });
                this._aSourceRefs = [];
            },

            // -- Aggregation Binding (ECD) -------------------------------------------

            /**
             * Called by the framework when the `entries` binding needs to fetch
             * new data (OData models). Delegates to the default framework
             * implementation which calls `getContexts` on the binding.
             *
             * @param {string} _sReason The reason for the refresh (unused, required by framework contract)
             * @protected
             */
            refreshEntries(_sReason) {
                this.refreshAggregation("entries");
            },

            /**
             * Called by the framework when the `entries` binding has new data.
             *
             * Uses Extended Change Detection: the binding's `getContexts()`
             * returns an array with a `.diff` property describing inserts and
             * deletes. Only those operations are applied to the DOM — unchanged
             * entries are left in place, following the same pattern that
             * `sap.m.GrowingEnablement` uses for `sap.m.ListBase`.
             *
             * Diff semantics (from the binding):
             *  - `undefined` → new data, rebuild from scratch
             *  - `[]`        → nothing changed
             *  - `[{index, type:"insert"|"delete"}, …]` → incremental update
             *
             * @param {string} _sReason The reason for the update (unused, required by framework contract)
             * @protected
             */
            updateEntries(_sReason) {
                const oBinding = this.getBinding("entries");
                const oBindingInfo = this.getBindingInfo("entries");
                if (!oBinding || !oBindingInfo) {
                    return;
                }

                const aContexts = oBinding.getContexts() || [];
                const aDiff = aContexts.diff;
                const aEntries = this.getEntries();

                // No data — clear everything
                if (!aContexts.length) {
                    this.destroyAggregation("entries", true);
                    const pre = this._getPreElement();
                    if (pre) {
                        pre.textContent = "";
                    }
                    return;
                }

                // No diff or no existing entries — rebuild from scratch
                if (!aDiff || !aEntries.length) {
                    this.destroyAggregation("entries", true);
                    const pre = this._getPreElement();
                    if (pre) {
                        pre.textContent = "";
                    }

                    for (let i = 0; i < aContexts.length; i++) {
                        const oEntry = oBindingInfo.factory(ManagedObjectMetadata.uid("clone"), aContexts[i]);
                        oEntry.setBindingContext(aContexts[i], oBindingInfo.model);
                        this.addAggregation("entries", oEntry, true);
                        this._appendEntryToDOM(oEntry);
                    }

                    if (this.getAutoScroll()) {
                        this._scrollToBottom();
                    }
                    return;
                }

                // Empty diff — nothing changed
                if (!aDiff.length) {
                    return;
                }

                // Process ECD diff — only insert/delete the affected entries
                for (let i = 0; i < aDiff.length; i++) {
                    const oDiff = aDiff[i];
                    if (oDiff.type === "insert") {
                        const oContext = aContexts[oDiff.index];
                        const oEntry = oBindingInfo.factory(ManagedObjectMetadata.uid("clone"), oContext);
                        oEntry.setBindingContext(oContext, oBindingInfo.model);
                        this.insertAggregation("entries", oEntry, oDiff.index, true);
                        this._insertEntryInDOM(oEntry, oDiff.index);
                    } else if (oDiff.type === "delete") {
                        const oEntry = this.getEntries()[oDiff.index];
                        this._removeEntryFromDOM(oDiff.index);
                        this.removeAggregation("entries", oEntry, true);
                        oEntry.destroy(true);
                    }
                }

                // Inserting/deleting entries shifts the index of all following
                // items, so re-assign binding contexts to keep them in sync.
                const aUpdated = this.getEntries();
                for (let i = 0; i < aUpdated.length; i++) {
                    aUpdated[i].setBindingContext(aContexts[i], oBindingInfo.model);
                }

                if (this.getAutoScroll()) {
                    this._scrollToBottom();
                }
            },

            // -- Resize Handling --------------------------------------------------

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
             * When a binding is active on the `entries` aggregation, the entry
             * is pushed to the bound model and the binding's change detection
             * handles the DOM update via `updateEntries`. When no binding is
             * active, the entry is added directly to the aggregation and
             * appended to the DOM for performance (no full re-render).
             *
             * @param {string} sType Built-in: success, error, warning, info, debug, trace, input, output. Custom types via registerLogType().
             * @param {string} sMessage The log message text
             * @public
             */
            log(sType, sMessage) {
                const oBinding = this.getBinding("entries");
                if (oBinding) {
                    // Binding active — push to model; the binding's change
                    // detection will call updateEntries which handles the DOM.
                    const oModel = oBinding.getModel();
                    const sPath = oBinding.getPath();
                    const aData = (oModel.getProperty(sPath) || []).slice();
                    aData.push({ type: sType, message: sMessage, timestamp: this._formatTimestamp() });
                    oModel.setProperty(sPath, aData);
                    return;
                }

                // No binding — imperative path
                const oEntry = new EventLogEntry({
                    type: sType,
                    message: sMessage,
                    timestamp: this._formatTimestamp(),
                });
                this.addAggregation("entries", oEntry, true);
                this._appendEntryToDOM(oEntry);

                if (this.getAutoScroll()) {
                    this._scrollToBottom();
                }
            },

            /**
             * Clear all entries from the terminal.
             *
             * When a binding is active, clears the bound model array so that
             * the binding's change detection handles the DOM update.
             * Otherwise removes all EventLogEntry elements directly.
             *
             * @public
             */
            clear() {
                const oBinding = this.getBinding("entries");
                if (oBinding) {
                    const oModel = oBinding.getModel();
                    const sPath = oBinding.getPath();
                    oModel.setProperty(sPath, []);
                    return;
                }

                this.destroyAggregation("entries", true);
                const pre = this._getPreElement();
                if (pre) {
                    pre.textContent = "";
                }
            },

            // -- DOM Helpers -------------------------------------------------------

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
             * Create a DocumentFragment containing the DOM nodes for a single
             * log entry (timestamp span, separator, message span, line break).
             *
             * If the entry has no timestamp (e.g. bound without a timestamp
             * field), the current time is used as a display-only fallback.
             *
             * @param {org.mrb.ui5websockets.control.EventLogEntry} oEntry The entry element
             * @returns {DocumentFragment} Ready-to-insert DOM fragment
             * @private
             */
            _createEntryDOM(oEntry) {
                const config = this._getLogTypeConfig(oEntry.getType());
                const sTimestamp = oEntry.getTimestamp() || this._formatTimestamp();

                const fragment = document.createDocumentFragment();

                const oTimestampSpan = document.createElement("span");
                oTimestampSpan.className = "eventLogTerminal-timestamp";
                oTimestampSpan.textContent = sTimestamp;
                fragment.appendChild(oTimestampSpan);

                fragment.appendChild(document.createTextNode(" "));

                const oMessageSpan = document.createElement("span");
                oMessageSpan.className = config.cssClass;
                oMessageSpan.textContent = `${config.icon} ${oEntry.getMessage()}`;
                fragment.appendChild(oMessageSpan);

                fragment.appendChild(document.createElement("br"));

                return fragment;
            },

            /**
             * Append a single entry's DOM nodes to the end of the pre element.
             *
             * @param {org.mrb.ui5websockets.control.EventLogEntry} oEntry The entry to append
             * @private
             */
            _appendEntryToDOM(oEntry) {
                const pre = this._getPreElement();
                if (!pre) {
                    return;
                }
                pre.appendChild(this._createEntryDOM(oEntry));
            },

            /**
             * Insert a single entry's DOM nodes at a specific position.
             *
             * Each entry occupies four consecutive child nodes in the pre
             * element (timestamp span, text node, message span, br), so the
             * DOM offset for entry `i` is `i * 4`.
             *
             * @param {org.mrb.ui5websockets.control.EventLogEntry} oEntry The entry to insert
             * @param {int} iIndex The zero-based entry index
             * @private
             */
            _insertEntryInDOM(oEntry, iIndex) {
                const pre = this._getPreElement();
                if (!pre) {
                    return;
                }

                const fragment = this._createEntryDOM(oEntry);
                const iNodeIndex = iIndex * 4;
                const oRefNode = pre.childNodes[iNodeIndex] || null;
                pre.insertBefore(fragment, oRefNode);
            },

            /**
             * Remove the four DOM nodes that belong to the entry at `iIndex`.
             *
             * @param {int} iIndex The zero-based entry index
             * @private
             */
            _removeEntryFromDOM(iIndex) {
                const pre = this._getPreElement();
                if (!pre) {
                    return;
                }

                const iNodeIndex = iIndex * 4;
                for (let j = 0; j < 4; j++) {
                    if (pre.childNodes[iNodeIndex]) {
                        pre.removeChild(pre.childNodes[iNodeIndex]);
                    }
                }
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
             * Uses the Temporal API where available (Chrome 144+, Firefox 139+,
             * Safari 18.4+) with a Date-based fallback for older browsers.
             *
             * @returns {string} Formatted time string
             * @private
             */
            _formatTimestamp() {
                if (typeof Temporal !== "undefined") {
                    const now = Temporal.Now.plainTimeISO();
                    return `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}:${String(now.second).padStart(2, "0")}`;
                }
                const now = new Date();
                return [now.getHours(), now.getMinutes(), now.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
            },
        });
    },
);
