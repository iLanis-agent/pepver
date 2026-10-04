(function (root) {
  'use strict';
  // PEP 440 public/local version with the normalizations from the "Normalization" section.
  var RE = new RegExp('^v?(?:(?:([0-9]+)!)?([0-9]+(?:\\.[0-9]+)*)([-_.]?(alpha|a|beta|b|preview|pre|c|rc)[-_.]?([0-9]+)?)?((?:-([0-9]+))|(?:[-_.]?(post|rev|r)[-_.]?([0-9]+)?))?([-_.]?(dev)[-_.]?([0-9]+)?)?)(?:\\+([a-z0-9]+(?:[-_.][a-z0-9]+)*))?$', 'i');
  var PRE = { alpha: 'a', a: 'a', beta: 'b', b: 'b', c: 'rc', pre: 'rc', preview: 'rc', rc: 'rc' };
  function parse(input) {
    var s = String(input).replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, ''), m = RE.exec(s);
    if (!m) return null;
    var v = { epoch: m[1] ? parseInt(m[1], 10) : 0, epochExplicit: !!m[1], release: m[2].split('.').map(function (x) { return parseInt(x, 10); }), pre: null, post: null, dev: null, local: null };
    if (m[3]) v.pre = [PRE[m[4].toLowerCase()], m[5] ? parseInt(m[5], 10) : 0];
    if (m[6]) v.post = m[7] !== undefined ? parseInt(m[7], 10) : (m[9] ? parseInt(m[9], 10) : 0);
    if (m[10]) v.dev = m[12] ? parseInt(m[12], 10) : 0;
    if (m[13]) v.local = m[13].toLowerCase().split(/[-_.]/).map(function (x) { return /^[0-9]+$/.test(x) ? parseInt(x, 10) : x; });
    return v;
  }
  function pub(v) {
    var s = (v.epoch ? v.epoch + '!' : '') + v.release.join('.');
    if (v.pre) s += v.pre[0] + v.pre[1]; if (v.post !== null) s += '.post' + v.post; if (v.dev !== null) s += '.dev' + v.dev; return s;
  }
  function str(v) { return pub(v) + (v.local ? '+' + v.local.join('.') : ''); }
  function stripZeros(r) { var a = r.slice(); while (a.length > 1 && a[a.length - 1] === 0) a.pop(); return a; }
  function cmpArr(a, b) { var n = Math.max(a.length, b.length); for (var i = 0; i < n; i++) { var x = a[i] === undefined ? -Infinity : a[i], y = b[i] === undefined ? -Infinity : b[i]; if (x !== y) return x < y ? -1 : 1; } return 0; }
  function localKey(l) { return l === null ? null : l.map(function (x) { return typeof x === 'number' ? [1, x, ''] : [0, 0, x]; }); }
  function cmpLocal(a, b) {
    if (a === null && b === null) return 0; if (a === null) return -1; if (b === null) return 1;
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) { if (a[i] === undefined) return -1; if (b[i] === undefined) return 1; var x = typeof a[i] === 'number', y = typeof b[i] === 'number';
      if (x !== y) return x ? 1 : -1; if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; }
    return 0;
  }
  // Ordering: epoch, release (trailing zeros ignored), then a dev-only release sorts before pre-releases, pre < final, post after, dev before its non-dev, local last.
  function key(v) {
    var pre = v.pre ? [0, v.pre[0] === 'a' ? 0 : v.pre[0] === 'b' ? 1 : 2, v.pre[1]] : (v.post === null && v.dev !== null ? [-1, 0, 0] : [1, 0, 0]);
    return { epoch: v.epoch, rel: stripZeros(v.release), pre: pre, post: v.post === null ? -1 : v.post, dev: v.dev === null ? Infinity : v.dev, local: v.local };
  }
  function cmp(a, b) {
    var x = key(a), y = key(b); if (x.epoch !== y.epoch) return x.epoch < y.epoch ? -1 : 1;
    var c = cmpArr(x.rel, y.rel); if (c) return c; c = cmpArr(x.pre, y.pre); if (c) return c;
    if (x.post !== y.post) return x.post < y.post ? -1 : 1; if (x.dev !== y.dev) return x.dev < y.dev ? -1 : 1; return cmpLocal(x.local, y.local);
  }
  function isPre(v) { return v.pre !== null || v.dev !== null; }
  function base(v) { return { epoch: v.epoch, release: v.release, pre: null, post: null, dev: null, local: null }; }
  function withoutLocal(v) { var c = Object.assign({}, v); c.local = null; return c; }
  // Specifier clause: operator + version, with a trailing .* allowed for == and !=
  function parseSpec(text) {
    var m = /^\s*(===|==|!=|~=|<=|>=|<|>)\s*(\S.*?)\s*$/.exec(text); if (!m) return { error: 'Expected an operator (==, !=, ~=, <=, >=, <, >, ===) followed by a version.' };
    var op = m[1], vs = m[2];
    if (op === '===') return { op: op, raw: vs };
    var wild = false; if (/\.\*$/.test(vs)) { if (op !== '==' && op !== '!=') return { error: 'A trailing .* is only allowed with == and !=.' }; wild = true; vs = vs.slice(0, -2); }
    var v = parse(vs); if (!v) return { error: '"' + vs + '" is not a valid PEP 440 version.' };
    if (wild && (v.dev !== null || v.local)) return { error: 'A prefix match cannot contain a development or local segment.' };
    if (wild && (v.pre || v.post !== null)) return { error: 'The packaging library only accepts .* after a plain release number (such as 1.1.*), so this clause is rejected there.' };
    if (op === '~=' && v.release.length < 2) return { error: '~= needs at least two release segments, so ~=1 is invalid.' };
    if (op !== '==' && op !== '!=' && op !== '===' && v.local) return { error: 'Local versions are not allowed with ' + op + '.' };
    return { op: op, v: v, wild: wild };
  }
  function prefixMatch(c, spec) {
    if (c.epoch !== spec.epoch) return false; var n = spec.release.length, r = c.release.slice(0, n); while (r.length < n) r.push(0);
    for (var i = 0; i < n; i++) if (r[i] !== spec.release[i]) return false;
    if (spec.pre || spec.post !== null) { /* prefix with suffix: compare those too */ if (JSON.stringify(spec.pre) !== JSON.stringify(c.pre)) return false; if (spec.post !== null && spec.post !== c.post) return false; }
    return true;
  }
  // matches(spec, candidate): the PEP's rules, with local labels ignored unless the spec names one.
  function matches(spec, c, opts) {
    var res;
    if (spec.op === '===') return str(c) === spec.raw.toLowerCase();
    var s = spec.v;
    if (spec.op === '==' || spec.op === '!=') {
      if (spec.wild) res = prefixMatch(c, s);
      else if (s.local) res = cmp(c, s) === 0; else res = cmp(withoutLocal(c), s) === 0;
      if (spec.op === '!=') res = !res; return res;
    }
    if (spec.op === '>=') return cmp(withoutLocal(c), s) >= 0;
    if (spec.op === '<=') return cmp(withoutLocal(c), s) <= 0;
    if (spec.op === '<') { if (cmp(c, s) >= 0) return false; if (!isPre(s) && isPre(c) && cmp(base(c), base(s)) === 0) return false; return true; }
    if (spec.op === '>') { if (cmp(c, s) <= 0) return false; if (s.post === null && c.post !== null && cmp(base(c), base(s)) === 0) return false; if (c.local !== null && cmp(base(c), base(s)) === 0) return false; return true; }
    if (spec.op === '~=') { var prefix = { epoch: s.epoch, release: s.release.slice(0, -1), pre: null, post: null, dev: null, local: null }; return cmp(withoutLocal(c), s) >= 0 && prefixMatch(c, prefix); }
    return false;
  }
  var api = { parse: parse, str: str, pub: pub, cmp: cmp, isPre: isPre, parseSpec: parseSpec, matches: matches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PepVer = api;
})(typeof window !== 'undefined' ? window : this);
