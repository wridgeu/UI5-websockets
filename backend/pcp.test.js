import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, escape, unescape, SUBPROTOCOL } from './pcp.js';

describe('pcp.encode', () => {
  it('emits the spec example with two custom fields and a text body', () => {
    const wire = encode({
      fields: { field1: 'value1', field2: 'value2' },
      body: 'this is the body !',
    });
    assert.equal(
      wire,
      'pcp-action:MESSAGE\npcp-body-type:text\nfield1:value1\nfield2:value2\n\nthis is the body !',
    );
  });

  it('defaults to action MESSAGE and bodyType text', () => {
    const wire = encode({ body: 'hi' });
    assert.equal(wire, 'pcp-action:MESSAGE\npcp-body-type:text\n\nhi');
  });

  it('supports an empty body', () => {
    const wire = encode({ fields: { a: '1' } });
    assert.equal(wire, 'pcp-action:MESSAGE\npcp-body-type:text\na:1\n\n');
  });

  it('ignores reserved pcp-* keys passed in fields', () => {
    const wire = encode({
      fields: { 'pcp-action': 'OVERRIDE', 'pcp-body-type': 'binary', a: '1' },
      body: 'x',
    });
    assert.equal(wire, 'pcp-action:MESSAGE\npcp-body-type:text\na:1\n\nx');
  });

  it('escapes backslash, colon and LF in field names and values', () => {
    const wire = encode({
      fields: { 'weird:name': 'v\nwith\\colon:and-lf' },
      body: 'b',
    });
    assert.equal(
      wire,
      'pcp-action:MESSAGE\npcp-body-type:text\nweird\\:name:v\\nwith\\\\colon\\:and-lf\n\nb',
    );
  });

  it('throws on empty field names rather than emitting an unparseable line', () => {
    assert.throws(
      () => encode({ fields: { '': 'v' }, body: 'b' }),
      /PCP field names must be non-empty/,
    );
  });

  it('does not let a fields entry override pcp-body-type', () => {
    const wire = encode({ fields: { 'pcp-body-type': 'binary' }, body: 'x' });
    // pcp-body-type stays at the default `text` and the override is dropped
    assert.equal(wire, 'pcp-action:MESSAGE\npcp-body-type:text\n\nx');
  });
});

describe('pcp.decode', () => {
  it('parses the spec example', () => {
    const { pcpFields, body } = decode(
      'pcp-action:MESSAGE\npcp-body-type:text\nfield1:value1\nfield2:value2\n\nthis is the body !',
    );
    assert.deepEqual(pcpFields, {
      'pcp-action': 'MESSAGE',
      'pcp-body-type': 'text',
      field1: 'value1',
      field2: 'value2',
    });
    assert.equal(body, 'this is the body !');
  });

  it('falls back to a body-only message when no separator is present', () => {
    const { pcpFields, body } = decode('plain text without headers');
    assert.deepEqual(pcpFields, {});
    assert.equal(body, 'plain text without headers');
  });

  it('handles an empty body', () => {
    const { pcpFields, body } = decode('pcp-action:MESSAGE\npcp-body-type:text\n\n');
    assert.deepEqual(pcpFields, { 'pcp-action': 'MESSAGE', 'pcp-body-type': 'text' });
    assert.equal(body, '');
  });

  it('unescapes backslash, colon and LF sequences in fields', () => {
    const { pcpFields } = decode(
      'pcp-action:MESSAGE\npcp-body-type:text\nweird\\:name:v\\nwith\\\\colon\\:and-lf\n\n',
    );
    assert.equal(pcpFields['weird:name'], 'v\nwith\\colon:and-lf');
  });

  it('returns the body verbatim even when it contains an LFLF', () => {
    const { pcpFields, body } = decode(
      'pcp-action:MESSAGE\npcp-body-type:text\nfoo:bar\n\nfirst paragraph\n\nsecond paragraph',
    );
    assert.equal(pcpFields.foo, 'bar');
    assert.equal(body, 'first paragraph\n\nsecond paragraph');
  });

  it('skips header lines that have no colon', () => {
    const { pcpFields, body } = decode(
      'pcp-action:MESSAGE\npcp-body-type:text\nrubbish\nfoo:bar\n\nbody',
    );
    assert.deepEqual(pcpFields, {
      'pcp-action': 'MESSAGE',
      'pcp-body-type': 'text',
      foo: 'bar',
    });
    assert.equal(body, 'body');
  });

  it('handles a completely empty input', () => {
    const { pcpFields, body } = decode('');
    assert.deepEqual(pcpFields, {});
    assert.equal(body, '');
  });

  it('handles an LFLF at position 0 (empty headers, body present)', () => {
    const { pcpFields, body } = decode('\n\nbody');
    assert.deepEqual(pcpFields, {});
    assert.equal(body, 'body');
  });
});

describe('pcp round-trip', () => {
  const cases = [
    { fields: {}, body: '' },
    { fields: { a: '1' }, body: 'hello' },
    { fields: { foo: 'bar', baz: 'qux' }, body: 'multi field' },
    { fields: { 'name with spaces': 'value with spaces' }, body: 'ok' },
    { fields: { tricky: 'a\\b:c\nd' }, body: 'edge' },
    { fields: { utf8: 'héllo wörld 🚀' }, body: 'ünicödé 💡' },
  ];
  for (const c of cases) {
    it(`survives encode→decode for ${JSON.stringify(c)}`, () => {
      const { pcpFields, body } = decode(encode(c));
      assert.equal(body, c.body);
      for (const [k, v] of Object.entries(c.fields)) {
        assert.equal(pcpFields[k], v);
      }
      assert.equal(pcpFields['pcp-action'], 'MESSAGE');
      assert.equal(pcpFields['pcp-body-type'], 'text');
      // Exactly the custom fields plus pcp-action and pcp-body-type;
      // anything else is accidental pollution.
      assert.equal(Object.keys(pcpFields).length, Object.keys(c.fields).length + 2);
    });
  }

  it('round-trips a 50KB body', () => {
    const body = 'x'.repeat(50 * 1024);
    const decoded = decode(encode({ fields: { size: '50k' }, body }));
    assert.equal(decoded.body, body);
    assert.equal(decoded.pcpFields.size, '50k');
  });
});

describe('pcp helpers', () => {
  it('escape and unescape are inverses for tricky strings', () => {
    const inputs = ['', 'plain', 'a:b', 'a\\b', 'a\nb', 'a\\:b\\\\c\\nd', ':::', '\\\\\\'];
    for (const s of inputs) {
      assert.equal(unescape(escape(s)), s);
    }
  });

  it('exposes the v1.0 subprotocol identifier', () => {
    assert.equal(SUBPROTOCOL, 'v10.pcp.sap.com');
  });
});
