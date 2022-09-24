sap.ui.define([], () => {
	"use strict";

	/**
	 * Enum for the possible Actions that can be executed via PCPWS coming from the Backend.
	 *
	 * These need to be in sync with what can be send from the Backend.
	 *
	 * @public
	 * @enum {string}
	 */
	return Object.freeze({
		/**
		 * @public
		 */
		SOME_ACTION: "some-action",
		/**
		 * @public
		 */
		PING_PONG: "pingpong",
	});
});