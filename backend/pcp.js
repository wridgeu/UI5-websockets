/**
 * Push Channel Protocol (PCP) v1.0 encoder/decoder.
 *
 * Implementation of the wire format described in
 * https://community.sap.com/t5/application-development-and-automation-blog-posts/specification-of-the-push-channel-protocol-pcp/ba-p/13137541
 *
 * Wire format (LF = `\n`, 0x0A):
 *
 *     pcp-action:MESSAGE
 *     pcp-body-type:text
 *     <field>:<value>
 *     ...
 *     <LF>
 *     <body>
 *
 * Header and body are separated by a blank line (LFLF). Field names and
 * values are UTF-8 and case-sensitive. The characters `\`, `:` and LF inside
 * names/values are escaped as `\\`, `\:` and `\n` respectively.
 *
 * The encoding produced here is byte-compatible with `sap.ui.core.ws.SapPcpWebSocket`
 * so the same frames can be exchanged in both directions without translation.
 */

const SEPARATOR = '\n\n';
const PCP_ACTION = 'pcp-action';
const PCP_BODY_TYPE = 'pcp-body-type';
const DEFAULT_ACTION = 'MESSAGE';
const DEFAULT_BODY_TYPE = 'text';

/**
 * Escape a header name or value per the PCP spec.
 *
 * @param {string} value
 * @returns {string}
 */
function escape(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/\n/g, '\\n');
}

/**
 * Unescape a header name or value per the PCP spec.
 *
 * Uses a placeholder (U+0008) to avoid double-substitution of `\\` sequences,
 * matching the approach used by SapPcpWebSocket.
 *
 * @param {string} value
 * @returns {string}
 */
function unescape(value) {
  const parts = value.split('\u0008');
  for (let i = 0; i < parts.length; i++) {
    parts[i] = parts[i].replace(/\\\\/g, '\u0008').replace(/\\:/g, ':').replace(/\\n/g, '\n').replace(/\u0008/g, '\\');
  }
  return parts.join('\u0008');
}

/**
 * Same regex SapPcpWebSocket uses to extract `name:value` pairs from a header line.
 * Captures key and value while honoring backslash escapes.
 */
const FIELD_REGEX = /((?:[^:\\]|(?:\\.))+):((?:[^:\\\n]|(?:\\.))*)/;

/**
 * Encode a PCP message into its wire string.
 *
 * `pcp-action` and `pcp-body-type` are emitted first, in that order, even if
 * the caller passes them inside `fields` (any `pcp-*` entry in `fields` is
 * ignored — they are reserved per spec).
 *
 * @param {object} [options]
 * @param {string} [options.action="MESSAGE"]    Value for `pcp-action`.
 * @param {string} [options.bodyType="text"]     Value for `pcp-body-type` (`text` or `binary`).
 * @param {Record<string,string>} [options.fields] Additional, application-defined fields.
 * @param {string} [options.body=""]             Message body. For binary content, pre-encode to Base64 and pass `bodyType: "binary"`.
 * @returns {string}
 */
function encode({ action = DEFAULT_ACTION, bodyType = DEFAULT_BODY_TYPE, fields = {}, body = '' } = {}) {
  let header = `${PCP_ACTION}:${escape(action)}\n${PCP_BODY_TYPE}:${escape(bodyType)}\n`;
  for (const [name, value] of Object.entries(fields)) {
    if (name.startsWith('pcp-')) continue;
    header += `${escape(name)}:${escape(value)}\n`;
  }
  return header + '\n' + body;
}

/**
 * Decode a PCP wire string into its parts.
 *
 * The returned `pcpFields` is a flat key/value map containing **all** header
 * fields including `pcp-action` and `pcp-body-type` (matching what
 * SapPcpWebSocket exposes to its `message` event listeners).
 *
 * If no header/body separator (LFLF) is present, the input is treated as a
 * body-only message with empty `pcpFields` — same fallback as SapPcpWebSocket.
 *
 * @param {string} text
 * @returns {{ pcpFields: Record<string,string>, body: string }}
 */
function decode(text) {
  const splitPos = text.indexOf(SEPARATOR);
  if (splitPos === -1) {
    return { pcpFields: {}, body: text };
  }
  const headerPart = text.substring(0, splitPos);
  const body = text.substring(splitPos + SEPARATOR.length);
  const pcpFields = {};
  for (const line of headerPart.split('\n')) {
    const match = line.match(FIELD_REGEX);
    if (match && match.length === 3) {
      pcpFields[unescape(match[1])] = unescape(match[2]);
    }
  }
  return { pcpFields, body };
}

/** WebSocket subprotocol identifier for PCP v1.0. */
const SUBPROTOCOL = 'v10.pcp.sap.com';

export { encode, decode, escape, unescape, SUBPROTOCOL };
