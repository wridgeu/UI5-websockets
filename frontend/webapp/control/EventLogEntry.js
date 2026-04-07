/**
 * EventLogEntry module.
 *
 * Lightweight UI5 Element representing a single log entry.
 * Does not render itself — the parent EventLogTerminal renders all its entries.
 */
sap.ui.define(["sap/ui/core/Element"], (Element) => {
    "use strict";

    /**
     * Constructor for a new EventLogEntry.
     *
     * @param {string} [sId] ID for the new element, generated automatically if no ID is given
     * @param {object} [mSettings] Initial settings for the new element
     *
     * @class
     * Represents a single log entry inside the EventLogTerminal.
     * Each entry has a timestamp, a type (which determines its icon and color),
     * and a message.
     *
     * @extends sap.ui.core.Element
     * @author Marco Beier
     *
     * @constructor
     * @public
     * @alias org.mrb.ui5websockets.control.EventLogEntry
     * @see org.mrb.ui5websockets.control.EventLogTerminal
     */
    return Element.extend("org.mrb.ui5websockets.control.EventLogEntry", /** @lends org.mrb.ui5websockets.control.EventLogEntry.prototype */ {
        metadata: {
            properties: {
                /**
                 * The log entry type, which determines the icon and color.
                 * Built-in types: "success", "error", "warning", "info", "debug", "trace", "input", "output".
                 * Custom types can be registered via `EventLogTerminal.registerLogType()`.
                 * Unknown types fall back to "info" styling.
                 */
                type: { type: "string", defaultValue: "info" },

                /**
                 * The log message text.
                 */
                message: { type: "string", defaultValue: "" },

                /**
                 * The timestamp of the log entry, formatted as HH:MM:SS.
                 * If not provided, the current time is used when the entry is created.
                 */
                timestamp: { type: "string", defaultValue: "" },
            },
        },
    });
});
