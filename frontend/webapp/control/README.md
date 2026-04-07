# EventLogTerminal

A custom UI5 control that renders an in-app terminal-like event log. It displays timestamped, color-coded log entries in a dark-themed monospace panel, similar to a browser developer console but embedded directly in the application.

## Files

- `EventLogTerminal.js` - The control (extends `sap.ui.core.Control`)
- `EventLogTerminalRenderer.js` - Separate renderer (apiVersion 4)
- `EventLogEntry.js` - Element for each log entry (extends `sap.ui.core.Element`)
- `EventLogTerminal.css` - Control-owned styles using UI5 theme CSS variables

## Three Ways to Add Log Entries

The control supports three approaches that can be used independently or combined:

1. **Imperative** - Call `log()` directly from a controller
2. **Reactive** - Connect an `EventProvider` via `connectSource()` for automatic event logging
3. **Declarative** - Bind the `entries` aggregation to a model in XML views

### 1. Imperative Logging

```xml
<control:EventLogTerminal id="eventLog" height="300px" autoScroll="true" />
```

```js
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
```

### 2. Reactive Logging via connectSource

Connect any `sap.ui.base.EventProvider` to the terminal. Events are automatically logged and all listeners are cleaned up when the control is destroyed. Calling `connectSource` twice on the same source disconnects the previous handlers first.

```js
const terminal = this.byId("eventLog");
const wsService = this.getWebSocketService();

terminal.connectSource(wsService, {
    // Simple mapping: event name becomes the log message
    "open": "success",

    // Object mapping with static message
    "error": { type: "error", message: "WebSocket error occurred." },

    // Formatter function for dynamic messages from event parameters
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
```

To disconnect a source manually (cleanup is automatic on destroy):

```js
terminal.disconnectSource(wsService);
terminal.disconnectAllSources();
```

### 3. Declarative Binding with Extended Change Detection

The `entries` aggregation supports standard UI5 aggregation binding. When bound, the control uses Extended Change Detection (ECD) for efficient incremental DOM updates — only inserted or deleted entries touch the DOM, existing entries are left in place.

```xml
<control:EventLogTerminal id="eventLog" height="300px"
    entries="{/logEntries}">
    <control:EventLogEntry type="{type}" message="{message}" timestamp="{timestamp}" />
</control:EventLogTerminal>
```

The model drives the terminal content:

```js
const oModel = new JSONModel({
    logEntries: [
        { type: "info", message: "Application started", timestamp: "10:30:00" },
        { type: "success", message: "Connected", timestamp: "10:30:05" }
    ]
});
this.getView().setModel(oModel);
```

When a binding is active, `log()` and `clear()` automatically operate on the bound model so that the model remains the single source of truth. `connectSource` also flows through the model in this case.

Entries without a `timestamp` field in the model data get an auto-generated timestamp (HH:MM:SS) at display time. Entries without a `type` fall back to `"info"` styling.

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `width` | `sap.ui.core.CSSSize` | `"100%"` | Width of the terminal |
| `height` | `sap.ui.core.CSSSize` | `"300px"` | Height of the scroll area |
| `autoScroll` | `boolean` | `true` | Auto-scroll to bottom when content overflows |
| `backgroundColor` | `sap.ui.core.CSSColor` | `"#1e1e1e"` | Terminal background color |
| `textColor` | `sap.ui.core.CSSColor` | `"#cccccc"` | Default text color |
| `fontSize` | `sap.ui.core.CSSSize` | `"0.8125rem"` | Font size for log entries |
| `fontFamily` | `string` | `"'Courier New', Consolas, monospace"` | Font family (supports CSS fallback chains) |

## Aggregations

| Aggregation | Type | Multiple | Bindable | Description |
|---|---|---|---|---|
| `entries` | `EventLogEntry` | Yes | Yes | Log entries displayed in the terminal |

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

Unknown types fall back to `info` styling. Colors use UI5 theme CSS variables (for example `--sapPositiveTextColor`, `--sapNegativeTextColor`) with fallbacks for non-themed contexts.

### Custom Log Types

Register additional log types at the application level via `registerLogType`. Custom types take precedence over built-in types. Registering after the control is rendered triggers a re-render automatically.

Icons must be **Unicode characters** (for example `"\u21BB"`, `"\u2714"`, `"\u26A0"`). The terminal renders entries inside a monospace `<pre>` element, so `sap-icon://` URIs are not supported as they would require inline `sap.ui.core.Icon` controls that break the text-based layout. Unicode characters integrate naturally with monospace rendering.

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

## Testing

Unit tests use the modern UI5 Test Starter (requires UI5 1.124+). Run with:

```bash
npm test
```

This starts the UI5 server and opens the test suite at `test/testsuite.qunit.html`. The suite covers property defaults, rendering, imperative logging, custom log types, reactive event sources, declarative binding with ECD, model-aware `log()`/`clear()`, and lifecycle behavior.

Test files:

```
frontend/webapp/test/
  testsuite.qunit.html          <- Test Starter entry point
  Test.qunit.html               <- Generic test runner
  testsuite.qunit.js            <- Suite config (QUnit 2, Sinon 4)
  unit/control/
    EventLogTerminal.qunit.js   <- ~50 tests, ~100 assertions
```

## Technical Details

- **Renderer**: apiVersion 4, separate file, RenderManager chaining
- **Aggregation**: `entries` (`EventLogEntry[]`, bindable) for UI5 lifecycle management
- **ECD**: Extended Change Detection enabled via `bUseExtendedChangeDetection`. Custom `updateEntries` hook consumes the binding's `.diff` array for incremental DOM updates, following the `sap.m.GrowingEnablement` pattern
- **Performance**: Direct DOM manipulation on `log()` calls and ECD updates (suppresses re-render). Full re-render only when the control itself is invalidated
- **Model-aware**: When a binding is active, `log()` pushes to the model and `clear()` empties the model array, keeping the model as single source of truth
- **Security**: All text escaped via `RenderManager.text()` (renderer path) and `textContent` / `createTextNode()` (direct DOM path)
- **CSS**: Loaded once via `sap/ui/dom/includeStylesheet` using module-relative `require.toUrl("./EventLogTerminal.css")`
- **Memory**: WeakMap for source handler registry (does not prevent GC), WeakRef array for source iteration
- **Resize**: Uses `sap/ui/core/ResizeHandler` to re-evaluate scroll on resize
- **Timestamps**: Uses the Temporal API (`Temporal.Now.plainTimeISO()`) with a `Date`-based fallback for browsers without Temporal support
