import js from "@eslint/js";
import globals from "globals";

export default [
    js.configs.recommended,
    {
        files: ["frontend/webapp/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "script",
            globals: {
                ...globals.browser,
                sap: "readonly",
                jQuery: "readonly",
            },
        },
        rules: {
            "array-callback-return": "error",
            "camelcase": ["warn"],
            "consistent-return": "warn",
            "default-case": "warn",
            "default-param-last": "error",
            "eqeqeq": "error",
            "id-length": "off",
            "max-lines": [
                "warn",
                {
                    "max": 500,
                    "skipBlankLines": true,
                    "skipComments": true,
                },
            ],
            "new-cap": "warn",
            "no-array-constructor": "error",
            "no-object-constructor": "error",
            "no-console": "error",
            "no-debugger": "error",
            "no-eval": "error",
            "no-else-return": "warn",
            "no-loop-func": "error",
            "no-new-func": "error",
            "no-new-wrappers": "error",
            "no-prototype-builtins": "error",
            "no-shadow": "error",
            "no-undef": "error",
            "no-unused-vars": "error",
            "no-var": "error",
            "no-warning-comments": "warn",
            "prefer-const": "error",
            "prefer-object-spread": "error",
            "prefer-template": "error",
            "radix": "off",
        },
    },
    {
        files: ["backend/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
            },
        },
    },
    {
        ignores: [
            "templates/",
            "deployer/resources/",
            "node_modules/",
            "approuter/webapp/",
            "frontend/webapp/utils/locate-reuse-libs.js",
        ],
    },
];
