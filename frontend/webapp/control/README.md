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
    terminal.log("open", "Connection established.");
    terminal.log("send", "Sent: Ping");
    terminal.log("receive", "Received: Pong!");
    terminal.log("error", "Something went wrong.");
    terminal.log("retry", "Retrying in 2000ms...");
    terminal.log("info", "Some informational message.");
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

    // Advanced mapping: custom messages per event
    terminal.connectSource(wsService, {
        "close": {
            type: "close",
            message: function (oEvent) {
                const data = oEvent.getParameter("data");
                const code = data ? data.getParameter("code") : "unknown";
                return "Connection closed (code: " + code + ").";
            }
        }
    });

    // Connect a RetryStrategy instance
    const retryStrategy = wsService.getRetryStrategy();
    terminal.connectSource(retryStrategy, {
        "scheduled": {
            type: "retry",
            message: function (oEvent) {
                return "Retry #" + oEvent.getParameter("attempt") + " in " + oEvent.getParameter("delay") + "ms...";
            }
        },
        "maxAttemptsReached": { type: "error", message: "Max retry attempts reached." },
        "reset": { type: "info", message: "Retry strategy reset." }
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

| Type | Icon | Color | Use for |
|---|---|---|---|
| `open` | ▶ | Green | Connection established |
| `close` | ✕ | Gray | Connection closed |
| `send` | ▶ | Blue | Outgoing message |
| `receive` | ◀ | Yellow | Incoming message |
| `retry` | ↻ | Orange | Reconnection attempt |
| `error` | ✖ | Red | Error occurred |
| `info` | • | Dim | Informational |

Colors use UI5 theme CSS variables (e.g. `--sapPositiveTextColor`, `--sapNegativeTextColor`) with fallbacks for non-themed contexts.

## Technical Details

- **Renderer**: apiVersion 4, separate file, RenderManager chaining
- **Aggregation**: `entries` (`EventLogEntry[]`) for UI5 lifecycle management
- **Performance**: Direct DOM append on `log()` calls (suppresses re-render), full re-render only when the control itself is invalidated
- **Security**: All text escaped via `RenderManager.text()` (renderer path) and `createTextNode()` (direct DOM path)
- **CSS**: Loaded once via `sap/ui/dom/includeStylesheet` on first instantiation
- **Resize**: Uses `sap/ui/core/ResizeHandler` to re-evaluate scroll on resize
- **Timestamps**: Uses the Temporal API (`Temporal.Now.plainTimeISO()`)
