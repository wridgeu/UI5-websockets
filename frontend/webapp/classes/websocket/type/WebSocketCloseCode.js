sap.ui.define([], () => {
	"use strict";

	/**
	 * Enum for the possible reasons a WebSocket connection could be closed.
	 *
	 * @see {@link https://www.rfc-editor.org/rfc/rfc6455|RFC}
	 * @see {@link https://www.iana.org/assignments/websocket/websocket.xhtml|RFC}
	 *
	 * @public
	 * @enum {string}
	 */
	return Object.freeze({
		/**
		 * @public
		 */
		NORMAL_CLOSURE: 1000,
		/**
		 * @public
		 */
		CLOSED_ABNORMALLY: 1006,
	});
});