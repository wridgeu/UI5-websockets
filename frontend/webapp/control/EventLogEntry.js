/**
 * EventLogEntry
 * @author Marco Beier
 *
 * Represents a single log entry inside the EventLogTerminal.
 * Each entry has a timestamp, a type (which determines its icon and color),
 * and a message. This is a lightweight UI5 Element (not a Control) because
 * it does not render itself independently. Instead, the parent
 * EventLogTerminal control renders all its entries.
 *
 * @class
 * @extends sap.ui.core.Element
 * @alias org.mrb.ui5websockets.control.EventLogEntry
 * @see org.mrb.ui5websockets.control.EventLogTerminal
 * @public
 */
sap.ui.define(["sap/ui/core/Element"], (Element) => {
    "use strict";

    return Element.extend("org.mrb.ui5websockets.control.EventLogEntry", {
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
