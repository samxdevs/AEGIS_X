/* Minimal Design-Components runtime — enough to render .dc.html artboards in a
   plain browser for screenshots. Not the real editor runtime. */
(function () {
  window.DCLogic = class DCLogic {
    constructor(props) { this.props = props || {}; }
    setState(patch) {
      this.state = Object.assign({}, this.state, patch);
      if (this._rerender) this._rerender();
    }
    forceUpdate() { if (this._rerender) this._rerender(); }
  };

  var HOLE = /\{\{([^}]+)\}\}/g;

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.');
    var v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }

  // Whole-value hole -> raw value; otherwise interpolate to a string.
  function resolve(str, scope) {
    var whole = str.match(/^\s*\{\{([^}]+)\}\}\s*$/);
    if (whole) return lookup(whole[1], scope);
    return str.replace(HOLE, function (_, p) {
      var v = lookup(p, scope);
      return v == null ? '' : String(v);
    });
  }

  function processNodes(parent, scope) {
    var kids = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < kids.length; i++) processNode(kids[i], scope);
  }

  function processNode(node, scope) {
    if (node.nodeType === 3) {
      if (node.nodeValue.indexOf('{{') !== -1) node.nodeValue = resolve(node.nodeValue, scope);
      return;
    }
    if (node.nodeType !== 1) return;

    var tag = (node.tagName || '').toLowerCase();

    if (tag === 'sc-for') {
      var list = resolve(node.getAttribute('list') || '', scope) || [];
      var as = node.getAttribute('as') || 'item';
      var frag = document.createDocumentFragment();
      for (var i = 0; i < list.length; i++) {
        var childScope = Object.create(scope);
        childScope[as] = list[i];
        childScope.$index = i;
        var kids = Array.prototype.slice.call(node.childNodes);
        for (var k = 0; k < kids.length; k++) {
          var clone = kids[k].cloneNode(true);
          processNode(clone, childScope);
          frag.appendChild(clone);
        }
      }
      node.parentNode.replaceChild(frag, node);
      return;
    }

    if (tag === 'sc-if') {
      var val = resolve(node.getAttribute('value') || '', scope);
      if (val) {
        var frag2 = document.createDocumentFragment();
        var kids2 = Array.prototype.slice.call(node.childNodes);
        for (var j = 0; j < kids2.length; j++) {
          processNode(kids2[j], scope);
          frag2.appendChild(kids2[j]);
        }
        node.parentNode.replaceChild(frag2, node);
      } else {
        node.parentNode.removeChild(node);
      }
      return;
    }

    var attrs = Array.prototype.slice.call(node.attributes || []);
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, value = attrs[a].value;
      if (value.indexOf('{{') === -1) continue;
      var out = resolve(value, scope);
      if (/^on[A-Z]/.test(name) || /^on[a-z]+$/.test(name)) {
        node.removeAttribute(name);
        if (typeof out === 'function') {
          node.addEventListener(name.slice(2).toLowerCase(), out);
        }
      } else {
        node.setAttribute(name, out == null ? '' : String(out));
      }
    }

    processNodes(node, scope);
  }

  function boot() {
    var style = document.createElement('style');
    style.textContent = 'x-dc{display:block}helmet{display:none}';
    document.head.appendChild(style);

    var helmet = document.querySelector('helmet');
    if (helmet) {
      while (helmet.firstChild) document.head.appendChild(helmet.firstChild);
      helmet.parentNode.removeChild(helmet);
    }

    var root = document.querySelector('x-dc');
    if (!root) return;
    var TEMPLATE = root.innerHTML;

    var scriptEl = document.querySelector('script[data-dc-script]');
    var props = {};
    var inst = null;

    if (scriptEl) {
      var raw = scriptEl.getAttribute('data-props');
      if (raw) {
        try {
          var spec = JSON.parse(raw);
          for (var key in spec) {
            if (key.charAt(0) === '$') continue;
            if (spec[key] && 'default' in spec[key]) props[key] = spec[key]['default'];
          }
        } catch (e) { console.warn('data-props parse failed', e); }
      }
      try {
        var Cls = (0, eval)(scriptEl.textContent + '\n;Component');
        inst = new Cls(props);
      } catch (e) { console.error('component eval failed', e); }
    }

    function render() {
      var vals = {};
      if (inst && typeof inst.renderVals === 'function') {
        try { vals = inst.renderVals() || {}; } catch (e) { console.error('renderVals failed', e); }
      }
      var holder = document.createElement('div');
      holder.innerHTML = TEMPLATE;
      processNodes(holder, vals);
      root.innerHTML = '';
      while (holder.firstChild) root.appendChild(holder.firstChild);
    }

    if (inst) inst._rerender = render;
    render();
    document.documentElement.setAttribute('data-dc-ready', '1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
