'use strict';
var P = require('./engine.js'), cp = require('child_process');
var checks = 0, fails = 0, report = [];
function eq(a, b, m) { checks++; if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; if (fails < 30) console.log('FAIL', m, JSON.stringify(a), '!=', JSON.stringify(b)); } }
function run(input) { return JSON.parse(cp.execFileSync('python3', ['oracle.py'], { input: JSON.stringify(input), maxBuffer: 1 << 28, cwd: __dirname }).toString()); }
// 1. Facts from PEP 440 (fetched): normalization examples, ordering examples, clause examples
var N = { '1.1RC1': '1.1rc1', '00': '0', '09000': '9000', '1.1.a1': '1.1a1', '1.1-a1': '1.1a1', '1.1alpha1': '1.1a1', '1.1beta2': '1.1b2', '1.1c3': '1.1rc3', '1.2a': '1.2a0', '1.2-post2': '1.2.post2', '1.2post2': '1.2.post2', '1.0-r4': '1.0.post4', '1.2.post': '1.2.post0', '1.0-1': '1.0.post1', '1.2-dev2': '1.2.dev2', '1.2.dev': '1.2.dev0', '1.0+ubuntu-1': '1.0+ubuntu.1', 'v1.0': '1.0', '1.0\n': '1.0' };
Object.keys(N).forEach(function (k) { eq(P.str(P.parse(k)), N[k], 'normalize ' + JSON.stringify(k)); });
var order = ['1.0.dev456', '1.0a1', '1.0a2.dev456', '1.0a12.dev456', '1.0a12', '1.0b1.dev456', '1.0b2', '1.0b2.post345.dev456', '1.0b2.post345', '1.0rc1.dev456', '1.0rc1', '1.0', '1.0+abc.5', '1.0+abc.7', '1.0+5', '1.0.post456.dev34', '1.0.post456', '1.1.dev1'];
for (var i = 0; i + 1 < order.length; i++) eq(P.cmp(P.parse(order[i]), P.parse(order[i + 1])), -1, 'PEP order ' + order[i] + ' < ' + order[i + 1]);
eq(P.cmp(P.parse('2014.04'), P.parse('1!1.0')), -1, 'epoch'); eq(P.cmp(P.parse('1.0'), P.parse('1.0.0')), 0, 'zero padding');
function m(spec, v) { return P.matches(P.parseSpec(spec), P.parse(v)); }
eq(m('==1.1', '1.1.post1'), false, '== 1.1 vs 1.1.post1'); eq(m('==1.1.*', '1.1.post1'), true, '== 1.1.* vs 1.1.post1'); eq(m('==1.1.0', '1.1'), true, 'zero pad =='); eq(m('==1.1.dev1', '1.1'), false, '== dev');
eq(m('!=1.1.*', '1.1.post1'), false, '!= wildcard'); eq(m('>1.7', '1.7.0.post1'), false, '>1.7 excludes post'); eq(m('>1.7', '1.7.1'), true, '>1.7 allows 1.7.1'); eq(m('>1.7.post2', '1.7.0.post3'), true, '>1.7.post2'); eq(m('>1.7.post2', '1.7.0'), false, '>1.7.post2 vs 1.7.0');
eq(m('<1.7', '1.7rc1'), false, '<1.7 excludes pre'); eq(m('<1.7.rc2', '1.7rc1'), true, '<1.7rc2'); eq(m('~=2.2', '2.9'), true, '~=2.2'); eq(m('~=2.2', '3.0'), false, '~=2.2 3.0'); eq(m('~=1.4.5', '1.4.9'), true, '~=1.4.5'); eq(m('~=1.4.5', '1.5.0'), false, '~=1.4.5 1.5'); eq(m('~=1.4.5.0', '1.4.5.9'), true, '~=1.4.5.0');
eq(m('==1.0', '1.0+downstream1'), true, 'local ignored'); eq(m('===1.0', '1.0+downstream1'), false, '=== strict');
eq(typeof P.parseSpec('~=1').error, 'string', '~=1 invalid'); eq(typeof P.parseSpec('==1.0.dev1.*').error, 'string', 'dev prefix invalid');
// 2. Random strings vs packaging
var seed = 21; function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function ri(n) { return Math.floor(rnd() * n); } function pick(a) { return a[ri(a.length)]; }
function num() { return pick(['0', '1', '2', '3', '10', '00', '07', '12', '100']); }
function ver() {
  var s = ''; if (rnd() < .6) s += pick(['v', 'V', ' ', '']); if (rnd() < .12) s += num() + '!';
  var n = 1 + ri(4), r = []; for (var i = 0; i < n; i++) r.push(num()); s += r.join('.');
  if (rnd() < .4) s += pick(['', '.', '-', '_']) + pick(['a', 'b', 'rc', 'c', 'alpha', 'beta', 'pre', 'preview', 'RC', 'A']) + pick(['', '', '.', '-', '_']) + pick(['', num()]);
  if (rnd() < .3) { var r2 = rnd(); s += r2 < .25 ? '-' + num() : pick(['', '.', '-', '_']) + pick(['post', 'rev', 'r', 'POST']) + pick(['', '.', '-', '_']) + pick(['', num()]); }
  if (rnd() < .3) s += pick(['', '.', '-', '_']) + 'dev' + pick(['', '.', '-', '_']) + pick(['', num()]);
  if (rnd() < .15) s += '+' + pick(['abc', 'ubuntu.1', 'a-b', '1_2', 'Local.5', 'x', '007', 'x.y.z']);
  if (rnd() < .06) s += pick(['!', ' x', '..', '-', '+', 'x1', '1.', '.1', '+_']);
  if (rnd() < .5) s += pick(['', ' ']);
  return s;
}
var NS = 6000, vs = []; for (i = 0; i < NS; i++) vs.push(ver());
var o = run(vs.map(function (s) { return { k: 'norm', s: s }; }));
var valid = [];
vs.forEach(function (s, j) { var p = P.parse(s); eq(p ? P.str(p) : 'ERR', o[j], 'normalize ' + JSON.stringify(s)); if (p) valid.push(s); });
report.push('parse and normalize: ' + NS + ' strings (' + valid.length + ' valid, ' + (NS - valid.length) + ' invalid) vs packaging.version.Version');
var NP = 8000, pairs = []; for (i = 0; i < NP; i++) pairs.push([pick(valid), pick(valid)]);
o = run(pairs.map(function (p) { return { k: 'cmp', a: p[0], b: p[1] }; }));
pairs.forEach(function (p, j) { eq(P.cmp(P.parse(p[0]), P.parse(p[1])), o[j], 'cmp ' + JSON.stringify(p)); });
report.push('ordering: ' + NP + ' random pairs vs packaging comparison');
// 3. Specifiers: package contains(prereleases=True) to test the clause semantics themselves
function simple() { var s = '', r = [], n = 1 + ri(3); for (var i = 0; i < n; i++) r.push(pick(['0', '1', '2', '3'])); s = r.join('.'); if (rnd() < .2) s += pick(['a1', 'rc1', '.dev1', '.post1', '.post2', 'b2']); return s; }
function cand() { var s = simple(); if (rnd() < .15) s += '+loc' + ri(3); return s; }
var NSP = 10000, sp = []; for (i = 0; i < NSP; i++) { var op = pick(['==', '!=', '~=', '<=', '>=', '<', '>', '===', '==', '==']), sv = simple(); if ((op === '==' || op === '!=') && rnd() < .35 && !/dev|\+/.test(sv)) sv += '.*'; if (op === '==' && rnd() < .1) sv += '+loc1'; sp.push({ spec: op + sv, v: cand() }); }
o = run(sp.map(function (x) { return { k: 'spec', spec: x.spec, v: x.v }; }));
var valids = 0, errs = 0, mism = 0;
sp.forEach(function (x, j) { var ps = P.parseSpec(x.spec), mine = ps.error ? 'ERR' : P.matches(ps, P.parse(x.v)); if (mine === o[j]) { checks++; if (o[j] === 'ERR') errs++; else valids++; } else { mism++; fails++; if (fails < 30) console.log('FAIL spec', JSON.stringify(x), mine, o[j]); checks++; } });
report.push('specifiers: ' + NSP + ' random clause/candidate pairs vs packaging Specifier.contains(prereleases=True): ' + valids + ' valid agree, ' + errs + ' invalid clauses agree, ' + mism + ' differ');
report.forEach(function (l) { console.log(l); }); console.log(checks + ' checks, ' + fails + ' failures'); process.exit(fails ? 1 : 0);
