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
 * @see org.mrb.ui5websockets.control.EventLogTerminal
 */
sap.ui.define(["sap/ui/core/Element"], (Element) => {
    "use strict";

    return Element.extend("org.mrb.ui5websockets.control.EventLogEntry", {
        metadata: {
            properties: {
                /**
                 * The log entry type, which determines the icon and color.
                 * Supported values: "open", "close", "send", "receive", "retry", "error", "info".
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
