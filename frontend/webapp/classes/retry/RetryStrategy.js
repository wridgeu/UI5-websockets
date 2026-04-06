/**
 * RetryStrategy
 * @author Marco Beier
 *
 * A reusable exponential backoff retry strategy for scheduling reconnection attempts
 * or any other operation that should be retried with increasing delays.
 *
 * How it works:
 * On each call to `schedule()`, the internal delay doubles (starting from `initialDelay`)
 * until it reaches `maxDelay`. A random jitter (between 0 and `maxJitter` ms) is added
 * to each delay to prevent multiple clients from retrying at the exact same time
 * (the "thundering herd" problem). After `maxAttempts` retries, `schedule()` returns
 * `false` and no further retries are made.
 *
 * Calling `reset()` restores the strategy to its initial state. This should be done
 * after a successful connection so the next failure starts fresh.
 *
 * Usage example:
 * ```js
 * const retry = new RetryStrategy({ initialDelay: 1000, maxAttempts: 5 });
 *
 * function onConnectionLost() {
 *     const scheduled = retry.schedule(() => reconnect());
 *     if (!scheduled) {
 *         Log.warning("Giving up after max attempts.");
 *     }
 * }
 *
 * function onConnectionEstablished() {
 *     retry.reset();
 * }
 * ```
 *
 * @see {@link https://en.wikipedia.org/wiki/Exponential_backoff|Wikipedia - Exponential Backoff}
 * @see {@link https://dev.to/jeroendk/how-to-implement-a-random-exponential-backoff-algorithm-in-javascript-18n6|Dev.to}
 * @see {@link https://advancedweb.hu/how-to-implement-an-exponential-backoff-retry-strategy-in-javascript/|Advanced Web}
 */
sap.ui.define(["sap/ui/base/Object"], (BaseObject) => {
    "use strict";

    /**
     * @typedef {object} org.mrb.ui5websockets.classes.retry.RetryStrategySettings
     * @property {number} [initialDelay=1000] Starting delay in ms before the first retry
     * @property {number} [maxDelay=16000] Upper bound for the delay in ms (delay stops doubling beyond this)
     * @property {number} [maxAttempts=10] Maximum number of retry attempts before giving up
     * @property {number} [maxJitter=3000] Maximum random jitter in ms added to each delay
     */

    return BaseObject.extend(
        "org.mrb.ui5websockets.classes.retry.RetryStrategy",
        /** @lends org.mrb.ui5websockets.classes.retry.RetryStrategy.prototype */ {
            /**
             * Creates a new RetryStrategy instance.
             *
             * All settings are optional and fall back to sensible defaults if omitted.
             *
             * @param {org.mrb.ui5websockets.classes.retry.RetryStrategySettings} [settings] Configuration
             * @see sap.ui.base.Object#constructor
             * @override
             * @public
             * @constructor
             */
            constructor: function (settings) {
                BaseObject.constructor.apply(this);

                const config = {
                    initialDelay: 1000,
                    maxDelay: 16000,
                    maxAttempts: 10,
                    maxJitter: 3000,
                    ...settings,
                };

                /** @private */
                this._initialDelay = config.initialDelay;
                /** @private */
                this._maxDelay = config.maxDelay;
                /** @private */
                this._maxAttempts = config.maxAttempts;
                /** @private */
                this._maxJitter = config.maxJitter;
                /** @private */
                this._currentDelay = this._initialDelay;
                /** @private */
                this._attempts = 0;
                /** @private */
                this._timeout = null;
            },

            /**
             * Schedule a retry attempt.
             *
             * Doubles the current delay (up to `maxDelay`), adds random jitter, increments the
             * attempt counter, and calls `fn` after the computed delay.
             *
             * @param {function} fn The function to call after the backoff delay
             * @returns {boolean} `true` if the retry was scheduled, `false` if max attempts have been reached
             * @public
             */
            schedule(fn) {
                if (this._attempts >= this._maxAttempts) {
                    this.reset();
                    return false;
                }

                if (this._currentDelay < this._maxDelay) {
                    this._currentDelay *= 2;
                }

                this._attempts++;

                const delay = this._currentDelay + Math.floor(Math.random() * this._maxJitter);
                this._timeout = setTimeout(fn, delay);
                return true;
            },

            /**
             * Reset the strategy to its initial state.
             *
             * Call this after a successful connection so the next failure
             * starts with the initial delay and zero attempts.
             * Also cancels any currently pending retry timeout.
             *
             * @public
             */
            reset() {
                this._currentDelay = this._initialDelay;
                this._attempts = 0;
                clearTimeout(this._timeout);
                this._timeout = null;
            },

            /**
             * Cancel any pending retry timeout without resetting the attempt counter or delay.
             *
             * Useful when the connection is being intentionally closed (e.g. user-initiated)
             * and you don't want the pending retry to fire, but also don't need to reset
             * the backoff state.
             *
             * @public
             */
            cancel() {
                clearTimeout(this._timeout);
                this._timeout = null;
            },

            /**
             * Returns the current attempt count.
             *
             * @returns {number} Number of retry attempts made since last reset
             * @public
             */
            getAttempts() {
                return this._attempts;
            },

            /**
             * Cleanup internals.
             *
             * The object must not be used anymore after destroy was called.
             *
             * @see sap.ui.base.Object#destroy
             * @public
             */
            destroy() {
                this.cancel();
                BaseObject.prototype.destroy.apply(this);
            },
        },
    );
});
