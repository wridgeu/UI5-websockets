# EventLogTerminal

A custom UI5 control that renders an in-app terminal-like event log. It displays timestamped, color-coded log entries in a dark-themed monospace panel, similar to a browser developer console but embedded directly in the application.

## Files

- `EventLogTerminal.js` - The control (extends `sap.ui.core.Control`)
- `EventLogTerminalRenderer.js` - Separate renderer (apiVersion 4)
- `EventLogEntry.js` - Element for each log entry (extends `sap.ui.core.Element`)
- `EventLogTerminal.css` - Control-owned styles using UI5 theme CSS variables

## Usage in XML Views

```xml
<mvc:View
    xmlns:control="org.mrb.ui5websockets.control"
    xmlns="sap.m"
>
    <control:EventLogTerminal id="eventLog" height="300px" autoScroll="true" />
</mvc:View>
```

## Logging from a Controller

### Manual logging

You can always call `log()` directly for full control over what appears in the terminal:

```js
onInit: function () {
    const terminal = this.byId("eventLog");
    terminal.log("success", "Connection established.");
    terminal.log("input", "Sent: Ping");
    terminal.log("output", "Received: Pong!");
    terminal.log("error", "Something went wrong.");
    terminal.log("warning", "Connection lost, retrying...");
    terminal.log("info", "Informational message.");
    terminal.log("debug", "Debug-level detail.");
    terminal.log("trace", "Trace-level detail.");
    terminal.clear();
}
```

### Automatic logging via connectSource

Connect any `sap.ui.base.EventProvider` to the terminal. Events are automatically logged and all listeners are cleaned up when the control is destroyed.

```js
onInit: function () {
    const terminal = this.byId("eventLog");
    const wsService = this.getWebSocketService();

    // Simple mapping: event name -> log type
    terminal.connectSource(wsService, {
        "open": "open",
        "error": "error"
    });

    // Advanced mapping with custom messages and retry events.
    // The WebSocketService forwards RetryStrategy lifecycle events
    // (retryScheduled, retryMaxAttemptsReached, retryReset) through
    // its own eventing, so everything can be connected to a single source.
    terminal.connectSource(wsService, {
        "open": { type: "success", message: "Connection opened." },
        "error": { type: "error", message: "WebSocket error occurred." },
        "close": {
            type: "warning",
            message: function (oEvent) {
                const data = oEvent.getParameter("data");
                const code = data ? data.getParameter("code") : "unknown";
                return "Connection closed (code: " + code + ").";
            }
        },
        "retryScheduled": {
            type: "warning",
            message: function (oEvent) {
                return "Retry #" + oEvent.getParameter("attempt") + " in " + oEvent.getParameter("delay") + "ms...";
            }
        },
        "retryMaxAttemptsReached": { type: "error", message: "Max retry attempts reached." },
        "retryReset": { type: "success", message: "Retry strategy reset." }
    });
}
```

To disconnect a source manually (cleanup is automatic on destroy):

```js
terminal.disconnectSource(wsService);
terminal.disconnectAllSources();
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `width` | `sap.ui.core.CSSSize` | `"100%"` | Width of the terminal |
| `height` | `sap.ui.core.CSSSize` | `"300px"` | Height of the scroll area |
| `autoScroll` | `boolean` | `true` | Auto-scroll to bottom when content overflows |
| `backgroundColor` | `sap.ui.core.CSSColor` | `"#1e1e1e"` | Terminal background color |
| `textColor` | `sap.ui.core.CSSColor` | `"#cccccc"` | Default text color |
| `fontSize` | `sap.ui.core.CSSSize` | `"0.8125rem"` | Font size for log entries |
| `fontFamily` | `string` | `"'Courier New', Consolas, monospace"` | Font family |

## Log Types

Types are aligned with UI5 log levels (`sap.base.Log.Level`) plus additional semantic types for common use cases. They are intentionally generic and not tied to any specific domain.

| Type | Icon | Color | Aligns with | Use for |
|---|---|---|---|---|
| `success` | ✔ | Green | - | Positive outcome, successful operation |
| `error` | ✖ | Red | `Log.Level.ERROR` | Error condition |
| `warning` | ⚠ | Orange | `Log.Level.WARNING` | Warning, attention needed |
| `info` | • | Neutral | `Log.Level.INFO` | Informational message |
| `debug` | ‣ | Dim | `Log.Level.DEBUG` | Debug-level detail |
| `trace` | · | Very dim | `Log.Level.TRACE` | Trace-level detail |
| `input` | ▶ | Blue | - | Outgoing data (sent message, request) |
| `output` | ◀ | Yellow | - | Incoming data (received message, response) |

Unknown types fall back to `info` styling. Colors use UI5 theme CSS variables (e.g. `--sapPositiveTextColor`, `--sapNegativeTextColor`) with fallbacks for non-themed contexts.

### Custom Log Types

You can register additional log types at the application level via `registerLogType`. Custom types take precedence over built-in types.

Icons must be **Unicode characters** (e.g. `"\u21BB"`, `"\u2714"`, `"\u26A0"`). The terminal renders entries inside a monospace `<pre>` element, so `sap-icon://` URIs are not supported as they would require inline `sap.ui.core.Icon` controls that break the text-based layout. Unicode characters integrate naturally with monospace rendering.

The CSS class is applied to the message span and can reference the control's own classes, UI5 theme classes, or custom application-level classes.

```js
// Register domain-specific log types with Unicode icons
terminal.registerLogType("retry", { icon: "\u21BB", cssClass: "myApp-logRetry" });
terminal.registerLogType("connect", { icon: "\u2714", cssClass: "myApp-logConnect" });

// Then use them like any built-in type
terminal.log("retry", "Retrying in 2000ms...");
terminal.log("connect", "Connection established.");
```

Resolution order: custom type -> built-in type -> `info` fallback.

## Technical Details

- **Renderer**: apiVersion 4, separate file, RenderManager chaining
- **Aggregation**: `entries` (`EventLogEntry[]`) for UI5 lifecycle management
- **Performance**: Direct DOM append on `log()` calls (suppresses re-render), full re-render only when the control itself is invalidated
- **Security**: All text escaped via `RenderManager.text()` (renderer path) and `createTextNode()` (direct DOM path)
- **CSS**: Loaded once via `sap/ui/dom/includeStylesheet` on first instantiation
- **Resize**: Uses `sap/ui/core/ResizeHandler` to re-evaluate scroll on resize
- **Timestamps**: Uses the Temporal API (`Temporal.Now.plainTimeISO()`)
