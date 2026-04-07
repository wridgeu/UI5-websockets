/*global QUnit */
sap.ui.define([
    "org/mrb/ui5websockets/control/EventLogTerminal",
    "org/mrb/ui5websockets/control/EventLogEntry",
    "sap/ui/model/json/JSONModel",
    "sap/ui/base/EventProvider",
    "sap/ui/qunit/utils/createAndAppendDiv",
], (EventLogTerminal, EventLogEntry, JSONModel, EventProvider, createAndAppendDiv) => {
    "use strict";

    createAndAppendDiv("uiArea");

    // ── Helpers ──────────────────────────────────────────────────────────

    /** Create a terminal, place it, and wait for rendering. */
    function createTerminal(oSettings) {
        const oTerminal = new EventLogTerminal(oSettings);
        oTerminal.placeAt("uiArea");
        sap.ui.getCore().applyChanges();
        return oTerminal;
    }

    /** Return the <pre> inside the terminal's DOM. */
    function getPre(oTerminal) {
        return oTerminal.getDomRef().querySelector(".eventLogTerminal-pre");
    }

    /** Count how many visual log lines are in the <pre> (each entry = 4 child nodes). */
    function domEntryCount(oTerminal) {
        const pre = getPre(oTerminal);
        return pre ? pre.childNodes.length / 4 : 0;
    }

    // ── Module: Property Defaults ────────────────────────────────────────

    QUnit.module("Property Defaults", {
        beforeEach: function () {
            this.oTerminal = createTerminal();
        },
        afterEach: function () {
            this.oTerminal.destroy();
        },
    });

    QUnit.test("width defaults to 100%", function (assert) {
        assert.strictEqual(this.oTerminal.getWidth(), "100%");
    });

    QUnit.test("height defaults to 300px", function (assert) {
        assert.strictEqual(this.oTerminal.getHeight(), "300px");
    });

    QUnit.test("autoScroll defaults to true", function (assert) {
        assert.strictEqual(this.oTerminal.getAutoScroll(), true);
    });

    QUnit.test("backgroundColor defaults to #1e1e1e", function (assert) {
        assert.strictEqual(this.oTerminal.getBackgroundColor(), "#1e1e1e");
    });

    QUnit.test("textColor defaults to #cccccc", function (assert) {
        assert.strictEqual(this.oTerminal.getTextColor(), "#cccccc");
    });

    QUnit.test("fontSize defaults to 0.8125rem", function (assert) {
        assert.strictEqual(this.oTerminal.getFontSize(), "0.8125rem");
    });

    QUnit.test("fontFamily defaults to monospace stack", function (assert) {
        assert.strictEqual(this.oTerminal.getFontFamily(), "'Courier New', Consolas, monospace");
    });

    QUnit.test("bUseExtendedChangeDetection is true on the prototype", function (assert) {
        assert.strictEqual(EventLogTerminal.prototype.bUseExtendedChangeDetection, true);
    });

    QUnit.test("entries aggregation is marked bindable", function (assert) {
        const oAggMeta = this.oTerminal.getMetadata().getAggregation("entries");
        assert.strictEqual(oAggMeta.bindable, true, "bindable flag is set");
        assert.strictEqual(typeof this.oTerminal.bindEntries, "function", "bindEntries convenience method exists");
        assert.strictEqual(typeof this.oTerminal.unbindEntries, "function", "unbindEntries convenience method exists");
    });

    // ── Module: Rendering ────────────────────────────────────────────────

    QUnit.module("Rendering", {
        beforeEach: function () {
            this.oTerminal = createTerminal();
        },
        afterEach: function () {
            this.oTerminal.destroy();
        },
    });

    QUnit.test("renders root div with eventLogTerminal class", function (assert) {
        const dom = this.oTerminal.getDomRef();
        assert.ok(dom, "DOM ref exists");
        assert.ok(dom.classList.contains("eventLogTerminal"), "has root CSS class");
    });

    QUnit.test("renders scroll container and pre element", function (assert) {
        const dom = this.oTerminal.getDomRef();
        assert.ok(dom.querySelector(".eventLogTerminal-scroll"), "scroll div exists");
        assert.ok(dom.querySelector(".eventLogTerminal-pre"), "pre element exists");
    });

    QUnit.test("applies width, height, colors, font to DOM", function (assert) {
        const oTerminal = createTerminal({
            width: "500px",
            height: "200px",
            backgroundColor: "#000",
            textColor: "#fff",
            fontSize: "14px",
        });
        const dom = oTerminal.getDomRef();
        assert.strictEqual(dom.style.width, "500px");
        const scroll = dom.querySelector(".eventLogTerminal-scroll");
        assert.strictEqual(scroll.style.height, "200px");
        assert.strictEqual(scroll.style.backgroundColor, "rgb(0, 0, 0)");
        assert.strictEqual(scroll.style.color, "rgb(255, 255, 255)");
        assert.strictEqual(scroll.style.fontSize, "14px");
        oTerminal.destroy();
    });

    // ── Module: Imperative Logging (log / clear) ─────────────────────────

    QUnit.module("Imperative Logging", {
        beforeEach: function () {
            this.oTerminal = createTerminal();
        },
        afterEach: function () {
            this.oTerminal.destroy();
        },
    });

    QUnit.test("log() adds an entry to the aggregation", function (assert) {
        this.oTerminal.log("info", "Hello");
        assert.strictEqual(this.oTerminal.getEntries().length, 1);
        const oEntry = this.oTerminal.getEntries()[0];
        assert.strictEqual(oEntry.getType(), "info");
        assert.strictEqual(oEntry.getMessage(), "Hello");
        assert.ok(oEntry.getTimestamp(), "timestamp is auto-generated");
    });

    QUnit.test("log() appends 4 DOM nodes per entry", function (assert) {
        this.oTerminal.log("success", "A");
        this.oTerminal.log("error", "B");
        assert.strictEqual(domEntryCount(this.oTerminal), 2);
        assert.strictEqual(getPre(this.oTerminal).childNodes.length, 8);
    });

    QUnit.test("log() renders correct icon and CSS class per type", function (assert) {
        this.oTerminal.log("success", "OK");
        const pre = getPre(this.oTerminal);
        // 3rd child node (index 2) is the message span
        const msgSpan = pre.childNodes[2];
        assert.ok(msgSpan.classList.contains("eventLogTerminal-success"), "has success CSS class");
        assert.ok(msgSpan.textContent.includes("\u2714"), "contains check mark icon");
    });

    QUnit.test("clear() removes all entries and DOM nodes", function (assert) {
        this.oTerminal.log("info", "A");
        this.oTerminal.log("info", "B");
        assert.strictEqual(this.oTerminal.getEntries().length, 2);

        this.oTerminal.clear();
        assert.strictEqual(this.oTerminal.getEntries().length, 0);
        assert.strictEqual(getPre(this.oTerminal).childNodes.length, 0);
    });

    QUnit.test("all 8 built-in types render without error", function (assert) {
        const aTypes = ["success", "error", "warning", "info", "debug", "trace", "input", "output"];
        aTypes.forEach((sType) => this.oTerminal.log(sType, sType + " message"));
        assert.strictEqual(this.oTerminal.getEntries().length, 8);
        assert.strictEqual(domEntryCount(this.oTerminal), 8);
    });

    QUnit.test("unknown type falls back to info styling", function (assert) {
        this.oTerminal.log("nonexistent", "test");
        const msgSpan = getPre(this.oTerminal).childNodes[2];
        assert.ok(msgSpan.classList.contains("eventLogTerminal-info"), "falls back to info CSS class");
    });

    // ── Module: Custom Log Types ─────────────────────────────────────────

    QUnit.module("Custom Log Types", {
        beforeEach: function () {
            this.oTerminal = createTerminal();
        },
        afterEach: function () {
            this.oTerminal.destroy();
        },
    });

    QUnit.test("registerLogType() makes custom type available", function (assert) {
        this.oTerminal.registerLogType("custom", { icon: "\u21BB", cssClass: "my-custom" });
        this.oTerminal.log("custom", "test");
        const msgSpan = getPre(this.oTerminal).childNodes[2];
        assert.ok(msgSpan.classList.contains("my-custom"), "uses custom CSS class");
        assert.ok(msgSpan.textContent.includes("\u21BB"), "uses custom icon");
    });

    QUnit.test("custom type overrides built-in type of same name", function (assert) {
        this.oTerminal.registerLogType("info", { icon: "X", cssClass: "override-info" });
        this.oTerminal.log("info", "test");
        const msgSpan = getPre(this.oTerminal).childNodes[2];
        assert.ok(msgSpan.classList.contains("override-info"), "uses overridden CSS class");
    });

    // ── Module: Reactive Event Source (connectSource) ────────────────────

    QUnit.module("Reactive Event Source", {
        beforeEach: function () {
            this.oTerminal = createTerminal();
            this.oSource = new EventProvider();
        },
        afterEach: function () {
            this.oTerminal.destroy();
            this.oSource.destroy();
        },
    });

    QUnit.test("connectSource() with simple string mapping logs on event", function (assert) {
        this.oTerminal.connectSource(this.oSource, { myEvent: "info" });
        this.oSource.fireEvent("myEvent");
        assert.strictEqual(this.oTerminal.getEntries().length, 1);
        assert.strictEqual(this.oTerminal.getEntries()[0].getType(), "info");
        assert.strictEqual(this.oTerminal.getEntries()[0].getMessage(), "myEvent");
    });

    QUnit.test("connectSource() with object mapping uses custom type and message", function (assert) {
        this.oTerminal.connectSource(this.oSource, {
            open: { type: "success", message: "Connected." },
        });
        this.oSource.fireEvent("open");
        assert.strictEqual(this.oTerminal.getEntries()[0].getType(), "success");
        assert.strictEqual(this.oTerminal.getEntries()[0].getMessage(), "Connected.");
    });

    QUnit.test("connectSource() with formatter function extracts event parameters", function (assert) {
        this.oTerminal.connectSource(this.oSource, {
            close: {
                type: "warning",
                message: (oEvent) => "Code: " + oEvent.getParameter("code"),
            },
        });
        this.oSource.fireEvent("close", { code: 1001 });
        assert.strictEqual(this.oTerminal.getEntries()[0].getMessage(), "Code: 1001");
    });

    QUnit.test("disconnectSource() stops logging from that source", function (assert) {
        this.oTerminal.connectSource(this.oSource, { ping: "info" });
        this.oSource.fireEvent("ping");
        assert.strictEqual(this.oTerminal.getEntries().length, 1);

        this.oTerminal.disconnectSource(this.oSource);
        this.oSource.fireEvent("ping");
        assert.strictEqual(this.oTerminal.getEntries().length, 1, "no new entry after disconnect");
    });

    QUnit.test("disconnectAllSources() stops all sources", function (assert) {
        const oSource2 = new EventProvider();
        this.oTerminal.connectSource(this.oSource, { a: "info" });
        this.oTerminal.connectSource(oSource2, { b: "info" });

        this.oTerminal.disconnectAllSources();
        this.oSource.fireEvent("a");
        oSource2.fireEvent("b");
        assert.strictEqual(this.oTerminal.getEntries().length, 0);
        oSource2.destroy();
    });

    // ── Module: Declarative Binding (ECD) ────────────────────────────────

    QUnit.module("Declarative Binding with ECD", {
        beforeEach: function () {
            this.oModel = new JSONModel({
                logEntries: [
                    { type: "info", message: "Initial entry", timestamp: "10:00:00" },
                ],
            });
            this.oTerminal = createTerminal();
            this.oTerminal.setModel(this.oModel);
            this.oTerminal.bindEntries({
                path: "/logEntries",
                template: new EventLogEntry({
                    type: "{type}",
                    message: "{message}",
                    timestamp: "{timestamp}",
                }),
            });
            // Force synchronous rendering after binding
            sap.ui.getCore().applyChanges();
        },
        afterEach: function () {
            this.oTerminal.destroy();
            this.oModel.destroy();
        },
    });

    QUnit.test("binding renders initial model data", function (assert) {
        assert.strictEqual(this.oTerminal.getEntries().length, 1);
        assert.strictEqual(domEntryCount(this.oTerminal), 1);
    });

    QUnit.test("ECD flag is propagated to the list binding", function (assert) {
        const oBinding = this.oTerminal.getBinding("entries");
        assert.ok(oBinding, "binding exists");
        assert.strictEqual(oBinding.bUseExtendedChangeDetection, true, "ECD is enabled on the binding");
    });

    QUnit.test("pushing to model appends entry via ECD diff (no full rebuild)", function (assert) {
        const pre = getPre(this.oTerminal);
        const iNodesBefore = pre.childNodes.length;

        // Push a new entry to the model
        const aData = this.oModel.getProperty("/logEntries").slice();
        aData.push({ type: "success", message: "Appended", timestamp: "10:00:01" });
        this.oModel.setProperty("/logEntries", aData);

        assert.strictEqual(this.oTerminal.getEntries().length, 2);
        assert.strictEqual(pre.childNodes.length, iNodesBefore + 4, "exactly 4 nodes added (1 entry)");
    });

    QUnit.test("multiple rapid pushes each produce correct incremental DOM updates", function (assert) {
        for (let i = 0; i < 5; i++) {
            const aData = this.oModel.getProperty("/logEntries").slice();
            aData.push({ type: "info", message: "Entry " + i, timestamp: "10:00:0" + i });
            this.oModel.setProperty("/logEntries", aData);
        }
        // 1 initial + 5 pushed = 6
        assert.strictEqual(this.oTerminal.getEntries().length, 6);
        assert.strictEqual(domEntryCount(this.oTerminal), 6);
    });

    QUnit.test("clearing model data removes all entries and DOM nodes", function (assert) {
        this.oModel.setProperty("/logEntries", []);
        assert.strictEqual(this.oTerminal.getEntries().length, 0);
        assert.strictEqual(getPre(this.oTerminal).childNodes.length, 0);
    });

    QUnit.test("replacing model data rebuilds from scratch", function (assert) {
        this.oModel.setProperty("/logEntries", [
            { type: "error", message: "Replaced A", timestamp: "11:00:00" },
            { type: "warning", message: "Replaced B", timestamp: "11:00:01" },
        ]);
        assert.strictEqual(this.oTerminal.getEntries().length, 2);
        assert.strictEqual(domEntryCount(this.oTerminal), 2);
        // Verify content is from the new data, not the old
        const msgSpan = getPre(this.oTerminal).childNodes[2];
        assert.ok(msgSpan.textContent.includes("Replaced A"), "DOM reflects new data");
    });

    // ── Module: log() and clear() with Active Binding ────────────────────

    QUnit.module("Model-Aware log() and clear()", {
        beforeEach: function () {
            this.oModel = new JSONModel({ logEntries: [] });
            this.oTerminal = createTerminal();
            this.oTerminal.setModel(this.oModel);
            this.oTerminal.bindEntries({
                path: "/logEntries",
                template: new EventLogEntry({
                    type: "{type}",
                    message: "{message}",
                    timestamp: "{timestamp}",
                }),
            });
            sap.ui.getCore().applyChanges();
        },
        afterEach: function () {
            this.oTerminal.destroy();
            this.oModel.destroy();
        },
    });

    QUnit.test("log() pushes to the model when binding is active", function (assert) {
        this.oTerminal.log("info", "Via log()");
        const aData = this.oModel.getProperty("/logEntries");
        assert.strictEqual(aData.length, 1, "model has 1 entry");
        assert.strictEqual(aData[0].type, "info");
        assert.strictEqual(aData[0].message, "Via log()");
        assert.ok(aData[0].timestamp, "timestamp is auto-generated");
    });

    QUnit.test("log() entry appears in DOM via ECD path", function (assert) {
        this.oTerminal.log("success", "Rendered");
        assert.strictEqual(this.oTerminal.getEntries().length, 1);
        assert.strictEqual(domEntryCount(this.oTerminal), 1);
    });

    QUnit.test("clear() empties the model when binding is active", function (assert) {
        this.oTerminal.log("info", "A");
        this.oTerminal.log("info", "B");
        assert.strictEqual(this.oModel.getProperty("/logEntries").length, 2);

        this.oTerminal.clear();
        assert.strictEqual(this.oModel.getProperty("/logEntries").length, 0, "model cleared");
        assert.strictEqual(this.oTerminal.getEntries().length, 0, "aggregation cleared");
        assert.strictEqual(getPre(this.oTerminal).childNodes.length, 0, "DOM cleared");
    });

    // ── Module: connectSource() with Active Binding ──────────────────────

    QUnit.module("Reactive Source with Active Binding", {
        beforeEach: function () {
            this.oModel = new JSONModel({ logEntries: [] });
            this.oTerminal = createTerminal();
            this.oTerminal.setModel(this.oModel);
            this.oTerminal.bindEntries({
                path: "/logEntries",
                template: new EventLogEntry({
                    type: "{type}",
                    message: "{message}",
                    timestamp: "{timestamp}",
                }),
            });
            sap.ui.getCore().applyChanges();
            this.oSource = new EventProvider();
        },
        afterEach: function () {
            this.oTerminal.destroy();
            this.oModel.destroy();
            this.oSource.destroy();
        },
    });

    QUnit.test("connectSource events flow through model when binding is active", function (assert) {
        this.oTerminal.connectSource(this.oSource, {
            ping: { type: "input", message: "Ping sent" },
        });
        this.oSource.fireEvent("ping");

        assert.strictEqual(this.oModel.getProperty("/logEntries").length, 1, "model updated");
        assert.strictEqual(this.oTerminal.getEntries().length, 1, "aggregation updated");
        assert.strictEqual(domEntryCount(this.oTerminal), 1, "DOM updated");
    });

    // ── Module: Lifecycle ────────────────────────────────────────────────

    QUnit.module("Lifecycle");

    QUnit.test("destroy() disconnects all sources", function (assert) {
        const oTerminal = createTerminal();
        const oSource = new EventProvider();
        oTerminal.connectSource(oSource, { evt: "info" });

        oTerminal.destroy();

        // Source should no longer have the terminal's handler attached
        oSource.fireEvent("evt");
        // No error thrown — handlers were cleaned up
        assert.ok(true, "no error after firing event on disconnected source");
        oSource.destroy();
    });

    QUnit.test("log() before rendering does not throw", function (assert) {
        const oTerminal = new EventLogTerminal();
        oTerminal.log("info", "Before render");
        assert.strictEqual(oTerminal.getEntries().length, 1, "entry added to aggregation");
        // Not placed — no DOM ref, but no error
        oTerminal.destroy();
    });

    QUnit.test("entries added before rendering appear after placeAt", function (assert) {
        const oTerminal = new EventLogTerminal();
        oTerminal.log("info", "Pre-render A");
        oTerminal.log("success", "Pre-render B");
        oTerminal.placeAt("uiArea");
        sap.ui.getCore().applyChanges();

        assert.strictEqual(domEntryCount(oTerminal), 2, "both entries rendered");
        oTerminal.destroy();
    });
});
