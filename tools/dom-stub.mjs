/**
 * 零浏览器验收台:最小 DOM 桩 + DSH 0.2.0-rc.2 客户端模块系统桩。
 *
 * 用途:让「lib/client.js 能不能在桌面端(内嵌 DSH 0.2.0-rc.2)的 Web 客户端里
 * 正常装入并引导桌宠」变成可 `node --test` 直跑的断言,不启动任何浏览器、
 * 不起本地服务器、不联网、不引入 jsdom(本仓库无 node_modules)。
 *
 * 桩里被刻意复刻的宿主契约(来源:_reference/desktop-0.2.0-rc.2/):
 *
 * 1. queue facade —— `dsh-client-modules/lib/index.js:453-475` 注入到 <head> 的
 *    内联脚本:`window.__ModuleLoader__ = { mode:"queue", pendingQueue, load(reg),
 *    create(options) }`。执行插件 bundle 只是 `load()` 入队,**零副作用**;
 *    副作用必须发生在 factory 物化期(惰性 CJS 模型,见该文件 16-31 行注释)。
 * 2. live 模块系统 —— `dsh-client-modules/lib/client.js:506-715`:
 *    `register()` 拒绝同一 id 二次注册(未 invalidate 时)、`materialize()` 记忆化
 *    在 loadCache、`require(spec)` 解析顺序 = platform seed → 已物化 → 已注册
 *    factory → 抛出。factory 返回的 exports 就是插件的 `{ apply, inject }`。
 * 3. slots 服务 —— `dsh-client-ui-renderer/lib/client.js:1343` 提供
 *    `slots.inject(key, callback)`:key 已声明时同步执行 callback,否则挂起到该 slot
 *    被声明;`dsh-client-ui-slots/lib/index.js:163` 的 `register(options, component)`
 *    在 slot 未声明时**抛出**、list slot 缺 `id` 时抛出、`children` 表即声明子 slot。
 * 4. 资源路由 —— 插件只能通过宿主路由 `/api/dsh-whale-musume/assets?f=<path>` 取
 *    资源(f 映射到仓库 assets/<path>);任何绝对 http(s) 请求都会被记录为外部请求。
 *
 * 明确不做的事:不解析 HTML、不真正渲染、不加载图片、不跑真定时器。所有
 * setTimeout/setInterval/requestAnimationFrame 都是虚拟队列,必须显式 flush,
 * 这样测试既不会挂住 node --test,也不会产生无法回收的异步副作用。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** 宿主资源路由(与 lib/client.js 的 BASE 常量同源)。 */
export const HOST_ROUTE = "/api/dsh-whale-musume/assets";
export const HOST_QUERY = "?f=";
/** 合成来源:.invalid 是保留 TLD,永不可解析 —— 桩里也从不发起真实网络请求。 */
export const HOST_ORIGIN = "http://dsh-desktop-host.invalid";

const PLUGIN_ID = "dsh-whale-musume";

/** 读仓库内文件(UTF-8)。 */
export function readRepoFile(relative) {
  return fs.readFileSync(path.join(REPO_ROOT, relative), "utf8");
}

/** 把跨 realm 的对象转成本 realm 的纯数据,便于 deepStrictEqual 比较原型。 */
export function plain(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

/* ------------------------------------------------------------------ *
 * DOM 桩
 * ------------------------------------------------------------------ */

class StubEvent {
  constructor(type, init = {}) {
    this.type = String(type);
    this.detail = init.detail;
    this.bubbles = Boolean(init.bubbles);
    this.cancelable = Boolean(init.cancelable);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this._stopped = false;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopPropagation() {
    this._stopped = true;
  }
  stopImmediatePropagation() {
    this._stopped = true;
  }
}

class EventTargetStub {
  constructor() {
    this._listeners = new Map();
  }
  addEventListener(type, listener, options) {
    if (typeof listener !== "function") return;
    const key = String(type);
    const list = this._listeners.get(key) ?? [];
    list.push({ listener, once: Boolean(options && options.once) });
    this._listeners.set(key, list);
  }
  removeEventListener(type, listener) {
    const key = String(type);
    const list = this._listeners.get(key);
    if (list === undefined) return;
    this._listeners.set(
      key,
      list.filter((entry) => entry.listener !== listener)
    );
  }
  dispatchEvent(event) {
    const payload = event instanceof StubEvent ? event : new StubEvent(event && event.type ? event.type : "event", event ?? {});
    payload.target = this;
    payload.currentTarget = this;
    const list = [...(this._listeners.get(payload.type) ?? [])];
    for (const entry of list) {
      if (entry.once) this.removeEventListener(payload.type, entry.listener);
      entry.listener.call(this, payload);
    }
    return !payload.defaultPrevented;
  }
  listenerCount(type) {
    return (this._listeners.get(String(type)) ?? []).length;
  }
}

class StyleDeclarationStub {
  constructor() {
    this._props = new Map();
  }
  setProperty(name, value) {
    this._props.set(String(name), String(value));
  }
  getPropertyValue(name) {
    return this._props.get(String(name)) ?? "";
  }
  removeProperty(name) {
    const value = this.getPropertyValue(name);
    this._props.delete(String(name));
    return value;
  }
}

class ClassListStub {
  constructor(element) {
    this._element = element;
  }
  _tokens() {
    return (this._element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
  }
  _write(tokens) {
    this._element.setAttribute("class", tokens.join(" "));
  }
  add(...tokens) {
    const current = new Set(this._tokens());
    for (const token of tokens) current.add(String(token));
    this._write([...current]);
  }
  remove(...tokens) {
    const drop = new Set(tokens.map(String));
    this._write(this._tokens().filter((token) => !drop.has(token)));
  }
  contains(token) {
    return this._tokens().includes(String(token));
  }
  toggle(token, force) {
    const has = this.contains(token);
    const next = force === undefined ? !has : Boolean(force);
    if (next) this.add(token);
    else this.remove(token);
    return next;
  }
}

class ElementStub extends EventTargetStub {
  constructor(tagName, ownerDocument = null) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.childNodes = [];
    this.parentNode = null;
    this.style = new StyleDeclarationStub();
    this.classList = new ClassListStub(this);
    this.dataset = {};
    this._text = undefined;
    this._innerHTML = "";
    this._value = "";
    this.disabled = false;
    this.hidden = false;
  }
  get children() {
    return this.childNodes.filter((node) => node instanceof ElementStub);
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }
  get textContent() {
    if (this._text !== undefined) return this._text;
    return this.childNodes.map((node) => (node && typeof node.textContent === "string" ? node.textContent : "")).join("");
  }
  set textContent(value) {
    this._text = String(value);
    this.childNodes = [];
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(value) {
    this._innerHTML = String(value);
    this._text = undefined;
    this.childNodes = [];
  }
  get value() {
    return this._value;
  }
  set value(next) {
    this._value = String(next);
  }
  appendChild(node) {
    if (!node) throw new Error("appendChild(null)");
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    if (node.ownerDocument === null || node.ownerDocument === undefined) node.ownerDocument = this.ownerDocument;
    this.childNodes.push(node);
    return node;
  }
  insertBefore(node, reference) {
    if (!reference) return this.appendChild(node);
    const index = this.childNodes.indexOf(reference);
    if (index === -1) return this.appendChild(node);
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.splice(index, 0, node);
    return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index !== -1) {
      this.childNodes.splice(index, 1);
      node.parentNode = null;
    }
    return node;
  }
  replaceChild(next, previous) {
    const index = this.childNodes.indexOf(previous);
    if (index === -1) return previous;
    next.parentNode = this;
    previous.parentNode = null;
    this.childNodes[index] = next;
    return previous;
  }
  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
  cloneNode(deep = false) {
    const copy = new ElementStub(this.tagName, this.ownerDocument);
    for (const [name, value] of this.attributes) copy.setAttribute(name, value);
    copy._text = this._text;
    if (deep) for (const child of this.childNodes) copy.appendChild(child.cloneNode(true));
    return copy;
  }
  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
    if (String(name) === "data-dsh-whale-musume") this._marker = String(value);
  }
  getAttribute(name) {
    const key = String(name);
    return this.attributes.has(key) ? this.attributes.get(key) : null;
  }
  hasAttribute(name) {
    return this.attributes.has(String(name));
  }
  removeAttribute(name) {
    this.attributes.delete(String(name));
  }
  contains(node) {
    if (node === this) return true;
    return this.childNodes.some((child) => child instanceof ElementStub && child.contains(node));
  }
  matches(selector) {
    return matchesSelector(this, selector);
  }
  closest(selector) {
    let node = this;
    while (node instanceof ElementStub) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentNode;
    }
    return null;
  }
  querySelector(selector) {
    return queryTree(this, selector, true)[0] ?? null;
  }
  querySelectorAll(selector) {
    return queryTree(this, selector, true);
  }
  getElementsByTagName(tagName) {
    return queryTree(this, String(tagName), true);
  }
  getBoundingClientRect() {
    // 默认 0×0:presenter 的 isVisible() 会因此判为不可见(与真实空白 DOM 一致)。
    // 需要「可见节点」的断言用 harness.markVisible(el) 显式给尺寸。
    const rect = this._harnessRect;
    if (rect === undefined) return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const left = rect.left ?? 0;
    const top = rect.top ?? 0;
    return { x: left, y: top, top, left, right: left + rect.width, bottom: top + rect.height, width: rect.width, height: rect.height };
  }
  getContext(kind) {
    if (this._context === undefined) {
      const noop = () => {};
      this._context = {
        kind,
        canvas: this,
        clearRect: noop,
        fillRect: noop,
        strokeRect: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        arc: noop,
        fill: noop,
        stroke: noop,
        save: noop,
        restore: noop,
        translate: noop,
        scale: noop,
        rotate: noop,
        setTransform: noop,
        drawImage: noop,
        fillText: noop,
        createRadialGradient: () => ({ addColorStop: noop }),
        createLinearGradient: () => ({ addColorStop: noop }),
        getImageData: () => ({ data: new Uint8ClampedArray(0), width: 0, height: 0 }),
        putImageData: noop,
      };
    }
    return this._context;
  }
  focus() {}
  blur() {}
  click() {
    this.dispatchEvent(new StubEvent("click", { bubbles: true, cancelable: true }));
  }
  scrollIntoView() {}
  animate() {
    return { cancel() {}, finished: Promise.resolve() };
  }
}

/**
 * 解析一条简单选择器：tag / #id / 任意多个 [attr] / [attr="v"]。
 * 必须支持复合属性（如 `[data-tool][data-state="running"]`）——0.2.0-rc.2 的
 * 工具卡契约正是靠「同一元素上同时满足两个属性」来表达忙碌状态；只按子串匹配
 * 会让 `[data-tool]` 单独命中历史卡片，把回归断言变成假绿。
 */
function parseSimpleSelector(selector) {
  const source = String(selector).trim();
  if (source === "") return null;
  const head = /^([a-zA-Z][\w-]*)?(?:#([\w-]+))?/.exec(source);
  let rest = source.slice(head[0].length);
  const tag = head[1] ?? null;
  const id = head[2] ?? null;
  const attrs = [];
  while (rest.length > 0) {
    const m = /^\[([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\]"']*)))?\]/.exec(rest);
    if (m === null) return null;
    attrs.push({ name: m[1], value: m[2] ?? m[3] ?? m[4] ?? null });
    rest = rest.slice(m[0].length);
  }
  if (!tag && !id && attrs.length === 0) return null;
  return { tag: tag ? tag.toUpperCase() : null, id: id ?? null, attrs };
}

function matchesSelector(element, selector) {
  if (!(element instanceof ElementStub)) return false;
  for (const part of String(selector).split(",")) {
    const parsed = parseSimpleSelector(part);
    if (parsed === null) continue;
    if (parsed.tag !== null && element.tagName !== parsed.tag) continue;
    if (parsed.id !== null && element.getAttribute("id") !== parsed.id) continue;
    let ok = true;
    for (const attr of parsed.attrs) {
      if (!element.hasAttribute(attr.name)) {
        ok = false;
        break;
      }
      if (attr.value !== null && element.getAttribute(attr.name) !== attr.value) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    return true;
  }
  return false;
}

function queryTree(root, selector, skipRoot) {
  const found = [];
  const visit = (node) => {
    if (matchesSelector(node, selector)) found.push(node);
    for (const child of node.childNodes) if (child instanceof ElementStub) visit(child);
  };
  if (skipRoot) {
    // ElementStub.querySelector 语义:只搜后代,不含自身。
    for (const child of root.childNodes) if (child instanceof ElementStub) visit(child);
  } else {
    // document 语义:含 documentElement 自身。
    visit(root);
  }
  return found;
}

class MutationObserverStub {
  constructor(callback) {
    this._callback = callback;
    this._targets = [];
  }
  observe(target, options) {
    this._targets.push({ target, options });
  }
  disconnect() {
    this._targets = [];
  }
  takeRecords() {
    return [];
  }
}

class ImageStub extends EventTargetStub {
  constructor(width, height) {
    super();
    this.width = width ?? 0;
    this.height = height ?? 0;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.complete = false;
    this.crossOrigin = null;
    this.decoding = "auto";
    this._src = "";
  }
  get src() {
    return this._src;
  }
  set src(value) {
    this._src = String(value);
    // 桩里永远不真正加载图片,也就不触发 load/error。
  }
  decode() {
    return Promise.resolve();
  }
}

class ResizeObserverStub {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  constructor(callback) {
    this._callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function createDocumentStub() {
  const documentElement = new ElementStub("html");
  const head = new ElementStub("head");
  const body = new ElementStub("body");
  const document = new EventTargetStub();
  Object.assign(document, {
    nodeType: 9,
    documentElement,
    head,
    body,
    readyState: "complete",
    hidden: false,
    visibilityState: "visible",
    title: "",
    cookie: "",
    defaultView: null,
    createElement: (tagName) => new ElementStub(tagName, document),
    createElementNS: (_namespace, tagName) => new ElementStub(tagName, document),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null }),
    createDocumentFragment: () => new ElementStub("#fragment", document),
    getElementById: (id) => queryTree(documentElement, `#${id}`, false)[0] ?? null,
    querySelector: (selector) => queryTree(documentElement, selector, false)[0] ?? null,
    querySelectorAll: (selector) => queryTree(documentElement, selector, false),
    getElementsByTagName: (tagName) => queryTree(documentElement, String(tagName), false),
    getElementsByClassName: () => [],
    elementFromPoint: () => null,
    hasFocus: () => true,
    execCommand: () => false,
  });
  documentElement.ownerDocument = document;
  head.ownerDocument = document;
  body.ownerDocument = document;
  documentElement.appendChild(head);
  documentElement.appendChild(body);
  return document;
}

function createStorageStub() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(String(key)) ? map.get(String(key)) : null),
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: (key) => map.delete(String(key)),
    clear: () => map.clear(),
    _map: map,
  };
}

/* ------------------------------------------------------------------ *
 * 宿主模块系统桩
 * ------------------------------------------------------------------ */

/**
 * 复刻 0.2.0-rc.2 注入 <head> 的 queue facade
 * (_reference/.../dsh-client-modules/lib/index.js:453-475)。
 * 执行 bundle 只是入队;`create()` 由 live 模块系统接管。
 */
export function installBootFacade(target) {
  const pendingQueue = [];
  target.__ModuleLoader__ = {
    mode: "queue",
    pendingQueue,
    load(registration) {
      pendingQueue.push(registration);
    },
    create() {
      throw new Error(`client-modules: ${PLUGIN_ID} bootstrap module did not supply ClientModuleSystem`);
    },
  };
  return target.__ModuleLoader__;
}

/**
 * 复刻 ClientModuleSystem 的注册/物化/require 语义
 * (_reference/.../dsh-client-modules/lib/client.js:506-715)。
 * @param facade - installBootFacade() 装上的 facade。
 * @param options.seeds - platform seed 表,例如 react / react/jsx-runtime。
 */
export function createClientModuleSystem(facade, options = {}) {
  const seeds = new Map(Object.entries(options.seeds ?? {}));
  const factories = new Map();
  const loadCache = new Map();
  const materializing = new Set();
  const generations = new Map();
  const factoryRuns = [];

  const register = (registration) => {
    if (!registration || typeof registration.id !== "string" || typeof registration.factory !== "function") {
      throw new Error("client-modules: bundle registered a malformed { id, factory } row");
    }
    const id = registration.id;
    if (factories.has(id) || loadCache.has(id)) {
      throw new Error(`client-modules: duplicate factory registration for "${id}" (bundle executed twice without invalidate?)`);
    }
    factories.set(id, registration.factory);
  };

  const materialize = (id, ownerId = id) => {
    const existing = loadCache.get(id);
    if (existing !== undefined) return existing;
    const factory = factories.get(id);
    if (factory === undefined) throw new Error(`client-modules: no registered factory for "${id}"`);
    if (materializing.has(id)) throw new Error(`client-modules: require cycle through "${id}" (factory-form CJS cannot deliver partial exports)`);
    materializing.add(id);
    try {
      const require = (spec) => {
        if (seeds.has(spec)) return seeds.get(spec);
        const record = loadCache.get(spec);
        if (record !== undefined) return record.exports;
        if (factories.has(spec)) return materialize(spec, ownerId).exports;
        throw new Error(`client-modules: require("${spec}") missed the module table — not a platform seed word, not a materialized module, and no registered package factory`);
      };
      require.async = async (spec) => require(spec);
      factoryRuns.push({ id, owner: ownerId });
      const record = { id, exports: factory(require), edges: new Set(), styles: [] };
      loadCache.set(id, record);
      return record;
    } finally {
      materializing.delete(id);
    }
  };

  const invalidate = (id) => {
    factories.delete(id);
    loadCache.delete(id);
    for (const key of [...loadCache.keys()]) if (key.startsWith(`${id}/client.`)) loadCache.delete(key);
    generations.set(id, (generations.get(id) ?? 0) + 1);
  };

  const system = {
    version: "client",
    mirrors: "dsh-client-modules 0.2.0-rc.2 ClientModuleSystem",
    factories,
    loadCache,
    seeds,
    factoryRuns,
    register,
    materialize,
    invalidate,
    require: (spec) => {
      if (seeds.has(spec)) return seeds.get(spec);
      const record = loadCache.get(spec);
      if (record !== undefined) return record.exports;
      if (factories.has(spec)) return materialize(spec).exports;
      throw new Error(`client-modules: cannot resolve "${spec}"`);
    },
    import: async (spec) => materialize(spec).exports,
    hasFactory: (id) => factories.has(id),
    isMaterialized: (id) => loadCache.has(id),
  };

  // 真实系统构造时把同一 facade 切成 live 注册模式(_reference 同文件 559-567 行)。
  const pending = facade.pendingQueue.splice(0);
  facade.mode = "live";
  facade.load = (registration) => register(registration);
  facade.create = () => {
    throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot");
  };
  for (const registration of pending) register(registration);
  system.pendingQueue = facade.pendingQueue;
  return system;
}

/**
 * 复刻 cordis fiber 的插件物化语义:materialize 后对 exports 调 apply(ctx)。
 * 兼容 `exports.apply`(本轮 client.js 形态)与 `exports.default.apply`。
 */
export function applyPlugin(system, id, ctx) {
  const record = system.materialize(id);
  const exported = record.exports;
  const target = exported && typeof exported === "object" && exported.default ? exported.default : exported;
  const apply = typeof exported === "function" ? exported : target.apply;
  if (typeof apply !== "function") throw new Error(`client-modules: module "${id}" exported no apply()`);
  const inject = (target && target.inject) ?? [];
  return { result: apply(ctx, undefined), inject, exports: exported };
}

/* ------------------------------------------------------------------ *
 * slots 服务桩
 * ------------------------------------------------------------------ */

/**
 * 复刻 0.2.0-rc.2 的 slots 服务:
 * - register(options, component):未声明 slot → 抛错;list 缺 id → 抛错;
 *   children 表即声明子 slot(_reference/.../dsh-client-ui-slots/lib/index.js:163-219)。
 * - inject(key, callback):已声明 → 同步执行;未声明 → 挂起,声明后补跑
 *   (_reference/.../dsh-client-ui-renderer/lib/client.js:1343-1389)。
 */
export function createSlotsService(options = {}) {
  const declared = new Map();
  const entries = [];
  const pendingInjects = new Map();

  const flush = () => {
    let progressed = true;
    while (progressed) {
      progressed = false;
      // 每次都重新取键:回调内部可能再次声明子 slot 并触发重入 flush。
      for (const key of [...pendingInjects.keys()]) {
        if (!declared.has(key)) continue;
        const callbacks = pendingInjects.get(key);
        if (callbacks === undefined || callbacks.length === 0) continue;
        pendingInjects.delete(key); // 先摘除,重入时不会二次执行同一回调
        progressed = true;
        for (const callback of callbacks) callback();
      }
    }
  };

  const declare = (name, spec) => {
    if (declared.has(name)) throw new Error(`slot "${name}" is already declared`);
    declared.set(name, spec ?? { kind: "single", scope: "root" });
    flush();
    return () => declared.delete(name);
  };

  // 宿主外壳先声明 settings.section(ui-settings 领域基座),插件才能注册进去。
  for (const [name, spec] of Object.entries(options.declared ?? {})) declared.set(name, spec);

  const register = (options_ = {}, component) => {
    const name = options_.name;
    const spec = declared.get(name);
    if (spec === undefined) throw new Error(`slot "${name}" is not declared (a parent entry's children table must declare it)`);
    const priority = options_.priority ?? 0;
    const occupantFor = (test) => entries.find((entry) => entry.name === name && (entry.options.priority ?? 0) === priority && test(entry));
    if (spec.kind === "list" && options_.id === undefined) throw new Error(`list slot "${name}" requires options.id`);
    if (spec.kind === "keyed" && options_.key === undefined) throw new Error(`keyed slot "${name}" requires options.key`);
    if (spec.kind === "single" && occupantFor(() => true)) throw new Error(`single slot "${name}" already has a registration at priority ${priority}`);
    if (spec.kind === "list" && occupantFor((entry) => entry.options.id === options_.id)) {
      throw new Error(`list slot "${name}" already has an entry with id "${options_.id}" at priority ${priority}`);
    }
    if (spec.kind === "keyed" && occupantFor((entry) => entry.options.key === options_.key)) {
      throw new Error(`keyed slot "${name}" already has an entry for key "${options_.key}" at priority ${priority}`);
    }
    if (options_.children) {
      for (const childKey of Object.keys(options_.children)) {
        if (declared.has(childKey)) throw new Error(`slot "${childKey}" is already declared`);
      }
      for (const [childKey, childSpec] of Object.entries(options_.children)) declared.set(childKey, childSpec);
    }
    const entry = {
      name,
      options: { ...options_ },
      component,
      children: options_.children ? Object.keys(options_.children) : [],
      live: true,
    };
    entries.push(entry);
    flush();
    return () => {
      const index = entries.indexOf(entry);
      if (index !== -1) entries.splice(index, 1);
      entry.live = false;
      for (const childKey of entry.children) declared.delete(childKey);
    };
  };

  const inject = (key, callback) => {
    if (declared.has(key)) {
      const dispose = callback();
      return typeof dispose === "function" ? dispose : () => {};
    }
    const callbacks = pendingInjects.get(key) ?? [];
    callbacks.push(callback);
    pendingInjects.set(key, callbacks);
    return () => {
      const list = pendingInjects.get(key);
      if (list === undefined) return;
      const index = list.indexOf(callback);
      if (index !== -1) list.splice(index, 1);
    };
  };

  return {
    register,
    inject,
    declare,
    spec: (key) => declared.get(key),
    entries: (key) => (key === undefined ? [...entries] : entries.filter((entry) => entry.name === key)),
    pendingInjectKeys: () => [...pendingInjects.keys()],
    declaredKeys: () => [...declared.keys()],
    subscribe: () => () => {},
    subscribeDeclaration: () => () => {},
    onMutate: () => () => {},
    snapshot: () => [...entries],
  };
}

/** 复刻 cordis Context 的服务读取面:`ctx.get(name)` 与 `ctx.<service>`。 */
export function createPluginContext(services = {}) {
  const ctx = {
    get(name) {
      return Object.prototype.hasOwnProperty.call(services, name) ? services[name] : undefined;
    },
    has: (name) => Object.prototype.hasOwnProperty.call(services, name),
    effect(callback) {
      const dispose = callback();
      return typeof dispose === "function" ? dispose : () => {};
    },
    on: () => () => {},
    once: () => () => {},
    emit: () => {},
    inject: () => {},
    set: () => {},
  };
  for (const [name, service] of Object.entries(services)) {
    if (name in ctx) continue;
    Object.defineProperty(ctx, name, { get: () => service, enumerable: true, configurable: true });
  }
  return ctx;
}

/* ------------------------------------------------------------------ *
 * React 种子(仅够物化 + 单趟渲染,不做调度)
 * ------------------------------------------------------------------ */

export function createReactSeed() {
  const state = { current: null, cursor: 0, hooks: new WeakMap(), effects: new WeakSet(), effectsRun: 0, cleaners: [] };

  const owner = () => {
    if (state.current === null) throw new Error("react stub: hook called outside renderComponent()");
    return state.current;
  };
  const slotFor = (index) => {
    const key = owner();
    let list = state.hooks.get(key);
    if (list === undefined) {
      list = [];
      state.hooks.set(key, list);
    }
    return { list, index };
  };

  const React = {
    __isReactStub: true,
    version: "18.0.0-stub",
    Fragment: Symbol.for("react.fragment"),
    useState(initial) {
      const { list, index } = slotFor(state.cursor);
      state.cursor += 1;
      if (!(index in list)) list[index] = typeof initial === "function" ? initial() : initial;
      const setState = (next) => {
        list[index] = typeof next === "function" ? next(list[index]) : next;
      };
      return [list[index], setState];
    },
    useReducer(reducer, initial) {
      const { list, index } = slotFor(state.cursor);
      state.cursor += 1;
      if (!(index in list)) list[index] = initial;
      const dispatch = (action) => {
        list[index] = reducer(list[index], action);
      };
      return [list[index], dispatch];
    },
    useEffect(callback) {
      const key = owner();
      state.cursor += 1;
      if (state.effects.has(key)) return undefined;
      state.effects.add(key);
      state.effectsRun += 1;
      const dispose = callback();
      if (typeof dispose === "function") state.cleaners.push(dispose);
      return undefined;
    },
    useLayoutEffect(callback) {
      return React.useEffect(callback);
    },
    useMemo(factory) {
      const { list, index } = slotFor(state.cursor);
      state.cursor += 1;
      if (!(index in list)) list[index] = factory();
      return list[index];
    },
    useCallback(callback) {
      return React.useMemo(() => callback);
    },
    useRef(initial) {
      const { list, index } = slotFor(state.cursor);
      state.cursor += 1;
      if (!(index in list)) list[index] = { current: initial };
      return list[index];
    },
    createElement(type, props, ...children) {
      return { $$typeof: Symbol.for("react.element"), type, props: { ...(props ?? {}), children: children.length > 1 ? children : children[0] } };
    },
  };

  const jsx = (type, props) => ({ $$typeof: Symbol.for("react.element"), type, props: props ?? {} });
  const jsxs = jsx;
  const jsxRuntime = { jsx, jsxs, jsxDEV: jsx, Fragment: React.Fragment };

  const seed = {
    React,
    jsxRuntime,
    stats: state,
    /** 单趟渲染一个函数组件,钩子游标按组件重置。 */
    renderComponent(component, props = {}) {
      state.current = component;
      state.cursor = 0;
      try {
        return component(props);
      } finally {
        state.current = null;
        state.cursor = 0;
      }
    },
  };
  return seed;
}

/**
 * 把 jsx 元素树物化成可检查的纯骨架(只认 host tag 与函数组件)。
 * 不做 diff/调度,只证明组件树能真正被求值出来。
 */
export function renderElementTree(root, seed, options = {}) {
  const maxNodes = options.maxNodes ?? 5000;
  const maxDepth = options.maxDepth ?? 80;
  let nodes = 0;
  const render = (node, depth) => {
    if (node === null || node === undefined || typeof node === "boolean") return null;
    if (typeof node === "string" || typeof node === "number") return node;
    if (Array.isArray(node)) return node.map((item) => render(item, depth));
    if (depth > maxDepth) throw new Error(`react stub: element tree deeper than ${maxDepth}`);
    nodes += 1;
    if (nodes > maxNodes) throw new Error(`react stub: element tree exceeded ${maxNodes} nodes`);
    const type = node.type;
    const props = node.props ?? {};
    if (typeof type === "function") {
      const produced = seed.renderComponent(type, { ...props, children: render(props.children, depth + 1) });
      return render(produced, depth + 1);
    }
    return { type: typeof type === "string" ? type : String(type), props: { ...props, children: render(props.children, depth + 1) } };
  };
  return render(root, 0);
}

/** 在骨架树里按 host tag 数量统计。 */
export function countTags(tree, tagName) {
  let count = 0;
  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object" || typeof node.type !== "string") return;
    if (node.type.toUpperCase() === String(tagName).toUpperCase()) count += 1;
    walk(node.props.children);
  };
  walk(tree);
  return count;
}

/* ------------------------------------------------------------------ *
 * 整台验收环境
 * ------------------------------------------------------------------ */

/**
 * 宿主资源路由桩:`/api/dsh-whale-musume/assets?f=<path>` → <repo>/assets/<path>。
 * 绝对 http(s) 请求不会被服务,而是记为 external(用于「无外部请求」断言)。
 * 单独导出,便于测试对桩本身做自检(证明该断言真的有牙齿)。
 */
export function createAssetRouteFetch(options = {}) {
  const assetsRoot = options.assetsRoot ?? path.join(REPO_ROOT, "assets");
  const calls = [];

  const makeResponse = (body, status, ok) => ({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: { get: () => null },
    text: async () => body,
    json: async () => JSON.parse(body),
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  });

  const fetch = (url) => {
    const target = String(url);
    const entry = { url: target, f: null, external: false, served: false, status: 0 };
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target) || target.startsWith("//")) {
      entry.external = true;
      calls.push(entry);
      return Promise.resolve(makeResponse("", 0, false));
    }
    if (!target.startsWith(HOST_ROUTE)) {
      entry.status = 404;
      calls.push(entry);
      return Promise.resolve(makeResponse("", 404, false));
    }
    const query = target.slice(HOST_ROUTE.length);
    const relative = query.startsWith(HOST_QUERY) ? decodeURIComponent(query.slice(HOST_QUERY.length)) : "";
    entry.f = relative;
    if (!relative || relative.includes("..") || path.isAbsolute(relative)) {
      entry.status = 400;
      calls.push(entry);
      return Promise.resolve(makeResponse("", 400, false));
    }
    const file = path.join(assetsRoot, relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      entry.status = 404;
      calls.push(entry);
      return Promise.resolve(makeResponse("", 404, false));
    }
    entry.served = true;
    entry.status = 200;
    calls.push(entry);
    return Promise.resolve(makeResponse(fs.readFileSync(file, "utf8"), 200, true));
  };

  return {
    assetsRoot,
    fetch,
    calls,
    externalFetches: () => calls.filter((call) => call.external),
    missingAssets: () => calls.filter((call) => call.status === 404 && !call.external),
  };
}

/**
 * 建一个隔离的「桌面端 Web 客户端」环境(vm realm + DOM 桩 + 宿主模块系统)。
 * @param options.services - 注入 ctx 的服务表(例如 { slots });显式传入即代表宿主服务表就是这样。
 * @param options.declaredSlots - 宿主外壳已声明的 slot 表。
 * @param options.fetchImpl - 覆盖默认的宿主路由 fetch 桩(自定义实现只负责返回响应,记账仍由桩完成)。
 * @param options.assetsRoot - 资源根,默认 <repo>/assets。
 */
export function createClientHostHarness(options = {}) {
  const route = createAssetRouteFetch({ assetsRoot: options.assetsRoot });
  const fetchCalls = route.calls;
  const document = createDocumentStub();
  const localStorage = createStorageStub();
  const consoleLogs = [];
  const timers = new Map();
  const rafQueue = [];
  let timerSeq = 1;

  // services 传入即代表「宿主服务表就是这样」:不含 slots 时 = 服务缺失(用于负例断言)。
  const slots = options.services !== undefined
    ? (options.services.slots ?? null)
    : createSlotsService({ declared: options.declaredSlots });
  const services = options.services !== undefined ? { ...options.services } : { slots };
  const reactSeed = options.reactSeed ?? createReactSeed();

  const sandbox = {};
  const context = vm.createContext(sandbox, { name: "dsh-desktop-client-harness" });

  const log = (level, args) => {
    consoleLogs.push({ level, args: args.map((value) => (typeof value === "string" ? value : String(value && value.message ? value.message : value))) });
  };

  // 自定义 fetchImpl 只负责产出响应;请求记账(含越界判定)仍由桩统一完成。
  const fetchStub = options.fetchImpl === undefined
    ? route.fetch
    : (url, init) => {
        const target = String(url);
        route.calls.push({
          url: target,
          f: null,
          external: /^[a-z][a-z0-9+.-]*:\/\//i.test(target) || target.startsWith("//"),
          served: true,
          status: 0,
          custom: true,
        });
        return options.fetchImpl(target, init);
      };

  const windowEventTarget = new EventTargetStub();
  const matchMediaStub = (query) => ({
    matches: Boolean(options.matchMedia && options.matchMedia(query)),
    media: String(query),
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return true;
    },
  });

  const globals = {
    document,
    localStorage,
    sessionStorage: createStorageStub(),
    fetch: (url, init) => fetchStub(url, init),
    console: {
      log: (...args) => log("log", args),
      warn: (...args) => log("warn", args),
      error: (...args) => log("error", args),
      info: (...args) => log("info", args),
      debug: (...args) => log("debug", args),
    },
    Event: StubEvent,
    CustomEvent: StubEvent,
    MutationObserver: MutationObserverStub,
    ResizeObserver: ResizeObserverStub,
    IntersectionObserver: IntersectionObserverStub,
    Image: ImageStub,
    matchMedia: matchMediaStub,
    getComputedStyle: () => ({ getPropertyValue: () => "", fontSize: "16px", lineHeight: "normal" }),
    requestAnimationFrame: (callback) => {
      rafQueue.push(callback);
      return rafQueue.length;
    },
    cancelAnimationFrame: (id) => {
      if (id > 0) rafQueue[id - 1] = null;
    },
    setTimeout: (callback, ms) => {
      const id = timerSeq++;
      timers.set(id, { callback, ms, kind: "timeout" });
      return id;
    },
    setInterval: (callback, ms) => {
      const id = timerSeq++;
      timers.set(id, { callback, ms, kind: "interval" });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    queueMicrotask: (callback) => queueMicrotask(callback),
    navigator: {
      userAgent: "DSH-Desktop-Harness/0.2.0-rc.2 (electron; no browser launched)",
      language: "zh-CN",
      languages: ["zh-CN", "en"],
      platform: "Win32",
      onLine: true,
      hardwareConcurrency: 8,
      clipboard: { writeText: async () => {} },
    },
    location: {
      href: `${HOST_ORIGIN}/`,
      origin: HOST_ORIGIN,
      protocol: "http:",
      host: "dsh-desktop-host.invalid",
      hostname: "dsh-desktop-host.invalid",
      port: "",
      pathname: "/",
      search: "",
      hash: "",
      reload() {},
      assign() {},
      replace() {},
    },
    screen: { width: 1440, height: 900, availWidth: 1440, availHeight: 900, colorDepth: 24 },
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    crypto: { randomUUID: () => `stub-${Math.random().toString(16).slice(2)}`, getRandomValues: (array) => array },
    TextEncoder,
    TextDecoder,
    structuredClone,
    addEventListener: (type, listener, opts) => windowEventTarget.addEventListener(type, listener, opts),
    removeEventListener: (type, listener) => windowEventTarget.removeEventListener(type, listener),
    dispatchEvent: (event) => windowEventTarget.dispatchEvent(event),
    innerWidth: options.innerWidth ?? 1440,
    innerHeight: options.innerHeight ?? 900,
    devicePixelRatio: options.devicePixelRatio ?? 1,
    scrollX: 0,
    scrollY: 0,
    scrollTo() {},
    getSelection: () => null,
    __dshHarness: true,
  };

  for (const [name, value] of Object.entries(globals)) sandbox[name] = value;
  vm.runInContext("globalThis.window = globalThis; globalThis.self = globalThis; globalThis.document.defaultView = globalThis;", context);

  const facade = installBootFacade(sandbox);
  // live 模块系统按需构造:复刻真实启动顺序里「facade 先入队 → client-modules
  // bootstrap 执行 __ModuleLoader__.create() → 切成 live 注册」的时序,这样
  // queue-first / live-first 两种顺序都能被断言覆盖。
  let moduleSystem = null;
  const ensureModuleSystem = () => {
    if (moduleSystem === null) {
      moduleSystem = createClientModuleSystem(facade, {
        seeds: {
          react: reactSeed.React,
          "react/jsx-runtime": reactSeed.jsxRuntime,
          ...(options.seeds ?? {}),
        },
      });
    }
    return moduleSystem;
  };

  const env = {
    context,
    sandbox,
    facade,
    document,
    localStorage,
    window: sandbox,
    slots,
    services,
    reactSeed,
    fetchCalls,
    consoleLogs,
    /** 由 client-modules bootstrap 触发:把 queue facade 切成 live 注册。 */
    createModuleSystem: () => ensureModuleSystem(),
    isLive: () => facade.mode === "live",
    get moduleSystem() {
      return ensureModuleSystem();
    },
    /** 执行一段 classic script(等价于宿主 <script src> 到达并执行 bundle)。 */
    runScript(source, { filename = "client.js" } = {}) {
      return vm.runInContext(source, context, { filename });
    },
    /** 执行插件 bundle:只应发生 facade.load() 入队。 */
    loadBundle(source, { filename = "lib/client.js" } = {}) {
      return env.runScript(source, { filename });
    },
    /** 让桩节点对 presenter 的 isVisible() 判定为可见(默认 0×0 即不可见)。 */
    markVisible(element, rect = { width: 640, height: 480, left: 0, top: 0 }) {
      element._harnessRect = { width: rect.width, height: rect.height, left: rect.left ?? 0, top: rect.top ?? 0 };
      return element;
    },
    /** 把注入的 core/presenter 两段脚本真的执行起来(等价于浏览器执行 <script> 文本)。 */
    runInjectedScripts({ presenterFilename = "assets/dsh-whale-moe.js" } = {}) {
      const injected = env.scripts();
      if (injected.length < 2) throw new Error(`runInjectedScripts: 期望已注入 2 段脚本,实际 ${injected.length}`);
      env.runScript(injected[0].textContent, { filename: "assets/whale-moe-core.js" });
      env.runScript(injected[1].textContent, { filename: presenterFilename });
      env.flushAnimationFrames(2);
      return env;
    },
    materialize(id = PLUGIN_ID) {
      return env.moduleSystem.materialize(id);
    },
    apply(id = PLUGIN_ID, ctx = null) {
      const pluginCtx = ctx ?? createPluginContext(services);
      const applied = applyPlugin(env.moduleSystem, id, pluginCtx);
      return { ...applied, ctx: pluginCtx };
    },
    /** 等 microtask 排空(boot 内部是一串 await)。 */
    async idle(rounds = 2) {
      for (let index = 0; index < rounds; index += 1) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      return env;
    },
    /** 排空虚拟 rAF 队列。 */
    flushAnimationFrames(rounds = 1) {
      let ran = 0;
      for (let round = 0; round < rounds; round += 1) {
        const queued = rafQueue.splice(0);
        for (const callback of queued) {
          if (callback) {
            callback({ now: 0 });
            ran += 1;
          }
        }
      }
      return ran;
    },
    /** 跑一遍虚拟定时器(单次,不做无限循环)。 */
    runTimers(limit = 64) {
      let ran = 0;
      while (timers.size > 0 && ran < limit) {
        const [id, timer] = timers.entries().next().value;
        if (timer.kind === "timeout") timers.delete(id);
        timer.callback();
        ran += 1;
      }
      return ran;
    },
    pendingTimers: () => timers.size,
    /** 清空虚拟定时器队列(用于让「下一个注册的定时器」可被确定性识别)。 */
    clearTimers() {
      timers.clear();
      return env;
    },
    queuedAnimationFrames: () => rafQueue.filter(Boolean).length,
    windowsListeners: (type) => windowEventTarget.listenerCount(type),
    dispatchWindowEvent(type, init) {
      return windowEventTarget.dispatchEvent(new StubEvent(type, init));
    },
    /** 注入的 <style> 元素。 */
    styles() {
      return document.head.children.filter((element) => element.tagName === "STYLE");
    },
    /** 注入的 <script> 元素。 */
    scripts() {
      return document.body.children.filter((element) => element.tagName === "SCRIPT");
    },
    warnings: () => consoleLogs.filter((entry) => entry.level === "warn"),
    errors: () => consoleLogs.filter((entry) => entry.level === "error"),
    externalFetches: () => fetchCalls.filter((call) => call.external),
    missingAssets: () => fetchCalls.filter((call) => call.status === 404 && !call.external),
    plugin: {
      id: PLUGIN_ID,
      bootFlag: "__dshWhaleMusumeBooted",
    },
  };
  return env;
}

export { PLUGIN_ID };
