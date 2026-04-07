sap.ui.define(function () {
    "use strict";

    return {
        name: "QUnit test suite for EventLogTerminal",
        defaults: {
            page: "ui5://test-resources/org/mrb/ui5websockets/Test.qunit.html?testsuite={suite}&test={name}",
            qunit: {
                version: 2,
            },
            sinon: {
                version: 4,
            },
            ui5: {
                theme: "sap_horizon",
            },
            coverage: {
                only: "org/mrb/ui5websockets/control/",
                never: "test-resources/org/mrb/ui5websockets/",
            },
            loader: {
                paths: {
                    "org/mrb/ui5websockets": "../",
                },
            },
        },
        tests: {
            "unit/control/EventLogTerminal": {
                title: "EventLogTerminal \u2014 Unit Tests",
            },
        },
    };
});
