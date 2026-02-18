var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target2) => {
  target2 = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target2, "default", { value: mod, enumerable: true }) : target2;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target2, all) => {
  for (var name in all)
    __defProp(target2, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// ../../../../node_modules/.bun/fflate@0.8.2/node_modules/fflate/esm/browser.js
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
var u8, u16, i32, fleb, fdeb, clim, freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0;i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1;i < 30; ++i) {
    for (var j = b[i];j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
}, _a, fl, revfl, _b, fd, revfd, rev, x, i, hMap = function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (;i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1;i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1;v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
}, flt, i, i, i, i, fdt, i, flrm, fdrm, max = function(a) {
  var m = a[0];
  for (var i2 = 1;i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
}, bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
}, bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
}, shft = function(p) {
  return (p + 7) / 8 | 0;
}, slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
}, ec, err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
}, inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0;i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0;i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (;; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (;bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (;bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
}, et, td, tds = 0;
var init_browser = __esm(() => {
  u8 = Uint8Array;
  u16 = Uint16Array;
  i32 = Int32Array;
  fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
  fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
  clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  _a = freb(fleb, 2);
  fl = _a.b;
  revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  _b = freb(fdeb, 0);
  fd = _b.b;
  revfd = _b.r;
  rev = new u16(32768);
  for (i = 0;i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  flt = new u8(288);
  for (i = 0;i < 144; ++i)
    flt[i] = 8;
  for (i = 144;i < 256; ++i)
    flt[i] = 9;
  for (i = 256;i < 280; ++i)
    flt[i] = 7;
  for (i = 280;i < 288; ++i)
    flt[i] = 8;
  fdt = new u8(32);
  for (i = 0;i < 32; ++i)
    fdt[i] = 5;
  flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
  ];
  et = /* @__PURE__ */ new u8(0);
  td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {}
});

// ../../libraries/files-state/src/download.ts
var exports_download = {};
__export(exports_download, {
  downloadFile: () => downloadFile
});
async function downloadFile(fileId, filesService, storeService) {
  console.log("[downloadFile] Starting download for:", fileId);
  const metadata5 = await filesService.get(fileId);
  console.log("[downloadFile] Metadata loaded:", metadata5);
  const chunks = await filesService.getChunks(fileId);
  console.log("[downloadFile] Chunks loaded:", chunks.length);
  chunks.sort((a, b) => a.chunkNumber - b.chunkNumber);
  const hasFileSystemAPI = "showSaveFilePicker" in window;
  if (hasFileSystemAPI) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: metadata5.name,
        types: metadata5.fileType ? [{
          description: "File",
          accept: { [metadata5.fileType]: [] }
        }] : undefined
      });
      const writable = await handle.createWritable();
      for (const chunk of chunks) {
        console.log("[downloadFile] Processing chunk:", chunk.chunkNumber);
        const rawData = await storeService.get(chunk.hash);
        const compressedData = normalizeBlockData2(rawData);
        const decompressedData = inflateSync(compressedData);
        await writable.write(decompressedData);
      }
      await writable.close();
      console.log("[downloadFile] File written successfully via File System Access API");
      return {
        blob: new Blob([]),
        fileName: metadata5.name
      };
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("User cancelled download");
      }
      console.warn("[downloadFile] File System Access API failed, falling back to blob:", error);
    }
  }
  console.log("[downloadFile] Using blob fallback");
  const decompressedChunks = [];
  for (const chunk of chunks) {
    const rawData = await storeService.get(chunk.hash);
    const compressedData = normalizeBlockData2(rawData);
    const decompressedData = inflateSync(compressedData);
    decompressedChunks.push(decompressedData);
  }
  const blob = new Blob(decompressedChunks, { type: metadata5.fileType });
  console.log("[downloadFile] Blob created:", blob.size, "bytes");
  return {
    blob,
    fileName: metadata5.name
  };
}
var normalizeBlockData2 = (value) => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer);
  }
  if (typeof value === "string") {
    const binaryString = atob(value);
    const bytes = new Uint8Array(binaryString.length);
    for (let i2 = 0;i2 < binaryString.length; i2++) {
      bytes[i2] = binaryString.charCodeAt(i2);
    }
    return bytes;
  }
  if (typeof value === "object" && value !== null) {
    const record = value;
    if (record.__type === "Uint8Array" && "data" in record) {
      return normalizeBlockData2(record.data);
    }
  }
  throw new Error("StoreService.get returned invalid data");
};
var init_download = __esm(() => {
  init_browser();
});

// ../../../../node_modules/.bun/inline-style-parser@0.2.7/node_modules/inline-style-parser/cjs/index.js
var require_cjs = __commonJS((exports, module) => {
  var COMMENT_REGEX = /\/\*[^*]*\*+([^/*][^*]*\*+)*\//g;
  var NEWLINE_REGEX = /\n/g;
  var WHITESPACE_REGEX = /^\s*/;
  var PROPERTY_REGEX = /^(\*?[-#/*\\\w]+(\[[0-9a-z_-]+\])?)\s*/;
  var COLON_REGEX = /^:\s*/;
  var VALUE_REGEX = /^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^)]*?\)|[^};])+)/;
  var SEMICOLON_REGEX = /^[;\s]*/;
  var TRIM_REGEX = /^\s+|\s+$/g;
  var NEWLINE = `
`;
  var FORWARD_SLASH = "/";
  var ASTERISK = "*";
  var EMPTY_STRING = "";
  var TYPE_COMMENT = "comment";
  var TYPE_DECLARATION = "declaration";
  function index(style, options) {
    if (typeof style !== "string") {
      throw new TypeError("First argument must be a string");
    }
    if (!style)
      return [];
    options = options || {};
    var lineno = 1;
    var column = 1;
    function updatePosition(str) {
      var lines = str.match(NEWLINE_REGEX);
      if (lines)
        lineno += lines.length;
      var i2 = str.lastIndexOf(NEWLINE);
      column = ~i2 ? str.length - i2 : column + str.length;
    }
    function position() {
      var start2 = { line: lineno, column };
      return function(node) {
        node.position = new Position(start2);
        whitespace2();
        return node;
      };
    }
    function Position(start2) {
      this.start = start2;
      this.end = { line: lineno, column };
      this.source = options.source;
    }
    Position.prototype.content = style;
    function error(msg) {
      var err2 = new Error(options.source + ":" + lineno + ":" + column + ": " + msg);
      err2.reason = msg;
      err2.filename = options.source;
      err2.line = lineno;
      err2.column = column;
      err2.source = style;
      if (options.silent)
        ;
      else {
        throw err2;
      }
    }
    function match(re2) {
      var m = re2.exec(style);
      if (!m)
        return;
      var str = m[0];
      updatePosition(str);
      style = style.slice(str.length);
      return m;
    }
    function whitespace2() {
      match(WHITESPACE_REGEX);
    }
    function comments(rules) {
      var c;
      rules = rules || [];
      while (c = comment()) {
        if (c !== false) {
          rules.push(c);
        }
      }
      return rules;
    }
    function comment() {
      var pos = position();
      if (FORWARD_SLASH != style.charAt(0) || ASTERISK != style.charAt(1))
        return;
      var i2 = 2;
      while (EMPTY_STRING != style.charAt(i2) && (ASTERISK != style.charAt(i2) || FORWARD_SLASH != style.charAt(i2 + 1))) {
        ++i2;
      }
      i2 += 2;
      if (EMPTY_STRING === style.charAt(i2 - 1)) {
        return error("End of comment missing");
      }
      var str = style.slice(2, i2 - 2);
      column += 2;
      updatePosition(str);
      style = style.slice(i2);
      column += 2;
      return pos({
        type: TYPE_COMMENT,
        comment: str
      });
    }
    function declaration() {
      var pos = position();
      var prop = match(PROPERTY_REGEX);
      if (!prop)
        return;
      comment();
      if (!match(COLON_REGEX))
        return error("property missing ':'");
      var val = match(VALUE_REGEX);
      var ret = pos({
        type: TYPE_DECLARATION,
        property: trim(prop[0].replace(COMMENT_REGEX, EMPTY_STRING)),
        value: val ? trim(val[0].replace(COMMENT_REGEX, EMPTY_STRING)) : EMPTY_STRING
      });
      match(SEMICOLON_REGEX);
      return ret;
    }
    function declarations() {
      var decls = [];
      comments(decls);
      var decl;
      while (decl = declaration()) {
        if (decl !== false) {
          decls.push(decl);
          comments(decls);
        }
      }
      return decls;
    }
    whitespace2();
    return declarations();
  }
  function trim(str) {
    return str ? str.replace(TRIM_REGEX, EMPTY_STRING) : EMPTY_STRING;
  }
  module.exports = index;
});

// ../../../../node_modules/.bun/style-to-object@1.0.14/node_modules/style-to-object/cjs/index.js
var require_cjs2 = __commonJS((exports) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.default = StyleToObject;
  var inline_style_parser_1 = __importDefault(require_cjs());
  function StyleToObject(style, iterator) {
    let styleObject = null;
    if (!style || typeof style !== "string") {
      return styleObject;
    }
    const declarations = (0, inline_style_parser_1.default)(style);
    const hasIterator = typeof iterator === "function";
    declarations.forEach((declaration) => {
      if (declaration.type !== "declaration") {
        return;
      }
      const { property, value } = declaration;
      if (hasIterator) {
        iterator(property, value, declaration);
      } else if (value) {
        styleObject = styleObject || {};
        styleObject[property] = value;
      }
    });
    return styleObject;
  }
});

// ../../../../node_modules/.bun/style-to-js@1.1.21/node_modules/style-to-js/cjs/utilities.js
var require_utilities = __commonJS((exports) => {
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.camelCase = undefined;
  var CUSTOM_PROPERTY_REGEX = /^--[a-zA-Z0-9_-]+$/;
  var HYPHEN_REGEX = /-([a-z])/g;
  var NO_HYPHEN_REGEX = /^[^-]+$/;
  var VENDOR_PREFIX_REGEX = /^-(webkit|moz|ms|o|khtml)-/;
  var MS_VENDOR_PREFIX_REGEX = /^-(ms)-/;
  var skipCamelCase = function(property) {
    return !property || NO_HYPHEN_REGEX.test(property) || CUSTOM_PROPERTY_REGEX.test(property);
  };
  var capitalize = function(match, character) {
    return character.toUpperCase();
  };
  var trimHyphen = function(match, prefix) {
    return "".concat(prefix, "-");
  };
  var camelCase = function(property, options) {
    if (options === undefined) {
      options = {};
    }
    if (skipCamelCase(property)) {
      return property;
    }
    property = property.toLowerCase();
    if (options.reactCompat) {
      property = property.replace(MS_VENDOR_PREFIX_REGEX, trimHyphen);
    } else {
      property = property.replace(VENDOR_PREFIX_REGEX, trimHyphen);
    }
    return property.replace(HYPHEN_REGEX, capitalize);
  };
  exports.camelCase = camelCase;
});

// ../../../../node_modules/.bun/style-to-js@1.1.21/node_modules/style-to-js/cjs/index.js
var require_cjs3 = __commonJS((exports, module) => {
  var __importDefault = exports && exports.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
  var style_to_object_1 = __importDefault(require_cjs2());
  var utilities_1 = require_utilities();
  function StyleToJS(style, options) {
    var output = {};
    if (!style || typeof style !== "string") {
      return output;
    }
    (0, style_to_object_1.default)(style, function(property, value) {
      if (property && value) {
        output[(0, utilities_1.camelCase)(property, options)] = value;
      }
    });
    return output;
  }
  StyleToJS.default = StyleToJS;
  module.exports = StyleToJS;
});

// ../../../../node_modules/.bun/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  }
  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  }
  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  }
  function plural(ms, msAbs, n, name2) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name2 + (isPlural ? "s" : "");
  }
});

// ../../../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable2;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i2 = 0;i2 < namespace.length; i2++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i2);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self2 = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self2.diff = ms;
        self2.prev = prevTime;
        self2.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index2 = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index2++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index2];
            match = formatter.call(self2, val);
            args.splice(index2, 1);
            index2--;
          }
          return match;
        });
        createDebug.formatArgs.call(self2, args);
        const logFn = self2.log || createDebug.log;
        logFn.apply(self2, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable2() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name2) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name2, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name2, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// ../../../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index2 = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index2++;
      if (match === "%c") {
        lastC = index2;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// ../../../../node_modules/.bun/extend@3.0.2/node_modules/extend/index.js
var require_extend = __commonJS((exports, module) => {
  var hasOwn = Object.prototype.hasOwnProperty;
  var toStr = Object.prototype.toString;
  var defineProperty = Object.defineProperty;
  var gOPD = Object.getOwnPropertyDescriptor;
  var isArray = function isArray2(arr) {
    if (typeof Array.isArray === "function") {
      return Array.isArray(arr);
    }
    return toStr.call(arr) === "[object Array]";
  };
  var isPlainObject = function isPlainObject2(obj) {
    if (!obj || toStr.call(obj) !== "[object Object]") {
      return false;
    }
    var hasOwnConstructor = hasOwn.call(obj, "constructor");
    var hasIsPrototypeOf = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, "isPrototypeOf");
    if (obj.constructor && !hasOwnConstructor && !hasIsPrototypeOf) {
      return false;
    }
    var key;
    for (key in obj) {}
    return typeof key === "undefined" || hasOwn.call(obj, key);
  };
  var setProperty = function setProperty2(target2, options) {
    if (defineProperty && options.name === "__proto__") {
      defineProperty(target2, options.name, {
        enumerable: true,
        configurable: true,
        value: options.newValue,
        writable: true
      });
    } else {
      target2[options.name] = options.newValue;
    }
  };
  var getProperty = function getProperty2(obj, name2) {
    if (name2 === "__proto__") {
      if (!hasOwn.call(obj, name2)) {
        return;
      } else if (gOPD) {
        return gOPD(obj, name2).value;
      }
    }
    return obj[name2];
  };
  module.exports = function extend() {
    var options, name2, src, copy, copyIsArray, clone;
    var target2 = arguments[0];
    var i2 = 1;
    var length = arguments.length;
    var deep = false;
    if (typeof target2 === "boolean") {
      deep = target2;
      target2 = arguments[1] || {};
      i2 = 2;
    }
    if (target2 == null || typeof target2 !== "object" && typeof target2 !== "function") {
      target2 = {};
    }
    for (;i2 < length; ++i2) {
      options = arguments[i2];
      if (options != null) {
        for (name2 in options) {
          src = getProperty(target2, name2);
          copy = getProperty(options, name2);
          if (target2 !== copy) {
            if (deep && copy && (isPlainObject(copy) || (copyIsArray = isArray(copy)))) {
              if (copyIsArray) {
                copyIsArray = false;
                clone = src && isArray(src) ? src : [];
              } else {
                clone = src && isPlainObject(src) ? src : {};
              }
              setProperty(target2, { name: name2, newValue: extend(deep, clone, copy) });
            } else if (typeof copy !== "undefined") {
              setProperty(target2, { name: name2, newValue: copy });
            }
          }
        }
      }
    }
    return target2;
  };
});

// ../../../integration/nrpc/src/runtime/serialization.ts
class TypeHandlerRegistry {
  handlers = new Map;
  autoDetectHandlers = [];
  register(typeName, handler) {
    this.handlers.set(typeName, handler);
    if (handler.detect) {
      this.autoDetectHandlers.push({
        detect: handler.detect,
        deserialize: handler.deserialize
      });
    }
  }
  getHandler(typeName) {
    return this.handlers.get(typeName);
  }
  autoDetectAndDeserialize(value) {
    for (const handler of this.autoDetectHandlers) {
      if (handler.detect(value)) {
        return handler.deserialize(value);
      }
    }
    return value;
  }
}
var registry = new TypeHandlerRegistry;
registry.register("Date", {
  serialize: (value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    return value;
  },
  deserialize: (value) => new Date(value),
  detect: (value) => {
    if (typeof value !== "string")
      return false;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    if (!isoDateRegex.test(value))
      return false;
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
});
registry.register("Uint8Array", {
  serialize: (value) => {
    if (value instanceof Uint8Array) {
      let binary = "";
      for (let i = 0;i < value.byteLength; i++) {
        binary += String.fromCharCode(value[i]);
      }
      return { __type: "Uint8Array", data: btoa(binary) };
    }
    return value;
  },
  deserialize: (value) => {
    if (typeof value === "object" && value.__type === "Uint8Array" && typeof value.data === "string") {
      const binary = atob(value.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0;i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    if (typeof value === "string") {
      try {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0;i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } catch {
        return value;
      }
    }
    return value;
  },
  detect: (value) => {
    return typeof value === "object" && value !== null && value.__type === "Uint8Array";
  }
});
function serializeValue(value, typeName) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, typeName));
  }
  if (typeName) {
    const handler = registry.getHandler(typeName);
    if (handler && value.constructor.name === typeName) {
      return handler.serialize(value);
    }
  }
  const handlerForType = registry.getHandler(value.constructor.name);
  if (handlerForType) {
    return handlerForType.serialize(value);
  }
  if (typeof value === "object") {
    const result = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        result[key] = serializeValue(value[key]);
      }
    }
    return result;
  }
  return value;
}
function deserializeValue(value, typeName) {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deserializeValue(item, typeName));
  }
  if (typeName) {
    const handler = registry.getHandler(typeName);
    if (handler) {
      return handler.deserialize(value);
    }
  }
  if (typeof value === "object") {
    const result = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        const childValue = value[key];
        const detected = registry.autoDetectAndDeserialize(childValue);
        result[key] = detected !== childValue ? detected : deserializeValue(childValue);
      }
    }
    return result;
  }
  return registry.autoDetectAndDeserialize(value);
}

// ../../../integration/nrpc/src/runtime/access-control.ts
var WILDCARDS = new Set(["*", "all"]);

// ../../../integration/nrpc/src/runtime/http-client.ts
function createHttpClient(metadata, config = {}) {
  const client = new HttpClientImpl(metadata, config);
  return createProxy(client, metadata);
}

class HttpClientImpl {
  metadata;
  baseUrl;
  timeout;
  headers;
  constructor(metadata, config) {
    this.metadata = metadata;
    const envBase = typeof process !== "undefined" ? process.env?.SERVICES_BASE : undefined;
    this.baseUrl = config.baseUrl || envBase || "/services";
    this.timeout = config.timeout || 5000;
    this.headers = config.headers || {};
  }
  call(methodName, params) {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    if (!method) {
      throw new Error(`Method ${methodName} not found in service ${this.metadata.serviceName}`);
    }
    if (method.isAsyncIterable) {
      return this.callStreaming(methodName, params);
    }
    return this.callRegular(methodName, params);
  }
  async callRegular(methodName, params) {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}`;
    const body = this.prepareParams(method.parameters, params);
    const abortController = new AbortController;
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, this.timeout);
    try {
      const url = `${this.baseUrl}${path}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.headers
        },
        body: JSON.stringify(body),
        signal: abortController.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        let errorMessage = `HTTP ${url} ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {}
        throw new Error(errorMessage);
      }
      if (method.returnType === "void") {
        return;
      }
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return deserializeValue(data, method.returnType);
      } else {
        return response.text();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }
  callStreaming(methodName, params) {
    const method = this.metadata.methods.find((m) => m.name === methodName);
    const path = `/${this.metadata.serviceName}/${methodName}/stream`;
    const body = this.prepareParams(method.parameters, params);
    const self2 = this;
    return {
      async* [Symbol.asyncIterator]() {
        const abortController = new AbortController;
        const response = await fetch(`${self2.baseUrl}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...self2.headers
          },
          body: JSON.stringify(body),
          signal: abortController.signal
        });
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {}
          throw new Error(errorMessage);
        }
        if (!response.body) {
          throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder;
        try {
          let buffer = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += decoder.decode(value, { stream: true });
            let eventStart = 0;
            let eventEnd = buffer.indexOf(`

`);
            while (eventEnd !== -1) {
              const eventData = buffer.slice(eventStart, eventEnd);
              const lines = eventData.split(`
`);
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                  continue;
                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6);
                  if (data === "[DONE]") {
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    const deserialized = deserializeValue(parsed, method.returnType);
                    yield deserialized;
                  } catch (error) {
                    console.error("Error parsing JSON data:", data, error);
                  }
                }
              }
              eventStart = eventEnd + 2;
              eventEnd = buffer.indexOf(`

`, eventStart);
            }
            buffer = buffer.slice(eventStart);
          }
        } finally {
          reader.releaseLock();
        }
      }
    };
  }
  prepareParams(paramDefs, params) {
    const result = {};
    paramDefs.forEach((def, index) => {
      if (params[index] !== undefined) {
        result[def.name] = serializeValue(params[index], def.type);
      } else if (!def.optional) {
        throw new Error(`Required parameter '${def.name}' is missing`);
      }
    });
    return result;
  }
}
function createProxy(client, metadata) {
  const proxy = {};
  metadata.methods.forEach((method) => {
    proxy[method.name] = (...args) => {
      const requiredParamsCount = method.parameters.filter((p) => !p.optional).length;
      const totalParamsCount = method.parameters.length;
      if (args.length < requiredParamsCount) {
        throw new Error(`Method ${method.name} requires at least ${requiredParamsCount} arguments, got ${args.length}`);
      }
      if (args.length > totalParamsCount) {
        throw new Error(`Method ${method.name} accepts at most ${totalParamsCount} arguments, got ${args.length}`);
      }
      return client.call(method.name, args);
    };
  });
  proxy._metadata = metadata;
  return proxy;
}

// ../../../integration/nrpc/src/decorator/access.decorator.ts
var JWT_SECRET = new TextEncoder().encode("your-secret-key");

// ../../../integration/generated/g-aichat/src/index.ts
var metadata = {
  interfaceName: "AiChatService",
  serviceName: "aichat",
  filePath: "/home/alexstorm/distrib/4ir/gestalt/clarity/converged/integration/types/chats.ts",
  methods: [
    {
      name: "createSession",
      parameters: [
        {
          name: "serviceType",
          type: "ServiceType",
          optional: false,
          isArray: false
        },
        {
          name: "model",
          type: "string",
          optional: true,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "sendMessage",
      parameters: [
        {
          name: "sessionId",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "messages",
          type: "ContentBlock",
          optional: false,
          isArray: true
        },
        {
          name: "options",
          type: "ConversationOptions",
          optional: true,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: true
    },
    {
      name: "listOfChats",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "deleteChat",
      parameters: [
        {
          name: "chatId",
          type: "string",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "getChat",
      parameters: [
        {
          name: "chatId",
          type: "string",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "saveContext",
      parameters: [
        {
          name: "chatId",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "context",
          type: "any",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "getContext",
      parameters: [
        {
          name: "chatId",
          type: "string",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "listContexts",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    }
  ],
  types: [
    {
      name: "ContentBlock",
      definition: `{
    type: ContentType;
    data?: any;
}`
    },
    {
      name: "ToolParameter",
      definition: "",
      properties: [
        {
          name: "type",
          type: "any",
          optional: false,
          isArray: false
        },
        {
          name: "description",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "required",
          type: "boolean",
          optional: true,
          isArray: false
        },
        {
          name: "enum",
          type: "any",
          optional: true,
          isArray: true
        },
        {
          name: "items",
          type: "ToolParameter",
          optional: true,
          isArray: false
        },
        {
          name: "properties",
          type: "Record",
          optional: true,
          isArray: false
        }
      ]
    },
    {
      name: "Tool",
      definition: "",
      properties: [
        {
          name: "name",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "description",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "parameters",
          type: "any",
          optional: false,
          isArray: false
        },
        {
          name: "execute",
          type: "any",
          optional: false,
          isArray: false
        }
      ]
    },
    {
      name: "ToolCall",
      definition: "",
      properties: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "name",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "args",
          type: "Record",
          optional: false,
          isArray: false
        }
      ]
    },
    {
      name: "ToolResult",
      definition: "",
      properties: [
        {
          name: "toolCallId",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "result",
          type: "any",
          optional: false,
          isArray: false
        },
        {
          name: "error",
          type: "string",
          optional: true,
          isArray: false
        }
      ]
    },
    {
      name: "ConversationOptions",
      definition: `{
    stream?: boolean;
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
}`
    },
    {
      name: "StreamEvent",
      definition: `{
    tokens?: number;
} & (
    | { type: StreamEventType.TEXT_DELTA; content: string }
    | { type: StreamEventType.TOOL_CALL; id: string; name: string; args: any }
    | { type: StreamEventType.COMPLETED; finishReason?: string }
    | { type: StreamEventType.ERROR; message: string }
)`
    },
    {
      name: "PaginationParams",
      definition: "",
      properties: [
        {
          name: "offset",
          type: "number",
          optional: false,
          isArray: false
        },
        {
          name: "limit",
          type: "number",
          optional: false,
          isArray: false
        }
      ]
    },
    {
      name: "PaginatedResult",
      definition: "",
      properties: [
        {
          name: "items",
          type: "T",
          optional: false,
          isArray: true
        },
        {
          name: "totalCount",
          type: "number",
          optional: true,
          isArray: false
        }
      ]
    },
    {
      name: "Chat",
      definition: "",
      properties: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "name",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "description",
          type: "string",
          optional: false,
          isArray: false
        }
      ]
    },
    {
      name: "ChatContextSummary",
      definition: "",
      properties: [
        {
          name: "id",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "chatId",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "updatedAt",
          type: "number",
          optional: false,
          isArray: false
        },
        {
          name: "size",
          type: "number",
          optional: true,
          isArray: false
        }
      ]
    },
    {
      name: "ChatContext",
      definition: "",
      properties: [
        {
          name: "data",
          type: "any",
          optional: false,
          isArray: false
        }
      ]
    }
  ]
};
function createAiChatServiceClient(config) {
  return createHttpClient(metadata, config);
}
var aichatClient = createAiChatServiceClient();

// ../../../integration/generated/g-threads/src/index.ts
var metadata2 = {
  interfaceName: "ThreadsService",
  serviceName: "threads",
  filePath: "/home/alexstorm/distrib/4ir/gestalt/clarity/converged/integration/types/threads.ts",
  methods: [
    {
      name: "saveMessage",
      parameters: [
        {
          name: "message",
          type: "Message",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "readMessage",
      parameters: [
        {
          name: "threadId",
          type: "ULID",
          optional: false,
          isArray: false
        },
        {
          name: "messageId",
          type: "ULID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "readMessageVersions",
      parameters: [
        {
          name: "threadId",
          type: "ULID",
          optional: false,
          isArray: false
        },
        {
          name: "messageId",
          type: "ULID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "readThreadAllVersions",
      parameters: [
        {
          name: "threadId",
          type: "ULID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "readThread",
      parameters: [
        {
          name: "threadId",
          type: "ULID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    }
  ],
  types: [
    {
      name: "ULID",
      definition: "string"
    },
    {
      name: "Message",
      definition: `{
  threadId: ULID;
  id?: ULID;
  timestamp?: number;
  beforeId?: ULID;
  user: string;
  type: MessageType;
  data: string;
}`
    }
  ]
};
function createThreadsServiceClient(config) {
  return createHttpClient(metadata2, config);
}
var threadsClient = createThreadsServiceClient();

// ../../../integration/generated/g-store/src/index.ts
var metadata3 = {
  interfaceName: "StoreService",
  serviceName: "store",
  filePath: "/home/alexstorm/distrib/4ir/gestalt/clarity/converged/integration/types/store.ts",
  methods: [
    {
      name: "save",
      parameters: [
        {
          name: "data",
          type: "Uint8Array",
          optional: false,
          isArray: false
        },
        {
          name: "originalSize",
          type: "number",
          optional: true,
          isArray: false
        },
        {
          name: "compression",
          type: "CompressionType",
          optional: true,
          isArray: false
        },
        {
          name: "owner",
          type: "string",
          optional: true,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "saveWithHash",
      parameters: [
        {
          name: "hash",
          type: "HashString",
          optional: false,
          isArray: false
        },
        {
          name: "data",
          type: "Uint8Array",
          optional: false,
          isArray: false
        },
        {
          name: "originalSize",
          type: "number",
          optional: true,
          isArray: false
        },
        {
          name: "compression",
          type: "CompressionType",
          optional: true,
          isArray: false
        },
        {
          name: "owner",
          type: "string",
          optional: true,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "delete",
      parameters: [
        {
          name: "hash",
          type: "HashString",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "get",
      parameters: [
        {
          name: "hash",
          type: "HashString",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "getWithMeta",
      parameters: [
        {
          name: "hash",
          type: "HashString",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "exists",
      parameters: [
        {
          name: "hash",
          type: "HashString",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "list",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "storeStatistic",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    }
  ],
  types: [
    {
      name: "HashString",
      definition: "string"
    },
    {
      name: "CompressionType",
      definition: '"none" | "deflate" | "gzip" | "brotli"'
    },
    {
      name: "PaginationParams",
      definition: "",
      properties: [
        {
          name: "key",
          type: "string",
          optional: false,
          isArray: false
        },
        {
          name: "offset",
          type: "number",
          optional: false,
          isArray: false
        },
        {
          name: "limit",
          type: "number",
          optional: false,
          isArray: false
        }
      ]
    },
    {
      name: "PaginatedResult",
      definition: "",
      properties: [
        {
          name: "items",
          type: "T",
          optional: false,
          isArray: true
        },
        {
          name: "totalCount",
          type: "number",
          optional: true,
          isArray: false
        }
      ]
    },
    {
      name: "BlockMetadata",
      definition: "",
      properties: [
        {
          name: "hash",
          type: "HashString",
          optional: false,
          isArray: false
        },
        {
          name: "size",
          type: "number",
          optional: false,
          isArray: false
        },
        {
          name: "originalSize",
          type: "number",
          optional: false,
          isArray: false
        },
        {
          name: "compression",
          type: "CompressionType",
          optional: false,
          isArray: false
        },
        {
          name: "owner",
          type: "string",
          optional: false,
          isArray: false
        }
      ]
    }
  ]
};
function createStoreServiceClient(config) {
  return createHttpClient(metadata3, config);
}
var storeClient = createStoreServiceClient();

// ../../../integration/generated/g-files/src/index.ts
var metadata4 = {
  interfaceName: "FilesService",
  serviceName: "files",
  filePath: "/home/alexstorm/distrib/4ir/gestalt/clarity/converged/integration/types/files.ts",
  methods: [
    {
      name: "save",
      parameters: [
        {
          name: "file",
          type: "FileMetadata",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "saveChunk",
      parameters: [
        {
          name: "chunk",
          type: "FileChunk",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "update",
      parameters: [
        {
          name: "id",
          type: "UUID",
          optional: false,
          isArray: false
        },
        {
          name: "file",
          type: "FileMetadata",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "delete",
      parameters: [
        {
          name: "id",
          type: "UUID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "get",
      parameters: [
        {
          name: "id",
          type: "UUID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "getChunks",
      parameters: [
        {
          name: "id",
          type: "UUID",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "list",
      parameters: [
        {
          name: "params",
          type: "PaginationParams",
          optional: false,
          isArray: false
        }
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    },
    {
      name: "statistic",
      parameters: [],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false
    }
  ],
  types: [
    {
      name: "HashString",
      definition: "string"
    },
    {
      name: "UUID",
      definition: "string"
    },
    {
      name: "ISODateString",
      definition: "string"
    },
    {
      name: "PaginationParams",
      definition: `{
    key: string;
    offset: number;
    limit: number;
}`
    },
    {
      name: "PaginatedResult",
      definition: `{
    items: T[];
    totalCount?: number;
}`
    },
    {
      name: "FileStatus",
      definition: "'uploading' | 'uploaded' | 'failed'"
    },
    {
      name: "FileMetadata",
      definition: `{
    id:UUID
    hash: HashString; 
    status: FileStatus;
    name: string;
    fileSize: number;
    fileType: string;
    compression: string;
    owner: string;
    createdAt: ISODateString; 
    chunksCount: number;
}`
    },
    {
      name: "FileChunk",
      definition: `{
    fileId:UUID
    hash: HashString;
    chunkNumber: number;
    chunkSize: number;
    createdAt: ISODateString; 
}`
    },
    {
      name: "FileStatistic",
      definition: `{
    totalFiles: number;
    totalChunks: number;
    totalSize: number;
    createdAt: ISODateString;
}`
    }
  ]
};
function createFilesServiceClient(config) {
  return createHttpClient(metadata4, config);
}
var filesClient = createFilesServiceClient();

// ../../libraries/files-state/src/services.ts
class Services {
  static instance;
  _filesService = null;
  _storeService = null;
  constructor() {}
  static getInstance() {
    if (!Services.instance) {
      Services.instance = new Services;
    }
    return Services.instance;
  }
  setFilesService(service) {
    this._filesService = service;
  }
  setStoreService(service) {
    this._storeService = service;
  }
  getFilesService() {
    return this._filesService;
  }
  getStoreService() {
    return this._storeService;
  }
  get filesService() {
    if (!this._filesService) {
      throw new Error("FilesService not initialized");
    }
    return this._filesService;
  }
  get storeService() {
    if (!this._storeService) {
      throw new Error("StoreService not initialized");
    }
    return this._storeService;
  }
}
var services = Services.getInstance();
// ../../libraries/files-state/src/segments/files.ts
import { sample, combine } from "effector";

// ../../libraries/files-state/src/domain.ts
import { createDomain } from "effector";
var fileTransferDomain = createDomain("files");

// ../../libraries/files-state/src/segments/files.ts
var fileMetadataCreateRequested = fileTransferDomain.createEvent("FILE_METADATA_CREATE_REQUESTED");
var fileMetadataCreated = fileTransferDomain.createEvent("FILE_METADATA_CREATED");
var fileMetadataUpdateRequested = fileTransferDomain.createEvent("FILE_METADATA_UPDATE_REQUESTED");
var fileMetadataUpdated = fileTransferDomain.createEvent("FILE_METADATA_UPDATED");
var fileMetadataUpdateFailed = fileTransferDomain.createEvent("FILE_METADATA_UPDATE_FAILED");
var fileMetadataSaveFailed = fileTransferDomain.createEvent("FILE_METADATA_SAVE_FAILED");
var chunkMetadataSaveRequested = fileTransferDomain.createEvent("CHUNK_METADATA_SAVE_REQUESTED");
var chunkMetadataSaved = fileTransferDomain.createEvent("CHUNK_METADATA_SAVED");
var chunkMetadataSaveFailed = fileTransferDomain.createEvent("CHUNK_METADATA_SAVE_FAILED");
var fileMetadataLoadRequested = fileTransferDomain.createEvent("FILE_METADATA_LOAD_REQUESTED");
var fileMetadataLoaded = fileTransferDomain.createEvent("FILE_METADATA_LOADED");
var fileMetadataLoadFailed = fileTransferDomain.createEvent("FILE_METADATA_LOAD_FAILED");
var fileChunksLoadRequested = fileTransferDomain.createEvent("FILE_CHUNKS_LOAD_REQUESTED");
var fileChunksLoaded = fileTransferDomain.createEvent("FILE_CHUNKS_LOADED");
var fileChunksLoadFailed = fileTransferDomain.createEvent("FILE_CHUNKS_LOAD_FAILED");
var chunkLoadRequested = fileTransferDomain.createEvent("CHUNK_LOAD_REQUESTED");
var chunkLoaded = fileTransferDomain.createEvent("CHUNK_LOADED");
var saveFileMetadataFx = fileTransferDomain.createEffect("SAVE_FILE_METADATA_FX");
saveFileMetadataFx.use(async (file) => services.filesService.save(file));
var updateFileMetadataFx = fileTransferDomain.createEffect("UPDATE_FILE_METADATA_FX");
updateFileMetadataFx.use(async (file) => services.filesService.update(file.id, file));
var saveChunkMetadataFx = fileTransferDomain.createEffect("SAVE_CHUNK_METADATA_FX");
saveChunkMetadataFx.use(async (chunk) => {
  console.log("[saveChunkMetadataFx] Calling filesService.saveChunk with:", JSON.stringify(chunk));
  const result = await services.filesService.saveChunk(chunk);
  console.log("[saveChunkMetadataFx] Result:", result);
  return result;
});
var loadFileMetadataFx = fileTransferDomain.createEffect("LOAD_FILE_METADATA_FX");
loadFileMetadataFx.use(async (id) => {
  console.log("[loadFileMetadataFx] Loading metadata for fileId:", id);
  const result = await services.filesService.get(id);
  console.log("[loadFileMetadataFx] Result:", result);
  return result;
});
var loadFileChunksFx = fileTransferDomain.createEffect("LOAD_FILE_CHUNKS_FX");
loadFileChunksFx.use(async (id) => {
  console.log("[loadFileChunksFx] Loading chunks for fileId:", id);
  const result = await services.filesService.getChunks(id);
  console.log("[loadFileChunksFx] Result:", result.length, "chunks");
  return result;
});
var loadChunkFx = fileTransferDomain.createEffect("LOAD_CHUNK_FX");
loadChunkFx.use(async ({ fileId, chunkNumber }) => {
  const data = new Uint8Array(0);
  return { fileId, chunkNumber, data };
});
var $files = fileTransferDomain.createStore(new Map, { name: "FILES" });
var $chunks = fileTransferDomain.createStore(new Map, { name: "CHUNKS" });
var $fileMetadataCache = fileTransferDomain.createStore(new Map, { name: "FILE_METADATA_CACHE" });
var $fileChunksCache = fileTransferDomain.createStore(new Map, { name: "FILE_CHUNKS_CACHE" });
var $uploadingFiles = $files.map((files) => Array.from(files.values()).filter((f) => f.status === "uploading"));
var buildFileMetadata = ({ fileId, file, owner }) => ({
  id: fileId,
  hash: "",
  status: "uploading",
  name: file.name,
  fileSize: file.size,
  fileType: file.type,
  compression: "deflate",
  owner,
  createdAt: new Date().toISOString(),
  chunksCount: 0
});
sample({
  clock: fileMetadataCreateRequested,
  fn: buildFileMetadata,
  target: saveFileMetadataFx
});
$fileMetadataCache.on(fileMetadataCreateRequested, (state, request) => {
  const newMap = new Map(state);
  newMap.set(request.fileId, buildFileMetadata(request));
  return newMap;
});
sample({
  clock: saveFileMetadataFx.doneData,
  target: fileMetadataCreated
});
sample({
  clock: saveFileMetadataFx.fail,
  source: fileMetadataCreateRequested,
  fn: (request, { error }) => ({
    fileId: request.fileId,
    error
  }),
  target: fileMetadataSaveFailed
});
sample({
  clock: fileMetadataUpdateRequested,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => cache.has(fileId),
  fn: (cache, { fileId, patch }) => ({
    ...cache.get(fileId),
    ...patch
  }),
  target: updateFileMetadataFx
});
sample({
  clock: fileMetadataUpdateRequested,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => !cache.has(fileId),
  fn: (_, { fileId }) => ({
    fileId,
    error: new Error(`File metadata not found for ${fileId}`)
  }),
  target: fileMetadataUpdateFailed
});
sample({
  clock: updateFileMetadataFx.done,
  fn: ({ params }) => params,
  target: fileMetadataUpdated
});
sample({
  clock: updateFileMetadataFx.fail,
  source: fileMetadataUpdateRequested,
  fn: ({ fileId }, { error }) => ({
    fileId,
    error
  }),
  target: fileMetadataUpdateFailed
});
sample({
  clock: chunkMetadataSaveRequested,
  fn: ({ fileId, chunkNumber, hash, chunkSize }) => {
    const chunk = {
      fileId,
      hash,
      chunkNumber,
      chunkSize,
      createdAt: new Date().toISOString()
    };
    console.log("[files.ts] chunkMetadataSaveRequested -> saveChunkMetadataFx:", JSON.stringify(chunk));
    return chunk;
  },
  target: saveChunkMetadataFx
});
sample({
  clock: saveChunkMetadataFx.done,
  fn: ({ params }) => {
    const event = {
      fileId: params.fileId,
      chunkNumber: params.chunkNumber
    };
    console.log("[files.ts] saveChunkMetadataFx.done -> chunkMetadataSaved:", JSON.stringify(event));
    return event;
  },
  target: chunkMetadataSaved
});
sample({
  clock: saveChunkMetadataFx.fail,
  fn: ({ params, error }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    error
  }),
  target: chunkMetadataSaveFailed
});
sample({
  clock: fileMetadataLoadRequested,
  fn: (fileId) => fileId,
  target: loadFileMetadataFx
});
sample({
  clock: loadFileMetadataFx.doneData,
  target: fileMetadataLoaded
});
sample({
  clock: loadFileMetadataFx.fail,
  source: fileMetadataLoadRequested,
  fn: (fileId, { error }) => ({
    fileId,
    error
  }),
  target: fileMetadataLoadFailed
});
sample({
  clock: fileChunksLoadRequested,
  fn: (fileId) => fileId,
  target: loadFileChunksFx
});
sample({
  clock: loadFileChunksFx.done,
  fn: ({ params, result }) => ({
    fileId: params,
    chunks: result
  }),
  target: fileChunksLoaded
});
sample({
  clock: loadFileChunksFx.fail,
  source: fileChunksLoadRequested,
  fn: (fileId, { error }) => ({
    fileId,
    error
  }),
  target: fileChunksLoadFailed
});
$fileMetadataCache.on(fileMetadataLoaded, (state, metadata5) => {
  const newMap = new Map(state);
  newMap.set(metadata5.id, metadata5);
  return newMap;
});
$fileMetadataCache.on(fileMetadataUpdated, (state, metadata5) => {
  const newMap = new Map(state);
  newMap.set(metadata5.id, metadata5);
  return newMap;
});
$fileChunksCache.on(fileChunksLoaded, (state, { fileId, chunks }) => {
  const newMap = new Map(state);
  newMap.set(fileId, chunks);
  return newMap;
});
$files.on(fileMetadataSaveFailed, (state, { fileId, error }) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: "failed", error: error.message });
  return newMap;
});
$chunks.on(chunkMetadataSaveFailed, (state, { fileId, chunkNumber, error }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk)
    return state;
  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: "failed", error: error.message });
  return newMap;
});
$files.on(fileMetadataLoadFailed, (state, { fileId, error }) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: "failed", error: error.message });
  return newMap;
});
sample({
  clock: chunkLoadRequested,
  target: loadChunkFx
});
sample({
  clock: loadChunkFx.doneData,
  target: chunkLoaded
});
// ../../libraries/files-state/src/segments/store.ts
import { sample as sample2 } from "effector";
var decodeBase64ToUint8Array = (value) => {
  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!base64Pattern.test(value)) {
    throw new Error("StoreService.get returned non-base64 string");
  }
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0;i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  throw new Error("Base64 decoding is not available");
};
var normalizeBlockData = (value) => {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer);
  }
  if (typeof value === "string") {
    return decodeBase64ToUint8Array(value);
  }
  if (Array.isArray(value)) {
    return new Uint8Array(value);
  }
  if (value && typeof value === "object") {
    const record = value;
    if (record.__type === "Uint8Array") {
      return normalizeBlockData(record.data);
    }
    if ("data" in record) {
      return normalizeBlockData(record.data);
    }
  }
  throw new Error("StoreService.get returned invalid data");
};
var blockSaveRequested = fileTransferDomain.createEvent("BLOCK_SAVE_REQUESTED");
var blockSaved = fileTransferDomain.createEvent("BLOCK_SAVED");
var blockSaveFailed = fileTransferDomain.createEvent("BLOCK_SAVE_FAILED");
var blockLoadRequested = fileTransferDomain.createEvent("BLOCK_LOAD_REQUESTED");
var blockLoaded = fileTransferDomain.createEvent("BLOCK_LOADED");
var blockLoadFailed = fileTransferDomain.createEvent("BLOCK_LOAD_FAILED");
var saveBlockFx = fileTransferDomain.createEffect("SAVE_BLOCK_FX");
saveBlockFx.use(async ({ fileId, chunkNumber, data, originalSize, compression }) => {
  console.log(`[saveBlockFx] Starting save for chunk ${chunkNumber}, size=${data.length}, originalSize=${originalSize}, compression=${compression}`);
  try {
    const result = await services.storeService.save(data, originalSize, compression);
    console.log(`[saveBlockFx] Success for chunk ${chunkNumber}, hash=${result}`);
    return result;
  } catch (error) {
    console.error(`[saveBlockFx] Failed for chunk ${chunkNumber}:`, error);
    throw error;
  }
});
var loadBlockFx = fileTransferDomain.createEffect("LOAD_BLOCK_FX");
loadBlockFx.use(async ({ hash }) => {
  const payload = await services.storeService.get(hash);
  return normalizeBlockData(payload);
});
var $blockCache = fileTransferDomain.createStore(new Map, { name: "BLOCK_CACHE" });
sample2({
  clock: blockSaveRequested,
  fn: ({ fileId, chunkNumber, data, originalSize, compression }) => ({ fileId, chunkNumber, data, originalSize, compression }),
  target: saveBlockFx
});
sample2({
  clock: saveBlockFx.done,
  fn: ({ params, result }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    hash: result
  }),
  target: blockSaved
});
sample2({
  clock: saveBlockFx.fail,
  fn: ({ params, error }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    error
  }),
  target: blockSaveFailed
});
sample2({
  clock: blockLoadRequested,
  fn: (request) => request,
  target: loadBlockFx
});
sample2({
  clock: loadBlockFx.done,
  fn: ({ params, result }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    data: result
  }),
  target: blockLoaded
});
sample2({
  clock: loadBlockFx.fail,
  fn: ({ params, error }) => ({
    fileId: params.fileId,
    chunkNumber: params.chunkNumber,
    error
  }),
  target: blockLoadFailed
});
$blockCache.on(blockLoaded, (state, { chunkNumber, data }) => {
  const newMap = new Map(state);
  const hash = `cache-${chunkNumber}`;
  newMap.set(hash, data);
  return newMap;
});
// ../../libraries/files-state/src/segments/streaming.ts
import { sample as sample4 } from "effector";

// ../../libraries/store-workers/src/types.ts
var BLOCK_SIZE_BYTES = 512 * 1024;
var MIN_CHUNK_SIZE_BYTES = 4 * 1024;

// ../../libraries/files-state/src/segments/streaming-core.ts
import { sample as sample3, combine as combine2 } from "effector";
var compressionStarted = fileTransferDomain.createEvent("COMPRESSION_STARTED");
var chunkPrepared = fileTransferDomain.createEvent("CHUNK_PREPARED");
var compressionCompleted = fileTransferDomain.createEvent("COMPRESSION_COMPLETED");
var compressionFailed = fileTransferDomain.createEvent("COMPRESSION_FAILED");
var decompressionStarted = fileTransferDomain.createEvent("DECOMPRESSION_STARTED");
var decompressionStateInitialized = fileTransferDomain.createEvent("DECOMPRESSION_STATE_INITIALIZED");
var decompressionFailed = fileTransferDomain.createEvent("DECOMPRESSION_FAILED");
var decompressionChunkRequested = fileTransferDomain.createEvent("DECOMPRESSION_CHUNK_REQUESTED");
var decompressionDataReceived = fileTransferDomain.createEvent("DECOMPRESSION_DATA_RECEIVED");
var decompressionChunkProcessed = fileTransferDomain.createEvent("DECOMPRESSION_CHUNK_PROCESSED");
var decompressionCompleted = fileTransferDomain.createEvent("DECOMPRESSION_COMPLETED");
var chunkConsumed = fileTransferDomain.createEvent("CHUNK_CONSUMED");
var $decompressionState = fileTransferDomain.createStore(new Map, { name: "DECOMPRESSION_STATE" });
$decompressionState.on(decompressionStateInitialized, (state, { fileId, totalChunks }) => {
  console.log("[streaming-core] decompressionStateInitialized:", { fileId, totalChunks });
  const newMap = new Map(state);
  newMap.set(fileId, {
    currentChunkNumber: 0,
    totalChunks
  });
  return newMap;
});
sample3({
  clock: decompressionStarted,
  source: combine2({ metadata: $fileMetadataCache, chunks: $fileChunksCache }),
  filter: ({ chunks }, { fileId }) => {
    const hasChunks = chunks.has(fileId);
    console.log("[streaming-core] decompressionStarted -> check chunks:", { fileId, hasChunks });
    return hasChunks;
  },
  fn: ({ chunks }, { fileId }) => {
    const fileChunks = chunks.get(fileId);
    const totalChunks = fileChunks.length;
    console.log("[streaming-core] Initializing decompression state:", { fileId, totalChunks });
    return { fileId, totalChunks };
  },
  target: decompressionStateInitialized
});
sample3({
  clock: decompressionStarted,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => !cache.has(fileId),
  fn: (cache, { fileId }) => ({
    fileId,
    error: `File metadata not found for ${fileId}`
  }),
  target: decompressionFailed
});
sample3({
  clock: decompressionStateInitialized,
  fn: ({ fileId }) => {
    console.log("[streaming-core] Requesting first chunk for:", fileId);
    return { fileId, chunkNumber: 0 };
  },
  target: decompressionChunkRequested
});
// ../../libraries/files-state/src/segments/streaming.ts
var storeWorker = null;
var storeConfig = null;
function setStoreWorker(worker, config) {
  if (storeWorker) {
    console.warn("[Streaming] Replacing existing worker");
    storeWorker.terminate();
  }
  storeWorker = worker;
  storeConfig = config || null;
  setupWorkerHandlers(worker);
  console.log("[Streaming] Custom worker set", config ? "with config" : "");
}
function getStoreWorker() {
  if (!storeWorker) {
    console.log("[Streaming] Initializing default store-worker...");
    const workerUrl = new URL("../../../store-workers/dist/store.worker.js", import.meta.url);
    storeWorker = new Worker(workerUrl, { type: "module" });
    setupWorkerHandlers(storeWorker);
    console.log("[Streaming] Default store worker initialized");
  }
  return storeWorker;
}
function setupWorkerHandlers(worker) {
  worker.onmessage = (event) => {
    const message = event.data;
    console.log("[Streaming] Worker message:", message.type, message);
    switch (message.type) {
      case "CHUNK_READY" /* ChunkReady */:
        console.log("[Streaming] ChunkReady event:", {
          fileId: message.fileId,
          chunkNumber: message.chunkNumber,
          chunkSize: message.chunkSize,
          hash: message.hash
        });
        if (message.chunkSize === 0) {
          console.warn("[Streaming] Skipping empty chunk:", message.chunkNumber);
          break;
        }
        blockSaved({
          fileId: message.fileId,
          chunkNumber: message.chunkNumber,
          hash: message.hash,
          chunkSize: message.chunkSize
        });
        break;
      case "FILE_UPLOADED" /* FileUploaded */:
        console.log("[Streaming] FileUploaded event:", {
          fileId: message.fileId,
          totalChunks: message.totalChunks
        });
        compressionCompleted({
          fileId: message.fileId,
          totalChunks: message.totalChunks
        });
        break;
      case "UPLOAD_ERROR" /* Error */:
        console.error("[Streaming] Upload error:", message);
        compressionFailed({
          fileId: message.fileId,
          error: message.error
        });
        break;
      case "UPLOAD_PROGRESS" /* Progress */:
        console.log("[Streaming] Upload progress:", {
          fileId: message.fileId,
          bytesProcessed: message.bytesProcessed,
          totalBytes: message.totalBytes,
          percentage: (message.bytesProcessed / message.totalBytes * 100).toFixed(2) + "%"
        });
        break;
    }
  };
  worker.onerror = (error) => {
    console.error("[Streaming] Worker error:", error);
  };
}
sample4({
  clock: compressionStarted,
  fn: ({ fileId, file }) => {
    console.log("[Streaming] compressionStarted:", {
      fileId,
      fileName: file.name,
      fileSize: file.size
    });
    const message = {
      type: "UPLOAD_START" /* UploadStart */,
      fileId,
      file
    };
    if (storeConfig) {
      message.store = storeConfig;
      console.log("[Streaming] Adding store config to message:", storeConfig);
    }
    console.log("[Streaming] Sending UploadStart to worker");
    const worker = getStoreWorker();
    worker.postMessage(message);
  }
});
// ../../libraries/files-state/src/segments/browser.ts
import { sample as sample5 } from "effector";

// ../../libraries/files-state/src/utils/chunk-split.ts
var MAX_CHUNK_SIZE = 512 * 1024;
var MIN_CHUNK_SIZE = 4 * 1024;
function buildChunkPlan(fileSize) {
  if (fileSize <= 0) {
    return [];
  }
  if (fileSize <= MIN_CHUNK_SIZE) {
    return [fileSize];
  }
  const plan = [];
  let remaining = fileSize;
  let currentSize = MAX_CHUNK_SIZE;
  while (remaining > 0) {
    if (remaining <= currentSize && remaining >= MIN_CHUNK_SIZE) {
      plan.push(remaining);
      remaining = 0;
      break;
    }
    if (remaining - currentSize >= MIN_CHUNK_SIZE) {
      plan.push(currentSize);
      remaining -= currentSize;
      continue;
    }
    if (currentSize > MIN_CHUNK_SIZE && currentSize / 2 >= MIN_CHUNK_SIZE) {
      currentSize = Math.floor(currentSize / 2);
      continue;
    }
    const merged = remaining;
    if (plan.length === 0) {
      plan.push(merged);
    } else {
      const lastIndex = plan.length - 1;
      const last = plan[lastIndex];
      const newLast = last + merged;
      if (newLast <= MAX_CHUNK_SIZE) {
        plan[lastIndex] = newLast;
      } else {
        plan.push(merged);
      }
    }
    remaining = 0;
    break;
  }
  return plan;
}

// ../../libraries/files-state/src/config.ts
var MAX_BLOCK_SIZE = 512 * 1024;
var MIN_BLOCK_SIZE = 4 * 1024;
var MAX_PARALLEL_UPLOADS = 1;
var MAX_RETRY_ATTEMPTS = 1;
var MAX_BLOCK_CACHE_SIZE = 50 * 1024 * 1024;
var BLOCK_CACHE_TTL = 5 * 60 * 1000;
function calculateTotalChunks(fileSize) {
  return buildChunkPlan(fileSize).length;
}

// ../../libraries/files-state/src/segments/browser.ts
function generateUUID() {
  return crypto.randomUUID();
}
var $owner = fileTransferDomain.createStore("anonymous", { name: "OWNER" });
var openFilePicker = fileTransferDomain.createEvent("OPEN_FILE_PICKER");
var filesPickerOpened = fileTransferDomain.createEvent("FILES_PICKER_OPENED");
var fileSelected = fileTransferDomain.createEvent("FILE_SELECTED");
var fileInitialized = fileTransferDomain.createEvent("FILE_INITIALIZED");
var uploadChunkRequested = fileTransferDomain.createEvent("UPLOAD_CHUNK_REQUESTED");
var chunkUploadStarted = fileTransferDomain.createEvent("CHUNK_UPLOAD_STARTED");
var chunkUploaded = fileTransferDomain.createEvent("CHUNK_UPLOADED");
var chunkUploadFailed = fileTransferDomain.createEvent("CHUNK_UPLOAD_FAILED");
var nextChunkUploadRequested = fileTransferDomain.createEvent("NEXT_CHUNK_UPLOAD_REQUESTED");
var uploadCompleted = fileTransferDomain.createEvent("UPLOAD_COMPLETED");
var retryChunk = fileTransferDomain.createEvent("RETRY_CHUNK");
var pauseUpload = fileTransferDomain.createEvent("PAUSE_UPLOAD");
var resumeUpload = fileTransferDomain.createEvent("RESUME_UPLOAD");
var cancelUpload = fileTransferDomain.createEvent("CANCEL_UPLOAD");
var downloadRequested = fileTransferDomain.createEvent("DOWNLOAD_REQUESTED");
var saveDialogRequested = fileTransferDomain.createEvent("SAVE_DIALOG_REQUESTED");
var downloadCancelled = fileTransferDomain.createEvent("DOWNLOAD_CANCELLED");
var downloadBufferAppended = fileTransferDomain.createEvent("DOWNLOAD_BUFFER_APPENDED");
var downloadBufferCleared = fileTransferDomain.createEvent("DOWNLOAD_BUFFER_CLEARED");
var downloadOffsetAdvanced = fileTransferDomain.createEvent("DOWNLOAD_OFFSET_ADVANCED");
var fileHandleReady = fileTransferDomain.createEvent("FILE_HANDLE_READY");
var writeChunkRequested = fileTransferDomain.createEvent("WRITE_CHUNK_REQUESTED");
var chunkWritten = fileTransferDomain.createEvent("CHUNK_WRITTEN");
var clearFileState = fileTransferDomain.createEvent("CLEAR_FILE_STATE");
var openFilePickerFx = fileTransferDomain.createEffect("OPEN_FILE_PICKER_FX");
openFilePickerFx.use(async () => {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      resolve(files);
    };
    input.click();
  });
});
var showSaveDialogFx = fileTransferDomain.createEffect("SHOW_SAVE_DIALOG_FX");
showSaveDialogFx.use(async ({ fileName }) => {
  const hasFileSystemAPI = "showSaveFilePicker" in window;
  console.log("[Browser] showSaveDialogFx:", {
    fileName,
    hasFileSystemAPI,
    browser: navigator.userAgent.includes("Firefox") ? "Firefox" : "Other"
  });
  if (hasFileSystemAPI) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName
      });
      console.log("[Browser] File handle obtained via showSaveFilePicker");
      return handle;
    } catch (error) {
      if (error?.name === "AbortError") {
        console.log("[Browser] User cancelled save dialog");
        throw error;
      }
      console.error("[Browser] showSaveFilePicker failed:", error);
      return null;
    }
  }
  console.log("[Browser] File System Access API not supported, using buffer mode");
  return null;
});
var writeChunkFx = fileTransferDomain.createEffect("WRITE_CHUNK_FX");
writeChunkFx.use(async ({ handle, chunk, position }) => {
  if (handle) {
    const writable = await handle.createWritable({ keepExistingData: true });
    await writable.write({ type: "write", position, data: chunk });
    await writable.close();
  }
});
var downloadFileFx = fileTransferDomain.createEffect("DOWNLOAD_FILE_FX");
downloadFileFx.use(async ({ fileId, fileName }) => {
  console.log("[Browser] downloadFileFx called:", { fileId, fileName });
  const { downloadFile: downloadFile2 } = await Promise.resolve().then(() => (init_download(), exports_download));
  const filesService = services.getFilesService();
  const storeService = services.getStoreService();
  if (!filesService || !storeService) {
    console.error("[Browser] Services not initialized");
    throw new Error("Services not initialized");
  }
  console.log("[Browser] Starting download...");
  const result = await downloadFile2(fileId, filesService, storeService);
  if (result.blob.size === 0) {
    console.log("[Browser] File already written via File System Access API");
    return;
  }
  console.log("[Browser] Download complete, creating blob URL");
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || result.fileName;
  document.body.appendChild(link);
  console.log("[Browser] Triggering download click for:", link.download);
  link.click();
  setTimeout(() => {
    console.log("[Browser] Cleaning up blob URL and link");
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 1000);
  console.log("[Browser] Download initiated successfully");
});
var downloadBufferedFileFx = fileTransferDomain.createEffect("DOWNLOAD_BUFFERED_FILE_FX");
downloadBufferedFileFx.use(async ({ fileName, chunks }) => {
  console.log("[Browser] downloadBufferedFileFx called:", {
    fileName,
    chunksCount: chunks.length,
    totalSize: chunks.reduce((sum, c) => sum + c.length, 0)
  });
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
    console.error("[Browser] Browser APIs not available");
    return;
  }
  if (!chunks || chunks.length === 0) {
    console.error("[Browser] No chunks to download");
    return;
  }
  try {
    const blob = new Blob(chunks);
    console.log("[Browser] Blob created:", { size: blob.size, type: blob.type });
    const url = URL.createObjectURL(blob);
    console.log("[Browser] Blob URL created:", url);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    console.log("[Browser] Triggering download click for:", fileName);
    link.click();
    setTimeout(() => {
      console.log("[Browser] Cleaning up blob URL and link");
      URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }, 1000);
    console.log("[Browser] Download initiated successfully");
  } catch (error) {
    console.error("[Browser] Download failed:", error);
    throw error;
  }
});
var retryChunkFx = fileTransferDomain.createEffect("RETRY_CHUNK_FX");
retryChunkFx.use(async ({ fileId, chunkNumber, retryCount }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ fileId, chunkNumber });
    }, 1000 * (retryCount + 1));
  });
});
var $fileHandles = fileTransferDomain.createStore(new Map, { name: "FILE_HANDLES" });
var $downloadMode = fileTransferDomain.createStore(new Map, { name: "DOWNLOAD_MODE" });
var $downloadBuffers = fileTransferDomain.createStore(new Map, { name: "DOWNLOAD_BUFFERS" });
var $downloadOffsets = fileTransferDomain.createStore(new Map, { name: "DOWNLOAD_OFFSETS" });
$downloadMode.on(downloadRequested, (state, { fileId }) => {
  console.log("[Browser] downloadRequested - clearing mode for:", fileId);
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
}).on(fileHandleReady, (state, { fileId, handle }) => {
  const mode = handle ? "file" : "buffer";
  console.log("[Browser] fileHandleReady - setting mode:", { fileId, handle: !!handle, mode });
  const newMap = new Map(state);
  newMap.set(fileId, mode);
  return newMap;
}).on(downloadCancelled, (state, fileId) => {
  console.log("[Browser] downloadCancelled:", fileId);
  const newMap = new Map(state);
  newMap.set(fileId, "cancelled");
  return newMap;
});
$downloadBuffers.on(downloadRequested, (state, { fileId }) => {
  console.log("[Browser] downloadRequested - clearing buffer for:", fileId);
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
}).on(downloadBufferAppended, (state, { fileId, chunk }) => {
  const newMap = new Map(state);
  const existing = newMap.get(fileId) ?? [];
  const updated = [...existing, new Uint8Array(chunk)];
  console.log("[Browser] downloadBufferAppended:", {
    fileId,
    chunkSize: chunk.length,
    totalChunks: updated.length,
    totalBytes: updated.reduce((sum, c) => sum + c.length, 0)
  });
  newMap.set(fileId, updated);
  return newMap;
}).on(downloadBufferCleared, (state, fileId) => {
  console.log("[Browser] downloadBufferCleared:", fileId);
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
});
$downloadOffsets.on(downloadRequested, (state, { fileId }) => {
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
}).on(downloadCancelled, (state, fileId) => {
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
}).on(downloadOffsetAdvanced, (state, { fileId, offset }) => {
  const newMap = new Map(state);
  newMap.set(fileId, offset);
  return newMap;
});
sample5({
  clock: openFilePicker,
  target: openFilePickerFx
});
sample5({
  clock: openFilePickerFx.doneData,
  target: filesPickerOpened
});
sample5({
  clock: filesPickerOpened,
  fn: (files) => files[0],
  filter: (files) => files.length > 0,
  target: fileSelected
});
sample5({
  clock: fileSelected,
  source: $owner,
  fn: (owner, file) => ({
    fileId: generateUUID(),
    file,
    owner
  }),
  target: fileInitialized
});
$files.on(fileInitialized, (state, { fileId, file }) => {
  const totalChunks = calculateTotalChunks(file.size);
  const newMap = new Map(state);
  newMap.set(fileId, {
    fileId,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks,
    uploadedChunks: 0,
    status: "compressing"
  });
  return newMap;
});
sample5({
  clock: uploadChunkRequested,
  source: $chunks,
  filter: (chunks, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    if (!chunk || chunk.status !== "prepared") {
      console.log(`[Browser] uploadChunkRequested BLOCKED: chunk=${chunkNumber}, exists=${!!chunk}, status=${chunk?.status}`);
      return false;
    }
    const uploading = Array.from(chunks.values()).filter((c) => c.fileId === fileId && c.status === "uploading").length;
    const result = uploading < MAX_PARALLEL_UPLOADS;
    console.log(`[Browser] uploadChunkRequested: chunk=${chunkNumber}, uploading=${uploading}, maxParallel=${MAX_PARALLEL_UPLOADS}, pass=${result}`);
    return result;
  },
  fn: (chunks, { fileId, chunkNumber }) => {
    console.log(`[Browser] -> chunkUploadStarted: chunk=${chunkNumber}`);
    return { fileId, chunkNumber };
  },
  target: chunkUploadStarted
});
$chunks.on(chunkUploadStarted, (state, { fileId, chunkNumber }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk)
    return state;
  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: "uploading" });
  return newMap;
});
$chunks.on(chunkUploaded, (state, { fileId, chunkNumber, hash }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk)
    return state;
  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: "uploaded", hash });
  return newMap;
});
$files.on(chunkUploaded, (state, { fileId }) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, uploadedChunks: file.uploadedChunks + 1 });
  return newMap;
});
$chunks.on(chunkUploadFailed, (state, { fileId, chunkNumber, error }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  console.log(`[Browser] chunkUploadFailed: chunk=${chunkNumber}, error=${error.message}, retryCount=${chunk?.retryCount}`);
  if (!chunk)
    return state;
  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: "failed", error: error.message, retryCount: chunk.retryCount + 1 });
  return newMap;
});
sample5({
  clock: chunkUploadFailed,
  source: $chunks,
  filter: (chunks, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    return chunk !== undefined && chunk.retryCount < MAX_RETRY_ATTEMPTS;
  },
  fn: (chunks, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    return { fileId, chunkNumber, retryCount: chunk.retryCount };
  },
  target: retryChunkFx
});
sample5({
  clock: retryChunkFx.doneData,
  target: retryChunk
});
sample5({
  clock: chunkUploaded,
  fn: ({ fileId }) => fileId,
  target: nextChunkUploadRequested
});
sample5({
  clock: nextChunkUploadRequested,
  source: $chunks,
  filter: (chunks, fileId) => {
    const fileChunks = Array.from(chunks.values()).filter((c) => c.fileId === fileId);
    const prepared = fileChunks.filter((c) => c.status === "prepared");
    const uploading = fileChunks.filter((c) => c.status === "uploading").length;
    return prepared.length > 0 && uploading < MAX_PARALLEL_UPLOADS;
  },
  fn: (chunks, fileId) => {
    const prepared = Array.from(chunks.values()).filter((c) => c.fileId === fileId && c.status === "prepared")[0];
    return { fileId: prepared.fileId, chunkNumber: prepared.chunkNumber };
  },
  target: uploadChunkRequested
});
sample5({
  clock: chunkUploaded,
  source: $files,
  filter: (files, { fileId }) => {
    const file = files.get(fileId);
    if (!file?.totalChunks)
      return false;
    return file.uploadedChunks === file.totalChunks;
  },
  fn: (state, { fileId }) => fileId,
  target: uploadCompleted
});
$files.on(uploadCompleted, (state, fileId) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: "completed" });
  return newMap;
});
$chunks.on(retryChunk, (state, { fileId, chunkNumber }) => {
  const key = `${fileId}-${chunkNumber}`;
  const chunk = state.get(key);
  if (!chunk)
    return state;
  const newMap = new Map(state);
  newMap.set(key, { ...chunk, status: "prepared", error: undefined });
  return newMap;
});
sample5({
  clock: retryChunk,
  target: uploadChunkRequested
});
$files.on(pauseUpload, (state, fileId) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: "paused" });
  return newMap;
});
$files.on(resumeUpload, (state, fileId) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, status: "uploading" });
  return newMap;
});
sample5({
  clock: resumeUpload,
  fn: (fileId) => fileId,
  target: nextChunkUploadRequested
});
$files.on(clearFileState, (state, fileId) => {
  const newMap = new Map(state);
  newMap.delete(fileId);
  return newMap;
});
$chunks.on(clearFileState, (state, fileId) => {
  const newMap = new Map(state);
  Array.from(newMap.keys()).filter((key) => key.startsWith(fileId)).forEach((key) => newMap.delete(key));
  return newMap;
});
sample5({
  clock: downloadRequested,
  fn: ({ fileId, fileName }) => {
    console.log("[Browser] downloadRequested -> downloadFileFx:", { fileId, fileName });
    return { fileId, fileName };
  },
  target: downloadFileFx
});
// ../../libraries/files-state/src/segments/ui.ts
import { combine as combine4 } from "effector";
var mapStatus = (file, hasFailedChunk) => {
  if (hasFailedChunk || file.status === "failed") {
    return "error";
  }
  if (file.status === "paused") {
    return "paused";
  }
  if (file.status === "completed") {
    return "uploaded";
  }
  return "uploading";
};
var collectChunks = (chunks, fileId) => {
  return Array.from(chunks.values()).filter((chunk) => chunk.fileId === fileId);
};
var $fileListItems = combine4($files, $chunks, (files, chunks) => {
  return Array.from(files.values()).map((file) => {
    const fileChunks = collectChunks(chunks, file.fileId);
    const uploadedChunks = file.uploadedChunks;
    const failedChunk = fileChunks.find((chunk) => chunk.status === "failed");
    const observedChunks = fileChunks.reduce((max2, chunk) => Math.max(max2, chunk.chunkNumber + 1), fileChunks.length);
    const totalChunksValue = file.totalChunks ?? (observedChunks > 0 ? observedChunks : 0);
    const effectiveTotal = totalChunksValue || (uploadedChunks > 0 ? uploadedChunks : observedChunks);
    const progress = file.status === "completed" ? 100 : effectiveTotal > 0 ? Math.min(100, Math.round(uploadedChunks / effectiveTotal * 100)) : 0;
    const canDownload = file.status === "completed";
    return {
      fileId: file.fileId,
      name: file.fileName,
      progress,
      uploadedChunks,
      totalChunks: totalChunksValue,
      status: mapStatus(file, Boolean(failedChunk)),
      failedChunk: failedChunk?.chunkNumber ?? null,
      retriesLeft: undefined,
      onPause: file.status === "uploading" ? () => pauseUpload(file.fileId) : undefined,
      onResume: file.status === "paused" ? () => resumeUpload(file.fileId) : undefined,
      onCancel: file.status === "completed" ? undefined : () => cancelUpload(file.fileId),
      onRetry: failedChunk ? () => retryChunk({ fileId: file.fileId, chunkNumber: failedChunk.chunkNumber }) : undefined,
      disablePause: file.status !== "uploading",
      disableResume: file.status !== "paused",
      disableCancel: file.status === "completed",
      disableRetry: !failedChunk,
      onDownload: canDownload ? () => downloadRequested({ fileId: file.fileId, fileName: file.fileName }) : undefined,
      disableDownload: !canDownload
    };
  });
});
var $activeUploadsCount = $files.map((files) => Array.from(files.values()).filter((f) => f.status === "uploading" || f.status === "compressing").length);
var $hasFailedUploads = $files.map((files) => Array.from(files.values()).some((f) => f.status === "failed"));
var $totalProgress = $files.map((files) => {
  const activeFiles = Array.from(files.values()).filter((f) => f.status === "uploading" || f.status === "compressing" || f.status === "completed");
  if (activeFiles.length === 0)
    return 0;
  let totalChunks = 0;
  let uploadedChunks = 0;
  for (const file of activeFiles) {
    const total = file.totalChunks ?? file.uploadedChunks;
    totalChunks += total;
    uploadedChunks += file.uploadedChunks;
  }
  return totalChunks > 0 ? Math.round(uploadedChunks / totalChunks * 100) : 0;
});
// ../../libraries/files-state/src/integrations.ts
import { sample as sample6, combine as combine5 } from "effector";
sample6({
  clock: fileInitialized,
  target: fileMetadataCreateRequested
});
sample6({
  clock: fileInitialized,
  fn: ({ fileId, file }) => ({ fileId, file }),
  target: compressionStarted
});
$files.on(compressionCompleted, (state, { fileId, totalChunks }) => {
  const file = state.get(fileId);
  if (!file)
    return state;
  const newMap = new Map(state);
  newMap.set(fileId, { ...file, totalChunks, status: "uploading" });
  return newMap;
});
sample6({
  clock: compressionCompleted,
  source: $fileMetadataCache,
  filter: (cache, { fileId }) => cache.has(fileId),
  fn: (cache, { fileId, totalChunks }) => ({
    fileId,
    patch: {
      chunksCount: totalChunks,
      status: "uploading"
    }
  }),
  target: fileMetadataUpdateRequested
});
$chunks.on(chunkPrepared, (state, { fileId, chunkNumber, data, originalSize, compression }) => {
  const key = `${fileId}-${chunkNumber}`;
  const newMap = new Map(state);
  newMap.set(key, {
    fileId,
    chunkNumber,
    data,
    originalSize,
    compression,
    status: "prepared",
    retryCount: 0
  });
  return newMap;
});
sample6({
  clock: uploadCompleted,
  source: $fileMetadataCache,
  filter: (cache, fileId) => cache.has(fileId),
  fn: (_, fileId) => ({
    fileId,
    patch: {
      status: "uploaded"
    }
  }),
  target: fileMetadataUpdateRequested
});
sample6({
  clock: chunkPrepared,
  fn: ({ fileId }) => fileId,
  target: nextChunkUploadRequested
});
sample6({
  clock: chunkUploadStarted,
  source: combine5({ chunks: $chunks, files: $files }),
  filter: ({ files, chunks }, { fileId, chunkNumber }) => {
    const file = files.get(fileId);
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    const result = file?.status !== "paused" && chunk !== undefined;
    console.log(`[Integration] chunkUploadStarted filter: chunk=${chunkNumber}, fileStatus=${file?.status}, chunkExists=${!!chunk}, pass=${result}`);
    return result;
  },
  fn: ({ chunks }, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const chunk = chunks.get(key);
    console.log(`[Integration] -> blockSaveRequested: chunk=${chunkNumber}, dataSize=${chunk.data.length}, originalSize=${chunk.originalSize}`);
    return {
      fileId,
      chunkNumber,
      data: chunk.data,
      originalSize: chunk.originalSize,
      compression: chunk.compression
    };
  },
  target: blockSaveRequested
});
sample6({
  clock: blockSaved,
  fn: ({ fileId, chunkNumber, hash, chunkSize }) => {
    console.log(`[Integration] blockSaved -> chunkMetadataSaveRequested: chunk=${chunkNumber}, hash=${hash}, chunkSize=${chunkSize}`);
    return {
      fileId,
      chunkNumber,
      hash,
      chunkSize
    };
  },
  target: chunkMetadataSaveRequested
});
var $pendingChunkHashes = fileTransferDomain.createStore(new Map, { name: "PENDING_CHUNK_HASHES" });
$pendingChunkHashes.on(blockSaved, (state, { fileId, chunkNumber, hash }) => {
  const newMap = new Map(state);
  const key = `${fileId}-${chunkNumber}`;
  console.log("[Integration] $pendingChunkHashes.on(blockSaved):", { fileId, chunkNumber, hash });
  newMap.set(key, { fileId, chunkNumber, hash });
  return newMap;
});
sample6({
  clock: chunkMetadataSaved,
  source: $pendingChunkHashes,
  fn: (pending, { fileId, chunkNumber }) => {
    const key = `${fileId}-${chunkNumber}`;
    const data = pending.get(key);
    console.log("[Integration] chunkMetadataSaved -> chunkUploaded:", { fileId, chunkNumber, hasPending: !!data });
    if (!data) {
      console.error("[Integration] Missing hash for chunk:", { fileId, chunkNumber });
      return { fileId, chunkNumber, hash: "" };
    }
    return {
      fileId: data.fileId,
      chunkNumber: data.chunkNumber,
      hash: data.hash
    };
  },
  target: chunkUploaded
});
$pendingChunkHashes.on(chunkUploaded, (state, { fileId, chunkNumber }) => {
  const newMap = new Map(state);
  const key = `${fileId}-${chunkNumber}`;
  newMap.delete(key);
  return newMap;
});
sample6({
  clock: blockSaveFailed,
  fn: ({ fileId, chunkNumber, error }) => {
    console.error(`[Integration] blockSaveFailed -> chunkUploadFailed: chunk=${chunkNumber}, error=`, error);
    return {
      fileId,
      chunkNumber,
      error
    };
  },
  target: chunkUploadFailed
});

// src/services.ts
var callAiChat = async (method, body) => {
  const response = await fetch(`/services/aichat/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return;
  }
  return response.json();
};
var aichatClient2 = {
  ...aichatClient,
  listContexts: (params) => callAiChat("listContexts", { params }),
  getContext: (chatId) => callAiChat("getContext", { chatId }),
  saveContext: (chatId, context) => callAiChat("saveContext", { chatId, context })
};
var storeClient2 = createStoreServiceClient({
  baseUrl: "/services"
});
var filesClient2 = createFilesServiceClient({
  baseUrl: "/services"
});
services.setStoreService(storeClient2);
services.setFilesService(filesClient2);
var workerUrl = new URL("../../../libraries/store-workers/dist/store.worker.js", import.meta.url);
var worker = new Worker(workerUrl, { type: "module" });
setStoreWorker(worker, { baseUrl: "/services/store" });

// src/functions.ts
import { sample as sample11 } from "effector";

// src/domain.ts
import { createDomainLogger } from "front-core";
import { createDomain as createDomain3 } from "effector";

// ../../libraries/aichat-state/src/chat-store.ts
import { sample as sample7 } from "effector";

// ../../libraries/aichat-state/src/domain.ts
import { createDomain as createDomain2 } from "effector";
var chatDomain = createDomain2("chat-core");

// ../../libraries/aichat-state/src/events.ts
var initChat = chatDomain.createEvent("INIT_CHAT");
var sendMessage = chatDomain.createEvent("SEND_MESSAGE");
var addMessage = chatDomain.createEvent("ADD_MESSAGE");
var receiveChunk = chatDomain.createEvent("RECEIVE_CHUNK");
var completeResponse = chatDomain.createEvent("COMPLETE_RESPONSE");
var errorOccurred = chatDomain.createEvent("ERROR_OCCURRED");
var registerFunction = chatDomain.createEvent("REGISTER_FUNCTION");
var toolCallReceived = chatDomain.createEvent("TOOL_CALL_RECEIVED");
var toolCallExecuted = chatDomain.createEvent("TOOL_CALL_EXECUTED");

// ../../libraries/aichat-state/src/handlers.ts
var preserveLineBreaks = (text) => {
  if (!text)
    return "";
  return text.replace(/\\r\\n/g, `\r
`).replace(/\\n/g, `
`).replace(/\\r/g, "\r").replace(/\\\\/g, "\\");
};
var processAccumulatedText = (text) => {
  return preserveLineBreaks(text);
};
var debugLogContent = (content, label = "Content") => {
  console.log(`${label}:`, {
    raw: content,
    length: content.length,
    hasLineBreaks: content.includes(`
`),
    lineBreaksCount: (content.match(/\n/g) || []).length,
    hasEscapedLineBreaks: content.includes("\\n"),
    escapedLineBreaksCount: (content.match(/\\n/g) || []).length
  });
};
var initializeChat = (_, { threadId, serviceType, model }) => ({
  threadId,
  serviceType,
  model,
  sessionId: undefined,
  messages: [],
  isLoading: false,
  currentResponse: "",
  pendingToolCalls: []
});
var addUserMessage = (state, content) => {
  const message = {
    id: `msg_${Date.now()}`,
    type: "user",
    content: preserveLineBreaks(content),
    timestamp: Date.now()
  };
  return {
    ...state,
    messages: [...state.messages, message],
    isLoading: true,
    currentResponse: "",
    pendingToolCalls: []
  };
};
var updateResponse = (state, event) => {
  if (event.type === "text_delta" /* TEXT_DELTA */) {
    const newContent = event.content || "";
    if (newContent.includes("\\n") || newContent.includes(`
`)) {
      console.log("Найден перенос в чанке:", {
        content: newContent,
        hasEscaped: newContent.includes("\\n"),
        hasReal: newContent.includes(`
`)
      });
    }
    return {
      ...state,
      currentResponse: state.currentResponse + newContent
    };
  }
  return state;
};
var finalize = (state) => {
  if (!state.currentResponse.trim() && state.pendingToolCalls.length === 0) {
    return {
      ...state,
      isLoading: false
    };
  }
  const processedContent = processAccumulatedText(state.currentResponse);
  debugLogContent(state.currentResponse, "Raw accumulated content");
  debugLogContent(processedContent, "Processed content");
  const assistantMessage = {
    id: `msg_${Date.now()}`,
    type: "assistant",
    content: processedContent,
    timestamp: Date.now()
  };
  return {
    ...state,
    messages: [...state.messages, assistantMessage],
    isLoading: false,
    currentResponse: ""
  };
};
var handleError = (state) => ({
  ...state,
  isLoading: false,
  currentResponse: "",
  pendingToolCalls: []
});
var createSession = (aiService) => async ({ serviceType, model }) => {
  return await aiService.createSession(serviceType, model);
};
var saveAssistantMessage = (threadsService) => async (state) => {
  if (!state.currentResponse.trim()) {
    return;
  }
  const processedContent = processAccumulatedText(state.currentResponse);
  await threadsService.saveMessage({
    threadId: state.threadId,
    user: "assistant",
    type: "message" /* message */,
    data: processedContent,
    timestamp: Date.now()
  });
};
var sendMessage2 = (aiService, threadsService, $functions) => async ({ content, state }) => {
  if (!state.sessionId)
    return;
  await threadsService.saveMessage({
    threadId: state.threadId,
    user: "user",
    type: "message" /* message */,
    data: preserveLineBreaks(content),
    timestamp: Date.now()
  });
  const messages = [{ type: "text" /* TEXT */, data: preserveLineBreaks(content) }];
  const tools = Object.values($functions.getState()).map(({ execute, ...tool }) => tool);
  const options = { tools };
  try {
    for await (const event of aiService.sendMessage(state.sessionId, messages, options)) {
      receiveChunk(event);
      if (event.type === "completed" /* COMPLETED */) {
        completeResponse();
        break;
      }
      if (event.type === "error" /* ERROR */) {
        errorOccurred(event.message);
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errorOccurred(message);
  }
};
var executeToolCall = ($functions) => async (toolCall) => {
  console.log("Executing tool call:", toolCall);
  const functions = $functions.getState();
  const func = functions[toolCall.name];
  if (func) {
    try {
      const result = await func.execute(toolCall.args);
      console.log("Tool call result:", result);
      return { toolCallId: toolCall.id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("Tool call execution error:", message);
      throw new Error(message);
    }
  } else {
    const errorMessage = `Function "${toolCall.name}" not found`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
};
var sendToolResult = (aiService, threadsService) => async ({ toolCallId, result, state }) => {
  console.log("Sending tool result:", { toolCallId, result });
  if (!state.sessionId) {
    console.error("No session ID available for tool result");
    return;
  }
  let toolResultContent;
  if (typeof result === "string") {
    toolResultContent = preserveLineBreaks(result);
  } else {
    toolResultContent = JSON.stringify(result, null, 2);
  }
  await threadsService.saveMessage({
    threadId: state.threadId,
    user: "assistant",
    type: "message" /* message */,
    data: `Tool call ${toolCallId} result:
${toolResultContent}`,
    timestamp: Date.now()
  });
  const messages = [{
    type: "tool_result" /* TOOL_RESULT */,
    tool_call_id: toolCallId,
    data: toolResultContent
  }];
  try {
    for await (const event of aiService.sendMessage(state.sessionId, messages, {})) {
      receiveChunk(event);
      if (event.type === "completed" /* COMPLETED */) {
        completeResponse();
        break;
      }
      if (event.type === "error" /* ERROR */) {
        errorOccurred(event.message);
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    errorOccurred(message);
  }
};

// ../../libraries/aichat-state/src/chat-store.ts
var initialState = {
  threadId: "",
  serviceType: "",
  model: "",
  sessionId: undefined,
  messages: [],
  isLoading: false,
  currentResponse: "",
  pendingToolCalls: []
};
var createChatStore = (aiService, threadsService) => {
  const $chat = chatDomain.createStore(initialState, { name: "CHAT" }).on(initChat, initializeChat).on(sendMessage, addUserMessage).on(addMessage, (state, message) => ({
    ...state,
    messages: [...state.messages, message]
  })).on(receiveChunk, updateResponse).on(completeResponse, finalize).on(errorOccurred, handleError).on(toolCallReceived, (state, toolCall) => ({
    ...state,
    pendingToolCalls: [...state.pendingToolCalls, toolCall]
  })).on(toolCallExecuted, (state, { toolCallId }) => ({
    ...state,
    pendingToolCalls: state.pendingToolCalls.filter((tc) => tc.id !== toolCallId)
  }));
  const $functions = chatDomain.createStore({}, { name: "FUNCTIONS" }).on(registerFunction, (registry2, { name, handler }) => ({
    ...registry2,
    [name]: handler
  }));
  const createSessionFx = chatDomain.createEffect("CREATE_SESSION_FX");
  const sendMessageFx = chatDomain.createEffect("SEND_MESSAGE_FX");
  const executeToolCallFx = chatDomain.createEffect("EXECUTE_TOOL_CALL_FX");
  const sendToolResultFx = chatDomain.createEffect("SEND_TOOL_RESULT_FX");
  const saveAssistantMessageFx = chatDomain.createEffect("SAVE_ASSISTANT_MESSAGE_FX");
  createSessionFx.use(createSession(aiService));
  sendMessageFx.use(sendMessage2(aiService, threadsService, $functions));
  executeToolCallFx.use(executeToolCall($functions));
  sendToolResultFx.use(sendToolResult(aiService, threadsService));
  saveAssistantMessageFx.use(saveAssistantMessage(threadsService));
  sample7({
    clock: initChat,
    target: createSessionFx
  });
  sample7({
    clock: createSessionFx.doneData,
    source: $chat,
    fn: (state, sessionId) => ({ ...state, sessionId }),
    target: $chat
  });
  sample7({
    clock: sendMessage,
    source: $chat,
    fn: (state, content) => ({ content, state }),
    target: sendMessageFx
  });
  sample7({
    clock: receiveChunk,
    filter: (event) => event.type === "tool_call" /* TOOL_CALL */,
    fn: (event) => event,
    target: toolCallReceived
  });
  sample7({
    clock: toolCallReceived,
    target: executeToolCallFx
  });
  sample7({
    clock: executeToolCallFx.doneData,
    source: $chat,
    fn: (state, { toolCallId, result }) => ({ toolCallId, result, state }),
    target: sendToolResultFx
  });
  sample7({
    clock: executeToolCallFx.doneData,
    fn: ({ toolCallId, result }) => ({ toolCallId, result }),
    target: toolCallExecuted
  });
  sample7({
    clock: executeToolCallFx.failData,
    fn: (error) => {
      console.error("Tool call execution failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errorOccurred(errorMessage);
      return { toolCallId: "", result: null, error: errorMessage };
    },
    target: toolCallExecuted
  });
  sample7({
    clock: completeResponse,
    source: $chat,
    target: saveAssistantMessageFx
  });
  return {
    $chat,
    $functions,
    init: (threadId, serviceType, model) => initChat({ threadId, serviceType, model }),
    send: (content) => sendMessage(content),
    registerFunction: (name, handler) => registerFunction({ name, handler }),
    get messages() {
      return $chat.getState().messages;
    },
    get isLoading() {
      return $chat.getState().isLoading;
    },
    get currentResponse() {
      return $chat.getState().currentResponse;
    }
  };
};
// src/domain.ts
var domain2 = createDomain3("aichat");
createDomainLogger(domain2);
createDomainLogger(chatDomain);
var domain_default = domain2;

// src/views/ChatView.tsx
import { useEffect as useEffect3 } from "react";

// src/components/ChatDetail.tsx
import { useState as useState2, useEffect as useEffect2, useRef, useCallback } from "react";
import { Send, Bot, Paperclip, FileDown } from "lucide-react";
import {
  Button as Button2,
  Card,
  CardContent,
  CardFooter,
  ScrollArea,
  cn as cn2
} from "front-core";

// ../../../../node_modules/.bun/devlop@1.1.0/node_modules/devlop/lib/development.js
var codesWarned = new Set;

class AssertionError extends Error {
  name = "Assertion";
  code = "ERR_ASSERTION";
  constructor(message, actual, expected, operator, generated) {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.actual = actual;
    this.expected = expected;
    this.generated = generated;
    this.operator = operator;
  }
}
function ok(value, message) {
  assert(Boolean(value), false, true, "ok", "Expected value to be truthy", message);
}
function unreachable(message) {
  assert(false, false, true, "ok", "Unreachable", message);
}
function assert(bool, actual, expected, operator, defaultMessage, userMessage) {
  if (!bool) {
    throw userMessage instanceof Error ? userMessage : new AssertionError(userMessage || defaultMessage, actual, expected, operator, !userMessage);
  }
}

// ../../../../node_modules/.bun/comma-separated-tokens@2.0.3/node_modules/comma-separated-tokens/index.js
function stringify(values, options) {
  const settings = options || {};
  const input = values[values.length - 1] === "" ? [...values, ""] : values;
  return input.join((settings.padRight ? " " : "") + "," + (settings.padLeft === false ? "" : " ")).trim();
}

// ../../../../node_modules/.bun/estree-util-is-identifier-name@3.0.0/node_modules/estree-util-is-identifier-name/lib/index.js
var nameRe = /^[$_\p{ID_Start}][$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var nameReJsx = /^[$_\p{ID_Start}][-$_\u{200C}\u{200D}\p{ID_Continue}]*$/u;
var emptyOptions = {};
function name(name2, options) {
  const settings = options || emptyOptions;
  const re = settings.jsx ? nameReJsx : nameRe;
  return re.test(name2);
}
// ../../../../node_modules/.bun/hast-util-whitespace@3.0.0/node_modules/hast-util-whitespace/lib/index.js
var re = /[ \t\n\f\r]/g;
function whitespace(thing) {
  return typeof thing === "object" ? thing.type === "text" ? empty(thing.value) : false : empty(thing);
}
function empty(value) {
  return value.replace(re, "") === "";
}
// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/schema.js
class Schema {
  constructor(property, normal, space) {
    this.normal = normal;
    this.property = property;
    if (space) {
      this.space = space;
    }
  }
}
Schema.prototype.normal = {};
Schema.prototype.property = {};
Schema.prototype.space = undefined;

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/merge.js
function merge(definitions, space) {
  const property = {};
  const normal = {};
  for (const definition of definitions) {
    Object.assign(property, definition.property);
    Object.assign(normal, definition.normal);
  }
  return new Schema(property, normal, space);
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/normalize.js
function normalize(value) {
  return value.toLowerCase();
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/info.js
class Info {
  constructor(property, attribute) {
    this.attribute = attribute;
    this.property = property;
  }
}
Info.prototype.attribute = "";
Info.prototype.booleanish = false;
Info.prototype.boolean = false;
Info.prototype.commaOrSpaceSeparated = false;
Info.prototype.commaSeparated = false;
Info.prototype.defined = false;
Info.prototype.mustUseProperty = false;
Info.prototype.number = false;
Info.prototype.overloadedBoolean = false;
Info.prototype.property = "";
Info.prototype.spaceSeparated = false;
Info.prototype.space = undefined;

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/types.js
var exports_types2 = {};
__export(exports_types2, {
  spaceSeparated: () => spaceSeparated,
  overloadedBoolean: () => overloadedBoolean,
  number: () => number,
  commaSeparated: () => commaSeparated,
  commaOrSpaceSeparated: () => commaOrSpaceSeparated,
  booleanish: () => booleanish,
  boolean: () => boolean
});
var powers = 0;
var boolean = increment();
var booleanish = increment();
var overloadedBoolean = increment();
var number = increment();
var spaceSeparated = increment();
var commaSeparated = increment();
var commaOrSpaceSeparated = increment();
function increment() {
  return 2 ** ++powers;
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/defined-info.js
var checks = Object.keys(exports_types2);

class DefinedInfo extends Info {
  constructor(property, attribute, mask, space) {
    let index = -1;
    super(property, attribute);
    mark(this, "space", space);
    if (typeof mask === "number") {
      while (++index < checks.length) {
        const check = checks[index];
        mark(this, checks[index], (mask & exports_types2[check]) === exports_types2[check]);
      }
    }
  }
}
DefinedInfo.prototype.defined = true;
function mark(values, key, value) {
  if (value) {
    values[key] = value;
  }
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/create.js
function create(definition) {
  const properties = {};
  const normals = {};
  for (const [property, value] of Object.entries(definition.properties)) {
    const info = new DefinedInfo(property, definition.transform(definition.attributes || {}, property), value, definition.space);
    if (definition.mustUseProperty && definition.mustUseProperty.includes(property)) {
      info.mustUseProperty = true;
    }
    properties[property] = info;
    normals[normalize(property)] = property;
    normals[normalize(info.attribute)] = property;
  }
  return new Schema(properties, normals, definition.space);
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/aria.js
var aria = create({
  properties: {
    ariaActiveDescendant: null,
    ariaAtomic: booleanish,
    ariaAutoComplete: null,
    ariaBusy: booleanish,
    ariaChecked: booleanish,
    ariaColCount: number,
    ariaColIndex: number,
    ariaColSpan: number,
    ariaControls: spaceSeparated,
    ariaCurrent: null,
    ariaDescribedBy: spaceSeparated,
    ariaDetails: null,
    ariaDisabled: booleanish,
    ariaDropEffect: spaceSeparated,
    ariaErrorMessage: null,
    ariaExpanded: booleanish,
    ariaFlowTo: spaceSeparated,
    ariaGrabbed: booleanish,
    ariaHasPopup: null,
    ariaHidden: booleanish,
    ariaInvalid: null,
    ariaKeyShortcuts: null,
    ariaLabel: null,
    ariaLabelledBy: spaceSeparated,
    ariaLevel: number,
    ariaLive: null,
    ariaModal: booleanish,
    ariaMultiLine: booleanish,
    ariaMultiSelectable: booleanish,
    ariaOrientation: null,
    ariaOwns: spaceSeparated,
    ariaPlaceholder: null,
    ariaPosInSet: number,
    ariaPressed: booleanish,
    ariaReadOnly: booleanish,
    ariaRelevant: null,
    ariaRequired: booleanish,
    ariaRoleDescription: spaceSeparated,
    ariaRowCount: number,
    ariaRowIndex: number,
    ariaRowSpan: number,
    ariaSelected: booleanish,
    ariaSetSize: number,
    ariaSort: null,
    ariaValueMax: number,
    ariaValueMin: number,
    ariaValueNow: number,
    ariaValueText: null,
    role: null
  },
  transform(_, property) {
    return property === "role" ? property : "aria-" + property.slice(4).toLowerCase();
  }
});

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/case-sensitive-transform.js
function caseSensitiveTransform(attributes, attribute) {
  return attribute in attributes ? attributes[attribute] : attribute;
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/util/case-insensitive-transform.js
function caseInsensitiveTransform(attributes, property) {
  return caseSensitiveTransform(attributes, property.toLowerCase());
}

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/html.js
var html = create({
  attributes: {
    acceptcharset: "accept-charset",
    classname: "class",
    htmlfor: "for",
    httpequiv: "http-equiv"
  },
  mustUseProperty: ["checked", "multiple", "muted", "selected"],
  properties: {
    abbr: null,
    accept: commaSeparated,
    acceptCharset: spaceSeparated,
    accessKey: spaceSeparated,
    action: null,
    allow: null,
    allowFullScreen: boolean,
    allowPaymentRequest: boolean,
    allowUserMedia: boolean,
    alt: null,
    as: null,
    async: boolean,
    autoCapitalize: null,
    autoComplete: spaceSeparated,
    autoFocus: boolean,
    autoPlay: boolean,
    blocking: spaceSeparated,
    capture: null,
    charSet: null,
    checked: boolean,
    cite: null,
    className: spaceSeparated,
    cols: number,
    colSpan: null,
    content: null,
    contentEditable: booleanish,
    controls: boolean,
    controlsList: spaceSeparated,
    coords: number | commaSeparated,
    crossOrigin: null,
    data: null,
    dateTime: null,
    decoding: null,
    default: boolean,
    defer: boolean,
    dir: null,
    dirName: null,
    disabled: boolean,
    download: overloadedBoolean,
    draggable: booleanish,
    encType: null,
    enterKeyHint: null,
    fetchPriority: null,
    form: null,
    formAction: null,
    formEncType: null,
    formMethod: null,
    formNoValidate: boolean,
    formTarget: null,
    headers: spaceSeparated,
    height: number,
    hidden: overloadedBoolean,
    high: number,
    href: null,
    hrefLang: null,
    htmlFor: spaceSeparated,
    httpEquiv: spaceSeparated,
    id: null,
    imageSizes: null,
    imageSrcSet: null,
    inert: boolean,
    inputMode: null,
    integrity: null,
    is: null,
    isMap: boolean,
    itemId: null,
    itemProp: spaceSeparated,
    itemRef: spaceSeparated,
    itemScope: boolean,
    itemType: spaceSeparated,
    kind: null,
    label: null,
    lang: null,
    language: null,
    list: null,
    loading: null,
    loop: boolean,
    low: number,
    manifest: null,
    max: null,
    maxLength: number,
    media: null,
    method: null,
    min: null,
    minLength: number,
    multiple: boolean,
    muted: boolean,
    name: null,
    nonce: null,
    noModule: boolean,
    noValidate: boolean,
    onAbort: null,
    onAfterPrint: null,
    onAuxClick: null,
    onBeforeMatch: null,
    onBeforePrint: null,
    onBeforeToggle: null,
    onBeforeUnload: null,
    onBlur: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onContextLost: null,
    onContextMenu: null,
    onContextRestored: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFormData: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLanguageChange: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadEnd: null,
    onLoadStart: null,
    onMessage: null,
    onMessageError: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRejectionHandled: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onScrollEnd: null,
    onSecurityPolicyViolation: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onSlotChange: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnhandledRejection: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onWheel: null,
    open: boolean,
    optimum: number,
    pattern: null,
    ping: spaceSeparated,
    placeholder: null,
    playsInline: boolean,
    popover: null,
    popoverTarget: null,
    popoverTargetAction: null,
    poster: null,
    preload: null,
    readOnly: boolean,
    referrerPolicy: null,
    rel: spaceSeparated,
    required: boolean,
    reversed: boolean,
    rows: number,
    rowSpan: number,
    sandbox: spaceSeparated,
    scope: null,
    scoped: boolean,
    seamless: boolean,
    selected: boolean,
    shadowRootClonable: boolean,
    shadowRootDelegatesFocus: boolean,
    shadowRootMode: null,
    shape: null,
    size: number,
    sizes: null,
    slot: null,
    span: number,
    spellCheck: booleanish,
    src: null,
    srcDoc: null,
    srcLang: null,
    srcSet: null,
    start: number,
    step: null,
    style: null,
    tabIndex: number,
    target: null,
    title: null,
    translate: null,
    type: null,
    typeMustMatch: boolean,
    useMap: null,
    value: booleanish,
    width: number,
    wrap: null,
    writingSuggestions: null,
    align: null,
    aLink: null,
    archive: spaceSeparated,
    axis: null,
    background: null,
    bgColor: null,
    border: number,
    borderColor: null,
    bottomMargin: number,
    cellPadding: null,
    cellSpacing: null,
    char: null,
    charOff: null,
    classId: null,
    clear: null,
    code: null,
    codeBase: null,
    codeType: null,
    color: null,
    compact: boolean,
    declare: boolean,
    event: null,
    face: null,
    frame: null,
    frameBorder: null,
    hSpace: number,
    leftMargin: number,
    link: null,
    longDesc: null,
    lowSrc: null,
    marginHeight: number,
    marginWidth: number,
    noResize: boolean,
    noHref: boolean,
    noShade: boolean,
    noWrap: boolean,
    object: null,
    profile: null,
    prompt: null,
    rev: null,
    rightMargin: number,
    rules: null,
    scheme: null,
    scrolling: booleanish,
    standby: null,
    summary: null,
    text: null,
    topMargin: number,
    valueType: null,
    version: null,
    vAlign: null,
    vLink: null,
    vSpace: number,
    allowTransparency: null,
    autoCorrect: null,
    autoSave: null,
    disablePictureInPicture: boolean,
    disableRemotePlayback: boolean,
    prefix: null,
    property: null,
    results: number,
    security: null,
    unselectable: null
  },
  space: "html",
  transform: caseInsensitiveTransform
});

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/svg.js
var svg = create({
  attributes: {
    accentHeight: "accent-height",
    alignmentBaseline: "alignment-baseline",
    arabicForm: "arabic-form",
    baselineShift: "baseline-shift",
    capHeight: "cap-height",
    className: "class",
    clipPath: "clip-path",
    clipRule: "clip-rule",
    colorInterpolation: "color-interpolation",
    colorInterpolationFilters: "color-interpolation-filters",
    colorProfile: "color-profile",
    colorRendering: "color-rendering",
    crossOrigin: "crossorigin",
    dataType: "datatype",
    dominantBaseline: "dominant-baseline",
    enableBackground: "enable-background",
    fillOpacity: "fill-opacity",
    fillRule: "fill-rule",
    floodColor: "flood-color",
    floodOpacity: "flood-opacity",
    fontFamily: "font-family",
    fontSize: "font-size",
    fontSizeAdjust: "font-size-adjust",
    fontStretch: "font-stretch",
    fontStyle: "font-style",
    fontVariant: "font-variant",
    fontWeight: "font-weight",
    glyphName: "glyph-name",
    glyphOrientationHorizontal: "glyph-orientation-horizontal",
    glyphOrientationVertical: "glyph-orientation-vertical",
    hrefLang: "hreflang",
    horizAdvX: "horiz-adv-x",
    horizOriginX: "horiz-origin-x",
    horizOriginY: "horiz-origin-y",
    imageRendering: "image-rendering",
    letterSpacing: "letter-spacing",
    lightingColor: "lighting-color",
    markerEnd: "marker-end",
    markerMid: "marker-mid",
    markerStart: "marker-start",
    navDown: "nav-down",
    navDownLeft: "nav-down-left",
    navDownRight: "nav-down-right",
    navLeft: "nav-left",
    navNext: "nav-next",
    navPrev: "nav-prev",
    navRight: "nav-right",
    navUp: "nav-up",
    navUpLeft: "nav-up-left",
    navUpRight: "nav-up-right",
    onAbort: "onabort",
    onActivate: "onactivate",
    onAfterPrint: "onafterprint",
    onBeforePrint: "onbeforeprint",
    onBegin: "onbegin",
    onCancel: "oncancel",
    onCanPlay: "oncanplay",
    onCanPlayThrough: "oncanplaythrough",
    onChange: "onchange",
    onClick: "onclick",
    onClose: "onclose",
    onCopy: "oncopy",
    onCueChange: "oncuechange",
    onCut: "oncut",
    onDblClick: "ondblclick",
    onDrag: "ondrag",
    onDragEnd: "ondragend",
    onDragEnter: "ondragenter",
    onDragExit: "ondragexit",
    onDragLeave: "ondragleave",
    onDragOver: "ondragover",
    onDragStart: "ondragstart",
    onDrop: "ondrop",
    onDurationChange: "ondurationchange",
    onEmptied: "onemptied",
    onEnd: "onend",
    onEnded: "onended",
    onError: "onerror",
    onFocus: "onfocus",
    onFocusIn: "onfocusin",
    onFocusOut: "onfocusout",
    onHashChange: "onhashchange",
    onInput: "oninput",
    onInvalid: "oninvalid",
    onKeyDown: "onkeydown",
    onKeyPress: "onkeypress",
    onKeyUp: "onkeyup",
    onLoad: "onload",
    onLoadedData: "onloadeddata",
    onLoadedMetadata: "onloadedmetadata",
    onLoadStart: "onloadstart",
    onMessage: "onmessage",
    onMouseDown: "onmousedown",
    onMouseEnter: "onmouseenter",
    onMouseLeave: "onmouseleave",
    onMouseMove: "onmousemove",
    onMouseOut: "onmouseout",
    onMouseOver: "onmouseover",
    onMouseUp: "onmouseup",
    onMouseWheel: "onmousewheel",
    onOffline: "onoffline",
    onOnline: "ononline",
    onPageHide: "onpagehide",
    onPageShow: "onpageshow",
    onPaste: "onpaste",
    onPause: "onpause",
    onPlay: "onplay",
    onPlaying: "onplaying",
    onPopState: "onpopstate",
    onProgress: "onprogress",
    onRateChange: "onratechange",
    onRepeat: "onrepeat",
    onReset: "onreset",
    onResize: "onresize",
    onScroll: "onscroll",
    onSeeked: "onseeked",
    onSeeking: "onseeking",
    onSelect: "onselect",
    onShow: "onshow",
    onStalled: "onstalled",
    onStorage: "onstorage",
    onSubmit: "onsubmit",
    onSuspend: "onsuspend",
    onTimeUpdate: "ontimeupdate",
    onToggle: "ontoggle",
    onUnload: "onunload",
    onVolumeChange: "onvolumechange",
    onWaiting: "onwaiting",
    onZoom: "onzoom",
    overlinePosition: "overline-position",
    overlineThickness: "overline-thickness",
    paintOrder: "paint-order",
    panose1: "panose-1",
    pointerEvents: "pointer-events",
    referrerPolicy: "referrerpolicy",
    renderingIntent: "rendering-intent",
    shapeRendering: "shape-rendering",
    stopColor: "stop-color",
    stopOpacity: "stop-opacity",
    strikethroughPosition: "strikethrough-position",
    strikethroughThickness: "strikethrough-thickness",
    strokeDashArray: "stroke-dasharray",
    strokeDashOffset: "stroke-dashoffset",
    strokeLineCap: "stroke-linecap",
    strokeLineJoin: "stroke-linejoin",
    strokeMiterLimit: "stroke-miterlimit",
    strokeOpacity: "stroke-opacity",
    strokeWidth: "stroke-width",
    tabIndex: "tabindex",
    textAnchor: "text-anchor",
    textDecoration: "text-decoration",
    textRendering: "text-rendering",
    transformOrigin: "transform-origin",
    typeOf: "typeof",
    underlinePosition: "underline-position",
    underlineThickness: "underline-thickness",
    unicodeBidi: "unicode-bidi",
    unicodeRange: "unicode-range",
    unitsPerEm: "units-per-em",
    vAlphabetic: "v-alphabetic",
    vHanging: "v-hanging",
    vIdeographic: "v-ideographic",
    vMathematical: "v-mathematical",
    vectorEffect: "vector-effect",
    vertAdvY: "vert-adv-y",
    vertOriginX: "vert-origin-x",
    vertOriginY: "vert-origin-y",
    wordSpacing: "word-spacing",
    writingMode: "writing-mode",
    xHeight: "x-height",
    playbackOrder: "playbackorder",
    timelineBegin: "timelinebegin"
  },
  properties: {
    about: commaOrSpaceSeparated,
    accentHeight: number,
    accumulate: null,
    additive: null,
    alignmentBaseline: null,
    alphabetic: number,
    amplitude: number,
    arabicForm: null,
    ascent: number,
    attributeName: null,
    attributeType: null,
    azimuth: number,
    bandwidth: null,
    baselineShift: null,
    baseFrequency: null,
    baseProfile: null,
    bbox: null,
    begin: null,
    bias: number,
    by: null,
    calcMode: null,
    capHeight: number,
    className: spaceSeparated,
    clip: null,
    clipPath: null,
    clipPathUnits: null,
    clipRule: null,
    color: null,
    colorInterpolation: null,
    colorInterpolationFilters: null,
    colorProfile: null,
    colorRendering: null,
    content: null,
    contentScriptType: null,
    contentStyleType: null,
    crossOrigin: null,
    cursor: null,
    cx: null,
    cy: null,
    d: null,
    dataType: null,
    defaultAction: null,
    descent: number,
    diffuseConstant: number,
    direction: null,
    display: null,
    dur: null,
    divisor: number,
    dominantBaseline: null,
    download: boolean,
    dx: null,
    dy: null,
    edgeMode: null,
    editable: null,
    elevation: number,
    enableBackground: null,
    end: null,
    event: null,
    exponent: number,
    externalResourcesRequired: null,
    fill: null,
    fillOpacity: number,
    fillRule: null,
    filter: null,
    filterRes: null,
    filterUnits: null,
    floodColor: null,
    floodOpacity: null,
    focusable: null,
    focusHighlight: null,
    fontFamily: null,
    fontSize: null,
    fontSizeAdjust: null,
    fontStretch: null,
    fontStyle: null,
    fontVariant: null,
    fontWeight: null,
    format: null,
    fr: null,
    from: null,
    fx: null,
    fy: null,
    g1: commaSeparated,
    g2: commaSeparated,
    glyphName: commaSeparated,
    glyphOrientationHorizontal: null,
    glyphOrientationVertical: null,
    glyphRef: null,
    gradientTransform: null,
    gradientUnits: null,
    handler: null,
    hanging: number,
    hatchContentUnits: null,
    hatchUnits: null,
    height: null,
    href: null,
    hrefLang: null,
    horizAdvX: number,
    horizOriginX: number,
    horizOriginY: number,
    id: null,
    ideographic: number,
    imageRendering: null,
    initialVisibility: null,
    in: null,
    in2: null,
    intercept: number,
    k: number,
    k1: number,
    k2: number,
    k3: number,
    k4: number,
    kernelMatrix: commaOrSpaceSeparated,
    kernelUnitLength: null,
    keyPoints: null,
    keySplines: null,
    keyTimes: null,
    kerning: null,
    lang: null,
    lengthAdjust: null,
    letterSpacing: null,
    lightingColor: null,
    limitingConeAngle: number,
    local: null,
    markerEnd: null,
    markerMid: null,
    markerStart: null,
    markerHeight: null,
    markerUnits: null,
    markerWidth: null,
    mask: null,
    maskContentUnits: null,
    maskUnits: null,
    mathematical: null,
    max: null,
    media: null,
    mediaCharacterEncoding: null,
    mediaContentEncodings: null,
    mediaSize: number,
    mediaTime: null,
    method: null,
    min: null,
    mode: null,
    name: null,
    navDown: null,
    navDownLeft: null,
    navDownRight: null,
    navLeft: null,
    navNext: null,
    navPrev: null,
    navRight: null,
    navUp: null,
    navUpLeft: null,
    navUpRight: null,
    numOctaves: null,
    observer: null,
    offset: null,
    onAbort: null,
    onActivate: null,
    onAfterPrint: null,
    onBeforePrint: null,
    onBegin: null,
    onCancel: null,
    onCanPlay: null,
    onCanPlayThrough: null,
    onChange: null,
    onClick: null,
    onClose: null,
    onCopy: null,
    onCueChange: null,
    onCut: null,
    onDblClick: null,
    onDrag: null,
    onDragEnd: null,
    onDragEnter: null,
    onDragExit: null,
    onDragLeave: null,
    onDragOver: null,
    onDragStart: null,
    onDrop: null,
    onDurationChange: null,
    onEmptied: null,
    onEnd: null,
    onEnded: null,
    onError: null,
    onFocus: null,
    onFocusIn: null,
    onFocusOut: null,
    onHashChange: null,
    onInput: null,
    onInvalid: null,
    onKeyDown: null,
    onKeyPress: null,
    onKeyUp: null,
    onLoad: null,
    onLoadedData: null,
    onLoadedMetadata: null,
    onLoadStart: null,
    onMessage: null,
    onMouseDown: null,
    onMouseEnter: null,
    onMouseLeave: null,
    onMouseMove: null,
    onMouseOut: null,
    onMouseOver: null,
    onMouseUp: null,
    onMouseWheel: null,
    onOffline: null,
    onOnline: null,
    onPageHide: null,
    onPageShow: null,
    onPaste: null,
    onPause: null,
    onPlay: null,
    onPlaying: null,
    onPopState: null,
    onProgress: null,
    onRateChange: null,
    onRepeat: null,
    onReset: null,
    onResize: null,
    onScroll: null,
    onSeeked: null,
    onSeeking: null,
    onSelect: null,
    onShow: null,
    onStalled: null,
    onStorage: null,
    onSubmit: null,
    onSuspend: null,
    onTimeUpdate: null,
    onToggle: null,
    onUnload: null,
    onVolumeChange: null,
    onWaiting: null,
    onZoom: null,
    opacity: null,
    operator: null,
    order: null,
    orient: null,
    orientation: null,
    origin: null,
    overflow: null,
    overlay: null,
    overlinePosition: number,
    overlineThickness: number,
    paintOrder: null,
    panose1: null,
    path: null,
    pathLength: number,
    patternContentUnits: null,
    patternTransform: null,
    patternUnits: null,
    phase: null,
    ping: spaceSeparated,
    pitch: null,
    playbackOrder: null,
    pointerEvents: null,
    points: null,
    pointsAtX: number,
    pointsAtY: number,
    pointsAtZ: number,
    preserveAlpha: null,
    preserveAspectRatio: null,
    primitiveUnits: null,
    propagate: null,
    property: commaOrSpaceSeparated,
    r: null,
    radius: null,
    referrerPolicy: null,
    refX: null,
    refY: null,
    rel: commaOrSpaceSeparated,
    rev: commaOrSpaceSeparated,
    renderingIntent: null,
    repeatCount: null,
    repeatDur: null,
    requiredExtensions: commaOrSpaceSeparated,
    requiredFeatures: commaOrSpaceSeparated,
    requiredFonts: commaOrSpaceSeparated,
    requiredFormats: commaOrSpaceSeparated,
    resource: null,
    restart: null,
    result: null,
    rotate: null,
    rx: null,
    ry: null,
    scale: null,
    seed: null,
    shapeRendering: null,
    side: null,
    slope: null,
    snapshotTime: null,
    specularConstant: number,
    specularExponent: number,
    spreadMethod: null,
    spacing: null,
    startOffset: null,
    stdDeviation: null,
    stemh: null,
    stemv: null,
    stitchTiles: null,
    stopColor: null,
    stopOpacity: null,
    strikethroughPosition: number,
    strikethroughThickness: number,
    string: null,
    stroke: null,
    strokeDashArray: commaOrSpaceSeparated,
    strokeDashOffset: null,
    strokeLineCap: null,
    strokeLineJoin: null,
    strokeMiterLimit: number,
    strokeOpacity: number,
    strokeWidth: null,
    style: null,
    surfaceScale: number,
    syncBehavior: null,
    syncBehaviorDefault: null,
    syncMaster: null,
    syncTolerance: null,
    syncToleranceDefault: null,
    systemLanguage: commaOrSpaceSeparated,
    tabIndex: number,
    tableValues: null,
    target: null,
    targetX: number,
    targetY: number,
    textAnchor: null,
    textDecoration: null,
    textRendering: null,
    textLength: null,
    timelineBegin: null,
    title: null,
    transformBehavior: null,
    type: null,
    typeOf: commaOrSpaceSeparated,
    to: null,
    transform: null,
    transformOrigin: null,
    u1: null,
    u2: null,
    underlinePosition: number,
    underlineThickness: number,
    unicode: null,
    unicodeBidi: null,
    unicodeRange: null,
    unitsPerEm: number,
    values: null,
    vAlphabetic: number,
    vMathematical: number,
    vectorEffect: null,
    vHanging: number,
    vIdeographic: number,
    version: null,
    vertAdvY: number,
    vertOriginX: number,
    vertOriginY: number,
    viewBox: null,
    viewTarget: null,
    visibility: null,
    width: null,
    widths: null,
    wordSpacing: null,
    writingMode: null,
    x: null,
    x1: null,
    x2: null,
    xChannelSelector: null,
    xHeight: number,
    y: null,
    y1: null,
    y2: null,
    yChannelSelector: null,
    z: null,
    zoomAndPan: null
  },
  space: "svg",
  transform: caseSensitiveTransform
});

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/xlink.js
var xlink = create({
  properties: {
    xLinkActuate: null,
    xLinkArcRole: null,
    xLinkHref: null,
    xLinkRole: null,
    xLinkShow: null,
    xLinkTitle: null,
    xLinkType: null
  },
  space: "xlink",
  transform(_, property) {
    return "xlink:" + property.slice(5).toLowerCase();
  }
});

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/xmlns.js
var xmlns = create({
  attributes: { xmlnsxlink: "xmlns:xlink" },
  properties: { xmlnsXLink: null, xmlns: null },
  space: "xmlns",
  transform: caseInsensitiveTransform
});

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/xml.js
var xml = create({
  properties: { xmlBase: null, xmlLang: null, xmlSpace: null },
  space: "xml",
  transform(_, property) {
    return "xml:" + property.slice(3).toLowerCase();
  }
});

// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/hast-to-react.js
var hastToReact = {
  classId: "classID",
  dataType: "datatype",
  itemId: "itemID",
  strokeDashArray: "strokeDasharray",
  strokeDashOffset: "strokeDashoffset",
  strokeLineCap: "strokeLinecap",
  strokeLineJoin: "strokeLinejoin",
  strokeMiterLimit: "strokeMiterlimit",
  typeOf: "typeof",
  xLinkActuate: "xlinkActuate",
  xLinkArcRole: "xlinkArcrole",
  xLinkHref: "xlinkHref",
  xLinkRole: "xlinkRole",
  xLinkShow: "xlinkShow",
  xLinkTitle: "xlinkTitle",
  xLinkType: "xlinkType",
  xmlnsXLink: "xmlnsXlink"
};
// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/lib/find.js
var cap = /[A-Z]/g;
var dash = /-[a-z]/g;
var valid = /^data[-\w.:]+$/i;
function find(schema, value) {
  const normal = normalize(value);
  let property = value;
  let Type = Info;
  if (normal in schema.normal) {
    return schema.property[schema.normal[normal]];
  }
  if (normal.length > 4 && normal.slice(0, 4) === "data" && valid.test(value)) {
    if (value.charAt(4) === "-") {
      const rest = value.slice(5).replace(dash, camelcase);
      property = "data" + rest.charAt(0).toUpperCase() + rest.slice(1);
    } else {
      const rest = value.slice(4);
      if (!dash.test(rest)) {
        let dashes = rest.replace(cap, kebab);
        if (dashes.charAt(0) !== "-") {
          dashes = "-" + dashes;
        }
        value = "data" + dashes;
      }
    }
    Type = DefinedInfo;
  }
  return new Type(property, value);
}
function kebab($0) {
  return "-" + $0.toLowerCase();
}
function camelcase($0) {
  return $0.charAt(1).toUpperCase();
}
// ../../../../node_modules/.bun/property-information@7.1.0/node_modules/property-information/index.js
var html2 = merge([aria, html, xlink, xmlns, xml], "html");
var svg2 = merge([aria, svg, xlink, xmlns, xml], "svg");

// ../../../../node_modules/.bun/space-separated-tokens@2.0.2/node_modules/space-separated-tokens/index.js
function stringify2(values) {
  return values.join(" ").trim();
}

// ../../../../node_modules/.bun/hast-util-to-jsx-runtime@2.3.6/node_modules/hast-util-to-jsx-runtime/lib/index.js
var import_style_to_js = __toESM(require_cjs3(), 1);

// ../../../../node_modules/.bun/unist-util-position@5.0.0/node_modules/unist-util-position/lib/index.js
var pointEnd = point("end");
var pointStart = point("start");
function point(type) {
  return point2;
  function point2(node) {
    const point3 = node && node.position && node.position[type] || {};
    if (typeof point3.line === "number" && point3.line > 0 && typeof point3.column === "number" && point3.column > 0) {
      return {
        line: point3.line,
        column: point3.column,
        offset: typeof point3.offset === "number" && point3.offset > -1 ? point3.offset : undefined
      };
    }
  }
}
function position(node) {
  const start2 = pointStart(node);
  const end = pointEnd(node);
  if (start2 && end) {
    return { start: start2, end };
  }
}
// ../../../../node_modules/.bun/unist-util-stringify-position@4.0.0/node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position2(value.position);
  }
  if ("start" in value || "end" in value) {
    return position2(value);
  }
  if ("line" in value || "column" in value) {
    return point2(value);
  }
  return "";
}
function point2(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position2(pos) {
  return point2(pos && pos.start) + "-" + point2(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}
// ../../../../node_modules/.bun/vfile-message@4.0.3/node_modules/vfile-message/lib/index.js
class VFileMessage extends Error {
  constructor(causeOrReason, optionsOrParentOrPlace, origin) {
    super();
    if (typeof optionsOrParentOrPlace === "string") {
      origin = optionsOrParentOrPlace;
      optionsOrParentOrPlace = undefined;
    }
    let reason = "";
    let options = {};
    let legacyCause = false;
    if (optionsOrParentOrPlace) {
      if ("line" in optionsOrParentOrPlace && "column" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("start" in optionsOrParentOrPlace && "end" in optionsOrParentOrPlace) {
        options = { place: optionsOrParentOrPlace };
      } else if ("type" in optionsOrParentOrPlace) {
        options = {
          ancestors: [optionsOrParentOrPlace],
          place: optionsOrParentOrPlace.position
        };
      } else {
        options = { ...optionsOrParentOrPlace };
      }
    }
    if (typeof causeOrReason === "string") {
      reason = causeOrReason;
    } else if (!options.cause && causeOrReason) {
      legacyCause = true;
      reason = causeOrReason.message;
      options.cause = causeOrReason;
    }
    if (!options.ruleId && !options.source && typeof origin === "string") {
      const index2 = origin.indexOf(":");
      if (index2 === -1) {
        options.ruleId = origin;
      } else {
        options.source = origin.slice(0, index2);
        options.ruleId = origin.slice(index2 + 1);
      }
    }
    if (!options.place && options.ancestors && options.ancestors) {
      const parent = options.ancestors[options.ancestors.length - 1];
      if (parent) {
        options.place = parent.position;
      }
    }
    const start2 = options.place && "start" in options.place ? options.place.start : options.place;
    this.ancestors = options.ancestors || undefined;
    this.cause = options.cause || undefined;
    this.column = start2 ? start2.column : undefined;
    this.fatal = undefined;
    this.file = "";
    this.message = reason;
    this.line = start2 ? start2.line : undefined;
    this.name = stringifyPosition(options.place) || "1:1";
    this.place = options.place || undefined;
    this.reason = this.message;
    this.ruleId = options.ruleId || undefined;
    this.source = options.source || undefined;
    this.stack = legacyCause && options.cause && typeof options.cause.stack === "string" ? options.cause.stack : "";
    this.actual = undefined;
    this.expected = undefined;
    this.note = undefined;
    this.url = undefined;
  }
}
VFileMessage.prototype.file = "";
VFileMessage.prototype.name = "";
VFileMessage.prototype.reason = "";
VFileMessage.prototype.message = "";
VFileMessage.prototype.stack = "";
VFileMessage.prototype.column = undefined;
VFileMessage.prototype.line = undefined;
VFileMessage.prototype.ancestors = undefined;
VFileMessage.prototype.cause = undefined;
VFileMessage.prototype.fatal = undefined;
VFileMessage.prototype.place = undefined;
VFileMessage.prototype.ruleId = undefined;
VFileMessage.prototype.source = undefined;
// ../../../../node_modules/.bun/hast-util-to-jsx-runtime@2.3.6/node_modules/hast-util-to-jsx-runtime/lib/index.js
var own = {}.hasOwnProperty;
var emptyMap = new Map;
var cap2 = /[A-Z]/g;
var tableElements = new Set(["table", "tbody", "thead", "tfoot", "tr"]);
var tableCellElement = new Set(["td", "th"]);
var docs = "https://github.com/syntax-tree/hast-util-to-jsx-runtime";
function toJsxRuntime(tree, options) {
  if (!options || options.Fragment === undefined) {
    throw new TypeError("Expected `Fragment` in options");
  }
  const filePath = options.filePath || undefined;
  let create2;
  if (options.development) {
    if (typeof options.jsxDEV !== "function") {
      throw new TypeError("Expected `jsxDEV` in options when `development: true`");
    }
    create2 = developmentCreate(filePath, options.jsxDEV);
  } else {
    if (typeof options.jsx !== "function") {
      throw new TypeError("Expected `jsx` in production options");
    }
    if (typeof options.jsxs !== "function") {
      throw new TypeError("Expected `jsxs` in production options");
    }
    create2 = productionCreate(filePath, options.jsx, options.jsxs);
  }
  const state = {
    Fragment: options.Fragment,
    ancestors: [],
    components: options.components || {},
    create: create2,
    elementAttributeNameCase: options.elementAttributeNameCase || "react",
    evaluater: options.createEvaluater ? options.createEvaluater() : undefined,
    filePath,
    ignoreInvalidStyle: options.ignoreInvalidStyle || false,
    passKeys: options.passKeys !== false,
    passNode: options.passNode || false,
    schema: options.space === "svg" ? svg2 : html2,
    stylePropertyNameCase: options.stylePropertyNameCase || "dom",
    tableCellAlignToStyle: options.tableCellAlignToStyle !== false
  };
  const result = one(state, tree, undefined);
  if (result && typeof result !== "string") {
    return result;
  }
  return state.create(tree, state.Fragment, { children: result || undefined }, undefined);
}
function one(state, node, key) {
  if (node.type === "element") {
    return element(state, node, key);
  }
  if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
    return mdxExpression(state, node);
  }
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    return mdxJsxElement(state, node, key);
  }
  if (node.type === "mdxjsEsm") {
    return mdxEsm(state, node);
  }
  if (node.type === "root") {
    return root(state, node, key);
  }
  if (node.type === "text") {
    return text(state, node);
  }
}
function element(state, node, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node.tagName.toLowerCase() === "svg" && parentSchema.space === "html") {
    schema = svg2;
    state.schema = schema;
  }
  state.ancestors.push(node);
  const type = findComponentFromName(state, node.tagName, false);
  const props = createElementProps(state, node);
  let children = createChildren(state, node);
  if (tableElements.has(node.tagName)) {
    children = children.filter(function(child) {
      return typeof child === "string" ? !whitespace(child) : true;
    });
  }
  addNode(state, props, type, node);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node, type, props, key);
}
function mdxExpression(state, node) {
  if (node.data && node.data.estree && state.evaluater) {
    const program = node.data.estree;
    const expression = program.body[0];
    ok(expression.type === "ExpressionStatement");
    return state.evaluater.evaluateExpression(expression.expression);
  }
  crashEstree(state, node.position);
}
function mdxEsm(state, node) {
  if (node.data && node.data.estree && state.evaluater) {
    return state.evaluater.evaluateProgram(node.data.estree);
  }
  crashEstree(state, node.position);
}
function mdxJsxElement(state, node, key) {
  const parentSchema = state.schema;
  let schema = parentSchema;
  if (node.name === "svg" && parentSchema.space === "html") {
    schema = svg2;
    state.schema = schema;
  }
  state.ancestors.push(node);
  const type = node.name === null ? state.Fragment : findComponentFromName(state, node.name, true);
  const props = createJsxElementProps(state, node);
  const children = createChildren(state, node);
  addNode(state, props, type, node);
  addChildren(props, children);
  state.ancestors.pop();
  state.schema = parentSchema;
  return state.create(node, type, props, key);
}
function root(state, node, key) {
  const props = {};
  addChildren(props, createChildren(state, node));
  return state.create(node, state.Fragment, props, key);
}
function text(_, node) {
  return node.value;
}
function addNode(state, props, type, node) {
  if (typeof type !== "string" && type !== state.Fragment && state.passNode) {
    props.node = node;
  }
}
function addChildren(props, children) {
  if (children.length > 0) {
    const value = children.length > 1 ? children : children[0];
    if (value) {
      props.children = value;
    }
  }
}
function productionCreate(_, jsx, jsxs) {
  return create2;
  function create2(_2, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const fn = isStaticChildren ? jsxs : jsx;
    return key ? fn(type, props, key) : fn(type, props);
  }
}
function developmentCreate(filePath, jsxDEV) {
  return create2;
  function create2(node, type, props, key) {
    const isStaticChildren = Array.isArray(props.children);
    const point3 = pointStart(node);
    return jsxDEV(type, props, key, isStaticChildren, {
      columnNumber: point3 ? point3.column - 1 : undefined,
      fileName: filePath,
      lineNumber: point3 ? point3.line : undefined
    }, undefined);
  }
}
function createElementProps(state, node) {
  const props = {};
  let alignValue;
  let prop;
  for (prop in node.properties) {
    if (prop !== "children" && own.call(node.properties, prop)) {
      const result = createProperty(state, prop, node.properties[prop]);
      if (result) {
        const [key, value] = result;
        if (state.tableCellAlignToStyle && key === "align" && typeof value === "string" && tableCellElement.has(node.tagName)) {
          alignValue = value;
        } else {
          props[key] = value;
        }
      }
    }
  }
  if (alignValue) {
    const style = props.style || (props.style = {});
    style[state.stylePropertyNameCase === "css" ? "text-align" : "textAlign"] = alignValue;
  }
  return props;
}
function createJsxElementProps(state, node) {
  const props = {};
  for (const attribute of node.attributes) {
    if (attribute.type === "mdxJsxExpressionAttribute") {
      if (attribute.data && attribute.data.estree && state.evaluater) {
        const program = attribute.data.estree;
        const expression = program.body[0];
        ok(expression.type === "ExpressionStatement");
        const objectExpression = expression.expression;
        ok(objectExpression.type === "ObjectExpression");
        const property = objectExpression.properties[0];
        ok(property.type === "SpreadElement");
        Object.assign(props, state.evaluater.evaluateExpression(property.argument));
      } else {
        crashEstree(state, node.position);
      }
    } else {
      const name2 = attribute.name;
      let value;
      if (attribute.value && typeof attribute.value === "object") {
        if (attribute.value.data && attribute.value.data.estree && state.evaluater) {
          const program = attribute.value.data.estree;
          const expression = program.body[0];
          ok(expression.type === "ExpressionStatement");
          value = state.evaluater.evaluateExpression(expression.expression);
        } else {
          crashEstree(state, node.position);
        }
      } else {
        value = attribute.value === null ? true : attribute.value;
      }
      props[name2] = value;
    }
  }
  return props;
}
function createChildren(state, node) {
  const children = [];
  let index2 = -1;
  const countsByName = state.passKeys ? new Map : emptyMap;
  while (++index2 < node.children.length) {
    const child = node.children[index2];
    let key;
    if (state.passKeys) {
      const name2 = child.type === "element" ? child.tagName : child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement" ? child.name : undefined;
      if (name2) {
        const count = countsByName.get(name2) || 0;
        key = name2 + "-" + count;
        countsByName.set(name2, count + 1);
      }
    }
    const result = one(state, child, key);
    if (result !== undefined)
      children.push(result);
  }
  return children;
}
function createProperty(state, prop, value) {
  const info = find(state.schema, prop);
  if (value === null || value === undefined || typeof value === "number" && Number.isNaN(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value = info.commaSeparated ? stringify(value) : stringify2(value);
  }
  if (info.property === "style") {
    let styleObject = typeof value === "object" ? value : parseStyle(state, String(value));
    if (state.stylePropertyNameCase === "css") {
      styleObject = transformStylesToCssCasing(styleObject);
    }
    return ["style", styleObject];
  }
  return [
    state.elementAttributeNameCase === "react" && info.space ? hastToReact[info.property] || info.property : info.attribute,
    value
  ];
}
function parseStyle(state, value) {
  try {
    return import_style_to_js.default(value, { reactCompat: true });
  } catch (error) {
    if (state.ignoreInvalidStyle) {
      return {};
    }
    const cause = error;
    const message = new VFileMessage("Cannot parse `style` attribute", {
      ancestors: state.ancestors,
      cause,
      ruleId: "style",
      source: "hast-util-to-jsx-runtime"
    });
    message.file = state.filePath || undefined;
    message.url = docs + "#cannot-parse-style-attribute";
    throw message;
  }
}
function findComponentFromName(state, name2, allowExpression) {
  let result;
  if (!allowExpression) {
    result = { type: "Literal", value: name2 };
  } else if (name2.includes(".")) {
    const identifiers = name2.split(".");
    let index2 = -1;
    let node;
    while (++index2 < identifiers.length) {
      const prop = name(identifiers[index2]) ? { type: "Identifier", name: identifiers[index2] } : { type: "Literal", value: identifiers[index2] };
      node = node ? {
        type: "MemberExpression",
        object: node,
        property: prop,
        computed: Boolean(index2 && prop.type === "Literal"),
        optional: false
      } : prop;
    }
    ok(node, "always a result");
    result = node;
  } else {
    result = name(name2) && !/^[a-z]/.test(name2) ? { type: "Identifier", name: name2 } : { type: "Literal", value: name2 };
  }
  if (result.type === "Literal") {
    const name3 = result.value;
    return own.call(state.components, name3) ? state.components[name3] : name3;
  }
  if (state.evaluater) {
    return state.evaluater.evaluateExpression(result);
  }
  crashEstree(state);
}
function crashEstree(state, place) {
  const message = new VFileMessage("Cannot handle MDX estrees without `createEvaluater`", {
    ancestors: state.ancestors,
    place,
    ruleId: "mdx-estree",
    source: "hast-util-to-jsx-runtime"
  });
  message.file = state.filePath || undefined;
  message.url = docs + "#cannot-handle-mdx-estrees-without-createevaluater";
  throw message;
}
function transformStylesToCssCasing(domCasing) {
  const cssCasing = {};
  let from;
  for (from in domCasing) {
    if (own.call(domCasing, from)) {
      cssCasing[transformStyleToCssCasing(from)] = domCasing[from];
    }
  }
  return cssCasing;
}
function transformStyleToCssCasing(from) {
  let to = from.replace(cap2, toDash);
  if (to.slice(0, 3) === "ms-")
    to = "-" + to;
  return to;
}
function toDash($0) {
  return "-" + $0.toLowerCase();
}
// ../../../../node_modules/.bun/html-url-attributes@3.0.1/node_modules/html-url-attributes/lib/index.js
var urlAttributes = {
  action: ["form"],
  cite: ["blockquote", "del", "ins", "q"],
  data: ["object"],
  formAction: ["button", "input"],
  href: ["a", "area", "base", "link"],
  icon: ["menuitem"],
  itemId: null,
  manifest: ["html"],
  ping: ["a", "area"],
  poster: ["video"],
  src: [
    "audio",
    "embed",
    "iframe",
    "img",
    "input",
    "script",
    "source",
    "track",
    "video"
  ]
};
// ../../../../node_modules/.bun/react-markdown@10.1.0+f7f3071e040c6a00/node_modules/react-markdown/lib/index.js
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";

// ../../../../node_modules/.bun/mdast-util-to-string@4.0.0/node_modules/mdast-util-to-string/lib/index.js
var emptyOptions2 = {};
function toString(value, options) {
  const settings = options || emptyOptions2;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one2(value, includeImageAlt, includeHtml);
}
function one2(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index2 = -1;
  while (++index2 < values.length) {
    result[index2] = one2(values[index2], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}
// ../../../../node_modules/.bun/decode-named-character-reference@1.3.0/node_modules/decode-named-character-reference/index.dom.js
var element2 = document.createElement("i");
function decodeNamedCharacterReference(value) {
  const characterReference = "&" + value + ";";
  element2.innerHTML = characterReference;
  const character = element2.textContent;
  if (character.charCodeAt(character.length - 1) === 59 && value !== "semi") {
    return false;
  }
  return character === characterReference ? false : character;
}

// ../../../../node_modules/.bun/micromark-util-symbol@2.0.1/node_modules/micromark-util-symbol/lib/codes.js
var codes = {
  carriageReturn: -5,
  lineFeed: -4,
  carriageReturnLineFeed: -3,
  horizontalTab: -2,
  virtualSpace: -1,
  eof: null,
  nul: 0,
  soh: 1,
  stx: 2,
  etx: 3,
  eot: 4,
  enq: 5,
  ack: 6,
  bel: 7,
  bs: 8,
  ht: 9,
  lf: 10,
  vt: 11,
  ff: 12,
  cr: 13,
  so: 14,
  si: 15,
  dle: 16,
  dc1: 17,
  dc2: 18,
  dc3: 19,
  dc4: 20,
  nak: 21,
  syn: 22,
  etb: 23,
  can: 24,
  em: 25,
  sub: 26,
  esc: 27,
  fs: 28,
  gs: 29,
  rs: 30,
  us: 31,
  space: 32,
  exclamationMark: 33,
  quotationMark: 34,
  numberSign: 35,
  dollarSign: 36,
  percentSign: 37,
  ampersand: 38,
  apostrophe: 39,
  leftParenthesis: 40,
  rightParenthesis: 41,
  asterisk: 42,
  plusSign: 43,
  comma: 44,
  dash: 45,
  dot: 46,
  slash: 47,
  digit0: 48,
  digit1: 49,
  digit2: 50,
  digit3: 51,
  digit4: 52,
  digit5: 53,
  digit6: 54,
  digit7: 55,
  digit8: 56,
  digit9: 57,
  colon: 58,
  semicolon: 59,
  lessThan: 60,
  equalsTo: 61,
  greaterThan: 62,
  questionMark: 63,
  atSign: 64,
  uppercaseA: 65,
  uppercaseB: 66,
  uppercaseC: 67,
  uppercaseD: 68,
  uppercaseE: 69,
  uppercaseF: 70,
  uppercaseG: 71,
  uppercaseH: 72,
  uppercaseI: 73,
  uppercaseJ: 74,
  uppercaseK: 75,
  uppercaseL: 76,
  uppercaseM: 77,
  uppercaseN: 78,
  uppercaseO: 79,
  uppercaseP: 80,
  uppercaseQ: 81,
  uppercaseR: 82,
  uppercaseS: 83,
  uppercaseT: 84,
  uppercaseU: 85,
  uppercaseV: 86,
  uppercaseW: 87,
  uppercaseX: 88,
  uppercaseY: 89,
  uppercaseZ: 90,
  leftSquareBracket: 91,
  backslash: 92,
  rightSquareBracket: 93,
  caret: 94,
  underscore: 95,
  graveAccent: 96,
  lowercaseA: 97,
  lowercaseB: 98,
  lowercaseC: 99,
  lowercaseD: 100,
  lowercaseE: 101,
  lowercaseF: 102,
  lowercaseG: 103,
  lowercaseH: 104,
  lowercaseI: 105,
  lowercaseJ: 106,
  lowercaseK: 107,
  lowercaseL: 108,
  lowercaseM: 109,
  lowercaseN: 110,
  lowercaseO: 111,
  lowercaseP: 112,
  lowercaseQ: 113,
  lowercaseR: 114,
  lowercaseS: 115,
  lowercaseT: 116,
  lowercaseU: 117,
  lowercaseV: 118,
  lowercaseW: 119,
  lowercaseX: 120,
  lowercaseY: 121,
  lowercaseZ: 122,
  leftCurlyBrace: 123,
  verticalBar: 124,
  rightCurlyBrace: 125,
  tilde: 126,
  del: 127,
  byteOrderMarker: 65279,
  replacementCharacter: 65533
};
// ../../../../node_modules/.bun/micromark-util-symbol@2.0.1/node_modules/micromark-util-symbol/lib/constants.js
var constants = {
  attentionSideAfter: 2,
  attentionSideBefore: 1,
  atxHeadingOpeningFenceSizeMax: 6,
  autolinkDomainSizeMax: 63,
  autolinkSchemeSizeMax: 32,
  cdataOpeningString: "CDATA[",
  characterGroupPunctuation: 2,
  characterGroupWhitespace: 1,
  characterReferenceDecimalSizeMax: 7,
  characterReferenceHexadecimalSizeMax: 6,
  characterReferenceNamedSizeMax: 31,
  codeFencedSequenceSizeMin: 3,
  contentTypeContent: "content",
  contentTypeDocument: "document",
  contentTypeFlow: "flow",
  contentTypeString: "string",
  contentTypeText: "text",
  hardBreakPrefixSizeMin: 2,
  htmlBasic: 6,
  htmlCdata: 5,
  htmlComment: 2,
  htmlComplete: 7,
  htmlDeclaration: 4,
  htmlInstruction: 3,
  htmlRawSizeMax: 8,
  htmlRaw: 1,
  linkResourceDestinationBalanceMax: 32,
  linkReferenceSizeMax: 999,
  listItemValueSizeMax: 10,
  numericBaseDecimal: 10,
  numericBaseHexadecimal: 16,
  tabSize: 4,
  thematicBreakMarkerCountMin: 3,
  v8MaxSafeChunkSize: 1e4
};
// ../../../../node_modules/.bun/micromark-util-symbol@2.0.1/node_modules/micromark-util-symbol/lib/types.js
var types2 = {
  data: "data",
  whitespace: "whitespace",
  lineEnding: "lineEnding",
  lineEndingBlank: "lineEndingBlank",
  linePrefix: "linePrefix",
  lineSuffix: "lineSuffix",
  atxHeading: "atxHeading",
  atxHeadingSequence: "atxHeadingSequence",
  atxHeadingText: "atxHeadingText",
  autolink: "autolink",
  autolinkEmail: "autolinkEmail",
  autolinkMarker: "autolinkMarker",
  autolinkProtocol: "autolinkProtocol",
  characterEscape: "characterEscape",
  characterEscapeValue: "characterEscapeValue",
  characterReference: "characterReference",
  characterReferenceMarker: "characterReferenceMarker",
  characterReferenceMarkerNumeric: "characterReferenceMarkerNumeric",
  characterReferenceMarkerHexadecimal: "characterReferenceMarkerHexadecimal",
  characterReferenceValue: "characterReferenceValue",
  codeFenced: "codeFenced",
  codeFencedFence: "codeFencedFence",
  codeFencedFenceSequence: "codeFencedFenceSequence",
  codeFencedFenceInfo: "codeFencedFenceInfo",
  codeFencedFenceMeta: "codeFencedFenceMeta",
  codeFlowValue: "codeFlowValue",
  codeIndented: "codeIndented",
  codeText: "codeText",
  codeTextData: "codeTextData",
  codeTextPadding: "codeTextPadding",
  codeTextSequence: "codeTextSequence",
  content: "content",
  definition: "definition",
  definitionDestination: "definitionDestination",
  definitionDestinationLiteral: "definitionDestinationLiteral",
  definitionDestinationLiteralMarker: "definitionDestinationLiteralMarker",
  definitionDestinationRaw: "definitionDestinationRaw",
  definitionDestinationString: "definitionDestinationString",
  definitionLabel: "definitionLabel",
  definitionLabelMarker: "definitionLabelMarker",
  definitionLabelString: "definitionLabelString",
  definitionMarker: "definitionMarker",
  definitionTitle: "definitionTitle",
  definitionTitleMarker: "definitionTitleMarker",
  definitionTitleString: "definitionTitleString",
  emphasis: "emphasis",
  emphasisSequence: "emphasisSequence",
  emphasisText: "emphasisText",
  escapeMarker: "escapeMarker",
  hardBreakEscape: "hardBreakEscape",
  hardBreakTrailing: "hardBreakTrailing",
  htmlFlow: "htmlFlow",
  htmlFlowData: "htmlFlowData",
  htmlText: "htmlText",
  htmlTextData: "htmlTextData",
  image: "image",
  label: "label",
  labelText: "labelText",
  labelLink: "labelLink",
  labelImage: "labelImage",
  labelMarker: "labelMarker",
  labelImageMarker: "labelImageMarker",
  labelEnd: "labelEnd",
  link: "link",
  paragraph: "paragraph",
  reference: "reference",
  referenceMarker: "referenceMarker",
  referenceString: "referenceString",
  resource: "resource",
  resourceDestination: "resourceDestination",
  resourceDestinationLiteral: "resourceDestinationLiteral",
  resourceDestinationLiteralMarker: "resourceDestinationLiteralMarker",
  resourceDestinationRaw: "resourceDestinationRaw",
  resourceDestinationString: "resourceDestinationString",
  resourceMarker: "resourceMarker",
  resourceTitle: "resourceTitle",
  resourceTitleMarker: "resourceTitleMarker",
  resourceTitleString: "resourceTitleString",
  setextHeading: "setextHeading",
  setextHeadingText: "setextHeadingText",
  setextHeadingLine: "setextHeadingLine",
  setextHeadingLineSequence: "setextHeadingLineSequence",
  strong: "strong",
  strongSequence: "strongSequence",
  strongText: "strongText",
  thematicBreak: "thematicBreak",
  thematicBreakSequence: "thematicBreakSequence",
  blockQuote: "blockQuote",
  blockQuotePrefix: "blockQuotePrefix",
  blockQuoteMarker: "blockQuoteMarker",
  blockQuotePrefixWhitespace: "blockQuotePrefixWhitespace",
  listOrdered: "listOrdered",
  listUnordered: "listUnordered",
  listItemIndent: "listItemIndent",
  listItemMarker: "listItemMarker",
  listItemPrefix: "listItemPrefix",
  listItemPrefixWhitespace: "listItemPrefixWhitespace",
  listItemValue: "listItemValue",
  chunkDocument: "chunkDocument",
  chunkContent: "chunkContent",
  chunkFlow: "chunkFlow",
  chunkText: "chunkText",
  chunkString: "chunkString"
};
// ../../../../node_modules/.bun/micromark-util-symbol@2.0.1/node_modules/micromark-util-symbol/lib/values.js
var values = {
  ht: "\t",
  lf: `
`,
  cr: "\r",
  space: " ",
  exclamationMark: "!",
  quotationMark: '"',
  numberSign: "#",
  dollarSign: "$",
  percentSign: "%",
  ampersand: "&",
  apostrophe: "'",
  leftParenthesis: "(",
  rightParenthesis: ")",
  asterisk: "*",
  plusSign: "+",
  comma: ",",
  dash: "-",
  dot: ".",
  slash: "/",
  digit0: "0",
  digit1: "1",
  digit2: "2",
  digit3: "3",
  digit4: "4",
  digit5: "5",
  digit6: "6",
  digit7: "7",
  digit8: "8",
  digit9: "9",
  colon: ":",
  semicolon: ";",
  lessThan: "<",
  equalsTo: "=",
  greaterThan: ">",
  questionMark: "?",
  atSign: "@",
  uppercaseA: "A",
  uppercaseB: "B",
  uppercaseC: "C",
  uppercaseD: "D",
  uppercaseE: "E",
  uppercaseF: "F",
  uppercaseG: "G",
  uppercaseH: "H",
  uppercaseI: "I",
  uppercaseJ: "J",
  uppercaseK: "K",
  uppercaseL: "L",
  uppercaseM: "M",
  uppercaseN: "N",
  uppercaseO: "O",
  uppercaseP: "P",
  uppercaseQ: "Q",
  uppercaseR: "R",
  uppercaseS: "S",
  uppercaseT: "T",
  uppercaseU: "U",
  uppercaseV: "V",
  uppercaseW: "W",
  uppercaseX: "X",
  uppercaseY: "Y",
  uppercaseZ: "Z",
  leftSquareBracket: "[",
  backslash: "\\",
  rightSquareBracket: "]",
  caret: "^",
  underscore: "_",
  graveAccent: "`",
  lowercaseA: "a",
  lowercaseB: "b",
  lowercaseC: "c",
  lowercaseD: "d",
  lowercaseE: "e",
  lowercaseF: "f",
  lowercaseG: "g",
  lowercaseH: "h",
  lowercaseI: "i",
  lowercaseJ: "j",
  lowercaseK: "k",
  lowercaseL: "l",
  lowercaseM: "m",
  lowercaseN: "n",
  lowercaseO: "o",
  lowercaseP: "p",
  lowercaseQ: "q",
  lowercaseR: "r",
  lowercaseS: "s",
  lowercaseT: "t",
  lowercaseU: "u",
  lowercaseV: "v",
  lowercaseW: "w",
  lowercaseX: "x",
  lowercaseY: "y",
  lowercaseZ: "z",
  leftCurlyBrace: "{",
  verticalBar: "|",
  rightCurlyBrace: "}",
  tilde: "~",
  replacementCharacter: "�"
};
// ../../../../node_modules/.bun/micromark-util-chunked@2.0.1/node_modules/micromark-util-chunked/dev/index.js
function splice(list, start2, remove, items) {
  const end = list.length;
  let chunkStart = 0;
  let parameters;
  if (start2 < 0) {
    start2 = -start2 > end ? 0 : end + start2;
  } else {
    start2 = start2 > end ? end : start2;
  }
  remove = remove > 0 ? remove : 0;
  if (items.length < constants.v8MaxSafeChunkSize) {
    parameters = Array.from(items);
    parameters.unshift(start2, remove);
    list.splice(...parameters);
  } else {
    if (remove)
      list.splice(start2, remove);
    while (chunkStart < items.length) {
      parameters = items.slice(chunkStart, chunkStart + constants.v8MaxSafeChunkSize);
      parameters.unshift(start2, 0);
      list.splice(...parameters);
      chunkStart += constants.v8MaxSafeChunkSize;
      start2 += constants.v8MaxSafeChunkSize;
    }
  }
}
function push(list, items) {
  if (list.length > 0) {
    splice(list, list.length, 0, items);
    return list;
  }
  return items;
}

// ../../../../node_modules/.bun/micromark-util-combine-extensions@2.0.1/node_modules/micromark-util-combine-extensions/index.js
var hasOwnProperty = {}.hasOwnProperty;
function combineExtensions(extensions) {
  const all2 = {};
  let index2 = -1;
  while (++index2 < extensions.length) {
    syntaxExtension(all2, extensions[index2]);
  }
  return all2;
}
function syntaxExtension(all2, extension) {
  let hook;
  for (hook in extension) {
    const maybe = hasOwnProperty.call(all2, hook) ? all2[hook] : undefined;
    const left = maybe || (all2[hook] = {});
    const right = extension[hook];
    let code;
    if (right) {
      for (code in right) {
        if (!hasOwnProperty.call(left, code))
          left[code] = [];
        const value = right[code];
        constructs(left[code], Array.isArray(value) ? value : value ? [value] : []);
      }
    }
  }
}
function constructs(existing, list) {
  let index2 = -1;
  const before = [];
  while (++index2 < list.length) {
    (list[index2].add === "after" ? existing : before).push(list[index2]);
  }
  splice(existing, 0, 0, before);
}

// ../../../../node_modules/.bun/micromark-util-decode-numeric-character-reference@2.0.2/node_modules/micromark-util-decode-numeric-character-reference/dev/index.js
function decodeNumericCharacterReference(value, base) {
  const code = Number.parseInt(value, base);
  if (code < codes.ht || code === codes.vt || code > codes.cr && code < codes.space || code > codes.tilde && code < 160 || code > 55295 && code < 57344 || code > 64975 && code < 65008 || (code & 65535) === 65535 || (code & 65535) === 65534 || code > 1114111) {
    return values.replacementCharacter;
  }
  return String.fromCodePoint(code);
}

// ../../../../node_modules/.bun/micromark-util-normalize-identifier@2.0.1/node_modules/micromark-util-normalize-identifier/dev/index.js
function normalizeIdentifier(value) {
  return value.replace(/[\t\n\r ]+/g, values.space).replace(/^ | $/g, "").toLowerCase().toUpperCase();
}

// ../../../../node_modules/.bun/micromark-util-character@2.1.1/node_modules/micromark-util-character/dev/index.js
var asciiAlpha = regexCheck(/[A-Za-z]/);
var asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
var asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
function asciiControl(code) {
  return code !== null && (code < codes.space || code === codes.del);
}
var asciiDigit = regexCheck(/\d/);
var asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
var asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
function markdownLineEnding(code) {
  return code !== null && code < codes.horizontalTab;
}
function markdownLineEndingOrSpace(code) {
  return code !== null && (code < codes.nul || code === codes.space);
}
function markdownSpace(code) {
  return code === codes.horizontalTab || code === codes.virtualSpace || code === codes.space;
}
var unicodePunctuation = regexCheck(/\p{P}|\p{S}/u);
var unicodeWhitespace = regexCheck(/\s/);
function regexCheck(regex) {
  return check;
  function check(code) {
    return code !== null && code > -1 && regex.test(String.fromCharCode(code));
  }
}

// ../../../../node_modules/.bun/micromark-util-sanitize-uri@2.0.1/node_modules/micromark-util-sanitize-uri/dev/index.js
function normalizeUri(value) {
  const result = [];
  let index2 = -1;
  let start2 = 0;
  let skip = 0;
  while (++index2 < value.length) {
    const code = value.charCodeAt(index2);
    let replace = "";
    if (code === codes.percentSign && asciiAlphanumeric(value.charCodeAt(index2 + 1)) && asciiAlphanumeric(value.charCodeAt(index2 + 2))) {
      skip = 2;
    } else if (code < 128) {
      if (!/[!#$&-;=?-Z_a-z~]/.test(String.fromCharCode(code))) {
        replace = String.fromCharCode(code);
      }
    } else if (code > 55295 && code < 57344) {
      const next = value.charCodeAt(index2 + 1);
      if (code < 56320 && next > 56319 && next < 57344) {
        replace = String.fromCharCode(code, next);
        skip = 1;
      } else {
        replace = values.replacementCharacter;
      }
    } else {
      replace = String.fromCharCode(code);
    }
    if (replace) {
      result.push(value.slice(start2, index2), encodeURIComponent(replace));
      start2 = index2 + skip + 1;
      replace = "";
    }
    if (skip) {
      index2 += skip;
      skip = 0;
    }
  }
  return result.join("") + value.slice(start2);
}

// ../../../../node_modules/.bun/micromark-factory-space@2.0.1/node_modules/micromark-factory-space/dev/index.js
function factorySpace(effects, ok2, type, max2) {
  const limit = max2 ? max2 - 1 : Number.POSITIVE_INFINITY;
  let size = 0;
  return start2;
  function start2(code) {
    if (markdownSpace(code)) {
      effects.enter(type);
      return prefix(code);
    }
    return ok2(code);
  }
  function prefix(code) {
    if (markdownSpace(code) && size++ < limit) {
      effects.consume(code);
      return prefix;
    }
    effects.exit(type);
    return ok2(code);
  }
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/initialize/content.js
var content = { tokenize: initializeContent };
function initializeContent(effects) {
  const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  let previous;
  return contentStart;
  function afterContentStartConstruct(code) {
    ok(code === codes.eof || markdownLineEnding(code), "expected eol or eof");
    if (code === codes.eof) {
      effects.consume(code);
      return;
    }
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return factorySpace(effects, contentStart, types2.linePrefix);
  }
  function paragraphInitial(code) {
    ok(code !== codes.eof && !markdownLineEnding(code), "expected anything other than a line ending or EOF");
    effects.enter(types2.paragraph);
    return lineStart(code);
  }
  function lineStart(code) {
    const token = effects.enter(types2.chunkText, {
      contentType: constants.contentTypeText,
      previous
    });
    if (previous) {
      previous.next = token;
    }
    previous = token;
    return data(code);
  }
  function data(code) {
    if (code === codes.eof) {
      effects.exit(types2.chunkText);
      effects.exit(types2.paragraph);
      effects.consume(code);
      return;
    }
    if (markdownLineEnding(code)) {
      effects.consume(code);
      effects.exit(types2.chunkText);
      return lineStart;
    }
    effects.consume(code);
    return data;
  }
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/initialize/document.js
var document2 = { tokenize: initializeDocument };
var containerConstruct = { tokenize: tokenizeContainer };
function initializeDocument(effects) {
  const self2 = this;
  const stack = [];
  let continued = 0;
  let childFlow;
  let childToken;
  let lineStartOffset;
  return start2;
  function start2(code) {
    if (continued < stack.length) {
      const item = stack[continued];
      self2.containerState = item[1];
      ok(item[0].continuation, "expected `continuation` to be defined on container construct");
      return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code);
    }
    return checkNewContainers(code);
  }
  function documentContinue(code) {
    ok(self2.containerState, "expected `containerState` to be defined after continuation");
    continued++;
    if (self2.containerState._closeFlow) {
      self2.containerState._closeFlow = undefined;
      if (childFlow) {
        closeFlow();
      }
      const indexBeforeExits = self2.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let point3;
      while (indexBeforeFlow--) {
        if (self2.events[indexBeforeFlow][0] === "exit" && self2.events[indexBeforeFlow][1].type === types2.chunkFlow) {
          point3 = self2.events[indexBeforeFlow][1].end;
          break;
        }
      }
      ok(point3, "could not find previous flow chunk");
      exitContainers(continued);
      let index2 = indexBeforeExits;
      while (index2 < self2.events.length) {
        self2.events[index2][1].end = { ...point3 };
        index2++;
      }
      splice(self2.events, indexBeforeFlow + 1, 0, self2.events.slice(indexBeforeExits));
      self2.events.length = index2;
      return checkNewContainers(code);
    }
    return start2(code);
  }
  function checkNewContainers(code) {
    if (continued === stack.length) {
      if (!childFlow) {
        return documentContinued(code);
      }
      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        return flowStart(code);
      }
      self2.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
    }
    self2.containerState = {};
    return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code);
  }
  function thereIsANewContainer(code) {
    if (childFlow)
      closeFlow();
    exitContainers(continued);
    return documentContinued(code);
  }
  function thereIsNoNewContainer(code) {
    self2.parser.lazy[self2.now().line] = continued !== stack.length;
    lineStartOffset = self2.now().offset;
    return flowStart(code);
  }
  function documentContinued(code) {
    self2.containerState = {};
    return effects.attempt(containerConstruct, containerContinue, flowStart)(code);
  }
  function containerContinue(code) {
    ok(self2.currentConstruct, "expected `currentConstruct` to be defined on tokenizer");
    ok(self2.containerState, "expected `containerState` to be defined on tokenizer");
    continued++;
    stack.push([self2.currentConstruct, self2.containerState]);
    return documentContinued(code);
  }
  function flowStart(code) {
    if (code === codes.eof) {
      if (childFlow)
        closeFlow();
      exitContainers(0);
      effects.consume(code);
      return;
    }
    childFlow = childFlow || self2.parser.flow(self2.now());
    effects.enter(types2.chunkFlow, {
      _tokenizer: childFlow,
      contentType: constants.contentTypeFlow,
      previous: childToken
    });
    return flowContinue(code);
  }
  function flowContinue(code) {
    if (code === codes.eof) {
      writeToChild(effects.exit(types2.chunkFlow), true);
      exitContainers(0);
      effects.consume(code);
      return;
    }
    if (markdownLineEnding(code)) {
      effects.consume(code);
      writeToChild(effects.exit(types2.chunkFlow));
      continued = 0;
      self2.interrupt = undefined;
      return start2;
    }
    effects.consume(code);
    return flowContinue;
  }
  function writeToChild(token, endOfFile) {
    ok(childFlow, "expected `childFlow` to be defined when continuing");
    const stream = self2.sliceStream(token);
    if (endOfFile)
      stream.push(null);
    token.previous = childToken;
    if (childToken)
      childToken.next = token;
    childToken = token;
    childFlow.defineSkip(token.start);
    childFlow.write(stream);
    if (self2.parser.lazy[token.start.line]) {
      let index2 = childFlow.events.length;
      while (index2--) {
        if (childFlow.events[index2][1].start.offset < lineStartOffset && (!childFlow.events[index2][1].end || childFlow.events[index2][1].end.offset > lineStartOffset)) {
          return;
        }
      }
      const indexBeforeExits = self2.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let seen;
      let point3;
      while (indexBeforeFlow--) {
        if (self2.events[indexBeforeFlow][0] === "exit" && self2.events[indexBeforeFlow][1].type === types2.chunkFlow) {
          if (seen) {
            point3 = self2.events[indexBeforeFlow][1].end;
            break;
          }
          seen = true;
        }
      }
      ok(point3, "could not find previous flow chunk");
      exitContainers(continued);
      index2 = indexBeforeExits;
      while (index2 < self2.events.length) {
        self2.events[index2][1].end = { ...point3 };
        index2++;
      }
      splice(self2.events, indexBeforeFlow + 1, 0, self2.events.slice(indexBeforeExits));
      self2.events.length = index2;
    }
  }
  function exitContainers(size) {
    let index2 = stack.length;
    while (index2-- > size) {
      const entry = stack[index2];
      self2.containerState = entry[1];
      ok(entry[0].exit, "expected `exit` to be defined on container construct");
      entry[0].exit.call(self2, effects);
    }
    stack.length = size;
  }
  function closeFlow() {
    ok(self2.containerState, "expected `containerState` to be defined when closing flow");
    ok(childFlow, "expected `childFlow` to be defined when closing it");
    childFlow.write([codes.eof]);
    childToken = undefined;
    childFlow = undefined;
    self2.containerState._closeFlow = undefined;
  }
}
function tokenizeContainer(effects, ok2, nok) {
  ok(this.parser.constructs.disable.null, "expected `disable.null` to be populated");
  return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok2, nok), types2.linePrefix, this.parser.constructs.disable.null.includes("codeIndented") ? undefined : constants.tabSize);
}

// ../../../../node_modules/.bun/micromark-util-classify-character@2.0.1/node_modules/micromark-util-classify-character/dev/index.js
function classifyCharacter(code) {
  if (code === codes.eof || markdownLineEndingOrSpace(code) || unicodeWhitespace(code)) {
    return constants.characterGroupWhitespace;
  }
  if (unicodePunctuation(code)) {
    return constants.characterGroupPunctuation;
  }
}

// ../../../../node_modules/.bun/micromark-util-resolve-all@2.0.1/node_modules/micromark-util-resolve-all/index.js
function resolveAll(constructs2, events, context) {
  const called = [];
  let index2 = -1;
  while (++index2 < constructs2.length) {
    const resolve = constructs2[index2].resolveAll;
    if (resolve && !called.includes(resolve)) {
      events = resolve(events, context);
      called.push(resolve);
    }
  }
  return events;
}

// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/attention.js
var attention = {
  name: "attention",
  resolveAll: resolveAllAttention,
  tokenize: tokenizeAttention
};
function resolveAllAttention(events, context) {
  let index2 = -1;
  let open;
  let group;
  let text2;
  let openingSequence;
  let closingSequence;
  let use;
  let nextEvents;
  let offset;
  while (++index2 < events.length) {
    if (events[index2][0] === "enter" && events[index2][1].type === "attentionSequence" && events[index2][1]._close) {
      open = index2;
      while (open--) {
        if (events[open][0] === "exit" && events[open][1].type === "attentionSequence" && events[open][1]._open && context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index2][1]).charCodeAt(0)) {
          if ((events[open][1]._close || events[index2][1]._open) && (events[index2][1].end.offset - events[index2][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index2][1].end.offset - events[index2][1].start.offset) % 3)) {
            continue;
          }
          use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index2][1].end.offset - events[index2][1].start.offset > 1 ? 2 : 1;
          const start2 = { ...events[open][1].end };
          const end = { ...events[index2][1].start };
          movePoint(start2, -use);
          movePoint(end, use);
          openingSequence = {
            type: use > 1 ? types2.strongSequence : types2.emphasisSequence,
            start: start2,
            end: { ...events[open][1].end }
          };
          closingSequence = {
            type: use > 1 ? types2.strongSequence : types2.emphasisSequence,
            start: { ...events[index2][1].start },
            end
          };
          text2 = {
            type: use > 1 ? types2.strongText : types2.emphasisText,
            start: { ...events[open][1].end },
            end: { ...events[index2][1].start }
          };
          group = {
            type: use > 1 ? types2.strong : types2.emphasis,
            start: { ...openingSequence.start },
            end: { ...closingSequence.end }
          };
          events[open][1].end = { ...openingSequence.start };
          events[index2][1].start = { ...closingSequence.end };
          nextEvents = [];
          if (events[open][1].end.offset - events[open][1].start.offset) {
            nextEvents = push(nextEvents, [
              ["enter", events[open][1], context],
              ["exit", events[open][1], context]
            ]);
          }
          nextEvents = push(nextEvents, [
            ["enter", group, context],
            ["enter", openingSequence, context],
            ["exit", openingSequence, context],
            ["enter", text2, context]
          ]);
          ok(context.parser.constructs.insideSpan.null, "expected `insideSpan` to be populated");
          nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + 1, index2), context));
          nextEvents = push(nextEvents, [
            ["exit", text2, context],
            ["enter", closingSequence, context],
            ["exit", closingSequence, context],
            ["exit", group, context]
          ]);
          if (events[index2][1].end.offset - events[index2][1].start.offset) {
            offset = 2;
            nextEvents = push(nextEvents, [
              ["enter", events[index2][1], context],
              ["exit", events[index2][1], context]
            ]);
          } else {
            offset = 0;
          }
          splice(events, open - 1, index2 - open + 3, nextEvents);
          index2 = open + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  }
  index2 = -1;
  while (++index2 < events.length) {
    if (events[index2][1].type === "attentionSequence") {
      events[index2][1].type = "data";
    }
  }
  return events;
}
function tokenizeAttention(effects, ok2) {
  const attentionMarkers = this.parser.constructs.attentionMarkers.null;
  const previous = this.previous;
  const before = classifyCharacter(previous);
  let marker;
  return start2;
  function start2(code) {
    ok(code === codes.asterisk || code === codes.underscore, "expected asterisk or underscore");
    marker = code;
    effects.enter("attentionSequence");
    return inside(code);
  }
  function inside(code) {
    if (code === marker) {
      effects.consume(code);
      return inside;
    }
    const token = effects.exit("attentionSequence");
    const after = classifyCharacter(code);
    ok(attentionMarkers, "expected `attentionMarkers` to be populated");
    const open = !after || after === constants.characterGroupPunctuation && before || attentionMarkers.includes(code);
    const close = !before || before === constants.characterGroupPunctuation && after || attentionMarkers.includes(previous);
    token._open = Boolean(marker === codes.asterisk ? open : open && (before || !close));
    token._close = Boolean(marker === codes.asterisk ? close : close && (after || !open));
    return ok2(code);
  }
}
function movePoint(point3, offset) {
  point3.column += offset;
  point3.offset += offset;
  point3._bufferIndex += offset;
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/autolink.js
var autolink = { name: "autolink", tokenize: tokenizeAutolink };
function tokenizeAutolink(effects, ok2, nok) {
  let size = 0;
  return start2;
  function start2(code) {
    ok(code === codes.lessThan, "expected `<`");
    effects.enter(types2.autolink);
    effects.enter(types2.autolinkMarker);
    effects.consume(code);
    effects.exit(types2.autolinkMarker);
    effects.enter(types2.autolinkProtocol);
    return open;
  }
  function open(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return schemeOrEmailAtext;
    }
    if (code === codes.atSign) {
      return nok(code);
    }
    return emailAtext(code);
  }
  function schemeOrEmailAtext(code) {
    if (code === codes.plusSign || code === codes.dash || code === codes.dot || asciiAlphanumeric(code)) {
      size = 1;
      return schemeInsideOrEmailAtext(code);
    }
    return emailAtext(code);
  }
  function schemeInsideOrEmailAtext(code) {
    if (code === codes.colon) {
      effects.consume(code);
      size = 0;
      return urlInside;
    }
    if ((code === codes.plusSign || code === codes.dash || code === codes.dot || asciiAlphanumeric(code)) && size++ < constants.autolinkSchemeSizeMax) {
      effects.consume(code);
      return schemeInsideOrEmailAtext;
    }
    size = 0;
    return emailAtext(code);
  }
  function urlInside(code) {
    if (code === codes.greaterThan) {
      effects.exit(types2.autolinkProtocol);
      effects.enter(types2.autolinkMarker);
      effects.consume(code);
      effects.exit(types2.autolinkMarker);
      effects.exit(types2.autolink);
      return ok2;
    }
    if (code === codes.eof || code === codes.space || code === codes.lessThan || asciiControl(code)) {
      return nok(code);
    }
    effects.consume(code);
    return urlInside;
  }
  function emailAtext(code) {
    if (code === codes.atSign) {
      effects.consume(code);
      return emailAtSignOrDot;
    }
    if (asciiAtext(code)) {
      effects.consume(code);
      return emailAtext;
    }
    return nok(code);
  }
  function emailAtSignOrDot(code) {
    return asciiAlphanumeric(code) ? emailLabel(code) : nok(code);
  }
  function emailLabel(code) {
    if (code === codes.dot) {
      effects.consume(code);
      size = 0;
      return emailAtSignOrDot;
    }
    if (code === codes.greaterThan) {
      effects.exit(types2.autolinkProtocol).type = types2.autolinkEmail;
      effects.enter(types2.autolinkMarker);
      effects.consume(code);
      effects.exit(types2.autolinkMarker);
      effects.exit(types2.autolink);
      return ok2;
    }
    return emailValue(code);
  }
  function emailValue(code) {
    if ((code === codes.dash || asciiAlphanumeric(code)) && size++ < constants.autolinkDomainSizeMax) {
      const next = code === codes.dash ? emailValue : emailLabel;
      effects.consume(code);
      return next;
    }
    return nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/blank-line.js
var blankLine = { partial: true, tokenize: tokenizeBlankLine };
function tokenizeBlankLine(effects, ok2, nok) {
  return start2;
  function start2(code) {
    return markdownSpace(code) ? factorySpace(effects, after, types2.linePrefix)(code) : after(code);
  }
  function after(code) {
    return code === codes.eof || markdownLineEnding(code) ? ok2(code) : nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/block-quote.js
var blockQuote = {
  continuation: { tokenize: tokenizeBlockQuoteContinuation },
  exit,
  name: "blockQuote",
  tokenize: tokenizeBlockQuoteStart
};
function tokenizeBlockQuoteStart(effects, ok2, nok) {
  const self2 = this;
  return start2;
  function start2(code) {
    if (code === codes.greaterThan) {
      const state = self2.containerState;
      ok(state, "expected `containerState` to be defined in container");
      if (!state.open) {
        effects.enter(types2.blockQuote, { _container: true });
        state.open = true;
      }
      effects.enter(types2.blockQuotePrefix);
      effects.enter(types2.blockQuoteMarker);
      effects.consume(code);
      effects.exit(types2.blockQuoteMarker);
      return after;
    }
    return nok(code);
  }
  function after(code) {
    if (markdownSpace(code)) {
      effects.enter(types2.blockQuotePrefixWhitespace);
      effects.consume(code);
      effects.exit(types2.blockQuotePrefixWhitespace);
      effects.exit(types2.blockQuotePrefix);
      return ok2;
    }
    effects.exit(types2.blockQuotePrefix);
    return ok2(code);
  }
}
function tokenizeBlockQuoteContinuation(effects, ok2, nok) {
  const self2 = this;
  return contStart;
  function contStart(code) {
    if (markdownSpace(code)) {
      ok(self2.parser.constructs.disable.null, "expected `disable.null` to be populated");
      return factorySpace(effects, contBefore, types2.linePrefix, self2.parser.constructs.disable.null.includes("codeIndented") ? undefined : constants.tabSize)(code);
    }
    return contBefore(code);
  }
  function contBefore(code) {
    return effects.attempt(blockQuote, ok2, nok)(code);
  }
}
function exit(effects) {
  effects.exit(types2.blockQuote);
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/character-escape.js
var characterEscape = {
  name: "characterEscape",
  tokenize: tokenizeCharacterEscape
};
function tokenizeCharacterEscape(effects, ok2, nok) {
  return start2;
  function start2(code) {
    ok(code === codes.backslash, "expected `\\`");
    effects.enter(types2.characterEscape);
    effects.enter(types2.escapeMarker);
    effects.consume(code);
    effects.exit(types2.escapeMarker);
    return inside;
  }
  function inside(code) {
    if (asciiPunctuation(code)) {
      effects.enter(types2.characterEscapeValue);
      effects.consume(code);
      effects.exit(types2.characterEscapeValue);
      effects.exit(types2.characterEscape);
      return ok2;
    }
    return nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/character-reference.js
var characterReference = {
  name: "characterReference",
  tokenize: tokenizeCharacterReference
};
function tokenizeCharacterReference(effects, ok2, nok) {
  const self2 = this;
  let size = 0;
  let max2;
  let test;
  return start2;
  function start2(code) {
    ok(code === codes.ampersand, "expected `&`");
    effects.enter(types2.characterReference);
    effects.enter(types2.characterReferenceMarker);
    effects.consume(code);
    effects.exit(types2.characterReferenceMarker);
    return open;
  }
  function open(code) {
    if (code === codes.numberSign) {
      effects.enter(types2.characterReferenceMarkerNumeric);
      effects.consume(code);
      effects.exit(types2.characterReferenceMarkerNumeric);
      return numeric;
    }
    effects.enter(types2.characterReferenceValue);
    max2 = constants.characterReferenceNamedSizeMax;
    test = asciiAlphanumeric;
    return value(code);
  }
  function numeric(code) {
    if (code === codes.uppercaseX || code === codes.lowercaseX) {
      effects.enter(types2.characterReferenceMarkerHexadecimal);
      effects.consume(code);
      effects.exit(types2.characterReferenceMarkerHexadecimal);
      effects.enter(types2.characterReferenceValue);
      max2 = constants.characterReferenceHexadecimalSizeMax;
      test = asciiHexDigit;
      return value;
    }
    effects.enter(types2.characterReferenceValue);
    max2 = constants.characterReferenceDecimalSizeMax;
    test = asciiDigit;
    return value(code);
  }
  function value(code) {
    if (code === codes.semicolon && size) {
      const token = effects.exit(types2.characterReferenceValue);
      if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self2.sliceSerialize(token))) {
        return nok(code);
      }
      effects.enter(types2.characterReferenceMarker);
      effects.consume(code);
      effects.exit(types2.characterReferenceMarker);
      effects.exit(types2.characterReference);
      return ok2;
    }
    if (test(code) && size++ < max2) {
      effects.consume(code);
      return value;
    }
    return nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/code-fenced.js
var nonLazyContinuation = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
};
var codeFenced = {
  concrete: true,
  name: "codeFenced",
  tokenize: tokenizeCodeFenced
};
function tokenizeCodeFenced(effects, ok2, nok) {
  const self2 = this;
  const closeStart = { partial: true, tokenize: tokenizeCloseStart };
  let initialPrefix = 0;
  let sizeOpen = 0;
  let marker;
  return start2;
  function start2(code) {
    return beforeSequenceOpen(code);
  }
  function beforeSequenceOpen(code) {
    ok(code === codes.graveAccent || code === codes.tilde, "expected `` ` `` or `~`");
    const tail = self2.events[self2.events.length - 1];
    initialPrefix = tail && tail[1].type === types2.linePrefix ? tail[2].sliceSerialize(tail[1], true).length : 0;
    marker = code;
    effects.enter(types2.codeFenced);
    effects.enter(types2.codeFencedFence);
    effects.enter(types2.codeFencedFenceSequence);
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === marker) {
      sizeOpen++;
      effects.consume(code);
      return sequenceOpen;
    }
    if (sizeOpen < constants.codeFencedSequenceSizeMin) {
      return nok(code);
    }
    effects.exit(types2.codeFencedFenceSequence);
    return markdownSpace(code) ? factorySpace(effects, infoBefore, types2.whitespace)(code) : infoBefore(code);
  }
  function infoBefore(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.codeFencedFence);
      return self2.interrupt ? ok2(code) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
    }
    effects.enter(types2.codeFencedFenceInfo);
    effects.enter(types2.chunkString, { contentType: constants.contentTypeString });
    return info(code);
  }
  function info(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.chunkString);
      effects.exit(types2.codeFencedFenceInfo);
      return infoBefore(code);
    }
    if (markdownSpace(code)) {
      effects.exit(types2.chunkString);
      effects.exit(types2.codeFencedFenceInfo);
      return factorySpace(effects, metaBefore, types2.whitespace)(code);
    }
    if (code === codes.graveAccent && code === marker) {
      return nok(code);
    }
    effects.consume(code);
    return info;
  }
  function metaBefore(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      return infoBefore(code);
    }
    effects.enter(types2.codeFencedFenceMeta);
    effects.enter(types2.chunkString, { contentType: constants.contentTypeString });
    return meta(code);
  }
  function meta(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.chunkString);
      effects.exit(types2.codeFencedFenceMeta);
      return infoBefore(code);
    }
    if (code === codes.graveAccent && code === marker) {
      return nok(code);
    }
    effects.consume(code);
    return meta;
  }
  function atNonLazyBreak(code) {
    ok(markdownLineEnding(code), "expected eol");
    return effects.attempt(closeStart, after, contentBefore)(code);
  }
  function contentBefore(code) {
    ok(markdownLineEnding(code), "expected eol");
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return contentStart;
  }
  function contentStart(code) {
    return initialPrefix > 0 && markdownSpace(code) ? factorySpace(effects, beforeContentChunk, types2.linePrefix, initialPrefix + 1)(code) : beforeContentChunk(code);
  }
  function beforeContentChunk(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
    }
    effects.enter(types2.codeFlowValue);
    return contentChunk(code);
  }
  function contentChunk(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.codeFlowValue);
      return beforeContentChunk(code);
    }
    effects.consume(code);
    return contentChunk;
  }
  function after(code) {
    effects.exit(types2.codeFenced);
    return ok2(code);
  }
  function tokenizeCloseStart(effects2, ok3, nok2) {
    let size = 0;
    return startBefore;
    function startBefore(code) {
      ok(markdownLineEnding(code), "expected eol");
      effects2.enter(types2.lineEnding);
      effects2.consume(code);
      effects2.exit(types2.lineEnding);
      return start3;
    }
    function start3(code) {
      ok(self2.parser.constructs.disable.null, "expected `disable.null` to be populated");
      effects2.enter(types2.codeFencedFence);
      return markdownSpace(code) ? factorySpace(effects2, beforeSequenceClose, types2.linePrefix, self2.parser.constructs.disable.null.includes("codeIndented") ? undefined : constants.tabSize)(code) : beforeSequenceClose(code);
    }
    function beforeSequenceClose(code) {
      if (code === marker) {
        effects2.enter(types2.codeFencedFenceSequence);
        return sequenceClose(code);
      }
      return nok2(code);
    }
    function sequenceClose(code) {
      if (code === marker) {
        size++;
        effects2.consume(code);
        return sequenceClose;
      }
      if (size >= sizeOpen) {
        effects2.exit(types2.codeFencedFenceSequence);
        return markdownSpace(code) ? factorySpace(effects2, sequenceCloseAfter, types2.whitespace)(code) : sequenceCloseAfter(code);
      }
      return nok2(code);
    }
    function sequenceCloseAfter(code) {
      if (code === codes.eof || markdownLineEnding(code)) {
        effects2.exit(types2.codeFencedFence);
        return ok3(code);
      }
      return nok2(code);
    }
  }
}
function tokenizeNonLazyContinuation(effects, ok2, nok) {
  const self2 = this;
  return start2;
  function start2(code) {
    if (code === codes.eof) {
      return nok(code);
    }
    ok(markdownLineEnding(code), "expected eol");
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return lineStart;
  }
  function lineStart(code) {
    return self2.parser.lazy[self2.now().line] ? nok(code) : ok2(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/code-indented.js
var codeIndented = {
  name: "codeIndented",
  tokenize: tokenizeCodeIndented
};
var furtherStart = { partial: true, tokenize: tokenizeFurtherStart };
function tokenizeCodeIndented(effects, ok2, nok) {
  const self2 = this;
  return start2;
  function start2(code) {
    ok(markdownSpace(code));
    effects.enter(types2.codeIndented);
    return factorySpace(effects, afterPrefix, types2.linePrefix, constants.tabSize + 1)(code);
  }
  function afterPrefix(code) {
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === types2.linePrefix && tail[2].sliceSerialize(tail[1], true).length >= constants.tabSize ? atBreak(code) : nok(code);
  }
  function atBreak(code) {
    if (code === codes.eof) {
      return after(code);
    }
    if (markdownLineEnding(code)) {
      return effects.attempt(furtherStart, atBreak, after)(code);
    }
    effects.enter(types2.codeFlowValue);
    return inside(code);
  }
  function inside(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.codeFlowValue);
      return atBreak(code);
    }
    effects.consume(code);
    return inside;
  }
  function after(code) {
    effects.exit(types2.codeIndented);
    return ok2(code);
  }
}
function tokenizeFurtherStart(effects, ok2, nok) {
  const self2 = this;
  return furtherStart2;
  function furtherStart2(code) {
    if (self2.parser.lazy[self2.now().line]) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter(types2.lineEnding);
      effects.consume(code);
      effects.exit(types2.lineEnding);
      return furtherStart2;
    }
    return factorySpace(effects, afterPrefix, types2.linePrefix, constants.tabSize + 1)(code);
  }
  function afterPrefix(code) {
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === types2.linePrefix && tail[2].sliceSerialize(tail[1], true).length >= constants.tabSize ? ok2(code) : markdownLineEnding(code) ? furtherStart2(code) : nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/code-text.js
var codeText = {
  name: "codeText",
  previous,
  resolve: resolveCodeText,
  tokenize: tokenizeCodeText
};
function resolveCodeText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === types2.lineEnding || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === types2.lineEnding || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === types2.codeTextData) {
        events[headEnterIndex][1].type = types2.codeTextPadding;
        events[tailExitIndex][1].type = types2.codeTextPadding;
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === undefined) {
      if (index2 !== tailExitIndex && events[index2][1].type !== types2.lineEnding) {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === types2.lineEnding) {
      events[enter][1].type = types2.codeTextData;
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = undefined;
    }
  }
  return events;
}
function previous(code) {
  return code !== codes.graveAccent || this.events[this.events.length - 1][1].type === types2.characterEscape;
}
function tokenizeCodeText(effects, ok2, nok) {
  const self2 = this;
  let sizeOpen = 0;
  let size;
  let token;
  return start2;
  function start2(code) {
    ok(code === codes.graveAccent, "expected `` ` ``");
    ok(previous.call(self2, self2.previous), "expected correct previous");
    effects.enter(types2.codeText);
    effects.enter(types2.codeTextSequence);
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === codes.graveAccent) {
      effects.consume(code);
      sizeOpen++;
      return sequenceOpen;
    }
    effects.exit(types2.codeTextSequence);
    return between(code);
  }
  function between(code) {
    if (code === codes.eof) {
      return nok(code);
    }
    if (code === codes.space) {
      effects.enter("space");
      effects.consume(code);
      effects.exit("space");
      return between;
    }
    if (code === codes.graveAccent) {
      token = effects.enter(types2.codeTextSequence);
      size = 0;
      return sequenceClose(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter(types2.lineEnding);
      effects.consume(code);
      effects.exit(types2.lineEnding);
      return between;
    }
    effects.enter(types2.codeTextData);
    return data(code);
  }
  function data(code) {
    if (code === codes.eof || code === codes.space || code === codes.graveAccent || markdownLineEnding(code)) {
      effects.exit(types2.codeTextData);
      return between(code);
    }
    effects.consume(code);
    return data;
  }
  function sequenceClose(code) {
    if (code === codes.graveAccent) {
      effects.consume(code);
      size++;
      return sequenceClose;
    }
    if (size === sizeOpen) {
      effects.exit(types2.codeTextSequence);
      effects.exit(types2.codeText);
      return ok2(code);
    }
    token.type = types2.codeTextData;
    return data(code);
  }
}
// ../../../../node_modules/.bun/micromark-util-subtokenize@2.1.0/node_modules/micromark-util-subtokenize/dev/lib/splice-buffer.js
class SpliceBuffer {
  constructor(initial) {
    this.left = initial ? [...initial] : [];
    this.right = [];
  }
  get(index2) {
    if (index2 < 0 || index2 >= this.left.length + this.right.length) {
      throw new RangeError("Cannot access index `" + index2 + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    }
    if (index2 < this.left.length)
      return this.left[index2];
    return this.right[this.right.length - index2 + this.left.length - 1];
  }
  get length() {
    return this.left.length + this.right.length;
  }
  shift() {
    this.setCursor(0);
    return this.right.pop();
  }
  slice(start2, end) {
    const stop = end === null || end === undefined ? Number.POSITIVE_INFINITY : end;
    if (stop < this.left.length) {
      return this.left.slice(start2, stop);
    }
    if (start2 > this.left.length) {
      return this.right.slice(this.right.length - stop + this.left.length, this.right.length - start2 + this.left.length).reverse();
    }
    return this.left.slice(start2).concat(this.right.slice(this.right.length - stop + this.left.length).reverse());
  }
  splice(start2, deleteCount, items) {
    const count = deleteCount || 0;
    this.setCursor(Math.trunc(start2));
    const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
    if (items)
      chunkedPush(this.left, items);
    return removed.reverse();
  }
  pop() {
    this.setCursor(Number.POSITIVE_INFINITY);
    return this.left.pop();
  }
  push(item) {
    this.setCursor(Number.POSITIVE_INFINITY);
    this.left.push(item);
  }
  pushMany(items) {
    this.setCursor(Number.POSITIVE_INFINITY);
    chunkedPush(this.left, items);
  }
  unshift(item) {
    this.setCursor(0);
    this.right.push(item);
  }
  unshiftMany(items) {
    this.setCursor(0);
    chunkedPush(this.right, items.reverse());
  }
  setCursor(n) {
    if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0)
      return;
    if (n < this.left.length) {
      const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
      chunkedPush(this.right, removed.reverse());
    } else {
      const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
      chunkedPush(this.left, removed.reverse());
    }
  }
}
function chunkedPush(list, right) {
  let chunkStart = 0;
  if (right.length < constants.v8MaxSafeChunkSize) {
    list.push(...right);
  } else {
    while (chunkStart < right.length) {
      list.push(...right.slice(chunkStart, chunkStart + constants.v8MaxSafeChunkSize));
      chunkStart += constants.v8MaxSafeChunkSize;
    }
  }
}

// ../../../../node_modules/.bun/micromark-util-subtokenize@2.1.0/node_modules/micromark-util-subtokenize/dev/index.js
function subtokenize(eventsArray) {
  const jumps = {};
  let index2 = -1;
  let event;
  let lineIndex;
  let otherIndex;
  let otherEvent;
  let parameters;
  let subevents;
  let more;
  const events = new SpliceBuffer(eventsArray);
  while (++index2 < events.length) {
    while (index2 in jumps) {
      index2 = jumps[index2];
    }
    event = events.get(index2);
    if (index2 && event[1].type === types2.chunkFlow && events.get(index2 - 1)[1].type === types2.listItemPrefix) {
      ok(event[1]._tokenizer, "expected `_tokenizer` on subtokens");
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === types2.lineEndingBlank) {
        otherIndex += 2;
      }
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === types2.content) {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === types2.content) {
            break;
          }
          if (subevents[otherIndex][1].type === types2.chunkText) {
            subevents[otherIndex][1]._isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    }
    if (event[0] === "enter") {
      if (event[1].contentType) {
        Object.assign(jumps, subcontent(events, index2));
        index2 = jumps[index2];
        more = true;
      }
    } else if (event[1]._container) {
      otherIndex = index2;
      lineIndex = undefined;
      while (otherIndex--) {
        otherEvent = events.get(otherIndex);
        if (otherEvent[1].type === types2.lineEnding || otherEvent[1].type === types2.lineEndingBlank) {
          if (otherEvent[0] === "enter") {
            if (lineIndex) {
              events.get(lineIndex)[1].type = types2.lineEndingBlank;
            }
            otherEvent[1].type = types2.lineEnding;
            lineIndex = otherIndex;
          }
        } else if (otherEvent[1].type === types2.linePrefix || otherEvent[1].type === types2.listItemIndent) {} else {
          break;
        }
      }
      if (lineIndex) {
        event[1].end = { ...events.get(lineIndex)[1].start };
        parameters = events.slice(lineIndex, index2);
        parameters.unshift(event);
        events.splice(lineIndex, index2 - lineIndex + 1, parameters);
      }
    }
  }
  splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
  return !more;
}
function subcontent(events, eventIndex) {
  const token = events.get(eventIndex)[1];
  const context = events.get(eventIndex)[2];
  let startPosition = eventIndex - 1;
  const startPositions = [];
  ok(token.contentType, "expected `contentType` on subtokens");
  let tokenizer = token._tokenizer;
  if (!tokenizer) {
    tokenizer = context.parser[token.contentType](token.start);
    if (token._contentTypeTextTrailing) {
      tokenizer._contentTypeTextTrailing = true;
    }
  }
  const childEvents = tokenizer.events;
  const jumps = [];
  const gaps = {};
  let stream;
  let previous2;
  let index2 = -1;
  let current = token;
  let adjust = 0;
  let start2 = 0;
  const breaks = [start2];
  while (current) {
    while (events.get(++startPosition)[1] !== current) {}
    ok(!previous2 || current.previous === previous2, "expected previous to match");
    ok(!previous2 || previous2.next === current, "expected next to match");
    startPositions.push(startPosition);
    if (!current._tokenizer) {
      stream = context.sliceStream(current);
      if (!current.next) {
        stream.push(codes.eof);
      }
      if (previous2) {
        tokenizer.defineSkip(current.start);
      }
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }
      tokenizer.write(stream);
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = undefined;
      }
    }
    previous2 = current;
    current = current.next;
  }
  current = token;
  while (++index2 < childEvents.length) {
    if (childEvents[index2][0] === "exit" && childEvents[index2 - 1][0] === "enter" && childEvents[index2][1].type === childEvents[index2 - 1][1].type && childEvents[index2][1].start.line !== childEvents[index2][1].end.line) {
      ok(current, "expected a current token");
      start2 = index2 + 1;
      breaks.push(start2);
      current._tokenizer = undefined;
      current.previous = undefined;
      current = current.next;
    }
  }
  tokenizer.events = [];
  if (current) {
    current._tokenizer = undefined;
    current.previous = undefined;
    ok(!current.next, "expected no next token");
  } else {
    breaks.pop();
  }
  index2 = breaks.length;
  while (index2--) {
    const slice = childEvents.slice(breaks[index2], breaks[index2 + 1]);
    const start3 = startPositions.pop();
    ok(start3 !== undefined, "expected a start position when splicing");
    jumps.push([start3, start3 + slice.length - 1]);
    events.splice(start3, 2, slice);
  }
  jumps.reverse();
  index2 = -1;
  while (++index2 < jumps.length) {
    gaps[adjust + jumps[index2][0]] = adjust + jumps[index2][1];
    adjust += jumps[index2][1] - jumps[index2][0] - 1;
  }
  return gaps;
}

// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/content.js
var content2 = { resolve: resolveContent, tokenize: tokenizeContent };
var continuationConstruct = { partial: true, tokenize: tokenizeContinuation };
function resolveContent(events) {
  subtokenize(events);
  return events;
}
function tokenizeContent(effects, ok2) {
  let previous2;
  return chunkStart;
  function chunkStart(code) {
    ok(code !== codes.eof && !markdownLineEnding(code), "expected no eof or eol");
    effects.enter(types2.content);
    previous2 = effects.enter(types2.chunkContent, {
      contentType: constants.contentTypeContent
    });
    return chunkInside(code);
  }
  function chunkInside(code) {
    if (code === codes.eof) {
      return contentEnd(code);
    }
    if (markdownLineEnding(code)) {
      return effects.check(continuationConstruct, contentContinue, contentEnd)(code);
    }
    effects.consume(code);
    return chunkInside;
  }
  function contentEnd(code) {
    effects.exit(types2.chunkContent);
    effects.exit(types2.content);
    return ok2(code);
  }
  function contentContinue(code) {
    ok(markdownLineEnding(code), "expected eol");
    effects.consume(code);
    effects.exit(types2.chunkContent);
    ok(previous2, "expected previous token");
    previous2.next = effects.enter(types2.chunkContent, {
      contentType: constants.contentTypeContent,
      previous: previous2
    });
    previous2 = previous2.next;
    return chunkInside;
  }
}
function tokenizeContinuation(effects, ok2, nok) {
  const self2 = this;
  return startLookahead;
  function startLookahead(code) {
    ok(markdownLineEnding(code), "expected a line ending");
    effects.exit(types2.chunkContent);
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return factorySpace(effects, prefixed, types2.linePrefix);
  }
  function prefixed(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      return nok(code);
    }
    ok(self2.parser.constructs.disable.null, "expected `disable.null` to be populated");
    const tail = self2.events[self2.events.length - 1];
    if (!self2.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === types2.linePrefix && tail[2].sliceSerialize(tail[1], true).length >= constants.tabSize) {
      return ok2(code);
    }
    return effects.interrupt(self2.parser.constructs.flow, nok, ok2)(code);
  }
}
// ../../../../node_modules/.bun/micromark-factory-destination@2.0.1/node_modules/micromark-factory-destination/dev/index.js
function factoryDestination(effects, ok2, nok, type, literalType, literalMarkerType, rawType, stringType, max2) {
  const limit = max2 || Number.POSITIVE_INFINITY;
  let balance = 0;
  return start2;
  function start2(code) {
    if (code === codes.lessThan) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      return enclosedBefore;
    }
    if (code === codes.eof || code === codes.space || code === codes.rightParenthesis || asciiControl(code)) {
      return nok(code);
    }
    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter(types2.chunkString, { contentType: constants.contentTypeString });
    return raw(code);
  }
  function enclosedBefore(code) {
    if (code === codes.greaterThan) {
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok2;
    }
    effects.enter(stringType);
    effects.enter(types2.chunkString, { contentType: constants.contentTypeString });
    return enclosed(code);
  }
  function enclosed(code) {
    if (code === codes.greaterThan) {
      effects.exit(types2.chunkString);
      effects.exit(stringType);
      return enclosedBefore(code);
    }
    if (code === codes.eof || code === codes.lessThan || markdownLineEnding(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === codes.backslash ? enclosedEscape : enclosed;
  }
  function enclosedEscape(code) {
    if (code === codes.lessThan || code === codes.greaterThan || code === codes.backslash) {
      effects.consume(code);
      return enclosed;
    }
    return enclosed(code);
  }
  function raw(code) {
    if (!balance && (code === codes.eof || code === codes.rightParenthesis || markdownLineEndingOrSpace(code))) {
      effects.exit(types2.chunkString);
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok2(code);
    }
    if (balance < limit && code === codes.leftParenthesis) {
      effects.consume(code);
      balance++;
      return raw;
    }
    if (code === codes.rightParenthesis) {
      effects.consume(code);
      balance--;
      return raw;
    }
    if (code === codes.eof || code === codes.space || code === codes.leftParenthesis || asciiControl(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === codes.backslash ? rawEscape : raw;
  }
  function rawEscape(code) {
    if (code === codes.leftParenthesis || code === codes.rightParenthesis || code === codes.backslash) {
      effects.consume(code);
      return raw;
    }
    return raw(code);
  }
}

// ../../../../node_modules/.bun/micromark-factory-label@2.0.1/node_modules/micromark-factory-label/dev/index.js
function factoryLabel(effects, ok2, nok, type, markerType, stringType) {
  const self2 = this;
  let size = 0;
  let seen;
  return start2;
  function start2(code) {
    ok(code === codes.leftSquareBracket, "expected `[`");
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }
  function atBreak(code) {
    if (size > constants.linkReferenceSizeMax || code === codes.eof || code === codes.leftSquareBracket || code === codes.rightSquareBracket && !seen || code === codes.caret && !size && "_hiddenFootnoteSupport" in self2.parser.constructs) {
      return nok(code);
    }
    if (code === codes.rightSquareBracket) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok2;
    }
    if (markdownLineEnding(code)) {
      effects.enter(types2.lineEnding);
      effects.consume(code);
      effects.exit(types2.lineEnding);
      return atBreak;
    }
    effects.enter(types2.chunkString, { contentType: constants.contentTypeString });
    return labelInside(code);
  }
  function labelInside(code) {
    if (code === codes.eof || code === codes.leftSquareBracket || code === codes.rightSquareBracket || markdownLineEnding(code) || size++ > constants.linkReferenceSizeMax) {
      effects.exit(types2.chunkString);
      return atBreak(code);
    }
    effects.consume(code);
    if (!seen)
      seen = !markdownSpace(code);
    return code === codes.backslash ? labelEscape : labelInside;
  }
  function labelEscape(code) {
    if (code === codes.leftSquareBracket || code === codes.backslash || code === codes.rightSquareBracket) {
      effects.consume(code);
      size++;
      return labelInside;
    }
    return labelInside(code);
  }
}

// ../../../../node_modules/.bun/micromark-factory-title@2.0.1/node_modules/micromark-factory-title/dev/index.js
function factoryTitle(effects, ok2, nok, type, markerType, stringType) {
  let marker;
  return start2;
  function start2(code) {
    if (code === codes.quotationMark || code === codes.apostrophe || code === codes.leftParenthesis) {
      effects.enter(type);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      marker = code === codes.leftParenthesis ? codes.rightParenthesis : code;
      return begin;
    }
    return nok(code);
  }
  function begin(code) {
    if (code === marker) {
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok2;
    }
    effects.enter(stringType);
    return atBreak(code);
  }
  function atBreak(code) {
    if (code === marker) {
      effects.exit(stringType);
      return begin(marker);
    }
    if (code === codes.eof) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter(types2.lineEnding);
      effects.consume(code);
      effects.exit(types2.lineEnding);
      return factorySpace(effects, atBreak, types2.linePrefix);
    }
    effects.enter(types2.chunkString, { contentType: constants.contentTypeString });
    return inside(code);
  }
  function inside(code) {
    if (code === marker || code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.chunkString);
      return atBreak(code);
    }
    effects.consume(code);
    return code === codes.backslash ? escape : inside;
  }
  function escape(code) {
    if (code === marker || code === codes.backslash) {
      effects.consume(code);
      return inside;
    }
    return inside(code);
  }
}

// ../../../../node_modules/.bun/micromark-factory-whitespace@2.0.1/node_modules/micromark-factory-whitespace/dev/index.js
function factoryWhitespace(effects, ok2) {
  let seen;
  return start2;
  function start2(code) {
    if (markdownLineEnding(code)) {
      effects.enter(types2.lineEnding);
      effects.consume(code);
      effects.exit(types2.lineEnding);
      seen = true;
      return start2;
    }
    if (markdownSpace(code)) {
      return factorySpace(effects, start2, seen ? types2.linePrefix : types2.lineSuffix)(code);
    }
    return ok2(code);
  }
}

// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/definition.js
var definition = { name: "definition", tokenize: tokenizeDefinition };
var titleBefore = { partial: true, tokenize: tokenizeTitleBefore };
function tokenizeDefinition(effects, ok2, nok) {
  const self2 = this;
  let identifier;
  return start2;
  function start2(code) {
    effects.enter(types2.definition);
    return before(code);
  }
  function before(code) {
    ok(code === codes.leftSquareBracket, "expected `[`");
    return factoryLabel.call(self2, effects, labelAfter, nok, types2.definitionLabel, types2.definitionLabelMarker, types2.definitionLabelString)(code);
  }
  function labelAfter(code) {
    identifier = normalizeIdentifier(self2.sliceSerialize(self2.events[self2.events.length - 1][1]).slice(1, -1));
    if (code === codes.colon) {
      effects.enter(types2.definitionMarker);
      effects.consume(code);
      effects.exit(types2.definitionMarker);
      return markerAfter;
    }
    return nok(code);
  }
  function markerAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, destinationBefore)(code) : destinationBefore(code);
  }
  function destinationBefore(code) {
    return factoryDestination(effects, destinationAfter, nok, types2.definitionDestination, types2.definitionDestinationLiteral, types2.definitionDestinationLiteralMarker, types2.definitionDestinationRaw, types2.definitionDestinationString)(code);
  }
  function destinationAfter(code) {
    return effects.attempt(titleBefore, after, after)(code);
  }
  function after(code) {
    return markdownSpace(code) ? factorySpace(effects, afterWhitespace, types2.whitespace)(code) : afterWhitespace(code);
  }
  function afterWhitespace(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.definition);
      self2.parser.defined.push(identifier);
      return ok2(code);
    }
    return nok(code);
  }
}
function tokenizeTitleBefore(effects, ok2, nok) {
  return titleBefore2;
  function titleBefore2(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, beforeMarker)(code) : nok(code);
  }
  function beforeMarker(code) {
    return factoryTitle(effects, titleAfter, nok, types2.definitionTitle, types2.definitionTitleMarker, types2.definitionTitleString)(code);
  }
  function titleAfter(code) {
    return markdownSpace(code) ? factorySpace(effects, titleAfterOptionalWhitespace, types2.whitespace)(code) : titleAfterOptionalWhitespace(code);
  }
  function titleAfterOptionalWhitespace(code) {
    return code === codes.eof || markdownLineEnding(code) ? ok2(code) : nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/hard-break-escape.js
var hardBreakEscape = {
  name: "hardBreakEscape",
  tokenize: tokenizeHardBreakEscape
};
function tokenizeHardBreakEscape(effects, ok2, nok) {
  return start2;
  function start2(code) {
    ok(code === codes.backslash, "expected `\\`");
    effects.enter(types2.hardBreakEscape);
    effects.consume(code);
    return after;
  }
  function after(code) {
    if (markdownLineEnding(code)) {
      effects.exit(types2.hardBreakEscape);
      return ok2(code);
    }
    return nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/heading-atx.js
var headingAtx = {
  name: "headingAtx",
  resolve: resolveHeadingAtx,
  tokenize: tokenizeHeadingAtx
};
function resolveHeadingAtx(events, context) {
  let contentEnd = events.length - 2;
  let contentStart = 3;
  let content3;
  let text2;
  if (events[contentStart][1].type === types2.whitespace) {
    contentStart += 2;
  }
  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === types2.whitespace) {
    contentEnd -= 2;
  }
  if (events[contentEnd][1].type === types2.atxHeadingSequence && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === types2.whitespace)) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }
  if (contentEnd > contentStart) {
    content3 = {
      type: types2.atxHeadingText,
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    text2 = {
      type: types2.chunkText,
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: constants.contentTypeText
    };
    splice(events, contentStart, contentEnd - contentStart + 1, [
      ["enter", content3, context],
      ["enter", text2, context],
      ["exit", text2, context],
      ["exit", content3, context]
    ]);
  }
  return events;
}
function tokenizeHeadingAtx(effects, ok2, nok) {
  let size = 0;
  return start2;
  function start2(code) {
    effects.enter(types2.atxHeading);
    return before(code);
  }
  function before(code) {
    ok(code === codes.numberSign, "expected `#`");
    effects.enter(types2.atxHeadingSequence);
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === codes.numberSign && size++ < constants.atxHeadingOpeningFenceSizeMax) {
      effects.consume(code);
      return sequenceOpen;
    }
    if (code === codes.eof || markdownLineEndingOrSpace(code)) {
      effects.exit(types2.atxHeadingSequence);
      return atBreak(code);
    }
    return nok(code);
  }
  function atBreak(code) {
    if (code === codes.numberSign) {
      effects.enter(types2.atxHeadingSequence);
      return sequenceFurther(code);
    }
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.atxHeading);
      return ok2(code);
    }
    if (markdownSpace(code)) {
      return factorySpace(effects, atBreak, types2.whitespace)(code);
    }
    effects.enter(types2.atxHeadingText);
    return data(code);
  }
  function sequenceFurther(code) {
    if (code === codes.numberSign) {
      effects.consume(code);
      return sequenceFurther;
    }
    effects.exit(types2.atxHeadingSequence);
    return atBreak(code);
  }
  function data(code) {
    if (code === codes.eof || code === codes.numberSign || markdownLineEndingOrSpace(code)) {
      effects.exit(types2.atxHeadingText);
      return atBreak(code);
    }
    effects.consume(code);
    return data;
  }
}
// ../../../../node_modules/.bun/micromark-util-html-tag-name@2.0.1/node_modules/micromark-util-html-tag-name/index.js
var htmlBlockNames = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var htmlRawNames = ["pre", "script", "style", "textarea"];

// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/html-flow.js
var htmlFlow = {
  concrete: true,
  name: "htmlFlow",
  resolveTo: resolveToHtmlFlow,
  tokenize: tokenizeHtmlFlow
};
var blankLineBefore = { partial: true, tokenize: tokenizeBlankLineBefore };
var nonLazyContinuationStart = {
  partial: true,
  tokenize: tokenizeNonLazyContinuationStart
};
function resolveToHtmlFlow(events) {
  let index2 = events.length;
  while (index2--) {
    if (events[index2][0] === "enter" && events[index2][1].type === types2.htmlFlow) {
      break;
    }
  }
  if (index2 > 1 && events[index2 - 2][1].type === types2.linePrefix) {
    events[index2][1].start = events[index2 - 2][1].start;
    events[index2 + 1][1].start = events[index2 - 2][1].start;
    events.splice(index2 - 2, 2);
  }
  return events;
}
function tokenizeHtmlFlow(effects, ok2, nok) {
  const self2 = this;
  let marker;
  let closingTag;
  let buffer;
  let index2;
  let markerB;
  return start2;
  function start2(code) {
    return before(code);
  }
  function before(code) {
    ok(code === codes.lessThan, "expected `<`");
    effects.enter(types2.htmlFlow);
    effects.enter(types2.htmlFlowData);
    effects.consume(code);
    return open;
  }
  function open(code) {
    if (code === codes.exclamationMark) {
      effects.consume(code);
      return declarationOpen;
    }
    if (code === codes.slash) {
      effects.consume(code);
      closingTag = true;
      return tagCloseStart;
    }
    if (code === codes.questionMark) {
      effects.consume(code);
      marker = constants.htmlInstruction;
      return self2.interrupt ? ok2 : continuationDeclarationInside;
    }
    if (asciiAlpha(code)) {
      ok(code !== null);
      effects.consume(code);
      buffer = String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function declarationOpen(code) {
    if (code === codes.dash) {
      effects.consume(code);
      marker = constants.htmlComment;
      return commentOpenInside;
    }
    if (code === codes.leftSquareBracket) {
      effects.consume(code);
      marker = constants.htmlCdata;
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      marker = constants.htmlDeclaration;
      return self2.interrupt ? ok2 : continuationDeclarationInside;
    }
    return nok(code);
  }
  function commentOpenInside(code) {
    if (code === codes.dash) {
      effects.consume(code);
      return self2.interrupt ? ok2 : continuationDeclarationInside;
    }
    return nok(code);
  }
  function cdataOpenInside(code) {
    const value = constants.cdataOpeningString;
    if (code === value.charCodeAt(index2++)) {
      effects.consume(code);
      if (index2 === value.length) {
        return self2.interrupt ? ok2 : continuation;
      }
      return cdataOpenInside;
    }
    return nok(code);
  }
  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      ok(code !== null);
      effects.consume(code);
      buffer = String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function tagName(code) {
    if (code === codes.eof || code === codes.slash || code === codes.greaterThan || markdownLineEndingOrSpace(code)) {
      const slash = code === codes.slash;
      const name2 = buffer.toLowerCase();
      if (!slash && !closingTag && htmlRawNames.includes(name2)) {
        marker = constants.htmlRaw;
        return self2.interrupt ? ok2(code) : continuation(code);
      }
      if (htmlBlockNames.includes(buffer.toLowerCase())) {
        marker = constants.htmlBasic;
        if (slash) {
          effects.consume(code);
          return basicSelfClosing;
        }
        return self2.interrupt ? ok2(code) : continuation(code);
      }
      marker = constants.htmlComplete;
      return self2.interrupt && !self2.parser.lazy[self2.now().line] ? nok(code) : closingTag ? completeClosingTagAfter(code) : completeAttributeNameBefore(code);
    }
    if (code === codes.dash || asciiAlphanumeric(code)) {
      effects.consume(code);
      buffer += String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function basicSelfClosing(code) {
    if (code === codes.greaterThan) {
      effects.consume(code);
      return self2.interrupt ? ok2 : continuation;
    }
    return nok(code);
  }
  function completeClosingTagAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeClosingTagAfter;
    }
    return completeEnd(code);
  }
  function completeAttributeNameBefore(code) {
    if (code === codes.slash) {
      effects.consume(code);
      return completeEnd;
    }
    if (code === codes.colon || code === codes.underscore || asciiAlpha(code)) {
      effects.consume(code);
      return completeAttributeName;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameBefore;
    }
    return completeEnd(code);
  }
  function completeAttributeName(code) {
    if (code === codes.dash || code === codes.dot || code === codes.colon || code === codes.underscore || asciiAlphanumeric(code)) {
      effects.consume(code);
      return completeAttributeName;
    }
    return completeAttributeNameAfter(code);
  }
  function completeAttributeNameAfter(code) {
    if (code === codes.equalsTo) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameAfter;
    }
    return completeAttributeNameBefore(code);
  }
  function completeAttributeValueBefore(code) {
    if (code === codes.eof || code === codes.lessThan || code === codes.equalsTo || code === codes.greaterThan || code === codes.graveAccent) {
      return nok(code);
    }
    if (code === codes.quotationMark || code === codes.apostrophe) {
      effects.consume(code);
      markerB = code;
      return completeAttributeValueQuoted;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }
    return completeAttributeValueUnquoted(code);
  }
  function completeAttributeValueQuoted(code) {
    if (code === markerB) {
      effects.consume(code);
      markerB = null;
      return completeAttributeValueQuotedAfter;
    }
    if (code === codes.eof || markdownLineEnding(code)) {
      return nok(code);
    }
    effects.consume(code);
    return completeAttributeValueQuoted;
  }
  function completeAttributeValueUnquoted(code) {
    if (code === codes.eof || code === codes.quotationMark || code === codes.apostrophe || code === codes.slash || code === codes.lessThan || code === codes.equalsTo || code === codes.greaterThan || code === codes.graveAccent || markdownLineEndingOrSpace(code)) {
      return completeAttributeNameAfter(code);
    }
    effects.consume(code);
    return completeAttributeValueUnquoted;
  }
  function completeAttributeValueQuotedAfter(code) {
    if (code === codes.slash || code === codes.greaterThan || markdownSpace(code)) {
      return completeAttributeNameBefore(code);
    }
    return nok(code);
  }
  function completeEnd(code) {
    if (code === codes.greaterThan) {
      effects.consume(code);
      return completeAfter;
    }
    return nok(code);
  }
  function completeAfter(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      return continuation(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAfter;
    }
    return nok(code);
  }
  function continuation(code) {
    if (code === codes.dash && marker === constants.htmlComment) {
      effects.consume(code);
      return continuationCommentInside;
    }
    if (code === codes.lessThan && marker === constants.htmlRaw) {
      effects.consume(code);
      return continuationRawTagOpen;
    }
    if (code === codes.greaterThan && marker === constants.htmlDeclaration) {
      effects.consume(code);
      return continuationClose;
    }
    if (code === codes.questionMark && marker === constants.htmlInstruction) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    if (code === codes.rightSquareBracket && marker === constants.htmlCdata) {
      effects.consume(code);
      return continuationCdataInside;
    }
    if (markdownLineEnding(code) && (marker === constants.htmlBasic || marker === constants.htmlComplete)) {
      effects.exit(types2.htmlFlowData);
      return effects.check(blankLineBefore, continuationAfter, continuationStart)(code);
    }
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.htmlFlowData);
      return continuationStart(code);
    }
    effects.consume(code);
    return continuation;
  }
  function continuationStart(code) {
    return effects.check(nonLazyContinuationStart, continuationStartNonLazy, continuationAfter)(code);
  }
  function continuationStartNonLazy(code) {
    ok(markdownLineEnding(code));
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return continuationBefore;
  }
  function continuationBefore(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      return continuationStart(code);
    }
    effects.enter(types2.htmlFlowData);
    return continuation(code);
  }
  function continuationCommentInside(code) {
    if (code === codes.dash) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationRawTagOpen(code) {
    if (code === codes.slash) {
      effects.consume(code);
      buffer = "";
      return continuationRawEndTag;
    }
    return continuation(code);
  }
  function continuationRawEndTag(code) {
    if (code === codes.greaterThan) {
      const name2 = buffer.toLowerCase();
      if (htmlRawNames.includes(name2)) {
        effects.consume(code);
        return continuationClose;
      }
      return continuation(code);
    }
    if (asciiAlpha(code) && buffer.length < constants.htmlRawSizeMax) {
      ok(code !== null);
      effects.consume(code);
      buffer += String.fromCharCode(code);
      return continuationRawEndTag;
    }
    return continuation(code);
  }
  function continuationCdataInside(code) {
    if (code === codes.rightSquareBracket) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationDeclarationInside(code) {
    if (code === codes.greaterThan) {
      effects.consume(code);
      return continuationClose;
    }
    if (code === codes.dash && marker === constants.htmlComment) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationClose(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.htmlFlowData);
      return continuationAfter(code);
    }
    effects.consume(code);
    return continuationClose;
  }
  function continuationAfter(code) {
    effects.exit(types2.htmlFlow);
    return ok2(code);
  }
}
function tokenizeNonLazyContinuationStart(effects, ok2, nok) {
  const self2 = this;
  return start2;
  function start2(code) {
    if (markdownLineEnding(code)) {
      effects.enter(types2.lineEnding);
      effects.consume(code);
      effects.exit(types2.lineEnding);
      return after;
    }
    return nok(code);
  }
  function after(code) {
    return self2.parser.lazy[self2.now().line] ? nok(code) : ok2(code);
  }
}
function tokenizeBlankLineBefore(effects, ok2, nok) {
  return start2;
  function start2(code) {
    ok(markdownLineEnding(code), "expected a line ending");
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return effects.attempt(blankLine, ok2, nok);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/html-text.js
var htmlText = { name: "htmlText", tokenize: tokenizeHtmlText };
function tokenizeHtmlText(effects, ok2, nok) {
  const self2 = this;
  let marker;
  let index2;
  let returnState;
  return start2;
  function start2(code) {
    ok(code === codes.lessThan, "expected `<`");
    effects.enter(types2.htmlText);
    effects.enter(types2.htmlTextData);
    effects.consume(code);
    return open;
  }
  function open(code) {
    if (code === codes.exclamationMark) {
      effects.consume(code);
      return declarationOpen;
    }
    if (code === codes.slash) {
      effects.consume(code);
      return tagCloseStart;
    }
    if (code === codes.questionMark) {
      effects.consume(code);
      return instruction;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagOpen;
    }
    return nok(code);
  }
  function declarationOpen(code) {
    if (code === codes.dash) {
      effects.consume(code);
      return commentOpenInside;
    }
    if (code === codes.leftSquareBracket) {
      effects.consume(code);
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      return declaration;
    }
    return nok(code);
  }
  function commentOpenInside(code) {
    if (code === codes.dash) {
      effects.consume(code);
      return commentEnd;
    }
    return nok(code);
  }
  function comment(code) {
    if (code === codes.eof) {
      return nok(code);
    }
    if (code === codes.dash) {
      effects.consume(code);
      return commentClose;
    }
    if (markdownLineEnding(code)) {
      returnState = comment;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return comment;
  }
  function commentClose(code) {
    if (code === codes.dash) {
      effects.consume(code);
      return commentEnd;
    }
    return comment(code);
  }
  function commentEnd(code) {
    return code === codes.greaterThan ? end(code) : code === codes.dash ? commentClose(code) : comment(code);
  }
  function cdataOpenInside(code) {
    const value = constants.cdataOpeningString;
    if (code === value.charCodeAt(index2++)) {
      effects.consume(code);
      return index2 === value.length ? cdata : cdataOpenInside;
    }
    return nok(code);
  }
  function cdata(code) {
    if (code === codes.eof) {
      return nok(code);
    }
    if (code === codes.rightSquareBracket) {
      effects.consume(code);
      return cdataClose;
    }
    if (markdownLineEnding(code)) {
      returnState = cdata;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return cdata;
  }
  function cdataClose(code) {
    if (code === codes.rightSquareBracket) {
      effects.consume(code);
      return cdataEnd;
    }
    return cdata(code);
  }
  function cdataEnd(code) {
    if (code === codes.greaterThan) {
      return end(code);
    }
    if (code === codes.rightSquareBracket) {
      effects.consume(code);
      return cdataEnd;
    }
    return cdata(code);
  }
  function declaration(code) {
    if (code === codes.eof || code === codes.greaterThan) {
      return end(code);
    }
    if (markdownLineEnding(code)) {
      returnState = declaration;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return declaration;
  }
  function instruction(code) {
    if (code === codes.eof) {
      return nok(code);
    }
    if (code === codes.questionMark) {
      effects.consume(code);
      return instructionClose;
    }
    if (markdownLineEnding(code)) {
      returnState = instruction;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return instruction;
  }
  function instructionClose(code) {
    return code === codes.greaterThan ? end(code) : instruction(code);
  }
  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagClose;
    }
    return nok(code);
  }
  function tagClose(code) {
    if (code === codes.dash || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagClose;
    }
    return tagCloseBetween(code);
  }
  function tagCloseBetween(code) {
    if (markdownLineEnding(code)) {
      returnState = tagCloseBetween;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagCloseBetween;
    }
    return end(code);
  }
  function tagOpen(code) {
    if (code === codes.dash || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpen;
    }
    if (code === codes.slash || code === codes.greaterThan || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    return nok(code);
  }
  function tagOpenBetween(code) {
    if (code === codes.slash) {
      effects.consume(code);
      return end;
    }
    if (code === codes.colon || code === codes.underscore || asciiAlpha(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenBetween;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenBetween;
    }
    return end(code);
  }
  function tagOpenAttributeName(code) {
    if (code === codes.dash || code === codes.dot || code === codes.colon || code === codes.underscore || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }
    return tagOpenAttributeNameAfter(code);
  }
  function tagOpenAttributeNameAfter(code) {
    if (code === codes.equalsTo) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeNameAfter;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeNameAfter;
    }
    return tagOpenBetween(code);
  }
  function tagOpenAttributeValueBefore(code) {
    if (code === codes.eof || code === codes.lessThan || code === codes.equalsTo || code === codes.greaterThan || code === codes.graveAccent) {
      return nok(code);
    }
    if (code === codes.quotationMark || code === codes.apostrophe) {
      effects.consume(code);
      marker = code;
      return tagOpenAttributeValueQuoted;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueBefore;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }
    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuoted(code) {
    if (code === marker) {
      effects.consume(code);
      marker = undefined;
      return tagOpenAttributeValueQuotedAfter;
    }
    if (code === codes.eof) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueQuoted;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return tagOpenAttributeValueQuoted;
  }
  function tagOpenAttributeValueUnquoted(code) {
    if (code === codes.eof || code === codes.quotationMark || code === codes.apostrophe || code === codes.lessThan || code === codes.equalsTo || code === codes.graveAccent) {
      return nok(code);
    }
    if (code === codes.slash || code === codes.greaterThan || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuotedAfter(code) {
    if (code === codes.slash || code === codes.greaterThan || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    return nok(code);
  }
  function end(code) {
    if (code === codes.greaterThan) {
      effects.consume(code);
      effects.exit(types2.htmlTextData);
      effects.exit(types2.htmlText);
      return ok2;
    }
    return nok(code);
  }
  function lineEndingBefore(code) {
    ok(returnState, "expected return state");
    ok(markdownLineEnding(code), "expected eol");
    effects.exit(types2.htmlTextData);
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return lineEndingAfter;
  }
  function lineEndingAfter(code) {
    ok(self2.parser.constructs.disable.null, "expected `disable.null` to be populated");
    return markdownSpace(code) ? factorySpace(effects, lineEndingAfterPrefix, types2.linePrefix, self2.parser.constructs.disable.null.includes("codeIndented") ? undefined : constants.tabSize)(code) : lineEndingAfterPrefix(code);
  }
  function lineEndingAfterPrefix(code) {
    effects.enter(types2.htmlTextData);
    return returnState(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/label-end.js
var labelEnd = {
  name: "labelEnd",
  resolveAll: resolveAllLabelEnd,
  resolveTo: resolveToLabelEnd,
  tokenize: tokenizeLabelEnd
};
var resourceConstruct = { tokenize: tokenizeResource };
var referenceFullConstruct = { tokenize: tokenizeReferenceFull };
var referenceCollapsedConstruct = { tokenize: tokenizeReferenceCollapsed };
function resolveAllLabelEnd(events) {
  let index2 = -1;
  const newEvents = [];
  while (++index2 < events.length) {
    const token = events[index2][1];
    newEvents.push(events[index2]);
    if (token.type === types2.labelImage || token.type === types2.labelLink || token.type === types2.labelEnd) {
      const offset = token.type === types2.labelImage ? 4 : 2;
      token.type = types2.data;
      index2 += offset;
    }
  }
  if (events.length !== newEvents.length) {
    splice(events, 0, events.length, newEvents);
  }
  return events;
}
function resolveToLabelEnd(events, context) {
  let index2 = events.length;
  let offset = 0;
  let token;
  let open;
  let close;
  let media;
  while (index2--) {
    token = events[index2][1];
    if (open) {
      if (token.type === types2.link || token.type === types2.labelLink && token._inactive) {
        break;
      }
      if (events[index2][0] === "enter" && token.type === types2.labelLink) {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index2][0] === "enter" && (token.type === types2.labelImage || token.type === types2.labelLink) && !token._balanced) {
        open = index2;
        if (token.type !== types2.labelLink) {
          offset = 2;
          break;
        }
      }
    } else if (token.type === types2.labelEnd) {
      close = index2;
    }
  }
  ok(open !== undefined, "`open` is supposed to be found");
  ok(close !== undefined, "`close` is supposed to be found");
  const group = {
    type: events[open][1].type === types2.labelLink ? types2.link : types2.image,
    start: { ...events[open][1].start },
    end: { ...events[events.length - 1][1].end }
  };
  const label = {
    type: types2.label,
    start: { ...events[open][1].start },
    end: { ...events[close][1].end }
  };
  const text2 = {
    type: types2.labelText,
    start: { ...events[open + offset + 2][1].end },
    end: { ...events[close - 2][1].start }
  };
  media = [
    ["enter", group, context],
    ["enter", label, context]
  ];
  media = push(media, events.slice(open + 1, open + offset + 3));
  media = push(media, [["enter", text2, context]]);
  ok(context.parser.constructs.insideSpan.null, "expected `insideSpan.null` to be populated");
  media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + offset + 4, close - 3), context));
  media = push(media, [
    ["exit", text2, context],
    events[close - 2],
    events[close - 1],
    ["exit", label, context]
  ]);
  media = push(media, events.slice(close + 1));
  media = push(media, [["exit", group, context]]);
  splice(events, open, events.length, media);
  return events;
}
function tokenizeLabelEnd(effects, ok2, nok) {
  const self2 = this;
  let index2 = self2.events.length;
  let labelStart;
  let defined;
  while (index2--) {
    if ((self2.events[index2][1].type === types2.labelImage || self2.events[index2][1].type === types2.labelLink) && !self2.events[index2][1]._balanced) {
      labelStart = self2.events[index2][1];
      break;
    }
  }
  return start2;
  function start2(code) {
    ok(code === codes.rightSquareBracket, "expected `]`");
    if (!labelStart) {
      return nok(code);
    }
    if (labelStart._inactive) {
      return labelEndNok(code);
    }
    defined = self2.parser.defined.includes(normalizeIdentifier(self2.sliceSerialize({ start: labelStart.end, end: self2.now() })));
    effects.enter(types2.labelEnd);
    effects.enter(types2.labelMarker);
    effects.consume(code);
    effects.exit(types2.labelMarker);
    effects.exit(types2.labelEnd);
    return after;
  }
  function after(code) {
    if (code === codes.leftParenthesis) {
      return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code);
    }
    if (code === codes.leftSquareBracket) {
      return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code);
    }
    return defined ? labelEndOk(code) : labelEndNok(code);
  }
  function referenceNotFull(code) {
    return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code);
  }
  function labelEndOk(code) {
    return ok2(code);
  }
  function labelEndNok(code) {
    labelStart._balanced = true;
    return nok(code);
  }
}
function tokenizeResource(effects, ok2, nok) {
  return resourceStart;
  function resourceStart(code) {
    ok(code === codes.leftParenthesis, "expected left paren");
    effects.enter(types2.resource);
    effects.enter(types2.resourceMarker);
    effects.consume(code);
    effects.exit(types2.resourceMarker);
    return resourceBefore;
  }
  function resourceBefore(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceOpen)(code) : resourceOpen(code);
  }
  function resourceOpen(code) {
    if (code === codes.rightParenthesis) {
      return resourceEnd(code);
    }
    return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, types2.resourceDestination, types2.resourceDestinationLiteral, types2.resourceDestinationLiteralMarker, types2.resourceDestinationRaw, types2.resourceDestinationString, constants.linkResourceDestinationBalanceMax)(code);
  }
  function resourceDestinationAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceBetween)(code) : resourceEnd(code);
  }
  function resourceDestinationMissing(code) {
    return nok(code);
  }
  function resourceBetween(code) {
    if (code === codes.quotationMark || code === codes.apostrophe || code === codes.leftParenthesis) {
      return factoryTitle(effects, resourceTitleAfter, nok, types2.resourceTitle, types2.resourceTitleMarker, types2.resourceTitleString)(code);
    }
    return resourceEnd(code);
  }
  function resourceTitleAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceEnd)(code) : resourceEnd(code);
  }
  function resourceEnd(code) {
    if (code === codes.rightParenthesis) {
      effects.enter(types2.resourceMarker);
      effects.consume(code);
      effects.exit(types2.resourceMarker);
      effects.exit(types2.resource);
      return ok2;
    }
    return nok(code);
  }
}
function tokenizeReferenceFull(effects, ok2, nok) {
  const self2 = this;
  return referenceFull;
  function referenceFull(code) {
    ok(code === codes.leftSquareBracket, "expected left bracket");
    return factoryLabel.call(self2, effects, referenceFullAfter, referenceFullMissing, types2.reference, types2.referenceMarker, types2.referenceString)(code);
  }
  function referenceFullAfter(code) {
    return self2.parser.defined.includes(normalizeIdentifier(self2.sliceSerialize(self2.events[self2.events.length - 1][1]).slice(1, -1))) ? ok2(code) : nok(code);
  }
  function referenceFullMissing(code) {
    return nok(code);
  }
}
function tokenizeReferenceCollapsed(effects, ok2, nok) {
  return referenceCollapsedStart;
  function referenceCollapsedStart(code) {
    ok(code === codes.leftSquareBracket, "expected left bracket");
    effects.enter(types2.reference);
    effects.enter(types2.referenceMarker);
    effects.consume(code);
    effects.exit(types2.referenceMarker);
    return referenceCollapsedOpen;
  }
  function referenceCollapsedOpen(code) {
    if (code === codes.rightSquareBracket) {
      effects.enter(types2.referenceMarker);
      effects.consume(code);
      effects.exit(types2.referenceMarker);
      effects.exit(types2.reference);
      return ok2;
    }
    return nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/label-start-image.js
var labelStartImage = {
  name: "labelStartImage",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartImage
};
function tokenizeLabelStartImage(effects, ok2, nok) {
  const self2 = this;
  return start2;
  function start2(code) {
    ok(code === codes.exclamationMark, "expected `!`");
    effects.enter(types2.labelImage);
    effects.enter(types2.labelImageMarker);
    effects.consume(code);
    effects.exit(types2.labelImageMarker);
    return open;
  }
  function open(code) {
    if (code === codes.leftSquareBracket) {
      effects.enter(types2.labelMarker);
      effects.consume(code);
      effects.exit(types2.labelMarker);
      effects.exit(types2.labelImage);
      return after;
    }
    return nok(code);
  }
  function after(code) {
    return code === codes.caret && "_hiddenFootnoteSupport" in self2.parser.constructs ? nok(code) : ok2(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/label-start-link.js
var labelStartLink = {
  name: "labelStartLink",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartLink
};
function tokenizeLabelStartLink(effects, ok2, nok) {
  const self2 = this;
  return start2;
  function start2(code) {
    ok(code === codes.leftSquareBracket, "expected `[`");
    effects.enter(types2.labelLink);
    effects.enter(types2.labelMarker);
    effects.consume(code);
    effects.exit(types2.labelMarker);
    effects.exit(types2.labelLink);
    return after;
  }
  function after(code) {
    return code === codes.caret && "_hiddenFootnoteSupport" in self2.parser.constructs ? nok(code) : ok2(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/line-ending.js
var lineEnding = { name: "lineEnding", tokenize: tokenizeLineEnding };
function tokenizeLineEnding(effects, ok2) {
  return start2;
  function start2(code) {
    ok(markdownLineEnding(code), "expected eol");
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    return factorySpace(effects, ok2, types2.linePrefix);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/thematic-break.js
var thematicBreak = {
  name: "thematicBreak",
  tokenize: tokenizeThematicBreak
};
function tokenizeThematicBreak(effects, ok2, nok) {
  let size = 0;
  let marker;
  return start2;
  function start2(code) {
    effects.enter(types2.thematicBreak);
    return before(code);
  }
  function before(code) {
    ok(code === codes.asterisk || code === codes.dash || code === codes.underscore, "expected `*`, `-`, or `_`");
    marker = code;
    return atBreak(code);
  }
  function atBreak(code) {
    if (code === marker) {
      effects.enter(types2.thematicBreakSequence);
      return sequence(code);
    }
    if (size >= constants.thematicBreakMarkerCountMin && (code === codes.eof || markdownLineEnding(code))) {
      effects.exit(types2.thematicBreak);
      return ok2(code);
    }
    return nok(code);
  }
  function sequence(code) {
    if (code === marker) {
      effects.consume(code);
      size++;
      return sequence;
    }
    effects.exit(types2.thematicBreakSequence);
    return markdownSpace(code) ? factorySpace(effects, atBreak, types2.whitespace)(code) : atBreak(code);
  }
}

// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/list.js
var list = {
  continuation: { tokenize: tokenizeListContinuation },
  exit: tokenizeListEnd,
  name: "list",
  tokenize: tokenizeListStart
};
var listItemPrefixWhitespaceConstruct = {
  partial: true,
  tokenize: tokenizeListItemPrefixWhitespace
};
var indentConstruct = { partial: true, tokenize: tokenizeIndent };
function tokenizeListStart(effects, ok2, nok) {
  const self2 = this;
  const tail = self2.events[self2.events.length - 1];
  let initialSize = tail && tail[1].type === types2.linePrefix ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let size = 0;
  return start2;
  function start2(code) {
    ok(self2.containerState, "expected state");
    const kind = self2.containerState.type || (code === codes.asterisk || code === codes.plusSign || code === codes.dash ? types2.listUnordered : types2.listOrdered);
    if (kind === types2.listUnordered ? !self2.containerState.marker || code === self2.containerState.marker : asciiDigit(code)) {
      if (!self2.containerState.type) {
        self2.containerState.type = kind;
        effects.enter(kind, { _container: true });
      }
      if (kind === types2.listUnordered) {
        effects.enter(types2.listItemPrefix);
        return code === codes.asterisk || code === codes.dash ? effects.check(thematicBreak, nok, atMarker)(code) : atMarker(code);
      }
      if (!self2.interrupt || code === codes.digit1) {
        effects.enter(types2.listItemPrefix);
        effects.enter(types2.listItemValue);
        return inside(code);
      }
    }
    return nok(code);
  }
  function inside(code) {
    ok(self2.containerState, "expected state");
    if (asciiDigit(code) && ++size < constants.listItemValueSizeMax) {
      effects.consume(code);
      return inside;
    }
    if ((!self2.interrupt || size < 2) && (self2.containerState.marker ? code === self2.containerState.marker : code === codes.rightParenthesis || code === codes.dot)) {
      effects.exit(types2.listItemValue);
      return atMarker(code);
    }
    return nok(code);
  }
  function atMarker(code) {
    ok(self2.containerState, "expected state");
    ok(code !== codes.eof, "eof (`null`) is not a marker");
    effects.enter(types2.listItemMarker);
    effects.consume(code);
    effects.exit(types2.listItemMarker);
    self2.containerState.marker = self2.containerState.marker || code;
    return effects.check(blankLine, self2.interrupt ? nok : onBlank, effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix));
  }
  function onBlank(code) {
    ok(self2.containerState, "expected state");
    self2.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code);
  }
  function otherPrefix(code) {
    if (markdownSpace(code)) {
      effects.enter(types2.listItemPrefixWhitespace);
      effects.consume(code);
      effects.exit(types2.listItemPrefixWhitespace);
      return endOfPrefix;
    }
    return nok(code);
  }
  function endOfPrefix(code) {
    ok(self2.containerState, "expected state");
    self2.containerState.size = initialSize + self2.sliceSerialize(effects.exit(types2.listItemPrefix), true).length;
    return ok2(code);
  }
}
function tokenizeListContinuation(effects, ok2, nok) {
  const self2 = this;
  ok(self2.containerState, "expected state");
  self2.containerState._closeFlow = undefined;
  return effects.check(blankLine, onBlank, notBlank);
  function onBlank(code) {
    ok(self2.containerState, "expected state");
    ok(typeof self2.containerState.size === "number", "expected size");
    self2.containerState.furtherBlankLines = self2.containerState.furtherBlankLines || self2.containerState.initialBlankLine;
    return factorySpace(effects, ok2, types2.listItemIndent, self2.containerState.size + 1)(code);
  }
  function notBlank(code) {
    ok(self2.containerState, "expected state");
    if (self2.containerState.furtherBlankLines || !markdownSpace(code)) {
      self2.containerState.furtherBlankLines = undefined;
      self2.containerState.initialBlankLine = undefined;
      return notInCurrentItem(code);
    }
    self2.containerState.furtherBlankLines = undefined;
    self2.containerState.initialBlankLine = undefined;
    return effects.attempt(indentConstruct, ok2, notInCurrentItem)(code);
  }
  function notInCurrentItem(code) {
    ok(self2.containerState, "expected state");
    self2.containerState._closeFlow = true;
    self2.interrupt = undefined;
    ok(self2.parser.constructs.disable.null, "expected `disable.null` to be populated");
    return factorySpace(effects, effects.attempt(list, ok2, nok), types2.linePrefix, self2.parser.constructs.disable.null.includes("codeIndented") ? undefined : constants.tabSize)(code);
  }
}
function tokenizeIndent(effects, ok2, nok) {
  const self2 = this;
  ok(self2.containerState, "expected state");
  ok(typeof self2.containerState.size === "number", "expected size");
  return factorySpace(effects, afterPrefix, types2.listItemIndent, self2.containerState.size + 1);
  function afterPrefix(code) {
    ok(self2.containerState, "expected state");
    const tail = self2.events[self2.events.length - 1];
    return tail && tail[1].type === types2.listItemIndent && tail[2].sliceSerialize(tail[1], true).length === self2.containerState.size ? ok2(code) : nok(code);
  }
}
function tokenizeListEnd(effects) {
  ok(this.containerState, "expected state");
  ok(typeof this.containerState.type === "string", "expected type");
  effects.exit(this.containerState.type);
}
function tokenizeListItemPrefixWhitespace(effects, ok2, nok) {
  const self2 = this;
  ok(self2.parser.constructs.disable.null, "expected `disable.null` to be populated");
  return factorySpace(effects, afterPrefix, types2.listItemPrefixWhitespace, self2.parser.constructs.disable.null.includes("codeIndented") ? undefined : constants.tabSize + 1);
  function afterPrefix(code) {
    const tail = self2.events[self2.events.length - 1];
    return !markdownSpace(code) && tail && tail[1].type === types2.listItemPrefixWhitespace ? ok2(code) : nok(code);
  }
}
// ../../../../node_modules/.bun/micromark-core-commonmark@2.0.3/node_modules/micromark-core-commonmark/dev/lib/setext-underline.js
var setextUnderline = {
  name: "setextUnderline",
  resolveTo: resolveToSetextUnderline,
  tokenize: tokenizeSetextUnderline
};
function resolveToSetextUnderline(events, context) {
  let index2 = events.length;
  let content3;
  let text2;
  let definition2;
  while (index2--) {
    if (events[index2][0] === "enter") {
      if (events[index2][1].type === types2.content) {
        content3 = index2;
        break;
      }
      if (events[index2][1].type === types2.paragraph) {
        text2 = index2;
      }
    } else {
      if (events[index2][1].type === types2.content) {
        events.splice(index2, 1);
      }
      if (!definition2 && events[index2][1].type === types2.definition) {
        definition2 = index2;
      }
    }
  }
  ok(text2 !== undefined, "expected a `text` index to be found");
  ok(content3 !== undefined, "expected a `text` index to be found");
  ok(events[content3][2] === context, "enter context should be same");
  ok(events[events.length - 1][2] === context, "enter context should be same");
  const heading = {
    type: types2.setextHeading,
    start: { ...events[content3][1].start },
    end: { ...events[events.length - 1][1].end }
  };
  events[text2][1].type = types2.setextHeadingText;
  if (definition2) {
    events.splice(text2, 0, ["enter", heading, context]);
    events.splice(definition2 + 1, 0, ["exit", events[content3][1], context]);
    events[content3][1].end = { ...events[definition2][1].end };
  } else {
    events[content3][1] = heading;
  }
  events.push(["exit", heading, context]);
  return events;
}
function tokenizeSetextUnderline(effects, ok2, nok) {
  const self2 = this;
  let marker;
  return start2;
  function start2(code) {
    let index2 = self2.events.length;
    let paragraph;
    ok(code === codes.dash || code === codes.equalsTo, "expected `=` or `-`");
    while (index2--) {
      if (self2.events[index2][1].type !== types2.lineEnding && self2.events[index2][1].type !== types2.linePrefix && self2.events[index2][1].type !== types2.content) {
        paragraph = self2.events[index2][1].type === types2.paragraph;
        break;
      }
    }
    if (!self2.parser.lazy[self2.now().line] && (self2.interrupt || paragraph)) {
      effects.enter(types2.setextHeadingLine);
      marker = code;
      return before(code);
    }
    return nok(code);
  }
  function before(code) {
    effects.enter(types2.setextHeadingLineSequence);
    return inside(code);
  }
  function inside(code) {
    if (code === marker) {
      effects.consume(code);
      return inside;
    }
    effects.exit(types2.setextHeadingLineSequence);
    return markdownSpace(code) ? factorySpace(effects, after, types2.lineSuffix)(code) : after(code);
  }
  function after(code) {
    if (code === codes.eof || markdownLineEnding(code)) {
      effects.exit(types2.setextHeadingLine);
      return ok2(code);
    }
    return nok(code);
  }
}
// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/initialize/flow.js
var flow = { tokenize: initializeFlow };
function initializeFlow(effects) {
  const self2 = this;
  const initial = effects.attempt(blankLine, atBlankEnding, effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content2, afterConstruct)), types2.linePrefix)));
  return initial;
  function atBlankEnding(code) {
    ok(code === codes.eof || markdownLineEnding(code), "expected eol or eof");
    if (code === codes.eof) {
      effects.consume(code);
      return;
    }
    effects.enter(types2.lineEndingBlank);
    effects.consume(code);
    effects.exit(types2.lineEndingBlank);
    self2.currentConstruct = undefined;
    return initial;
  }
  function afterConstruct(code) {
    ok(code === codes.eof || markdownLineEnding(code), "expected eol or eof");
    if (code === codes.eof) {
      effects.consume(code);
      return;
    }
    effects.enter(types2.lineEnding);
    effects.consume(code);
    effects.exit(types2.lineEnding);
    self2.currentConstruct = undefined;
    return initial;
  }
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/initialize/text.js
var resolver = { resolveAll: createResolver() };
var string = initializeFactory("string");
var text2 = initializeFactory("text");
function initializeFactory(field) {
  return {
    resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : undefined),
    tokenize: initializeText
  };
  function initializeText(effects) {
    const self2 = this;
    const constructs2 = this.parser.constructs[field];
    const text3 = effects.attempt(constructs2, start2, notText);
    return start2;
    function start2(code) {
      return atBreak(code) ? text3(code) : notText(code);
    }
    function notText(code) {
      if (code === codes.eof) {
        effects.consume(code);
        return;
      }
      effects.enter(types2.data);
      effects.consume(code);
      return data;
    }
    function data(code) {
      if (atBreak(code)) {
        effects.exit(types2.data);
        return text3(code);
      }
      effects.consume(code);
      return data;
    }
    function atBreak(code) {
      if (code === codes.eof) {
        return true;
      }
      const list2 = constructs2[code];
      let index2 = -1;
      if (list2) {
        ok(Array.isArray(list2), "expected `disable.null` to be populated");
        while (++index2 < list2.length) {
          const item = list2[index2];
          if (!item.previous || item.previous.call(self2, self2.previous)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
function createResolver(extraResolver) {
  return resolveAllText;
  function resolveAllText(events, context) {
    let index2 = -1;
    let enter;
    while (++index2 <= events.length) {
      if (enter === undefined) {
        if (events[index2] && events[index2][1].type === types2.data) {
          enter = index2;
          index2++;
        }
      } else if (!events[index2] || events[index2][1].type !== types2.data) {
        if (index2 !== enter + 2) {
          events[enter][1].end = events[index2 - 1][1].end;
          events.splice(enter + 2, index2 - enter - 2);
          index2 = enter + 2;
        }
        enter = undefined;
      }
    }
    return extraResolver ? extraResolver(events, context) : events;
  }
}
function resolveAllLineSuffixes(events, context) {
  let eventIndex = 0;
  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === types2.lineEnding) && events[eventIndex - 1][1].type === types2.data) {
      const data = events[eventIndex - 1][1];
      const chunks = context.sliceStream(data);
      let index2 = chunks.length;
      let bufferIndex = -1;
      let size = 0;
      let tabs;
      while (index2--) {
        const chunk = chunks[index2];
        if (typeof chunk === "string") {
          bufferIndex = chunk.length;
          while (chunk.charCodeAt(bufferIndex - 1) === codes.space) {
            size++;
            bufferIndex--;
          }
          if (bufferIndex)
            break;
          bufferIndex = -1;
        } else if (chunk === codes.horizontalTab) {
          tabs = true;
          size++;
        } else if (chunk === codes.virtualSpace) {} else {
          index2++;
          break;
        }
      }
      if (context._contentTypeTextTrailing && eventIndex === events.length) {
        size = 0;
      }
      if (size) {
        const token = {
          type: eventIndex === events.length || tabs || size < constants.hardBreakPrefixSizeMin ? types2.lineSuffix : types2.hardBreakTrailing,
          start: {
            _bufferIndex: index2 ? bufferIndex : data.start._bufferIndex + bufferIndex,
            _index: data.start._index + index2,
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size
          },
          end: { ...data.end }
        };
        data.end = { ...token.start };
        if (data.start.offset === data.end.offset) {
          Object.assign(data, token);
        } else {
          events.splice(eventIndex, 0, ["enter", token, context], ["exit", token, context]);
          eventIndex += 2;
        }
      }
      eventIndex++;
    }
  }
  return events;
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/constructs.js
var exports_constructs = {};
__export(exports_constructs, {
  text: () => text3,
  string: () => string2,
  insideSpan: () => insideSpan,
  flowInitial: () => flowInitial,
  flow: () => flow2,
  document: () => document3,
  disable: () => disable,
  contentInitial: () => contentInitial,
  attentionMarkers: () => attentionMarkers
});
var document3 = {
  [codes.asterisk]: list,
  [codes.plusSign]: list,
  [codes.dash]: list,
  [codes.digit0]: list,
  [codes.digit1]: list,
  [codes.digit2]: list,
  [codes.digit3]: list,
  [codes.digit4]: list,
  [codes.digit5]: list,
  [codes.digit6]: list,
  [codes.digit7]: list,
  [codes.digit8]: list,
  [codes.digit9]: list,
  [codes.greaterThan]: blockQuote
};
var contentInitial = {
  [codes.leftSquareBracket]: definition
};
var flowInitial = {
  [codes.horizontalTab]: codeIndented,
  [codes.virtualSpace]: codeIndented,
  [codes.space]: codeIndented
};
var flow2 = {
  [codes.numberSign]: headingAtx,
  [codes.asterisk]: thematicBreak,
  [codes.dash]: [setextUnderline, thematicBreak],
  [codes.lessThan]: htmlFlow,
  [codes.equalsTo]: setextUnderline,
  [codes.underscore]: thematicBreak,
  [codes.graveAccent]: codeFenced,
  [codes.tilde]: codeFenced
};
var string2 = {
  [codes.ampersand]: characterReference,
  [codes.backslash]: characterEscape
};
var text3 = {
  [codes.carriageReturn]: lineEnding,
  [codes.lineFeed]: lineEnding,
  [codes.carriageReturnLineFeed]: lineEnding,
  [codes.exclamationMark]: labelStartImage,
  [codes.ampersand]: characterReference,
  [codes.asterisk]: attention,
  [codes.lessThan]: [autolink, htmlText],
  [codes.leftSquareBracket]: labelStartLink,
  [codes.backslash]: [hardBreakEscape, characterEscape],
  [codes.rightSquareBracket]: labelEnd,
  [codes.underscore]: attention,
  [codes.graveAccent]: codeText
};
var insideSpan = { null: [attention, resolver] };
var attentionMarkers = { null: [codes.asterisk, codes.underscore] };
var disable = { null: [] };

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/create-tokenizer.js
var import_debug = __toESM(require_browser(), 1);
var debug = import_debug.default("micromark");
function createTokenizer(parser, initialize, from) {
  let point3 = {
    _bufferIndex: -1,
    _index: 0,
    line: from && from.line || 1,
    column: from && from.column || 1,
    offset: from && from.offset || 0
  };
  const columnStart = {};
  const resolveAllConstructs = [];
  let chunks = [];
  let stack = [];
  let consumed = true;
  const effects = {
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    consume,
    enter,
    exit: exit2,
    interrupt: constructFactory(onsuccessfulcheck, { interrupt: true })
  };
  const context = {
    code: codes.eof,
    containerState: {},
    defineSkip,
    events: [],
    now,
    parser,
    previous: codes.eof,
    sliceSerialize,
    sliceStream,
    write
  };
  let state = initialize.tokenize.call(context, effects);
  let expectedCode;
  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  }
  return context;
  function write(slice) {
    chunks = push(chunks, slice);
    main();
    if (chunks[chunks.length - 1] !== codes.eof) {
      return [];
    }
    addResult(initialize, 0);
    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  }
  function sliceSerialize(token, expandTabs) {
    return serializeChunks(sliceStream(token), expandTabs);
  }
  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }
  function now() {
    const { _bufferIndex, _index, line, column, offset } = point3;
    return { _bufferIndex, _index, line, column, offset };
  }
  function defineSkip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
    debug("position: define skip: `%j`", point3);
  }
  function main() {
    let chunkIndex;
    while (point3._index < chunks.length) {
      const chunk = chunks[point3._index];
      if (typeof chunk === "string") {
        chunkIndex = point3._index;
        if (point3._bufferIndex < 0) {
          point3._bufferIndex = 0;
        }
        while (point3._index === chunkIndex && point3._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point3._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  }
  function go(code) {
    ok(consumed === true, "expected character to be consumed");
    consumed = undefined;
    debug("main: passing `%s` to %s", code, state && state.name);
    expectedCode = code;
    ok(typeof state === "function", "expected state");
    state = state(code);
  }
  function consume(code) {
    ok(code === expectedCode, "expected given code to equal expected code");
    debug("consume: `%s`", code);
    ok(consumed === undefined, "expected code to not have been consumed: this might be because `return x(code)` instead of `return x` was used");
    ok(code === null ? context.events.length === 0 || context.events[context.events.length - 1][0] === "exit" : context.events[context.events.length - 1][0] === "enter", "expected last token to be open");
    if (markdownLineEnding(code)) {
      point3.line++;
      point3.column = 1;
      point3.offset += code === codes.carriageReturnLineFeed ? 2 : 1;
      accountForPotentialSkip();
      debug("position: after eol: `%j`", point3);
    } else if (code !== codes.virtualSpace) {
      point3.column++;
      point3.offset++;
    }
    if (point3._bufferIndex < 0) {
      point3._index++;
    } else {
      point3._bufferIndex++;
      if (point3._bufferIndex === chunks[point3._index].length) {
        point3._bufferIndex = -1;
        point3._index++;
      }
    }
    context.previous = code;
    consumed = true;
  }
  function enter(type, fields) {
    const token = fields || {};
    token.type = type;
    token.start = now();
    ok(typeof type === "string", "expected string type");
    ok(type.length > 0, "expected non-empty string");
    debug("enter: `%s`", type);
    context.events.push(["enter", token, context]);
    stack.push(token);
    return token;
  }
  function exit2(type) {
    ok(typeof type === "string", "expected string type");
    ok(type.length > 0, "expected non-empty string");
    const token = stack.pop();
    ok(token, "cannot close w/o open tokens");
    token.end = now();
    ok(type === token.type, "expected exit token to match current token");
    ok(!(token.start._index === token.end._index && token.start._bufferIndex === token.end._bufferIndex), "expected non-empty token (`" + type + "`)");
    debug("exit: `%s`", token.type);
    context.events.push(["exit", token, context]);
    return token;
  }
  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  }
  function onsuccessfulcheck(_, info) {
    info.restore();
  }
  function constructFactory(onreturn, fields) {
    return hook;
    function hook(constructs2, returnState, bogusState) {
      let listOfConstructs;
      let constructIndex;
      let currentConstruct;
      let info;
      return Array.isArray(constructs2) ? handleListOfConstructs(constructs2) : ("tokenize" in constructs2) ? handleListOfConstructs([constructs2]) : handleMapOfConstructs(constructs2);
      function handleMapOfConstructs(map) {
        return start2;
        function start2(code) {
          const left = code !== null && map[code];
          const all2 = code !== null && map.null;
          const list2 = [
            ...Array.isArray(left) ? left : left ? [left] : [],
            ...Array.isArray(all2) ? all2 : all2 ? [all2] : []
          ];
          return handleListOfConstructs(list2)(code);
        }
      }
      function handleListOfConstructs(list2) {
        listOfConstructs = list2;
        constructIndex = 0;
        if (list2.length === 0) {
          ok(bogusState, "expected `bogusState` to be given");
          return bogusState;
        }
        return handleConstruct(list2[constructIndex]);
      }
      function handleConstruct(construct) {
        return start2;
        function start2(code) {
          info = store2();
          currentConstruct = construct;
          if (!construct.partial) {
            context.currentConstruct = construct;
          }
          ok(context.parser.constructs.disable.null, "expected `disable.null` to be populated");
          if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) {
            return nok(code);
          }
          return construct.tokenize.call(fields ? Object.assign(Object.create(context), fields) : context, effects, ok2, nok)(code);
        }
      }
      function ok2(code) {
        ok(code === expectedCode, "expected code");
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }
      function nok(code) {
        ok(code === expectedCode, "expected code");
        consumed = true;
        info.restore();
        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }
        return bogusState;
      }
    }
  }
  function addResult(construct, from2) {
    if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
      resolveAllConstructs.push(construct);
    }
    if (construct.resolve) {
      splice(context.events, from2, context.events.length - from2, construct.resolve(context.events.slice(from2), context));
    }
    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
    ok(construct.partial || context.events.length === 0 || context.events[context.events.length - 1][0] === "exit", "expected last token to end");
  }
  function store2() {
    const startPoint = now();
    const startPrevious = context.previous;
    const startCurrentConstruct = context.currentConstruct;
    const startEventsIndex = context.events.length;
    const startStack = Array.from(stack);
    return { from: startEventsIndex, restore };
    function restore() {
      point3 = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
      debug("position: restore: `%j`", point3);
    }
  }
  function accountForPotentialSkip() {
    if (point3.line in columnStart && point3.column < 2) {
      point3.column = columnStart[point3.line];
      point3.offset += columnStart[point3.line] - 1;
    }
  }
}
function sliceChunks(chunks, token) {
  const startIndex = token.start._index;
  const startBufferIndex = token.start._bufferIndex;
  const endIndex = token.end._index;
  const endBufferIndex = token.end._bufferIndex;
  let view;
  if (startIndex === endIndex) {
    ok(endBufferIndex > -1, "expected non-negative end buffer index");
    ok(startBufferIndex > -1, "expected non-negative start buffer index");
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);
    if (startBufferIndex > -1) {
      const head = view[0];
      if (typeof head === "string") {
        view[0] = head.slice(startBufferIndex);
      } else {
        ok(startBufferIndex === 0, "expected `startBufferIndex` to be `0`");
        view.shift();
      }
    }
    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }
  return view;
}
function serializeChunks(chunks, expandTabs) {
  let index2 = -1;
  const result = [];
  let atTab;
  while (++index2 < chunks.length) {
    const chunk = chunks[index2];
    let value;
    if (typeof chunk === "string") {
      value = chunk;
    } else
      switch (chunk) {
        case codes.carriageReturn: {
          value = values.cr;
          break;
        }
        case codes.lineFeed: {
          value = values.lf;
          break;
        }
        case codes.carriageReturnLineFeed: {
          value = values.cr + values.lf;
          break;
        }
        case codes.horizontalTab: {
          value = expandTabs ? values.space : values.ht;
          break;
        }
        case codes.virtualSpace: {
          if (!expandTabs && atTab)
            continue;
          value = values.space;
          break;
        }
        default: {
          ok(typeof chunk === "number", "expected number");
          value = String.fromCharCode(chunk);
        }
      }
    atTab = chunk === codes.horizontalTab;
    result.push(value);
  }
  return result.join("");
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/parse.js
function parse(options) {
  const settings = options || {};
  const constructs2 = combineExtensions([exports_constructs, ...settings.extensions || []]);
  const parser = {
    constructs: constructs2,
    content: create2(content),
    defined: [],
    document: create2(document2),
    flow: create2(flow),
    lazy: {},
    string: create2(string),
    text: create2(text2)
  };
  return parser;
  function create2(initial) {
    return creator;
    function creator(from) {
      return createTokenizer(parser, initial, from);
    }
  }
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/postprocess.js
function postprocess(events) {
  while (!subtokenize(events)) {}
  return events;
}

// ../../../../node_modules/.bun/micromark@4.0.2/node_modules/micromark/dev/lib/preprocess.js
var search = /[\0\t\n\r]/g;
function preprocess() {
  let column = 1;
  let buffer = "";
  let start2 = true;
  let atCarriageReturn;
  return preprocessor;
  function preprocessor(value, encoding, end) {
    const chunks = [];
    let match;
    let next;
    let startPosition;
    let endPosition;
    let code;
    value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || undefined).decode(value));
    startPosition = 0;
    buffer = "";
    if (start2) {
      if (value.charCodeAt(0) === codes.byteOrderMarker) {
        startPosition++;
      }
      start2 = undefined;
    }
    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      match = search.exec(value);
      endPosition = match && match.index !== undefined ? match.index : value.length;
      code = value.charCodeAt(endPosition);
      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }
      if (code === codes.lf && startPosition === endPosition && atCarriageReturn) {
        chunks.push(codes.carriageReturnLineFeed);
        atCarriageReturn = undefined;
      } else {
        if (atCarriageReturn) {
          chunks.push(codes.carriageReturn);
          atCarriageReturn = undefined;
        }
        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }
        switch (code) {
          case codes.nul: {
            chunks.push(codes.replacementCharacter);
            column++;
            break;
          }
          case codes.ht: {
            next = Math.ceil(column / constants.tabSize) * constants.tabSize;
            chunks.push(codes.horizontalTab);
            while (column++ < next)
              chunks.push(codes.virtualSpace);
            break;
          }
          case codes.lf: {
            chunks.push(codes.lineFeed);
            column = 1;
            break;
          }
          default: {
            atCarriageReturn = true;
            column = 1;
          }
        }
      }
      startPosition = endPosition + 1;
    }
    if (end) {
      if (atCarriageReturn)
        chunks.push(codes.carriageReturn);
      if (buffer)
        chunks.push(buffer);
      chunks.push(codes.eof);
    }
    return chunks;
  }
}
// ../../../../node_modules/.bun/micromark-util-decode-string@2.0.1/node_modules/micromark-util-decode-string/dev/index.js
var characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function decodeString(value) {
  return value.replace(characterEscapeOrReference, decode);
}
function decode($0, $1, $2) {
  if ($1) {
    return $1;
  }
  const head = $2.charCodeAt(0);
  if (head === codes.numberSign) {
    const head2 = $2.charCodeAt(1);
    const hex = head2 === codes.lowercaseX || head2 === codes.uppercaseX;
    return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? constants.numericBaseHexadecimal : constants.numericBaseDecimal);
  }
  return decodeNamedCharacterReference($2) || $0;
}

// ../../../../node_modules/.bun/mdast-util-from-markdown@2.0.2/node_modules/mdast-util-from-markdown/dev/lib/index.js
var own2 = {}.hasOwnProperty;
function fromMarkdown(value, encoding, options) {
  if (typeof encoding !== "string") {
    options = encoding;
    encoding = undefined;
  }
  return compiler(options)(postprocess(parse(options).document().write(preprocess()(value, encoding, true))));
}
function compiler(options) {
  const config = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: opener(link),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading),
      blockQuote: opener(blockQuote2),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText2, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition2),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis),
      hardBreakEscape: opener(hardBreak),
      hardBreakTrailing: opener(hardBreak),
      htmlFlow: opener(html3, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html3, buffer),
      htmlTextData: onenterdata,
      image: opener(image),
      label: buffer,
      link: opener(link),
      listItem: opener(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list2, onenterlistordered),
      listUnordered: opener(list2),
      paragraph: opener(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading),
      strong: opener(strong),
      thematicBreak: opener(thematicBreak2)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      characterReference: onexitcharacterreference,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  };
  configure(config, (options || {}).mdastExtensions || []);
  const data = {};
  return compile;
  function compile(events) {
    let tree = { type: "root", children: [] };
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit: exit2,
      buffer,
      resume,
      data
    };
    const listStack = [];
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === types2.listOrdered || events[index2][1].type === types2.listUnordered) {
        if (events[index2][0] === "enter") {
          listStack.push(index2);
        } else {
          const tail = listStack.pop();
          ok(typeof tail === "number", "expected list ot be open");
          index2 = prepareList(events, tail, index2);
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      const handler = config[events[index2][0]];
      if (own2.call(handler, events[index2][1].type)) {
        handler[events[index2][1].type].call(Object.assign({ sliceSerialize: events[index2][2].sliceSerialize }, context), events[index2][1]);
      }
    }
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1];
      const handler = tail[1] || defaultOnError;
      handler.call(context, undefined, tail[0]);
    }
    tree.position = {
      start: point3(events.length > 0 ? events[0][1].start : { line: 1, column: 1, offset: 0 }),
      end: point3(events.length > 0 ? events[events.length - 2][1].end : { line: 1, column: 1, offset: 0 })
    };
    index2 = -1;
    while (++index2 < config.transforms.length) {
      tree = config.transforms[index2](tree) || tree;
    }
    return tree;
  }
  function prepareList(events, start2, length) {
    let index2 = start2 - 1;
    let containerBalance = -1;
    let listSpread = false;
    let listItem2;
    let lineIndex;
    let firstBlankLineIndex;
    let atMarker;
    while (++index2 <= length) {
      const event = events[index2];
      switch (event[1].type) {
        case types2.listUnordered:
        case types2.listOrdered:
        case types2.blockQuote: {
          if (event[0] === "enter") {
            containerBalance++;
          } else {
            containerBalance--;
          }
          atMarker = undefined;
          break;
        }
        case types2.lineEndingBlank: {
          if (event[0] === "enter") {
            if (listItem2 && !atMarker && !containerBalance && !firstBlankLineIndex) {
              firstBlankLineIndex = index2;
            }
            atMarker = undefined;
          }
          break;
        }
        case types2.linePrefix:
        case types2.listItemValue:
        case types2.listItemMarker:
        case types2.listItemPrefix:
        case types2.listItemPrefixWhitespace: {
          break;
        }
        default: {
          atMarker = undefined;
        }
      }
      if (!containerBalance && event[0] === "enter" && event[1].type === types2.listItemPrefix || containerBalance === -1 && event[0] === "exit" && (event[1].type === types2.listUnordered || event[1].type === types2.listOrdered)) {
        if (listItem2) {
          let tailIndex = index2;
          lineIndex = undefined;
          while (tailIndex--) {
            const tailEvent = events[tailIndex];
            if (tailEvent[1].type === types2.lineEnding || tailEvent[1].type === types2.lineEndingBlank) {
              if (tailEvent[0] === "exit")
                continue;
              if (lineIndex) {
                events[lineIndex][1].type = types2.lineEndingBlank;
                listSpread = true;
              }
              tailEvent[1].type = types2.lineEnding;
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === types2.linePrefix || tailEvent[1].type === types2.blockQuotePrefix || tailEvent[1].type === types2.blockQuotePrefixWhitespace || tailEvent[1].type === types2.blockQuoteMarker || tailEvent[1].type === types2.listItemIndent) {} else {
              break;
            }
          }
          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem2._spread = true;
          }
          listItem2.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
          events.splice(lineIndex || index2, 0, ["exit", listItem2, event[2]]);
          index2++;
          length++;
        }
        if (event[1].type === types2.listItemPrefix) {
          const item = {
            type: "listItem",
            _spread: false,
            start: Object.assign({}, event[1].start),
            end: undefined
          };
          listItem2 = item;
          events.splice(index2, 0, ["enter", item, event[2]]);
          index2++;
          length++;
          firstBlankLineIndex = undefined;
          atMarker = true;
        }
      }
    }
    events[start2][1]._spread = listSpread;
    return length;
  }
  function opener(create2, and) {
    return open;
    function open(token) {
      enter.call(this, create2(token), token);
      if (and)
        and.call(this, token);
    }
  }
  function buffer() {
    this.stack.push({ type: "fragment", children: [] });
  }
  function enter(node2, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1];
    ok(parent, "expected `parent`");
    ok("children" in parent, "expected `parent`");
    const siblings = parent.children;
    siblings.push(node2);
    this.stack.push(node2);
    this.tokenStack.push([token, errorHandler || undefined]);
    node2.position = {
      start: point3(token.start),
      end: undefined
    };
  }
  function closer(and) {
    return close;
    function close(token) {
      if (and)
        and.call(this, token);
      exit2.call(this, token);
    }
  }
  function exit2(token, onExitError) {
    const node2 = this.stack.pop();
    ok(node2, "expected `node`");
    const open = this.tokenStack.pop();
    if (!open) {
      throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({ start: token.start, end: token.end }) + "): it’s not open");
    } else if (open[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open[0]);
      } else {
        const handler = open[1] || defaultOnError;
        handler.call(this, token, open[0]);
      }
    }
    ok(node2.type !== "fragment", "unexpected fragment `exit`ed");
    ok(node2.position, "expected `position` to be defined");
    node2.position.end = point3(token.end);
  }
  function resume() {
    return toString(this.stack.pop());
  }
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true;
  }
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2];
      ok(ancestor, "expected nodes on stack");
      ok(ancestor.type === "list", "expected list on stack");
      ancestor.start = Number.parseInt(this.sliceSerialize(token), constants.numericBaseDecimal);
      this.data.expectingFirstListItemValue = undefined;
    }
  }
  function onexitcodefencedfenceinfo() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "code", "expected code on stack");
    node2.lang = data2;
  }
  function onexitcodefencedfencemeta() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "code", "expected code on stack");
    node2.meta = data2;
  }
  function onexitcodefencedfence() {
    if (this.data.flowCodeInside)
      return;
    this.buffer();
    this.data.flowCodeInside = true;
  }
  function onexitcodefenced() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "code", "expected code on stack");
    node2.value = data2.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    this.data.flowCodeInside = undefined;
  }
  function onexitcodeindented() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "code", "expected code on stack");
    node2.value = data2.replace(/(\r?\n|\r)$/g, "");
  }
  function onexitdefinitionlabelstring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "definition", "expected definition on stack");
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }
  function onexitdefinitiontitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "definition", "expected definition on stack");
    node2.title = data2;
  }
  function onexitdefinitiondestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "definition", "expected definition on stack");
    node2.url = data2;
  }
  function onexitatxheadingsequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "heading", "expected heading on stack");
    if (!node2.depth) {
      const depth = this.sliceSerialize(token).length;
      ok(depth === 1 || depth === 2 || depth === 3 || depth === 4 || depth === 5 || depth === 6, "expected `depth` between `1` and `6`");
      node2.depth = depth;
    }
  }
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true;
  }
  function onexitsetextheadinglinesequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "heading", "expected heading on stack");
    node2.depth = this.sliceSerialize(token).codePointAt(0) === codes.equalsTo ? 1 : 2;
  }
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = undefined;
  }
  function onenterdata(token) {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok("children" in node2, "expected parent on stack");
    const siblings = node2.children;
    let tail = siblings[siblings.length - 1];
    if (!tail || tail.type !== "text") {
      tail = text4();
      tail.position = {
        start: point3(token.start),
        end: undefined
      };
      siblings.push(tail);
    }
    this.stack.push(tail);
  }
  function onexitdata(token) {
    const tail = this.stack.pop();
    ok(tail, "expected a `node` to be on the stack");
    ok("value" in tail, "expected a `literal` to be on the stack");
    ok(tail.position, "expected `node` to have an open position");
    tail.value += this.sliceSerialize(token);
    tail.position.end = point3(token.end);
  }
  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1];
    ok(context, "expected `node`");
    if (this.data.atHardBreak) {
      ok("children" in context, "expected `parent`");
      const tail = context.children[context.children.length - 1];
      ok(tail.position, "expected tail to have a starting position");
      tail.position.end = point3(token.end);
      this.data.atHardBreak = undefined;
      return;
    }
    if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }
  function onexithardbreak() {
    this.data.atHardBreak = true;
  }
  function onexithtmlflow() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "html", "expected html on stack");
    node2.value = data2;
  }
  function onexithtmltext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "html", "expected html on stack");
    node2.value = data2;
  }
  function onexitcodetext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "inlineCode", "expected inline code on stack");
    node2.value = data2;
  }
  function onexitlink() {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "link", "expected link on stack");
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = undefined;
  }
  function onexitimage() {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "image", "expected image on stack");
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = undefined;
  }
  function onexitlabeltext(token) {
    const string3 = this.sliceSerialize(token);
    const ancestor = this.stack[this.stack.length - 2];
    ok(ancestor, "expected ancestor on stack");
    ok(ancestor.type === "image" || ancestor.type === "link", "expected image or link on stack");
    ancestor.label = decodeString(string3);
    ancestor.identifier = normalizeIdentifier(string3).toLowerCase();
  }
  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1];
    ok(fragment, "expected node on stack");
    ok(fragment.type === "fragment", "expected fragment on stack");
    const value = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "image" || node2.type === "link", "expected image or link on stack");
    this.data.inReference = true;
    if (node2.type === "link") {
      const children = fragment.children;
      node2.children = children;
    } else {
      node2.alt = value;
    }
  }
  function onexitresourcedestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "image" || node2.type === "link", "expected image or link on stack");
    node2.url = data2;
  }
  function onexitresourcetitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "image" || node2.type === "link", "expected image or link on stack");
    node2.title = data2;
  }
  function onexitresource() {
    this.data.inReference = undefined;
  }
  function onenterreference() {
    this.data.referenceType = "collapsed";
  }
  function onexitreferencestring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "image" || node2.type === "link", "expected image reference or link reference on stack");
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    this.data.referenceType = "full";
  }
  function onexitcharacterreferencemarker(token) {
    ok(token.type === "characterReferenceMarkerNumeric" || token.type === "characterReferenceMarkerHexadecimal");
    this.data.characterReferenceType = token.type;
  }
  function onexitcharacterreferencevalue(token) {
    const data2 = this.sliceSerialize(token);
    const type = this.data.characterReferenceType;
    let value;
    if (type) {
      value = decodeNumericCharacterReference(data2, type === types2.characterReferenceMarkerNumeric ? constants.numericBaseDecimal : constants.numericBaseHexadecimal);
      this.data.characterReferenceType = undefined;
    } else {
      const result = decodeNamedCharacterReference(data2);
      ok(result !== false, "expected reference to decode");
      value = result;
    }
    const tail = this.stack[this.stack.length - 1];
    ok(tail, "expected `node`");
    ok("value" in tail, "expected `node.value`");
    tail.value += value;
  }
  function onexitcharacterreference(token) {
    const tail = this.stack.pop();
    ok(tail, "expected `node`");
    ok(tail.position, "expected `node.position`");
    tail.position.end = point3(token.end);
  }
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "link", "expected link on stack");
    node2.url = this.sliceSerialize(token);
  }
  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    ok(node2, "expected node on stack");
    ok(node2.type === "link", "expected link on stack");
    node2.url = "mailto:" + this.sliceSerialize(token);
  }
  function blockQuote2() {
    return { type: "blockquote", children: [] };
  }
  function codeFlow() {
    return { type: "code", lang: null, meta: null, value: "" };
  }
  function codeText2() {
    return { type: "inlineCode", value: "" };
  }
  function definition2() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function emphasis() {
    return { type: "emphasis", children: [] };
  }
  function heading() {
    return {
      type: "heading",
      depth: 0,
      children: []
    };
  }
  function hardBreak() {
    return { type: "break" };
  }
  function html3() {
    return { type: "html", value: "" };
  }
  function image() {
    return { type: "image", title: null, url: "", alt: null };
  }
  function link() {
    return { type: "link", title: null, url: "", children: [] };
  }
  function list2(token) {
    return {
      type: "list",
      ordered: token.type === "listOrdered",
      start: null,
      spread: token._spread,
      children: []
    };
  }
  function listItem(token) {
    return {
      type: "listItem",
      spread: token._spread,
      checked: null,
      children: []
    };
  }
  function paragraph() {
    return { type: "paragraph", children: [] };
  }
  function strong() {
    return { type: "strong", children: [] };
  }
  function text4() {
    return { type: "text", value: "" };
  }
  function thematicBreak2() {
    return { type: "thematicBreak" };
  }
}
function point3(d) {
  return { line: d.line, column: d.column, offset: d.offset };
}
function configure(combined, extensions) {
  let index2 = -1;
  while (++index2 < extensions.length) {
    const value = extensions[index2];
    if (Array.isArray(value)) {
      configure(combined, value);
    } else {
      extension(combined, value);
    }
  }
}
function extension(combined, extension2) {
  let key;
  for (key in extension2) {
    if (own2.call(extension2, key)) {
      switch (key) {
        case "canContainEols": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "transforms": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "enter":
        case "exit": {
          const right = extension2[key];
          if (right) {
            Object.assign(combined[key], right);
          }
          break;
        }
      }
    }
  }
}
function defaultOnError(left, right) {
  if (left) {
    throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({ start: left.start, end: left.end }) + "): a different token (`" + right.type + "`, " + stringifyPosition({ start: right.start, end: right.end }) + ") is open");
  } else {
    throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({ start: right.start, end: right.end }) + ") is still open");
  }
}
// ../../../../node_modules/.bun/remark-parse@11.0.0/node_modules/remark-parse/lib/index.js
function remarkParse(options) {
  const self2 = this;
  self2.parser = parser;
  function parser(doc) {
    return fromMarkdown(doc, {
      ...self2.data("settings"),
      ...options,
      extensions: self2.data("micromarkExtensions") || [],
      mdastExtensions: self2.data("fromMarkdownExtensions") || []
    });
  }
}
// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/blockquote.js
function blockquote(state, node2) {
  const result = {
    type: "element",
    tagName: "blockquote",
    properties: {},
    children: state.wrap(state.all(node2), true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/break.js
function hardBreak(state, node2) {
  const result = { type: "element", tagName: "br", properties: {}, children: [] };
  state.patch(node2, result);
  return [state.applyData(node2, result), { type: "text", value: `
` }];
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/code.js
function code(state, node2) {
  const value = node2.value ? node2.value + `
` : "";
  const properties = {};
  const language = node2.lang ? node2.lang.split(/\s+/) : [];
  if (language.length > 0) {
    properties.className = ["language-" + language[0]];
  }
  let result = {
    type: "element",
    tagName: "code",
    properties,
    children: [{ type: "text", value }]
  };
  if (node2.meta) {
    result.data = { meta: node2.meta };
  }
  state.patch(node2, result);
  result = state.applyData(node2, result);
  result = { type: "element", tagName: "pre", properties: {}, children: [result] };
  state.patch(node2, result);
  return result;
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/delete.js
function strikethrough(state, node2) {
  const result = {
    type: "element",
    tagName: "del",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/emphasis.js
function emphasis(state, node2) {
  const result = {
    type: "element",
    tagName: "em",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/footnote-reference.js
function footnoteReference(state, node2) {
  const clobberPrefix = typeof state.options.clobberPrefix === "string" ? state.options.clobberPrefix : "user-content-";
  const id = String(node2.identifier).toUpperCase();
  const safeId = normalizeUri(id.toLowerCase());
  const index2 = state.footnoteOrder.indexOf(id);
  let counter;
  let reuseCounter = state.footnoteCounts.get(id);
  if (reuseCounter === undefined) {
    reuseCounter = 0;
    state.footnoteOrder.push(id);
    counter = state.footnoteOrder.length;
  } else {
    counter = index2 + 1;
  }
  reuseCounter += 1;
  state.footnoteCounts.set(id, reuseCounter);
  const link = {
    type: "element",
    tagName: "a",
    properties: {
      href: "#" + clobberPrefix + "fn-" + safeId,
      id: clobberPrefix + "fnref-" + safeId + (reuseCounter > 1 ? "-" + reuseCounter : ""),
      dataFootnoteRef: true,
      ariaDescribedBy: ["footnote-label"]
    },
    children: [{ type: "text", value: String(counter) }]
  };
  state.patch(node2, link);
  const sup = {
    type: "element",
    tagName: "sup",
    properties: {},
    children: [link]
  };
  state.patch(node2, sup);
  return state.applyData(node2, sup);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/heading.js
function heading(state, node2) {
  const result = {
    type: "element",
    tagName: "h" + node2.depth,
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/html.js
function html3(state, node2) {
  if (state.options.allowDangerousHtml) {
    const result = { type: "raw", value: node2.value };
    state.patch(node2, result);
    return state.applyData(node2, result);
  }
  return;
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/revert.js
function revert(state, node2) {
  const subtype = node2.referenceType;
  let suffix = "]";
  if (subtype === "collapsed") {
    suffix += "[]";
  } else if (subtype === "full") {
    suffix += "[" + (node2.label || node2.identifier) + "]";
  }
  if (node2.type === "imageReference") {
    return [{ type: "text", value: "![" + node2.alt + suffix }];
  }
  const contents = state.all(node2);
  const head = contents[0];
  if (head && head.type === "text") {
    head.value = "[" + head.value;
  } else {
    contents.unshift({ type: "text", value: "[" });
  }
  const tail = contents[contents.length - 1];
  if (tail && tail.type === "text") {
    tail.value += suffix;
  } else {
    contents.push({ type: "text", value: suffix });
  }
  return contents;
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/image-reference.js
function imageReference(state, node2) {
  const id = String(node2.identifier).toUpperCase();
  const definition2 = state.definitionById.get(id);
  if (!definition2) {
    return revert(state, node2);
  }
  const properties = { src: normalizeUri(definition2.url || ""), alt: node2.alt };
  if (definition2.title !== null && definition2.title !== undefined) {
    properties.title = definition2.title;
  }
  const result = { type: "element", tagName: "img", properties, children: [] };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/image.js
function image(state, node2) {
  const properties = { src: normalizeUri(node2.url) };
  if (node2.alt !== null && node2.alt !== undefined) {
    properties.alt = node2.alt;
  }
  if (node2.title !== null && node2.title !== undefined) {
    properties.title = node2.title;
  }
  const result = { type: "element", tagName: "img", properties, children: [] };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/inline-code.js
function inlineCode(state, node2) {
  const text4 = { type: "text", value: node2.value.replace(/\r?\n|\r/g, " ") };
  state.patch(node2, text4);
  const result = {
    type: "element",
    tagName: "code",
    properties: {},
    children: [text4]
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/link-reference.js
function linkReference(state, node2) {
  const id = String(node2.identifier).toUpperCase();
  const definition2 = state.definitionById.get(id);
  if (!definition2) {
    return revert(state, node2);
  }
  const properties = { href: normalizeUri(definition2.url || "") };
  if (definition2.title !== null && definition2.title !== undefined) {
    properties.title = definition2.title;
  }
  const result = {
    type: "element",
    tagName: "a",
    properties,
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/link.js
function link(state, node2) {
  const properties = { href: normalizeUri(node2.url) };
  if (node2.title !== null && node2.title !== undefined) {
    properties.title = node2.title;
  }
  const result = {
    type: "element",
    tagName: "a",
    properties,
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/list-item.js
function listItem(state, node2, parent) {
  const results = state.all(node2);
  const loose = parent ? listLoose(parent) : listItemLoose(node2);
  const properties = {};
  const children = [];
  if (typeof node2.checked === "boolean") {
    const head = results[0];
    let paragraph;
    if (head && head.type === "element" && head.tagName === "p") {
      paragraph = head;
    } else {
      paragraph = { type: "element", tagName: "p", properties: {}, children: [] };
      results.unshift(paragraph);
    }
    if (paragraph.children.length > 0) {
      paragraph.children.unshift({ type: "text", value: " " });
    }
    paragraph.children.unshift({
      type: "element",
      tagName: "input",
      properties: { type: "checkbox", checked: node2.checked, disabled: true },
      children: []
    });
    properties.className = ["task-list-item"];
  }
  let index2 = -1;
  while (++index2 < results.length) {
    const child = results[index2];
    if (loose || index2 !== 0 || child.type !== "element" || child.tagName !== "p") {
      children.push({ type: "text", value: `
` });
    }
    if (child.type === "element" && child.tagName === "p" && !loose) {
      children.push(...child.children);
    } else {
      children.push(child);
    }
  }
  const tail = results[results.length - 1];
  if (tail && (loose || tail.type !== "element" || tail.tagName !== "p")) {
    children.push({ type: "text", value: `
` });
  }
  const result = { type: "element", tagName: "li", properties, children };
  state.patch(node2, result);
  return state.applyData(node2, result);
}
function listLoose(node2) {
  let loose = false;
  if (node2.type === "list") {
    loose = node2.spread || false;
    const children = node2.children;
    let index2 = -1;
    while (!loose && ++index2 < children.length) {
      loose = listItemLoose(children[index2]);
    }
  }
  return loose;
}
function listItemLoose(node2) {
  const spread = node2.spread;
  return spread === null || spread === undefined ? node2.children.length > 1 : spread;
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/list.js
function list2(state, node2) {
  const properties = {};
  const results = state.all(node2);
  let index2 = -1;
  if (typeof node2.start === "number" && node2.start !== 1) {
    properties.start = node2.start;
  }
  while (++index2 < results.length) {
    const child = results[index2];
    if (child.type === "element" && child.tagName === "li" && child.properties && Array.isArray(child.properties.className) && child.properties.className.includes("task-list-item")) {
      properties.className = ["contains-task-list"];
      break;
    }
  }
  const result = {
    type: "element",
    tagName: node2.ordered ? "ol" : "ul",
    properties,
    children: state.wrap(results, true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/paragraph.js
function paragraph(state, node2) {
  const result = {
    type: "element",
    tagName: "p",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/root.js
function root2(state, node2) {
  const result = { type: "root", children: state.wrap(state.all(node2)) };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/strong.js
function strong(state, node2) {
  const result = {
    type: "element",
    tagName: "strong",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table.js
function table(state, node2) {
  const rows = state.all(node2);
  const firstRow = rows.shift();
  const tableContent = [];
  if (firstRow) {
    const head = {
      type: "element",
      tagName: "thead",
      properties: {},
      children: state.wrap([firstRow], true)
    };
    state.patch(node2.children[0], head);
    tableContent.push(head);
  }
  if (rows.length > 0) {
    const body = {
      type: "element",
      tagName: "tbody",
      properties: {},
      children: state.wrap(rows, true)
    };
    const start2 = pointStart(node2.children[1]);
    const end = pointEnd(node2.children[node2.children.length - 1]);
    if (start2 && end)
      body.position = { start: start2, end };
    tableContent.push(body);
  }
  const result = {
    type: "element",
    tagName: "table",
    properties: {},
    children: state.wrap(tableContent, true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table-row.js
function tableRow(state, node2, parent) {
  const siblings = parent ? parent.children : undefined;
  const rowIndex = siblings ? siblings.indexOf(node2) : 1;
  const tagName = rowIndex === 0 ? "th" : "td";
  const align = parent && parent.type === "table" ? parent.align : undefined;
  const length = align ? align.length : node2.children.length;
  let cellIndex = -1;
  const cells = [];
  while (++cellIndex < length) {
    const cell = node2.children[cellIndex];
    const properties = {};
    const alignValue = align ? align[cellIndex] : undefined;
    if (alignValue) {
      properties.align = alignValue;
    }
    let result2 = { type: "element", tagName, properties, children: [] };
    if (cell) {
      result2.children = state.all(cell);
      state.patch(cell, result2);
      result2 = state.applyData(cell, result2);
    }
    cells.push(result2);
  }
  const result = {
    type: "element",
    tagName: "tr",
    properties: {},
    children: state.wrap(cells, true)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/table-cell.js
function tableCell(state, node2) {
  const result = {
    type: "element",
    tagName: "td",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/trim-lines@3.0.1/node_modules/trim-lines/index.js
var tab = 9;
var space = 32;
function trimLines(value) {
  const source = String(value);
  const search2 = /\r?\n|\r/g;
  let match = search2.exec(source);
  let last = 0;
  const lines = [];
  while (match) {
    lines.push(trimLine(source.slice(last, match.index), last > 0, true), match[0]);
    last = match.index + match[0].length;
    match = search2.exec(source);
  }
  lines.push(trimLine(source.slice(last), last > 0, false));
  return lines.join("");
}
function trimLine(value, start2, end) {
  let startIndex = 0;
  let endIndex = value.length;
  if (start2) {
    let code2 = value.codePointAt(startIndex);
    while (code2 === tab || code2 === space) {
      startIndex++;
      code2 = value.codePointAt(startIndex);
    }
  }
  if (end) {
    let code2 = value.codePointAt(endIndex - 1);
    while (code2 === tab || code2 === space) {
      endIndex--;
      code2 = value.codePointAt(endIndex - 1);
    }
  }
  return endIndex > startIndex ? value.slice(startIndex, endIndex) : "";
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/text.js
function text4(state, node2) {
  const result = { type: "text", value: trimLines(String(node2.value)) };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/thematic-break.js
function thematicBreak2(state, node2) {
  const result = {
    type: "element",
    tagName: "hr",
    properties: {},
    children: []
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/handlers/index.js
var handlers = {
  blockquote,
  break: hardBreak,
  code,
  delete: strikethrough,
  emphasis,
  footnoteReference,
  heading,
  html: html3,
  imageReference,
  image,
  inlineCode,
  linkReference,
  link,
  listItem,
  list: list2,
  paragraph,
  root: root2,
  strong,
  table,
  tableCell,
  tableRow,
  text: text4,
  thematicBreak: thematicBreak2,
  toml: ignore,
  yaml: ignore,
  definition: ignore,
  footnoteDefinition: ignore
};
function ignore() {
  return;
}

// ../../../../node_modules/.bun/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/types.js
var VOID = -1;
var PRIMITIVE = 0;
var ARRAY = 1;
var OBJECT = 2;
var DATE = 3;
var REGEXP = 4;
var MAP = 5;
var SET = 6;
var ERROR = 7;
var BIGINT = 8;

// ../../../../node_modules/.bun/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/deserialize.js
var env = typeof self === "object" ? self : globalThis;
var deserializer = ($, _) => {
  const as = (out, index2) => {
    $.set(index2, out);
    return out;
  };
  const unpair = (index2) => {
    if ($.has(index2))
      return $.get(index2);
    const [type, value] = _[index2];
    switch (type) {
      case PRIMITIVE:
      case VOID:
        return as(value, index2);
      case ARRAY: {
        const arr = as([], index2);
        for (const index3 of value)
          arr.push(unpair(index3));
        return arr;
      }
      case OBJECT: {
        const object = as({}, index2);
        for (const [key, index3] of value)
          object[unpair(key)] = unpair(index3);
        return object;
      }
      case DATE:
        return as(new Date(value), index2);
      case REGEXP: {
        const { source, flags } = value;
        return as(new RegExp(source, flags), index2);
      }
      case MAP: {
        const map = as(new Map, index2);
        for (const [key, index3] of value)
          map.set(unpair(key), unpair(index3));
        return map;
      }
      case SET: {
        const set = as(new Set, index2);
        for (const index3 of value)
          set.add(unpair(index3));
        return set;
      }
      case ERROR: {
        const { name: name2, message } = value;
        return as(new env[name2](message), index2);
      }
      case BIGINT:
        return as(BigInt(value), index2);
      case "BigInt":
        return as(Object(BigInt(value)), index2);
      case "ArrayBuffer":
        return as(new Uint8Array(value).buffer, value);
      case "DataView": {
        const { buffer } = new Uint8Array(value);
        return as(new DataView(buffer), value);
      }
    }
    return as(new env[type](value), index2);
  };
  return unpair;
};
var deserialize = (serialized) => deserializer(new Map, serialized)(0);

// ../../../../node_modules/.bun/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/serialize.js
var EMPTY = "";
var { toString: toString2 } = {};
var { keys } = Object;
var typeOf = (value) => {
  const type = typeof value;
  if (type !== "object" || !value)
    return [PRIMITIVE, type];
  const asString = toString2.call(value).slice(8, -1);
  switch (asString) {
    case "Array":
      return [ARRAY, EMPTY];
    case "Object":
      return [OBJECT, EMPTY];
    case "Date":
      return [DATE, EMPTY];
    case "RegExp":
      return [REGEXP, EMPTY];
    case "Map":
      return [MAP, EMPTY];
    case "Set":
      return [SET, EMPTY];
    case "DataView":
      return [ARRAY, asString];
  }
  if (asString.includes("Array"))
    return [ARRAY, asString];
  if (asString.includes("Error"))
    return [ERROR, asString];
  return [OBJECT, asString];
};
var shouldSkip = ([TYPE, type]) => TYPE === PRIMITIVE && (type === "function" || type === "symbol");
var serializer = (strict, json, $, _) => {
  const as = (out, value) => {
    const index2 = _.push(out) - 1;
    $.set(value, index2);
    return index2;
  };
  const pair = (value) => {
    if ($.has(value))
      return $.get(value);
    let [TYPE, type] = typeOf(value);
    switch (TYPE) {
      case PRIMITIVE: {
        let entry = value;
        switch (type) {
          case "bigint":
            TYPE = BIGINT;
            entry = value.toString();
            break;
          case "function":
          case "symbol":
            if (strict)
              throw new TypeError("unable to serialize " + type);
            entry = null;
            break;
          case "undefined":
            return as([VOID], value);
        }
        return as([TYPE, entry], value);
      }
      case ARRAY: {
        if (type) {
          let spread = value;
          if (type === "DataView") {
            spread = new Uint8Array(value.buffer);
          } else if (type === "ArrayBuffer") {
            spread = new Uint8Array(value);
          }
          return as([type, [...spread]], value);
        }
        const arr = [];
        const index2 = as([TYPE, arr], value);
        for (const entry of value)
          arr.push(pair(entry));
        return index2;
      }
      case OBJECT: {
        if (type) {
          switch (type) {
            case "BigInt":
              return as([type, value.toString()], value);
            case "Boolean":
            case "Number":
            case "String":
              return as([type, value.valueOf()], value);
          }
        }
        if (json && "toJSON" in value)
          return pair(value.toJSON());
        const entries = [];
        const index2 = as([TYPE, entries], value);
        for (const key of keys(value)) {
          if (strict || !shouldSkip(typeOf(value[key])))
            entries.push([pair(key), pair(value[key])]);
        }
        return index2;
      }
      case DATE:
        return as([TYPE, value.toISOString()], value);
      case REGEXP: {
        const { source, flags } = value;
        return as([TYPE, { source, flags }], value);
      }
      case MAP: {
        const entries = [];
        const index2 = as([TYPE, entries], value);
        for (const [key, entry] of value) {
          if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry))))
            entries.push([pair(key), pair(entry)]);
        }
        return index2;
      }
      case SET: {
        const entries = [];
        const index2 = as([TYPE, entries], value);
        for (const entry of value) {
          if (strict || !shouldSkip(typeOf(entry)))
            entries.push(pair(entry));
        }
        return index2;
      }
    }
    const { message } = value;
    return as([TYPE, { name: type, message }], value);
  };
  return pair;
};
var serialize = (value, { json, lossy } = {}) => {
  const _ = [];
  return serializer(!(json || lossy), !!json, new Map, _)(value), _;
};

// ../../../../node_modules/.bun/@ungap+structured-clone@1.3.0/node_modules/@ungap/structured-clone/esm/index.js
var esm_default = typeof structuredClone === "function" ? (any, options) => options && (("json" in options) || ("lossy" in options)) ? deserialize(serialize(any, options)) : structuredClone(any) : (any, options) => deserialize(serialize(any, options));

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/footer.js
function defaultFootnoteBackContent(_, rereferenceIndex) {
  const result = [{ type: "text", value: "↩" }];
  if (rereferenceIndex > 1) {
    result.push({
      type: "element",
      tagName: "sup",
      properties: {},
      children: [{ type: "text", value: String(rereferenceIndex) }]
    });
  }
  return result;
}
function defaultFootnoteBackLabel(referenceIndex, rereferenceIndex) {
  return "Back to reference " + (referenceIndex + 1) + (rereferenceIndex > 1 ? "-" + rereferenceIndex : "");
}
function footer(state) {
  const clobberPrefix = typeof state.options.clobberPrefix === "string" ? state.options.clobberPrefix : "user-content-";
  const footnoteBackContent = state.options.footnoteBackContent || defaultFootnoteBackContent;
  const footnoteBackLabel = state.options.footnoteBackLabel || defaultFootnoteBackLabel;
  const footnoteLabel = state.options.footnoteLabel || "Footnotes";
  const footnoteLabelTagName = state.options.footnoteLabelTagName || "h2";
  const footnoteLabelProperties = state.options.footnoteLabelProperties || {
    className: ["sr-only"]
  };
  const listItems = [];
  let referenceIndex = -1;
  while (++referenceIndex < state.footnoteOrder.length) {
    const definition2 = state.footnoteById.get(state.footnoteOrder[referenceIndex]);
    if (!definition2) {
      continue;
    }
    const content3 = state.all(definition2);
    const id = String(definition2.identifier).toUpperCase();
    const safeId = normalizeUri(id.toLowerCase());
    let rereferenceIndex = 0;
    const backReferences = [];
    const counts = state.footnoteCounts.get(id);
    while (counts !== undefined && ++rereferenceIndex <= counts) {
      if (backReferences.length > 0) {
        backReferences.push({ type: "text", value: " " });
      }
      let children = typeof footnoteBackContent === "string" ? footnoteBackContent : footnoteBackContent(referenceIndex, rereferenceIndex);
      if (typeof children === "string") {
        children = { type: "text", value: children };
      }
      backReferences.push({
        type: "element",
        tagName: "a",
        properties: {
          href: "#" + clobberPrefix + "fnref-" + safeId + (rereferenceIndex > 1 ? "-" + rereferenceIndex : ""),
          dataFootnoteBackref: "",
          ariaLabel: typeof footnoteBackLabel === "string" ? footnoteBackLabel : footnoteBackLabel(referenceIndex, rereferenceIndex),
          className: ["data-footnote-backref"]
        },
        children: Array.isArray(children) ? children : [children]
      });
    }
    const tail = content3[content3.length - 1];
    if (tail && tail.type === "element" && tail.tagName === "p") {
      const tailTail = tail.children[tail.children.length - 1];
      if (tailTail && tailTail.type === "text") {
        tailTail.value += " ";
      } else {
        tail.children.push({ type: "text", value: " " });
      }
      tail.children.push(...backReferences);
    } else {
      content3.push(...backReferences);
    }
    const listItem2 = {
      type: "element",
      tagName: "li",
      properties: { id: clobberPrefix + "fn-" + safeId },
      children: state.wrap(content3, true)
    };
    state.patch(definition2, listItem2);
    listItems.push(listItem2);
  }
  if (listItems.length === 0) {
    return;
  }
  return {
    type: "element",
    tagName: "section",
    properties: { dataFootnotes: true, className: ["footnotes"] },
    children: [
      {
        type: "element",
        tagName: footnoteLabelTagName,
        properties: {
          ...esm_default(footnoteLabelProperties),
          id: "footnote-label"
        },
        children: [{ type: "text", value: footnoteLabel }]
      },
      { type: "text", value: `
` },
      {
        type: "element",
        tagName: "ol",
        properties: {},
        children: state.wrap(listItems, true)
      },
      { type: "text", value: `
` }
    ]
  };
}

// ../../../../node_modules/.bun/unist-util-is@6.0.1/node_modules/unist-util-is/lib/index.js
var convert = function(test) {
  if (test === null || test === undefined) {
    return ok2;
  }
  if (typeof test === "function") {
    return castFactory(test);
  }
  if (typeof test === "object") {
    return Array.isArray(test) ? anyFactory(test) : propertiesFactory(test);
  }
  if (typeof test === "string") {
    return typeFactory(test);
  }
  throw new Error("Expected function, string, or object as test");
};
function anyFactory(tests) {
  const checks2 = [];
  let index2 = -1;
  while (++index2 < tests.length) {
    checks2[index2] = convert(tests[index2]);
  }
  return castFactory(any);
  function any(...parameters) {
    let index3 = -1;
    while (++index3 < checks2.length) {
      if (checks2[index3].apply(this, parameters))
        return true;
    }
    return false;
  }
}
function propertiesFactory(check) {
  const checkAsRecord = check;
  return castFactory(all2);
  function all2(node2) {
    const nodeAsRecord = node2;
    let key;
    for (key in check) {
      if (nodeAsRecord[key] !== checkAsRecord[key])
        return false;
    }
    return true;
  }
}
function typeFactory(check) {
  return castFactory(type);
  function type(node2) {
    return node2 && node2.type === check;
  }
}
function castFactory(testFunction) {
  return check;
  function check(value, index2, parent) {
    return Boolean(looksLikeANode(value) && testFunction.call(this, value, typeof index2 === "number" ? index2 : undefined, parent || undefined));
  }
}
function ok2() {
  return true;
}
function looksLikeANode(value) {
  return value !== null && typeof value === "object" && "type" in value;
}
// ../../../../node_modules/.bun/unist-util-visit-parents@6.0.2/node_modules/unist-util-visit-parents/lib/color.js
function color(d) {
  return d;
}

// ../../../../node_modules/.bun/unist-util-visit-parents@6.0.2/node_modules/unist-util-visit-parents/lib/index.js
var empty2 = [];
var CONTINUE = true;
var EXIT = false;
var SKIP = "skip";
function visitParents(tree, test, visitor, reverse) {
  let check;
  if (typeof test === "function" && typeof visitor !== "function") {
    reverse = visitor;
    visitor = test;
  } else {
    check = test;
  }
  const is2 = convert(check);
  const step = reverse ? -1 : 1;
  factory(tree, undefined, [])();
  function factory(node2, index2, parents) {
    const value = node2 && typeof node2 === "object" ? node2 : {};
    if (typeof value.type === "string") {
      const name2 = typeof value.tagName === "string" ? value.tagName : typeof value.name === "string" ? value.name : undefined;
      Object.defineProperty(visit, "name", {
        value: "node (" + color(node2.type + (name2 ? "<" + name2 + ">" : "")) + ")"
      });
    }
    return visit;
    function visit() {
      let result = empty2;
      let subresult;
      let offset;
      let grandparents;
      if (!test || is2(node2, index2, parents[parents.length - 1] || undefined)) {
        result = toResult(visitor(node2, parents));
        if (result[0] === EXIT) {
          return result;
        }
      }
      if ("children" in node2 && node2.children) {
        const nodeAsParent = node2;
        if (nodeAsParent.children && result[0] !== SKIP) {
          offset = (reverse ? nodeAsParent.children.length : -1) + step;
          grandparents = parents.concat(nodeAsParent);
          while (offset > -1 && offset < nodeAsParent.children.length) {
            const child = nodeAsParent.children[offset];
            subresult = factory(child, offset, grandparents)();
            if (subresult[0] === EXIT) {
              return subresult;
            }
            offset = typeof subresult[1] === "number" ? subresult[1] : offset + step;
          }
        }
      }
      return result;
    }
  }
}
function toResult(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "number") {
    return [CONTINUE, value];
  }
  return value === null || value === undefined ? empty2 : [value];
}
// ../../../../node_modules/.bun/unist-util-visit@5.1.0/node_modules/unist-util-visit/lib/index.js
function visit(tree, testOrVisitor, visitorOrReverse, maybeReverse) {
  let reverse;
  let test;
  let visitor;
  if (typeof testOrVisitor === "function" && typeof visitorOrReverse !== "function") {
    test = undefined;
    visitor = testOrVisitor;
    reverse = visitorOrReverse;
  } else {
    test = testOrVisitor;
    visitor = visitorOrReverse;
    reverse = maybeReverse;
  }
  visitParents(tree, test, overload, reverse);
  function overload(node2, parents) {
    const parent = parents[parents.length - 1];
    const index2 = parent ? parent.children.indexOf(node2) : undefined;
    return visitor(node2, index2, parent);
  }
}
// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/state.js
var own3 = {}.hasOwnProperty;
var emptyOptions3 = {};
function createState(tree, options) {
  const settings = options || emptyOptions3;
  const definitionById = new Map;
  const footnoteById = new Map;
  const footnoteCounts = new Map;
  const handlers2 = { ...handlers, ...settings.handlers };
  const state = {
    all: all2,
    applyData,
    definitionById,
    footnoteById,
    footnoteCounts,
    footnoteOrder: [],
    handlers: handlers2,
    one: one3,
    options: settings,
    patch,
    wrap
  };
  visit(tree, function(node2) {
    if (node2.type === "definition" || node2.type === "footnoteDefinition") {
      const map = node2.type === "definition" ? definitionById : footnoteById;
      const id = String(node2.identifier).toUpperCase();
      if (!map.has(id)) {
        map.set(id, node2);
      }
    }
  });
  return state;
  function one3(node2, parent) {
    const type = node2.type;
    const handle = state.handlers[type];
    if (own3.call(state.handlers, type) && handle) {
      return handle(state, node2, parent);
    }
    if (state.options.passThrough && state.options.passThrough.includes(type)) {
      if ("children" in node2) {
        const { children, ...shallow } = node2;
        const result = esm_default(shallow);
        result.children = state.all(node2);
        return result;
      }
      return esm_default(node2);
    }
    const unknown = state.options.unknownHandler || defaultUnknownHandler;
    return unknown(state, node2, parent);
  }
  function all2(parent) {
    const values2 = [];
    if ("children" in parent) {
      const nodes = parent.children;
      let index2 = -1;
      while (++index2 < nodes.length) {
        const result = state.one(nodes[index2], parent);
        if (result) {
          if (index2 && nodes[index2 - 1].type === "break") {
            if (!Array.isArray(result) && result.type === "text") {
              result.value = trimMarkdownSpaceStart(result.value);
            }
            if (!Array.isArray(result) && result.type === "element") {
              const head = result.children[0];
              if (head && head.type === "text") {
                head.value = trimMarkdownSpaceStart(head.value);
              }
            }
          }
          if (Array.isArray(result)) {
            values2.push(...result);
          } else {
            values2.push(result);
          }
        }
      }
    }
    return values2;
  }
}
function patch(from, to) {
  if (from.position)
    to.position = position(from);
}
function applyData(from, to) {
  let result = to;
  if (from && from.data) {
    const hName = from.data.hName;
    const hChildren = from.data.hChildren;
    const hProperties = from.data.hProperties;
    if (typeof hName === "string") {
      if (result.type === "element") {
        result.tagName = hName;
      } else {
        const children = "children" in result ? result.children : [result];
        result = { type: "element", tagName: hName, properties: {}, children };
      }
    }
    if (result.type === "element" && hProperties) {
      Object.assign(result.properties, esm_default(hProperties));
    }
    if ("children" in result && result.children && hChildren !== null && hChildren !== undefined) {
      result.children = hChildren;
    }
  }
  return result;
}
function defaultUnknownHandler(state, node2) {
  const data = node2.data || {};
  const result = "value" in node2 && !(own3.call(data, "hProperties") || own3.call(data, "hChildren")) ? { type: "text", value: node2.value } : {
    type: "element",
    tagName: "div",
    properties: {},
    children: state.all(node2)
  };
  state.patch(node2, result);
  return state.applyData(node2, result);
}
function wrap(nodes, loose) {
  const result = [];
  let index2 = -1;
  if (loose) {
    result.push({ type: "text", value: `
` });
  }
  while (++index2 < nodes.length) {
    if (index2)
      result.push({ type: "text", value: `
` });
    result.push(nodes[index2]);
  }
  if (loose && nodes.length > 0) {
    result.push({ type: "text", value: `
` });
  }
  return result;
}
function trimMarkdownSpaceStart(value) {
  let index2 = 0;
  let code2 = value.charCodeAt(index2);
  while (code2 === 9 || code2 === 32) {
    index2++;
    code2 = value.charCodeAt(index2);
  }
  return value.slice(index2);
}

// ../../../../node_modules/.bun/mdast-util-to-hast@13.2.1/node_modules/mdast-util-to-hast/lib/index.js
function toHast(tree, options) {
  const state = createState(tree, options);
  const node2 = state.one(tree, undefined);
  const foot = footer(state);
  const result = Array.isArray(node2) ? { type: "root", children: node2 } : node2 || { type: "root", children: [] };
  if (foot) {
    ok("children" in result);
    result.children.push({ type: "text", value: `
` }, foot);
  }
  return result;
}
// ../../../../node_modules/.bun/remark-rehype@11.1.2/node_modules/remark-rehype/lib/index.js
function remarkRehype(destination, options) {
  if (destination && "run" in destination) {
    return async function(tree, file) {
      const hastTree = toHast(tree, { file, ...options });
      await destination.run(hastTree, file);
    };
  }
  return function(tree, file) {
    return toHast(tree, { file, ...destination || options });
  };
}
// ../../../../node_modules/.bun/bail@2.0.2/node_modules/bail/index.js
function bail(error) {
  if (error) {
    throw error;
  }
}

// ../../../../node_modules/.bun/unified@11.0.5/node_modules/unified/lib/index.js
var import_extend = __toESM(require_extend(), 1);

// ../../../../node_modules/.bun/is-plain-obj@4.1.0/node_modules/is-plain-obj/index.js
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in value) && !(Symbol.iterator in value);
}

// ../../../../node_modules/.bun/trough@2.2.0/node_modules/trough/lib/index.js
function trough() {
  const fns = [];
  const pipeline = { run, use };
  return pipeline;
  function run(...values2) {
    let middlewareIndex = -1;
    const callback = values2.pop();
    if (typeof callback !== "function") {
      throw new TypeError("Expected function as last argument, not " + callback);
    }
    next(null, ...values2);
    function next(error, ...output) {
      const fn = fns[++middlewareIndex];
      let index2 = -1;
      if (error) {
        callback(error);
        return;
      }
      while (++index2 < values2.length) {
        if (output[index2] === null || output[index2] === undefined) {
          output[index2] = values2[index2];
        }
      }
      values2 = output;
      if (fn) {
        wrap2(fn, next)(...output);
      } else {
        callback(null, ...output);
      }
    }
  }
  function use(middelware) {
    if (typeof middelware !== "function") {
      throw new TypeError("Expected `middelware` to be a function, not " + middelware);
    }
    fns.push(middelware);
    return pipeline;
  }
}
function wrap2(middleware, callback) {
  let called;
  return wrapped;
  function wrapped(...parameters) {
    const fnExpectsCallback = middleware.length > parameters.length;
    let result;
    if (fnExpectsCallback) {
      parameters.push(done);
    }
    try {
      result = middleware.apply(this, parameters);
    } catch (error) {
      const exception = error;
      if (fnExpectsCallback && called) {
        throw exception;
      }
      return done(exception);
    }
    if (!fnExpectsCallback) {
      if (result && result.then && typeof result.then === "function") {
        result.then(then, done);
      } else if (result instanceof Error) {
        done(result);
      } else {
        then(result);
      }
    }
  }
  function done(error, ...output) {
    if (!called) {
      called = true;
      callback(error, ...output);
    }
  }
  function then(value) {
    done(null, value);
  }
}
// ../../../../node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minpath.browser.js
var minpath = { basename, dirname, extname, join, sep: "/" };
function basename(path, extname) {
  if (extname !== undefined && typeof extname !== "string") {
    throw new TypeError('"ext" argument must be a string');
  }
  assertPath(path);
  let start2 = 0;
  let end = -1;
  let index2 = path.length;
  let seenNonSlash;
  if (extname === undefined || extname.length === 0 || extname.length > path.length) {
    while (index2--) {
      if (path.codePointAt(index2) === 47) {
        if (seenNonSlash) {
          start2 = index2 + 1;
          break;
        }
      } else if (end < 0) {
        seenNonSlash = true;
        end = index2 + 1;
      }
    }
    return end < 0 ? "" : path.slice(start2, end);
  }
  if (extname === path) {
    return "";
  }
  let firstNonSlashEnd = -1;
  let extnameIndex = extname.length - 1;
  while (index2--) {
    if (path.codePointAt(index2) === 47) {
      if (seenNonSlash) {
        start2 = index2 + 1;
        break;
      }
    } else {
      if (firstNonSlashEnd < 0) {
        seenNonSlash = true;
        firstNonSlashEnd = index2 + 1;
      }
      if (extnameIndex > -1) {
        if (path.codePointAt(index2) === extname.codePointAt(extnameIndex--)) {
          if (extnameIndex < 0) {
            end = index2;
          }
        } else {
          extnameIndex = -1;
          end = firstNonSlashEnd;
        }
      }
    }
  }
  if (start2 === end) {
    end = firstNonSlashEnd;
  } else if (end < 0) {
    end = path.length;
  }
  return path.slice(start2, end);
}
function dirname(path) {
  assertPath(path);
  if (path.length === 0) {
    return ".";
  }
  let end = -1;
  let index2 = path.length;
  let unmatchedSlash;
  while (--index2) {
    if (path.codePointAt(index2) === 47) {
      if (unmatchedSlash) {
        end = index2;
        break;
      }
    } else if (!unmatchedSlash) {
      unmatchedSlash = true;
    }
  }
  return end < 0 ? path.codePointAt(0) === 47 ? "/" : "." : end === 1 && path.codePointAt(0) === 47 ? "//" : path.slice(0, end);
}
function extname(path) {
  assertPath(path);
  let index2 = path.length;
  let end = -1;
  let startPart = 0;
  let startDot = -1;
  let preDotState = 0;
  let unmatchedSlash;
  while (index2--) {
    const code2 = path.codePointAt(index2);
    if (code2 === 47) {
      if (unmatchedSlash) {
        startPart = index2 + 1;
        break;
      }
      continue;
    }
    if (end < 0) {
      unmatchedSlash = true;
      end = index2 + 1;
    }
    if (code2 === 46) {
      if (startDot < 0) {
        startDot = index2;
      } else if (preDotState !== 1) {
        preDotState = 1;
      }
    } else if (startDot > -1) {
      preDotState = -1;
    }
  }
  if (startDot < 0 || end < 0 || preDotState === 0 || preDotState === 1 && startDot === end - 1 && startDot === startPart + 1) {
    return "";
  }
  return path.slice(startDot, end);
}
function join(...segments) {
  let index2 = -1;
  let joined;
  while (++index2 < segments.length) {
    assertPath(segments[index2]);
    if (segments[index2]) {
      joined = joined === undefined ? segments[index2] : joined + "/" + segments[index2];
    }
  }
  return joined === undefined ? "." : normalize2(joined);
}
function normalize2(path) {
  assertPath(path);
  const absolute = path.codePointAt(0) === 47;
  let value = normalizeString(path, !absolute);
  if (value.length === 0 && !absolute) {
    value = ".";
  }
  if (value.length > 0 && path.codePointAt(path.length - 1) === 47) {
    value += "/";
  }
  return absolute ? "/" + value : value;
}
function normalizeString(path, allowAboveRoot) {
  let result = "";
  let lastSegmentLength = 0;
  let lastSlash = -1;
  let dots = 0;
  let index2 = -1;
  let code2;
  let lastSlashIndex;
  while (++index2 <= path.length) {
    if (index2 < path.length) {
      code2 = path.codePointAt(index2);
    } else if (code2 === 47) {
      break;
    } else {
      code2 = 47;
    }
    if (code2 === 47) {
      if (lastSlash === index2 - 1 || dots === 1) {} else if (lastSlash !== index2 - 1 && dots === 2) {
        if (result.length < 2 || lastSegmentLength !== 2 || result.codePointAt(result.length - 1) !== 46 || result.codePointAt(result.length - 2) !== 46) {
          if (result.length > 2) {
            lastSlashIndex = result.lastIndexOf("/");
            if (lastSlashIndex !== result.length - 1) {
              if (lastSlashIndex < 0) {
                result = "";
                lastSegmentLength = 0;
              } else {
                result = result.slice(0, lastSlashIndex);
                lastSegmentLength = result.length - 1 - result.lastIndexOf("/");
              }
              lastSlash = index2;
              dots = 0;
              continue;
            }
          } else if (result.length > 0) {
            result = "";
            lastSegmentLength = 0;
            lastSlash = index2;
            dots = 0;
            continue;
          }
        }
        if (allowAboveRoot) {
          result = result.length > 0 ? result + "/.." : "..";
          lastSegmentLength = 2;
        }
      } else {
        if (result.length > 0) {
          result += "/" + path.slice(lastSlash + 1, index2);
        } else {
          result = path.slice(lastSlash + 1, index2);
        }
        lastSegmentLength = index2 - lastSlash - 1;
      }
      lastSlash = index2;
      dots = 0;
    } else if (code2 === 46 && dots > -1) {
      dots++;
    } else {
      dots = -1;
    }
  }
  return result;
}
function assertPath(path) {
  if (typeof path !== "string") {
    throw new TypeError("Path must be a string. Received " + JSON.stringify(path));
  }
}

// ../../../../node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minproc.browser.js
var minproc = { cwd };
function cwd() {
  return "/";
}

// ../../../../node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minurl.shared.js
function isUrl(fileUrlOrPath) {
  return Boolean(fileUrlOrPath !== null && typeof fileUrlOrPath === "object" && "href" in fileUrlOrPath && fileUrlOrPath.href && "protocol" in fileUrlOrPath && fileUrlOrPath.protocol && fileUrlOrPath.auth === undefined);
}

// ../../../../node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/minurl.browser.js
function urlToPath(path) {
  if (typeof path === "string") {
    path = new URL(path);
  } else if (!isUrl(path)) {
    const error = new TypeError('The "path" argument must be of type string or an instance of URL. Received `' + path + "`");
    error.code = "ERR_INVALID_ARG_TYPE";
    throw error;
  }
  if (path.protocol !== "file:") {
    const error = new TypeError("The URL must be of scheme file");
    error.code = "ERR_INVALID_URL_SCHEME";
    throw error;
  }
  return getPathFromURLPosix(path);
}
function getPathFromURLPosix(url) {
  if (url.hostname !== "") {
    const error = new TypeError('File URL host must be "localhost" or empty on darwin');
    error.code = "ERR_INVALID_FILE_URL_HOST";
    throw error;
  }
  const pathname = url.pathname;
  let index2 = -1;
  while (++index2 < pathname.length) {
    if (pathname.codePointAt(index2) === 37 && pathname.codePointAt(index2 + 1) === 50) {
      const third = pathname.codePointAt(index2 + 2);
      if (third === 70 || third === 102) {
        const error = new TypeError("File URL path must not include encoded / characters");
        error.code = "ERR_INVALID_FILE_URL_PATH";
        throw error;
      }
    }
  }
  return decodeURIComponent(pathname);
}

// ../../../../node_modules/.bun/vfile@6.0.3/node_modules/vfile/lib/index.js
var order = [
  "history",
  "path",
  "basename",
  "stem",
  "extname",
  "dirname"
];

class VFile {
  constructor(value) {
    let options;
    if (!value) {
      options = {};
    } else if (isUrl(value)) {
      options = { path: value };
    } else if (typeof value === "string" || isUint8Array(value)) {
      options = { value };
    } else {
      options = value;
    }
    this.cwd = "cwd" in options ? "" : minproc.cwd();
    this.data = {};
    this.history = [];
    this.messages = [];
    this.value;
    this.map;
    this.result;
    this.stored;
    let index2 = -1;
    while (++index2 < order.length) {
      const field2 = order[index2];
      if (field2 in options && options[field2] !== undefined && options[field2] !== null) {
        this[field2] = field2 === "history" ? [...options[field2]] : options[field2];
      }
    }
    let field;
    for (field in options) {
      if (!order.includes(field)) {
        this[field] = options[field];
      }
    }
  }
  get basename() {
    return typeof this.path === "string" ? minpath.basename(this.path) : undefined;
  }
  set basename(basename2) {
    assertNonEmpty(basename2, "basename");
    assertPart(basename2, "basename");
    this.path = minpath.join(this.dirname || "", basename2);
  }
  get dirname() {
    return typeof this.path === "string" ? minpath.dirname(this.path) : undefined;
  }
  set dirname(dirname2) {
    assertPath2(this.basename, "dirname");
    this.path = minpath.join(dirname2 || "", this.basename);
  }
  get extname() {
    return typeof this.path === "string" ? minpath.extname(this.path) : undefined;
  }
  set extname(extname2) {
    assertPart(extname2, "extname");
    assertPath2(this.dirname, "extname");
    if (extname2) {
      if (extname2.codePointAt(0) !== 46) {
        throw new Error("`extname` must start with `.`");
      }
      if (extname2.includes(".", 1)) {
        throw new Error("`extname` cannot contain multiple dots");
      }
    }
    this.path = minpath.join(this.dirname, this.stem + (extname2 || ""));
  }
  get path() {
    return this.history[this.history.length - 1];
  }
  set path(path) {
    if (isUrl(path)) {
      path = urlToPath(path);
    }
    assertNonEmpty(path, "path");
    if (this.path !== path) {
      this.history.push(path);
    }
  }
  get stem() {
    return typeof this.path === "string" ? minpath.basename(this.path, this.extname) : undefined;
  }
  set stem(stem) {
    assertNonEmpty(stem, "stem");
    assertPart(stem, "stem");
    this.path = minpath.join(this.dirname || "", stem + (this.extname || ""));
  }
  fail(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = this.message(causeOrReason, optionsOrParentOrPlace, origin);
    message.fatal = true;
    throw message;
  }
  info(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = this.message(causeOrReason, optionsOrParentOrPlace, origin);
    message.fatal = undefined;
    return message;
  }
  message(causeOrReason, optionsOrParentOrPlace, origin) {
    const message = new VFileMessage(causeOrReason, optionsOrParentOrPlace, origin);
    if (this.path) {
      message.name = this.path + ":" + message.name;
      message.file = this.path;
    }
    message.fatal = false;
    this.messages.push(message);
    return message;
  }
  toString(encoding) {
    if (this.value === undefined) {
      return "";
    }
    if (typeof this.value === "string") {
      return this.value;
    }
    const decoder = new TextDecoder(encoding || undefined);
    return decoder.decode(this.value);
  }
}
function assertPart(part, name2) {
  if (part && part.includes(minpath.sep)) {
    throw new Error("`" + name2 + "` cannot be a path: did not expect `" + minpath.sep + "`");
  }
}
function assertNonEmpty(part, name2) {
  if (!part) {
    throw new Error("`" + name2 + "` cannot be empty");
  }
}
function assertPath2(path, name2) {
  if (!path) {
    throw new Error("Setting `" + name2 + "` requires `path` to be set too");
  }
}
function isUint8Array(value) {
  return Boolean(value && typeof value === "object" && "byteLength" in value && "byteOffset" in value);
}
// ../../../../node_modules/.bun/unified@11.0.5/node_modules/unified/lib/callable-instance.js
var CallableInstance = function(property) {
  const self2 = this;
  const constr = self2.constructor;
  const proto = constr.prototype;
  const value = proto[property];
  const apply = function() {
    return value.apply(apply, arguments);
  };
  Object.setPrototypeOf(apply, proto);
  return apply;
};

// ../../../../node_modules/.bun/unified@11.0.5/node_modules/unified/lib/index.js
var own4 = {}.hasOwnProperty;

class Processor extends CallableInstance {
  constructor() {
    super("copy");
    this.Compiler = undefined;
    this.Parser = undefined;
    this.attachers = [];
    this.compiler = undefined;
    this.freezeIndex = -1;
    this.frozen = undefined;
    this.namespace = {};
    this.parser = undefined;
    this.transformers = trough();
  }
  copy() {
    const destination = new Processor;
    let index2 = -1;
    while (++index2 < this.attachers.length) {
      const attacher = this.attachers[index2];
      destination.use(...attacher);
    }
    destination.data(import_extend.default(true, {}, this.namespace));
    return destination;
  }
  data(key, value) {
    if (typeof key === "string") {
      if (arguments.length === 2) {
        assertUnfrozen("data", this.frozen);
        this.namespace[key] = value;
        return this;
      }
      return own4.call(this.namespace, key) && this.namespace[key] || undefined;
    }
    if (key) {
      assertUnfrozen("data", this.frozen);
      this.namespace = key;
      return this;
    }
    return this.namespace;
  }
  freeze() {
    if (this.frozen) {
      return this;
    }
    const self2 = this;
    while (++this.freezeIndex < this.attachers.length) {
      const [attacher, ...options] = this.attachers[this.freezeIndex];
      if (options[0] === false) {
        continue;
      }
      if (options[0] === true) {
        options[0] = undefined;
      }
      const transformer = attacher.call(self2, ...options);
      if (typeof transformer === "function") {
        this.transformers.use(transformer);
      }
    }
    this.frozen = true;
    this.freezeIndex = Number.POSITIVE_INFINITY;
    return this;
  }
  parse(file) {
    this.freeze();
    const realFile = vfile(file);
    const parser = this.parser || this.Parser;
    assertParser("parse", parser);
    return parser(String(realFile), realFile);
  }
  process(file, done) {
    const self2 = this;
    this.freeze();
    assertParser("process", this.parser || this.Parser);
    assertCompiler("process", this.compiler || this.Compiler);
    return done ? executor(undefined, done) : new Promise(executor);
    function executor(resolve, reject) {
      const realFile = vfile(file);
      const parseTree = self2.parse(realFile);
      self2.run(parseTree, realFile, function(error, tree, file2) {
        if (error || !tree || !file2) {
          return realDone(error);
        }
        const compileTree = tree;
        const compileResult = self2.stringify(compileTree, file2);
        if (looksLikeAValue(compileResult)) {
          file2.value = compileResult;
        } else {
          file2.result = compileResult;
        }
        realDone(error, file2);
      });
      function realDone(error, file2) {
        if (error || !file2) {
          reject(error);
        } else if (resolve) {
          resolve(file2);
        } else {
          ok(done, "`done` is defined if `resolve` is not");
          done(undefined, file2);
        }
      }
    }
  }
  processSync(file) {
    let complete = false;
    let result;
    this.freeze();
    assertParser("processSync", this.parser || this.Parser);
    assertCompiler("processSync", this.compiler || this.Compiler);
    this.process(file, realDone);
    assertDone("processSync", "process", complete);
    ok(result, "we either bailed on an error or have a tree");
    return result;
    function realDone(error, file2) {
      complete = true;
      bail(error);
      result = file2;
    }
  }
  run(tree, file, done) {
    assertNode(tree);
    this.freeze();
    const transformers = this.transformers;
    if (!done && typeof file === "function") {
      done = file;
      file = undefined;
    }
    return done ? executor(undefined, done) : new Promise(executor);
    function executor(resolve, reject) {
      ok(typeof file !== "function", "`file` can’t be a `done` anymore, we checked");
      const realFile = vfile(file);
      transformers.run(tree, realFile, realDone);
      function realDone(error, outputTree, file2) {
        const resultingTree = outputTree || tree;
        if (error) {
          reject(error);
        } else if (resolve) {
          resolve(resultingTree);
        } else {
          ok(done, "`done` is defined if `resolve` is not");
          done(undefined, resultingTree, file2);
        }
      }
    }
  }
  runSync(tree, file) {
    let complete = false;
    let result;
    this.run(tree, file, realDone);
    assertDone("runSync", "run", complete);
    ok(result, "we either bailed on an error or have a tree");
    return result;
    function realDone(error, tree2) {
      bail(error);
      result = tree2;
      complete = true;
    }
  }
  stringify(tree, file) {
    this.freeze();
    const realFile = vfile(file);
    const compiler2 = this.compiler || this.Compiler;
    assertCompiler("stringify", compiler2);
    assertNode(tree);
    return compiler2(tree, realFile);
  }
  use(value, ...parameters) {
    const attachers = this.attachers;
    const namespace = this.namespace;
    assertUnfrozen("use", this.frozen);
    if (value === null || value === undefined) {} else if (typeof value === "function") {
      addPlugin(value, parameters);
    } else if (typeof value === "object") {
      if (Array.isArray(value)) {
        addList(value);
      } else {
        addPreset(value);
      }
    } else {
      throw new TypeError("Expected usable value, not `" + value + "`");
    }
    return this;
    function add(value2) {
      if (typeof value2 === "function") {
        addPlugin(value2, []);
      } else if (typeof value2 === "object") {
        if (Array.isArray(value2)) {
          const [plugin, ...parameters2] = value2;
          addPlugin(plugin, parameters2);
        } else {
          addPreset(value2);
        }
      } else {
        throw new TypeError("Expected usable value, not `" + value2 + "`");
      }
    }
    function addPreset(result) {
      if (!("plugins" in result) && !("settings" in result)) {
        throw new Error("Expected usable value but received an empty preset, which is probably a mistake: presets typically come with `plugins` and sometimes with `settings`, but this has neither");
      }
      addList(result.plugins);
      if (result.settings) {
        namespace.settings = import_extend.default(true, namespace.settings, result.settings);
      }
    }
    function addList(plugins) {
      let index2 = -1;
      if (plugins === null || plugins === undefined) {} else if (Array.isArray(plugins)) {
        while (++index2 < plugins.length) {
          const thing = plugins[index2];
          add(thing);
        }
      } else {
        throw new TypeError("Expected a list of plugins, not `" + plugins + "`");
      }
    }
    function addPlugin(plugin, parameters2) {
      let index2 = -1;
      let entryIndex = -1;
      while (++index2 < attachers.length) {
        if (attachers[index2][0] === plugin) {
          entryIndex = index2;
          break;
        }
      }
      if (entryIndex === -1) {
        attachers.push([plugin, ...parameters2]);
      } else if (parameters2.length > 0) {
        let [primary, ...rest] = parameters2;
        const currentPrimary = attachers[entryIndex][1];
        if (isPlainObject(currentPrimary) && isPlainObject(primary)) {
          primary = import_extend.default(true, currentPrimary, primary);
        }
        attachers[entryIndex] = [plugin, primary, ...rest];
      }
    }
  }
}
var unified = new Processor().freeze();
function assertParser(name2, value) {
  if (typeof value !== "function") {
    throw new TypeError("Cannot `" + name2 + "` without `parser`");
  }
}
function assertCompiler(name2, value) {
  if (typeof value !== "function") {
    throw new TypeError("Cannot `" + name2 + "` without `compiler`");
  }
}
function assertUnfrozen(name2, frozen) {
  if (frozen) {
    throw new Error("Cannot call `" + name2 + "` on a frozen processor.\nCreate a new processor first, by calling it: use `processor()` instead of `processor`.");
  }
}
function assertNode(node2) {
  if (!isPlainObject(node2) || typeof node2.type !== "string") {
    throw new TypeError("Expected node, got `" + node2 + "`");
  }
}
function assertDone(name2, asyncName, complete) {
  if (!complete) {
    throw new Error("`" + name2 + "` finished async. Use `" + asyncName + "` instead");
  }
}
function vfile(value) {
  return looksLikeAVFile(value) ? value : new VFile(value);
}
function looksLikeAVFile(value) {
  return Boolean(value && typeof value === "object" && "message" in value && "messages" in value);
}
function looksLikeAValue(value) {
  return typeof value === "string" || isUint8Array2(value);
}
function isUint8Array2(value) {
  return Boolean(value && typeof value === "object" && "byteLength" in value && "byteOffset" in value);
}
// ../../../../node_modules/.bun/react-markdown@10.1.0+f7f3071e040c6a00/node_modules/react-markdown/lib/index.js
var changelog = "https://github.com/remarkjs/react-markdown/blob/main/changelog.md";
var emptyPlugins = [];
var emptyRemarkRehypeOptions = { allowDangerousHtml: true };
var safeProtocol = /^(https?|ircs?|mailto|xmpp)$/i;
var deprecations = [
  { from: "astPlugins", id: "remove-buggy-html-in-markdown-parser" },
  { from: "allowDangerousHtml", id: "remove-buggy-html-in-markdown-parser" },
  {
    from: "allowNode",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "allowElement"
  },
  {
    from: "allowedTypes",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "allowedElements"
  },
  { from: "className", id: "remove-classname" },
  {
    from: "disallowedTypes",
    id: "replace-allownode-allowedtypes-and-disallowedtypes",
    to: "disallowedElements"
  },
  { from: "escapeHtml", id: "remove-buggy-html-in-markdown-parser" },
  { from: "includeElementIndex", id: "#remove-includeelementindex" },
  {
    from: "includeNodeIndex",
    id: "change-includenodeindex-to-includeelementindex"
  },
  { from: "linkTarget", id: "remove-linktarget" },
  { from: "plugins", id: "change-plugins-to-remarkplugins", to: "remarkPlugins" },
  { from: "rawSourcePos", id: "#remove-rawsourcepos" },
  { from: "renderers", id: "change-renderers-to-components", to: "components" },
  { from: "source", id: "change-source-to-children", to: "children" },
  { from: "sourcePos", id: "#remove-sourcepos" },
  { from: "transformImageUri", id: "#add-urltransform", to: "urlTransform" },
  { from: "transformLinkUri", id: "#add-urltransform", to: "urlTransform" }
];
function Markdown(options) {
  const processor = createProcessor(options);
  const file = createFile(options);
  return post(processor.runSync(processor.parse(file), file), options);
}
function createProcessor(options) {
  const rehypePlugins = options.rehypePlugins || emptyPlugins;
  const remarkPlugins = options.remarkPlugins || emptyPlugins;
  const remarkRehypeOptions = options.remarkRehypeOptions ? { ...options.remarkRehypeOptions, ...emptyRemarkRehypeOptions } : emptyRemarkRehypeOptions;
  const processor = unified().use(remarkParse).use(remarkPlugins).use(remarkRehype, remarkRehypeOptions).use(rehypePlugins);
  return processor;
}
function createFile(options) {
  const children = options.children || "";
  const file = new VFile;
  if (typeof children === "string") {
    file.value = children;
  } else {
    unreachable("Unexpected value `" + children + "` for `children` prop, expected `string`");
  }
  return file;
}
function post(tree, options) {
  const allowedElements = options.allowedElements;
  const allowElement = options.allowElement;
  const components = options.components;
  const disallowedElements = options.disallowedElements;
  const skipHtml = options.skipHtml;
  const unwrapDisallowed = options.unwrapDisallowed;
  const urlTransform = options.urlTransform || defaultUrlTransform;
  for (const deprecation of deprecations) {
    if (Object.hasOwn(options, deprecation.from)) {
      unreachable("Unexpected `" + deprecation.from + "` prop, " + (deprecation.to ? "use `" + deprecation.to + "` instead" : "remove it") + " (see <" + changelog + "#" + deprecation.id + "> for more info)");
    }
  }
  if (allowedElements && disallowedElements) {
    unreachable("Unexpected combined `allowedElements` and `disallowedElements`, expected one or the other");
  }
  visit(tree, transform);
  return toJsxRuntime(tree, {
    Fragment,
    components,
    ignoreInvalidStyle: true,
    jsx,
    jsxs,
    passKeys: true,
    passNode: true
  });
  function transform(node2, index2, parent) {
    if (node2.type === "raw" && parent && typeof index2 === "number") {
      if (skipHtml) {
        parent.children.splice(index2, 1);
      } else {
        parent.children[index2] = { type: "text", value: node2.value };
      }
      return index2;
    }
    if (node2.type === "element") {
      let key;
      for (key in urlAttributes) {
        if (Object.hasOwn(urlAttributes, key) && Object.hasOwn(node2.properties, key)) {
          const value = node2.properties[key];
          const test = urlAttributes[key];
          if (test === null || test.includes(node2.tagName)) {
            node2.properties[key] = urlTransform(String(value || ""), key, node2);
          }
        }
      }
    }
    if (node2.type === "element") {
      let remove = allowedElements ? !allowedElements.includes(node2.tagName) : disallowedElements ? disallowedElements.includes(node2.tagName) : false;
      if (!remove && allowElement && typeof index2 === "number") {
        remove = !allowElement(node2, index2, parent);
      }
      if (remove && parent && typeof index2 === "number") {
        if (unwrapDisallowed && node2.children) {
          parent.children.splice(index2, 1, ...node2.children);
        } else {
          parent.children.splice(index2, 1);
        }
        return index2;
      }
    }
  }
}
function defaultUrlTransform(value) {
  const colon = value.indexOf(":");
  const questionMark = value.indexOf("?");
  const numberSign = value.indexOf("#");
  const slash = value.indexOf("/");
  if (colon === -1 || slash !== -1 && colon > slash || questionMark !== -1 && colon > questionMark || numberSign !== -1 && colon > numberSign || safeProtocol.test(value.slice(0, colon))) {
    return value;
  }
  return "";
}
// src/components/files/FileView.tsx
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { Button, Progress, cn } from "front-core";
import { jsxDEV } from "react/jsx-dev-runtime";
var statusLabel = {
  uploading: "Загрузка",
  paused: "Пауза",
  error: "Ошибка",
  uploaded: "Готово"
};
var statusColor = {
  uploading: "text-blue-500",
  paused: "text-yellow-500",
  error: "text-red-500",
  uploaded: "text-green-500"
};
function FileView({ item }) {
  const totalChunksLabel = item.totalChunks > 0 ? item.totalChunks : "-";
  return /* @__PURE__ */ jsxDEV("div", {
    className: "flex flex-col gap-2 p-3 rounded-lg bg-muted/50 border",
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        className: "flex items-center justify-between gap-2",
        children: [
          /* @__PURE__ */ jsxDEV("div", {
            className: "flex-1 min-w-0",
            children: [
              /* @__PURE__ */ jsxDEV("div", {
                className: "text-sm font-medium truncate",
                title: item.name ?? item.fileId,
                children: item.name ?? item.fileId
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV("div", {
                className: "flex items-center gap-2 text-xs text-muted-foreground",
                children: [
                  /* @__PURE__ */ jsxDEV("span", {
                    className: cn(statusColor[item.status]),
                    children: statusLabel[item.status]
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV("span", {
                    children: [
                      item.progress,
                      "%"
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV("span", {
                    children: [
                      item.uploadedChunks,
                      " / ",
                      totalChunksLabel,
                      " chunks"
                    ]
                  }, undefined, true, undefined, this),
                  item.status === "error" && typeof item.failedChunk === "number" && /* @__PURE__ */ jsxDEV("span", {
                    className: "text-red-500",
                    children: [
                      "Chunk #",
                      item.failedChunk,
                      " failed"
                    ]
                  }, undefined, true, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV("div", {
            className: "flex items-center gap-1",
            children: [
              item.status === "uploading" && item.onPause && /* @__PURE__ */ jsxDEV(Button, {
                variant: "ghost",
                size: "icon",
                className: "h-7 w-7",
                onClick: item.onPause,
                disabled: item.disablePause,
                children: /* @__PURE__ */ jsxDEV(Pause, {
                  size: 14
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this),
              item.status === "paused" && item.onResume && /* @__PURE__ */ jsxDEV(Button, {
                variant: "ghost",
                size: "icon",
                className: "h-7 w-7",
                onClick: item.onResume,
                disabled: item.disableResume,
                children: /* @__PURE__ */ jsxDEV(Play, {
                  size: 14
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this),
              item.status === "error" && item.onRetry && /* @__PURE__ */ jsxDEV(Button, {
                variant: "ghost",
                size: "icon",
                className: "h-7 w-7",
                onClick: item.onRetry,
                disabled: item.disableRetry,
                children: /* @__PURE__ */ jsxDEV(RotateCcw, {
                  size: 14
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this),
              item.onCancel && /* @__PURE__ */ jsxDEV(Button, {
                variant: "ghost",
                size: "icon",
                className: "h-7 w-7",
                onClick: item.onCancel,
                disabled: item.disableCancel,
                children: /* @__PURE__ */ jsxDEV(X, {
                  size: 14
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV(Progress, {
        value: item.progress,
        className: "h-1.5"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/components/files/FileList.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
function FileList({ items, emptyLabel }) {
  const activeItems = items.filter((item) => item.status !== "uploaded");
  if (!activeItems.length) {
    return null;
  }
  return /* @__PURE__ */ jsxDEV2("div", {
    className: "flex flex-col gap-2",
    children: activeItems.map((item) => /* @__PURE__ */ jsxDEV2(FileView, {
      item
    }, item.fileId, false, undefined, this))
  }, undefined, false, undefined, this);
}
// src/components/ChatDetail.module.css
var ChatDetail_module_default = {
  markdown: "markdown_sc476w",
  messageRow: "messageRow_sc476w",
  messageRowUser: "messageRowUser_sc476w",
  messageRowAssistant: "messageRowAssistant_sc476w",
  userBubble: "userBubble_sc476w",
  assistantText: "assistantText_sc476w",
  messageHeader: "messageHeader_sc476w",
  chatScroll: "chatScroll_sc476w",
  chatSpacer: "chatSpacer_sc476w",
  chatMessages: "chatMessages_sc476w",
  loadingDots: "loadingDots_sc476w",
  loadingDot: "loadingDot_sc476w",
  streamCursor: "streamCursor_sc476w"
};

// src/components/ChatDetail.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
var MessageBubble = ({ message }) => {
  const isUser = message.type === "user";
  if (isUser) {
    return /* @__PURE__ */ jsxDEV3("div", {
      className: cn2(ChatDetail_module_default.messageRow, ChatDetail_module_default.messageRowUser),
      children: /* @__PURE__ */ jsxDEV3("div", {
        className: ChatDetail_module_default.userBubble,
        children: message.content
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV3("div", {
    className: cn2(ChatDetail_module_default.messageRow, ChatDetail_module_default.messageRowAssistant),
    children: /* @__PURE__ */ jsxDEV3("div", {
      className: ChatDetail_module_default.assistantText,
      children: [
        /* @__PURE__ */ jsxDEV3("div", {
          className: ChatDetail_module_default.messageHeader,
          children: /* @__PURE__ */ jsxDEV3(Bot, {
            size: 14
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV3("div", {
          className: ChatDetail_module_default.markdown,
          children: /* @__PURE__ */ jsxDEV3(Markdown, {
            children: message.content
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
};
var StreamingMessage = ({ content: content3 }) => {
  return /* @__PURE__ */ jsxDEV3("div", {
    className: cn2(ChatDetail_module_default.messageRow, ChatDetail_module_default.messageRowAssistant),
    children: /* @__PURE__ */ jsxDEV3("div", {
      className: ChatDetail_module_default.assistantText,
      children: [
        /* @__PURE__ */ jsxDEV3("div", {
          className: ChatDetail_module_default.messageHeader,
          children: /* @__PURE__ */ jsxDEV3(Bot, {
            size: 14
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV3("div", {
          className: ChatDetail_module_default.markdown,
          children: [
            /* @__PURE__ */ jsxDEV3(Markdown, {
              children: content3
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV3("span", {
              className: ChatDetail_module_default.streamCursor
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
};
var FileLinkMessage = ({ fileId, fileName, fileSize }) => {
  const handleDownload = useCallback(() => {
    downloadRequested({ fileId, fileName });
  }, [fileId, fileName]);
  const formatFileSize = (bytes) => {
    if (!bytes)
      return "";
    if (bytes < 1024)
      return `${bytes} B`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  return /* @__PURE__ */ jsxDEV3("div", {
    className: cn2(ChatDetail_module_default.messageRow, ChatDetail_module_default.messageRowUser),
    children: /* @__PURE__ */ jsxDEV3("div", {
      onClick: handleDownload,
      className: "max-w-[75%] rounded-2xl rounded-tr-sm bg-primary/10 border border-primary/20 px-3 py-2 cursor-pointer hover:bg-primary/20 transition-colors",
      children: /* @__PURE__ */ jsxDEV3("div", {
        className: "flex items-center gap-2",
        children: [
          /* @__PURE__ */ jsxDEV3(FileDown, {
            className: "h-4 w-4 text-primary shrink-0"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3("span", {
            className: "text-sm font-medium truncate",
            children: fileName
          }, undefined, false, undefined, this),
          fileSize && /* @__PURE__ */ jsxDEV3("span", {
            className: "text-xs text-muted-foreground shrink-0",
            children: formatFileSize(fileSize)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
};
var LoadingIndicator = () => {
  return /* @__PURE__ */ jsxDEV3("div", {
    className: cn2(ChatDetail_module_default.messageRow, ChatDetail_module_default.messageRowAssistant),
    children: /* @__PURE__ */ jsxDEV3("div", {
      className: ChatDetail_module_default.assistantText,
      children: [
        /* @__PURE__ */ jsxDEV3("div", {
          className: ChatDetail_module_default.messageHeader,
          children: /* @__PURE__ */ jsxDEV3(Bot, {
            size: 14
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV3("div", {
          className: ChatDetail_module_default.loadingDots,
          children: [
            /* @__PURE__ */ jsxDEV3("div", {
              className: ChatDetail_module_default.loadingDot
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV3("div", {
              className: ChatDetail_module_default.loadingDot
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV3("div", {
              className: ChatDetail_module_default.loadingDot
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
};
var ChatDetail = (props) => {
  const showComposer = props.showComposer ?? true;
  const [inputValue, setInputValue] = useState2("");
  const scrollAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const handleFileChange = useCallback((e) => {
    const files2 = Array.from(e.currentTarget.files ?? []);
    if (files2.length > 0 && props.onFilesSelected) {
      props.onFilesSelected(files2);
    }
    e.currentTarget.value = "";
  }, [props.onFilesSelected]);
  useEffect2(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [props.messages, props.currentResponse]);
  const handleSend = () => {
    if (!inputValue.trim() || props.isLoading)
      return;
    props.send(inputValue.trim());
    setInputValue("");
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  return /* @__PURE__ */ jsxDEV3("div", {
    className: "flex h-full w-full max-w-2xl mx-auto flex-col",
    children: /* @__PURE__ */ jsxDEV3(Card, {
      className: "flex flex-col h-full rounded-none border-none shadow-none",
      children: [
        /* @__PURE__ */ jsxDEV3(CardContent, {
          className: "flex-1 p-0 overflow-hidden",
          children: /* @__PURE__ */ jsxDEV3(ScrollArea, {
            ref: scrollAreaRef,
            className: "h-full w-full",
            children: /* @__PURE__ */ jsxDEV3("div", {
              className: ChatDetail_module_default.chatScroll,
              children: [
                /* @__PURE__ */ jsxDEV3("div", {
                  className: ChatDetail_module_default.chatSpacer
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV3("div", {
                  className: ChatDetail_module_default.chatMessages,
                  children: [
                    props.messages.map((message) => {
                      if (message.fileData) {
                        return /* @__PURE__ */ jsxDEV3(FileLinkMessage, {
                          fileId: message.fileData.fileId,
                          fileName: message.fileData.fileName,
                          fileSize: message.fileData.fileSize,
                          fileType: message.fileData.fileType
                        }, message.id, false, undefined, this);
                      }
                      return /* @__PURE__ */ jsxDEV3(MessageBubble, {
                        message
                      }, message.id, false, undefined, this);
                    }),
                    props.isLoading && props.currentResponse && /* @__PURE__ */ jsxDEV3(StreamingMessage, {
                      content: props.currentResponse
                    }, undefined, false, undefined, this),
                    props.isLoading && !props.currentResponse && /* @__PURE__ */ jsxDEV3(LoadingIndicator, {}, undefined, false, undefined, this)
                  ]
                }, undefined, true, undefined, this)
              ]
            }, undefined, true, undefined, this)
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this),
        showComposer && /* @__PURE__ */ jsxDEV3(CardFooter, {
          className: "p-4 shrink-0 flex-col gap-3",
          children: [
            /* @__PURE__ */ jsxDEV3("input", {
              ref: fileInputRef,
              type: "file",
              multiple: true,
              className: "hidden",
              onChange: handleFileChange
            }, undefined, false, undefined, this),
            props.files && props.files.length > 0 && /* @__PURE__ */ jsxDEV3("div", {
              className: "w-full",
              children: /* @__PURE__ */ jsxDEV3(FileList, {
                items: props.files
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV3("div", {
              className: "flex w-full items-center gap-2",
              children: [
                /* @__PURE__ */ jsxDEV3(Button2, {
                  onClick: handleAttachClick,
                  disabled: props.isLoading,
                  size: "icon",
                  variant: "ghost",
                  "aria-label": "Прикрепить файл",
                  children: /* @__PURE__ */ jsxDEV3(Paperclip, {
                    size: 16
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV3("textarea", {
                  value: inputValue,
                  onChange: (e) => setInputValue(e.target.value),
                  onKeyDown: handleKeyDown,
                  placeholder: "Напишите сообщение...",
                  style: { background: "transparent", border: "none", outline: "none", boxShadow: "none" },
                  className: "flex-1 resize-none p-0 m-0 text-sm",
                  rows: 1,
                  disabled: props.isLoading,
                  "aria-label": "Сообщение"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV3(Button2, {
                  onClick: handleSend,
                  disabled: !inputValue.trim() || props.isLoading,
                  size: "icon",
                  variant: "ghost",
                  "aria-label": "Отправить",
                  children: /* @__PURE__ */ jsxDEV3(Send, {
                    size: 16
                  }, undefined, false, undefined, this)
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
};

// src/views/ChatView.tsx
import { useUnit } from "effector-react";

// ../../../../node_modules/.bun/uuid@11.1.0/node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i2 = 0;i2 < 256; ++i2) {
  byteToHex.push((i2 + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// ../../../../node_modules/.bun/uuid@11.1.0/node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    if (typeof crypto === "undefined" || !crypto.getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
    getRandomValues = crypto.getRandomValues.bind(crypto);
  }
  return getRandomValues(rnds8);
}

// ../../../../node_modules/.bun/uuid@11.1.0/node_modules/uuid/dist/esm-browser/native.js
var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native_default = { randomUUID };

// ../../../../node_modules/.bun/uuid@11.1.0/node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i2 = 0;i2 < 16; ++i2) {
      buf[offset + i2] = rnds[i2];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;
// src/chat-store.ts
import { chatSendRequested, chatInitRequested, registry as registry2 } from "front-core";
var AI_COMMANDS = {
  "requests.show": "Открыть панель заявок",
  "threads.show": "Открыть диалоги/треды",
  "dashboard.mount": "Открыть дашборд",
  "logs.show": "Показать горячие логи",
  "logs.show.cold": "Показать холодные логи",
  "telemetry.show": "Показать горячую телеметрию",
  "telemetry.show.cold": "Показать холодную телеметрию",
  "dumps.list.show": "Показать список дампов",
  "dumps.storages.show": "Показать статистику хранилищ",
  show_workflows_list: "Показать список воркфлоу",
  show_workflows_statistic: "Показать статистику воркфлоу",
  show_nodes_list: "Показать список нод",
  show_providers_list: "Показать список провайдеров",
  show_code_source_list: "Показать список источников кода",
  "chats.show_list": "Показать список чатов",
  "chats.show_contexts_list": "Показать список контекстов",
  "chats.show_commands_list": "Показать список команд"
};
var chatStore = createChatStore(aichatClient2, threadsClient);
var chatThreadId = v4_default();
var isInitialized = false;
var ensureInitialized = () => {
  if (!isInitialized) {
    console.log("[Chat] Initializing chat session on first use");
    chatStore.init(chatThreadId, "openai" /* OPENAI */, "gpt-4o-mini");
    isInitialized = true;
  }
};
chatInitRequested.watch(() => {
  console.log("[Chat] Chat initialization requested via event");
  ensureInitialized();
});
var initializeChat2 = () => {
  ensureInitialized();
};
var weatherTool = {
  name: "weather",
  description: "Get the current weather",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "The city to get the weather for"
      }
    },
    required: ["city"]
  },
  execute: async (args) => {
    const city = args.city;
    return { city, temperature: 29, pressure: 1013, windSpeed: 5 };
  }
};
var getCommandsTool = {
  name: "getCommands",
  description: "Get available UI navigation commands",
  parameters: {
    type: "object",
    properties: {},
    required: []
  },
  execute: async () => {
    return Object.entries(AI_COMMANDS).map(([id, desc]) => ({ id, desc }));
  }
};
var execCommandTool = {
  name: "execCommand",
  description: "Execute UI navigation command by id",
  parameters: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Command id from getCommands"
      }
    },
    required: ["id"]
  },
  execute: async (args) => {
    console.log("[execCommand] Raw args:", args, typeof args);
    let commandId;
    if (typeof args === "string") {
      try {
        const parsed = JSON.parse(args);
        commandId = parsed.id;
      } catch {
        commandId = args;
      }
    } else {
      commandId = args?.id;
    }
    console.log("[execCommand] Parsed commandId:", commandId);
    console.log("[execCommand] Registered commands:", registry2.getAllIds());
    if (!commandId) {
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `⚠️ Не указан id команды`,
        timestamp: Date.now()
      });
      return { ok: false, error: "Command id not provided" };
    }
    if (!AI_COMMANDS[commandId]) {
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `⚠️ Команда \`${commandId}\` недоступна`,
        timestamp: Date.now()
      });
      return { ok: false, error: "Command not allowed" };
    }
    const cmd = registry2.get(commandId);
    if (!cmd) {
      console.log("[execCommand] Command not found in registry:", commandId);
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `⚠️ Команда \`${commandId}\` не зарегистрирована`,
        timestamp: Date.now()
      });
      return { ok: false, error: "Command not registered" };
    }
    try {
      registry2.run(commandId, {});
      addMessage({
        id: `cmd_${Date.now()}`,
        type: "assistant",
        content: `✅ ${AI_COMMANDS[commandId]}`,
        timestamp: Date.now()
      });
      return { ok: true };
    } catch (e) {
      addMessage({
        id: `cmd_err_${Date.now()}`,
        type: "assistant",
        content: `❌ Ошибка: ${AI_COMMANDS[commandId]}`,
        timestamp: Date.now()
      });
      return { ok: false, error: e instanceof Error ? e.message : "Error" };
    }
  }
};
chatStore.registerFunction("weather", weatherTool);
chatStore.registerFunction("getCommands", getCommandsTool);
chatStore.registerFunction("execCommand", execCommandTool);
chatSendRequested.watch((message) => {
  ensureInitialized();
  chatStore.send(message);
});
uploadCompleted.watch((fileId) => {
  const fileState = $files.getState().get(fileId);
  if (!fileState)
    return;
  const chatMessage = {
    id: `file_${fileId}`,
    type: "user",
    content: `Файл загружен: ${fileState.fileName}`,
    timestamp: Date.now(),
    fileData: {
      fileId,
      fileName: fileState.fileName,
      fileSize: fileState.fileSize,
      fileType: fileState.fileType
    }
  };
  addMessage(chatMessage);
  threadsClient.saveMessage({
    threadId: chatThreadId,
    user: "user",
    type: "link" /* link */,
    data: JSON.stringify({
      fileId,
      fileName: fileState.fileName,
      fileSize: fileState.fileSize,
      fileType: fileState.fileType
    })
  });
});

// src/views/ChatView.tsx
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
var ChatView = () => {
  const { messages, isLoading, currentResponse } = useUnit(chatStore.$chat);
  useEffect3(() => {
    console.log("[ChatView] Mounted - initializing chat immediately");
    initializeChat2();
    console.log("[ChatView] State:", { messages: messages.length, isLoading, hasResponse: !!currentResponse });
    return () => {
      console.log("[ChatView] Unmounted");
    };
  }, []);
  useEffect3(() => {
    console.log("[ChatView] State updated:", { messages: messages.length, isLoading, hasResponse: !!currentResponse });
  }, [messages, isLoading, currentResponse]);
  console.log("[ChatView] Rendering with", messages.length, "messages");
  return /* @__PURE__ */ jsxDEV4(ChatDetail, {
    messages,
    isLoading,
    currentResponse,
    send: chatStore.send,
    showComposer: false
  }, undefined, false, undefined, this);
};

// src/views/ChatsListView.tsx
import { useEffect as useEffect4 } from "react";
import { useUnit as useUnit2 } from "effector-react";
import { HeaderPanel, InfiniteScrollDataTable } from "front-core";
import { Plus, RefreshCw } from "lucide-react";

// src/domain-chats.ts
import { createDomain as createDomain4, sample as sample8 } from "effector";
import { createInfiniteTableStore } from "front-core";
var domain3 = createDomain4("aichats-list");
var chatsListViewMounted = domain3.createEvent("CHATS_LIST_VIEW_MOUNTED");
var refreshChatsClicked = domain3.createEvent("REFRESH_CHATS_CLICKED");
var addChatClicked = domain3.createEvent("ADD_CHAT_CLICKED");
var openChatDetail = domain3.createEvent("OPEN_CHAT_DETAIL");
var listChatsFx = domain3.createEffect({
  name: "LIST_CHATS",
  handler: async (params) => {
    return await aichatClient2.listOfChats(params);
  }
});
var $chatsStore = createInfiniteTableStore(domain3, listChatsFx);
sample8({
  clock: chatsListViewMounted,
  filter: () => {
    const state = $chatsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $chatsStore.loadMore
});
sample8({
  clock: refreshChatsClicked,
  fn: () => ({}),
  target: $chatsStore.reset
});
sample8({
  clock: refreshChatsClicked,
  fn: () => ({}),
  target: $chatsStore.loadMore
});

// src/config.ts
import { COLUMN_TYPES } from "front-core";
var chatsColumns = [
  { id: "id", title: "ID", type: COLUMN_TYPES.TEXT, width: 300, primary: true },
  { id: "description", title: "Описание", type: COLUMN_TYPES.TEXT, width: 150 }
];
var contextsColumns = [
  { id: "id", title: "ID", type: COLUMN_TYPES.TEXT, width: 280, primary: true },
  { id: "chatId", title: "Chat ID", type: COLUMN_TYPES.TEXT, width: 240 },
  { id: "updatedAt", title: "Updated", type: COLUMN_TYPES.TEXT, width: 180 },
  { id: "size", title: "Size", type: COLUMN_TYPES.TEXT, width: 100 }
];

// src/views/ChatsListView.tsx
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
var ChatsListView = ({ bus }) => {
  const chatsState = useUnit2($chatsStore.$state);
  useEffect4(() => {
    chatsListViewMounted();
  }, []);
  const headerConfig = {
    title: "Chats List",
    actions: [
      {
        id: "add",
        label: "New Chat",
        icon: Plus,
        event: addChatClicked,
        variant: "default"
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshChatsClicked,
        variant: "outline"
      }
    ]
  };
  const handleRowClick = (row) => {
    const recordId = row.id;
    openChatDetail({ recordId });
    bus.present({ widget: createChatDetailWidget(bus, { recordId }), params: { recordId } });
  };
  return /* @__PURE__ */ jsxDEV5("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV5(HeaderPanel, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV5("div", {
        className: "flex-1 overflow-hidden p-4",
        children: /* @__PURE__ */ jsxDEV5(InfiniteScrollDataTable, {
          data: chatsState.items,
          hasMore: chatsState.hasMore,
          loading: chatsState.loading,
          columns: chatsColumns,
          onRowClick: handleRowClick,
          onLoadMore: $chatsStore.loadMore,
          viewMode: "table"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/views/ContextsListView.tsx
import { useEffect as useEffect5, useState as useState3 } from "react";
import { useUnit as useUnit3 } from "effector-react";
import { HeaderPanel as HeaderPanel2, InfiniteScrollDataTable as InfiniteScrollDataTable2 } from "front-core";
import { RefreshCw as RefreshCw2 } from "lucide-react";

// src/domain-contexts.ts
import { createDomain as createDomain5, sample as sample9 } from "effector";
import { createInfiniteTableStore as createInfiniteTableStore2 } from "front-core";
var domain4 = createDomain5("aichats-contexts");
var contextsViewMounted = domain4.createEvent("CONTEXTS_VIEW_MOUNTED");
var refreshContextsClicked = domain4.createEvent("REFRESH_CONTEXTS_CLICKED");
var listContextsFx = domain4.createEffect({
  name: "LIST_CONTEXTS",
  handler: async (params) => {
    return await aichatClient2.listContexts(params);
  }
});
var $contextsStore = createInfiniteTableStore2(domain4, listContextsFx);
sample9({
  clock: contextsViewMounted,
  filter: () => {
    const state = $contextsStore.$state.getState();
    return !state.isInitialized && !state.loading;
  },
  fn: () => ({}),
  target: $contextsStore.loadMore
});
sample9({
  clock: refreshContextsClicked,
  fn: () => ({}),
  target: $contextsStore.reset
});
sample9({
  clock: refreshContextsClicked,
  fn: () => ({}),
  target: $contextsStore.loadMore
});

// src/views/ContextsListView.tsx
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
var ContextsListView = ({ bus: _bus }) => {
  const contextsState = useUnit3($contextsStore.$state);
  const [selectedContext, setSelectedContext] = useState3(null);
  const [contextLoading, setContextLoading] = useState3(false);
  const [contextError, setContextError] = useState3(null);
  useEffect5(() => {
    contextsViewMounted();
  }, []);
  const headerConfig = {
    title: "Contexts",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw2,
        event: refreshContextsClicked,
        variant: "outline"
      }
    ]
  };
  const items = (contextsState.items || []).map((item) => ({
    ...item,
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "-",
    size: item.size ?? "-"
  }));
  const handleRowClick = async (row) => {
    const chatId = row.chatId || row.id;
    if (!chatId)
      return;
    setContextLoading(true);
    setContextError(null);
    try {
      const context = await aichatClient2.getContext(chatId);
      setSelectedContext(context);
    } catch (error) {
      setContextError(error?.message || "Failed to load context");
      setSelectedContext(null);
    } finally {
      setContextLoading(false);
    }
  };
  return /* @__PURE__ */ jsxDEV6("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV6(HeaderPanel2, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "flex-1 overflow-hidden p-4",
        children: /* @__PURE__ */ jsxDEV6(InfiniteScrollDataTable2, {
          data: items,
          hasMore: contextsState.hasMore,
          loading: contextsState.loading,
          columns: contextsColumns,
          onLoadMore: $contextsStore.loadMore,
          onRowClick: handleRowClick,
          viewMode: "table"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6("div", {
        className: "border-t bg-muted/30 p-4",
        children: [
          /* @__PURE__ */ jsxDEV6("div", {
            className: "text-sm font-semibold",
            children: "Context JSON"
          }, undefined, false, undefined, this),
          contextLoading && /* @__PURE__ */ jsxDEV6("div", {
            className: "mt-2 text-sm text-muted-foreground",
            children: "Loading..."
          }, undefined, false, undefined, this),
          !contextLoading && contextError && /* @__PURE__ */ jsxDEV6("div", {
            className: "mt-2 text-sm text-destructive",
            children: contextError
          }, undefined, false, undefined, this),
          !contextLoading && !contextError && selectedContext && /* @__PURE__ */ jsxDEV6("pre", {
            className: "mt-2 max-h-56 overflow-auto rounded-md bg-background p-3 text-xs",
            children: JSON.stringify(selectedContext.data, null, 2)
          }, undefined, false, undefined, this),
          !contextLoading && !contextError && !selectedContext && /* @__PURE__ */ jsxDEV6("div", {
            className: "mt-2 text-sm text-muted-foreground",
            children: "Select a row to view the context."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/views/CommandsListView.tsx
import { useState as useState4 } from "react";
import { useUnit as useUnit4 } from "effector-react";
import { HeaderPanel as HeaderPanel3 } from "front-core";
import { RefreshCw as RefreshCw3, Play as Play2, Search } from "lucide-react";

// src/domain-commands.ts
import { createDomain as createDomain6, sample as sample10 } from "effector";
import { $registeredCommands, registry as registry3, runActionEvent } from "front-core";
var domain5 = createDomain6("commands");
var commandsViewMounted = domain5.createEvent("COMMANDS_VIEW_MOUNTED");
var refreshCommandsClicked = domain5.createEvent("REFRESH_COMMANDS_CLICKED");
var executeCommandClicked = domain5.createEvent("EXECUTE_COMMAND_CLICKED");
var $commandsFilter = domain5.createStore("", { name: "COMMANDS_FILTER" });
var setCommandsFilter = domain5.createEvent("SET_COMMANDS_FILTER");
$commandsFilter.on(setCommandsFilter, (_, filter) => filter);
var $filteredCommands = $registeredCommands.map((commands) => commands);
var executeCommandFx = domain5.createEffect({
  name: "EXECUTE_COMMAND",
  handler: ({ commandId, params }) => {
    console.log("[Commands] Executing command:", commandId, params);
    runActionEvent({ actionId: commandId, params: params || {} });
  }
});
sample10({
  clock: executeCommandClicked,
  target: executeCommandFx
});

// src/views/CommandsListView.tsx
import { jsxDEV as jsxDEV7 } from "react/jsx-dev-runtime";
var CommandsListView = ({ bus: _bus }) => {
  const commands = useUnit4($registeredCommands);
  const filter = useUnit4($commandsFilter);
  const [selectedCommand, setSelectedCommand] = useState4(null);
  const filteredCommands = commands.filter((cmd) => cmd.id.toLowerCase().includes(filter.toLowerCase()) || cmd.description.toLowerCase().includes(filter.toLowerCase()));
  const handleExecute = (commandId) => {
    executeCommandClicked({ commandId });
  };
  const headerConfig = {
    title: "Commands",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw3,
        event: refreshCommandsClicked,
        variant: "outline"
      }
    ]
  };
  return /* @__PURE__ */ jsxDEV7("div", {
    className: "flex flex-col h-full",
    children: [
      /* @__PURE__ */ jsxDEV7(HeaderPanel3, {
        config: headerConfig
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: "p-4 border-b",
        children: /* @__PURE__ */ jsxDEV7("div", {
          className: "relative",
          children: [
            /* @__PURE__ */ jsxDEV7(Search, {
              className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV7("input", {
              type: "text",
              placeholder: "Search commands...",
              value: filter,
              onChange: (e) => setCommandsFilter(e.target.value),
              className: "w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: "flex-1 overflow-auto p-4",
        children: [
          /* @__PURE__ */ jsxDEV7("div", {
            className: "text-sm text-muted-foreground mb-4",
            children: [
              filteredCommands.length,
              " commands available"
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: "space-y-2",
            children: filteredCommands.map((command) => /* @__PURE__ */ jsxDEV7("div", {
              className: `p-3 border rounded-lg cursor-pointer transition-colors ${selectedCommand === command.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50"}`,
              onClick: () => setSelectedCommand(command.id),
              children: /* @__PURE__ */ jsxDEV7("div", {
                className: "flex items-center justify-between",
                children: [
                  /* @__PURE__ */ jsxDEV7("div", {
                    className: "flex-1",
                    children: [
                      /* @__PURE__ */ jsxDEV7("div", {
                        className: "font-mono text-sm font-medium",
                        children: command.id
                      }, undefined, false, undefined, this),
                      /* @__PURE__ */ jsxDEV7("div", {
                        className: "text-sm text-muted-foreground mt-1",
                        children: command.description
                      }, undefined, false, undefined, this)
                    ]
                  }, undefined, true, undefined, this),
                  /* @__PURE__ */ jsxDEV7("button", {
                    onClick: (e) => {
                      e.stopPropagation();
                      handleExecute(command.id);
                    },
                    className: "ml-4 p-2 rounded-md hover:bg-primary/20 text-primary",
                    title: "Execute command",
                    children: /* @__PURE__ */ jsxDEV7(Play2, {
                      className: "h-4 w-4"
                    }, undefined, false, undefined, this)
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            }, command.id, false, undefined, this))
          }, undefined, false, undefined, this),
          filteredCommands.length === 0 && /* @__PURE__ */ jsxDEV7("div", {
            className: "text-center text-muted-foreground py-8",
            children: "No commands found"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: "border-t bg-muted/30 p-4",
        children: [
          /* @__PURE__ */ jsxDEV7("div", {
            className: "text-sm font-semibold mb-2",
            children: "AI Function Interface"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("pre", {
            className: "text-xs bg-background p-3 rounded-md overflow-auto max-h-40",
            children: `executeCommand({
  commandId: "${selectedCommand || "command.id"}"
})`
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: "text-xs text-muted-foreground mt-2",
            children: "Use this function from AI chat to execute UI commands"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
};

// src/functions.ts
var SHOW_CHATS_LIST = "chats.show_list";
var SHOW_CONTEXTS_LIST = "chats.show_contexts_list";
var SHOW_COMMANDS_LIST = "chats.show_commands_list";
var SHOW_CHAT = "chats.show";
var VIEW_CHAT = "chats.view";
var EDIT_CHAT = "chats.edit";
var DELETE_CHAT = "chats.delete";
var deleteChatFx = domain_default.createEffect({
  name: "DELETE_CHAT",
  handler: ({ recordId }) => aichatClient2.deleteChat(recordId)
});
var getChatFx = domain_default.createEffect({
  name: "GET_CHAT",
  handler: (recordId) => {
    console.log("GET_CHAT", recordId);
    return aichatClient2.getChat(recordId);
  }
});
var deleteChatEvent = domain_default.createEvent("DELETE_CHAT_EVENT");
var editChatEvent = domain_default.createEvent("EDIT_CHAT_EVENT");
sample11({ clock: openChatDetail, target: getChatFx });
sample11({ clock: deleteChatEvent, target: deleteChatFx });
var createChatsListWidget = (bus) => ({
  view: ChatsListView,
  placement: () => "center",
  config: {
    bus
  }
});
var createContextsListWidget = (bus) => ({
  view: ContextsListView,
  placement: () => "center",
  config: {
    bus
  }
});
var createCommandsListWidget = (bus) => ({
  view: CommandsListView,
  placement: () => "center",
  config: {
    bus
  }
});
var createChatWidget = (bus) => ({
  view: ChatView,
  placement: () => "sidebar:right",
  config: {},
  commands: {}
});
var createChatDetailWidget = (bus, params) => ({
  view: ChatView,
  placement: () => "sidebar:right",
  config: {},
  commands: {}
});
var createShowChatAction = (bus) => ({
  id: SHOW_CHAT,
  description: "Show chat widget",
  invoke: () => {
    console.log("[createShowChatAction] Presenting chat widget to sidebar:right");
    const widget = createChatWidget(bus);
    console.log("[createShowChatAction] Widget config:", widget);
    bus.present({ widget });
  }
});
var createShowChatsListAction = (bus) => ({
  id: SHOW_CHATS_LIST,
  description: "Show chats list",
  invoke: () => {
    bus.present({ widget: createChatsListWidget(bus) });
  }
});
var createShowContextsListAction = (bus) => ({
  id: SHOW_CONTEXTS_LIST,
  description: "Show contexts list",
  invoke: () => {
    bus.present({ widget: createContextsListWidget(bus) });
  }
});
var createShowCommandsListAction = (bus) => ({
  id: SHOW_COMMANDS_LIST,
  description: "Show available commands list",
  invoke: () => {
    bus.present({ widget: createCommandsListWidget(bus) });
  }
});
var createViewChatAction = (bus) => ({
  id: VIEW_CHAT,
  description: "View chat details",
  invoke: ({ recordId }) => {
    openChatDetail({ recordId });
    bus.present({ widget: createChatDetailWidget(bus, { recordId }), params: { recordId } });
  }
});
var createEditChatAction = () => ({
  id: EDIT_CHAT,
  description: "Edit chat",
  invoke: ({ recordId }) => {
    editChatEvent({ recordId });
  }
});
var createDeleteChatAction = () => ({
  id: DELETE_CHAT,
  description: "Delete chat",
  invoke: ({ recordId }) => {
    deleteChatEvent({ recordId });
  }
});
var ACTIONS = [
  createShowChatAction,
  createShowChatsListAction,
  createShowContextsListAction,
  createShowCommandsListAction,
  createViewChatAction,
  createEditChatAction,
  createDeleteChatAction
];
var functions_default = ACTIONS;

// src/menu.ts
var MENU = {
  title: "menu.chats",
  iconName: "IconAi",
  items: [
    {
      title: "menu.text",
      key: "text",
      action: SHOW_CHATS_LIST
    },
    {
      title: "menu.audio",
      key: "audio",
      action: SHOW_CHATS_LIST
    },
    {
      title: "menu.contexts",
      key: "contexts",
      action: SHOW_CONTEXTS_LIST
    },
    {
      title: "menu.commands",
      key: "commands",
      action: SHOW_COMMANDS_LIST
    }
  ]
};
// src/index.ts
import { BasePlugin, LocaleController } from "front-core";
var ID = "aichats-mf";
LocaleController.getInstance().setLocales(ID, {
  en: new URL("../locales/en.json", import.meta.url).toString(),
  ru: new URL("../locales/ru.json", import.meta.url).toString()
});
var src_default = new BasePlugin(ID, functions_default);
export {
  initializeChat2 as initializeChat,
  src_default as default,
  chatStore,
  MENU,
  ID,
  ChatView,
  ChatDetail
};
