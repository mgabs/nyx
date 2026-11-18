import {injectProxy} from '../../../src/inject/dynamic-theme/stylesheet-proxy';

class TestDeclaration {
    parentRule: TestRule | null = null;
    color = '';
    #values = new Map<string, string>();
    getPropertyValue(name: string) {
        if (!(this instanceof TestDeclaration)) {
            throw new TypeError('Invalid declaration receiver');
        }
        return this.#values.get(name) ?? '';
    }
    setProperty(name: string, value: string) {
        if (!(this instanceof TestDeclaration)) {
            throw new TypeError('Invalid declaration receiver');
        }
        this.#values.set(name, value);
    }
    removeProperty(name: string) {
        const previous = this.getPropertyValue(name);
        this.#values.delete(name);
        return previous;
    }
}

Object.defineProperty(TestDeclaration.prototype, 'fixedMethod', {value: () => 'fixed', configurable: false});
Object.defineProperty(TestDeclaration.prototype, 'testValue', {get: () => 42, configurable: true});

class TestRule {
    parentStyleSheet: TestSheet | null = null;
    declaration = new TestDeclaration();
    constructor() {
        this.declaration.parentRule = this;
    }
    get style() {
        return this.declaration;
    }
}

class TestSheet {
    cssRules: TestRule[] = [];
    ownerNode: TestElement | null = null;
    addRule() {
        return -1;
    }
    insertRule() {
        return 0;
    }
    deleteRule() {}
    removeRule() {}
    replace() {
        return Promise.resolve(this);
    }
    replaceSync() {}
}

class TestGroup {
    parentStyleSheet: TestSheet | null = null;
    rules = ['a'];
    insertRule(_rule: string, index = 0) {
        return index;
    }
    deleteRule(index: number) {
        this.rules.splice(index, 1);
    }
}

class TestNode extends EventTarget {}
class TestElement extends TestNode {
    isConnected = true;
    classList = {contains: () => false};
    attachShadow() {
        return new TestShadowRoot();
    }
}
class TestRoot extends TestNode {
    isConnected = true;
    private sheets: TestSheet[] = [];
    get adoptedStyleSheets() {
        return this.sheets;
    }
    set adoptedStyleSheets(value: TestSheet[]) {
        this.sheets = value;
    }
}
class TestDocument extends TestRoot {
    get adoptedStyleSheets() {
        return super.adoptedStyleSheets;
    }
    set adoptedStyleSheets(value: TestSheet[]) {
        super.adoptedStyleSheets = value;
    }
}
class TestShadowRoot extends TestRoot {
    get adoptedStyleSheets() {
        return super.adoptedStyleSheets;
    }
    set adoptedStyleSheets(value: TestSheet[]) {
        super.adoptedStyleSheets = value;
    }
}

const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
let documentRoot: TestDocument;

beforeEach(() => {
    documentRoot = new TestDocument();
    const globals = {
        document: documentRoot,
        window: {},
        location: {hostname: 'example.test'},
        CSSStyleDeclaration: TestDeclaration,
        CSSStyleRule: TestRule,
        CSSStyleSheet: TestSheet,
        CSSGroupingRule: TestGroup,
        Element: TestElement,
        Node: TestNode,
        Document: TestDocument,
        ShadowRoot: TestShadowRoot,
    };
    for (const [key, value] of Object.entries(globals)) {
        originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {value, configurable: true, writable: true});
    }
});

afterEach(() => {
    documentRoot.dispatchEvent(new CustomEvent('__nyx__cleanUp'));
    for (const [key, descriptor] of originalGlobals) {
        if (descriptor) {
            Object.defineProperty(globalThis, key, descriptor);
        } else {
            Reflect.deleteProperty(globalThis, key);
        }
    }
    originalGlobals.clear();
});

function pageSheet() {
    const rule = new TestRule();
    const sheet = new TestSheet();
    const owner = new TestElement();
    sheet.ownerNode = owner;
    sheet.cssRules = [rule];
    rule.parentStyleSheet = sheet;
    return {rule, sheet, owner};
}

describe('Lean-only declaration proxy', () => {
    test('keeps declaration identity, native method receivers and change events', () => {
        const {rule, owner} = pageSheet();
        const changed = jest.fn();
        owner.addEventListener('__nyx__updateSheet', changed);
        const originalGetter = Object.getOwnPropertyDescriptor(TestRule.prototype, 'style')!.get;
        const originalMethod = TestDeclaration.prototype.getPropertyValue;
        injectProxy(false, false, true);
        const wrapped = rule.style;
        expect(wrapped).not.toBe(rule.declaration);
        expect(rule.style).toBe(wrapped);
        expect(wrapped instanceof TestDeclaration).toBe(true);
        expect(TestDeclaration.prototype.constructor).toBe(TestDeclaration);
        expect(Reflect.get(wrapped, 'testValue')).toBe(42);
        expect(wrapped.color).toBe('');
        expect(wrapped.getPropertyValue).toBe(wrapped.getPropertyValue);
        wrapped.setProperty('color', 'red');
        expect(wrapped.getPropertyValue('color')).toBe('red');
        const detachedMethod = wrapped.getPropertyValue;
        expect(detachedMethod('color')).toBe('red');
        expect(TestDeclaration.prototype.getPropertyValue.call(wrapped, 'color')).toBe('red');
        changed.mockClear();
        wrapped.color = 'blue';
        expect(changed).toHaveBeenCalledTimes(1);
        wrapped.color = 'blue';
        expect(changed).toHaveBeenCalledTimes(1);
        expect(wrapped.removeProperty('color')).toBe('red');
        expect(changed).toHaveBeenCalledTimes(2);
        documentRoot.dispatchEvent(new CustomEvent('__nyx__cleanUp'));
        expect(Object.getOwnPropertyDescriptor(TestRule.prototype, 'style')!.get).toBe(originalGetter);
        expect(TestDeclaration.prototype.getPropertyValue).toBe(originalMethod);
        expect(rule.style).toBe(rule.declaration);
    });

    test('rebinds methods that change and safely handles declarations without a parent rule', () => {
        const {rule, owner} = pageSheet();
        const changed = jest.fn();
        owner.addEventListener('__nyx__updateSheet', changed);
        injectProxy(false, false, true);
        const wrapped = rule.style;
        const previousMethod = wrapped.getPropertyValue;
        const replacement = jest.fn(() => 'replacement');
        TestDeclaration.prototype.getPropertyValue = replacement;
        expect(wrapped.getPropertyValue).not.toBe(previousMethod);
        expect(wrapped.getPropertyValue('color')).toBe('replacement');
        rule.declaration.parentRule = null;
        expect(() => {
            wrapped.color = 'red';
        }).not.toThrow();
        expect(changed).not.toHaveBeenCalled();
        Object.defineProperty(rule.declaration, 'readOnly', {value: 1, writable: false, configurable: false});
        expect(Reflect.set(wrapped, 'readOnly', 2)).toBe(false);
    });

    test('registers pre-existing adopted sheets for document and shadow roots', () => {
        const {rule, sheet} = pageSheet();
        sheet.ownerNode = null;
        const shadow = new TestShadowRoot();
        documentRoot.adoptedStyleSheets = [sheet];
        shadow.adoptedStyleSheets = [sheet];
        const documentChanged = jest.fn();
        const shadowChanged = jest.fn();
        documentRoot.addEventListener('__nyx__adoptedStyleSheetChange', documentChanged);
        shadow.addEventListener('__nyx__adoptedStyleSheetChange', shadowChanged);
        injectProxy(false, false, true);
        class RegisterEvent extends Event {
            constructor(private targetRoot: TestRoot) {
                super('__nyx__registerAdoptedRoot');
            }
            composedPath() {
                return [this.targetRoot] as unknown as EventTarget[];
            }
        }
        documentRoot.dispatchEvent(new RegisterEvent(documentRoot));
        documentRoot.dispatchEvent(new RegisterEvent(shadow));
        rule.style.color = 'red';
        expect(documentChanged).toHaveBeenCalledTimes(1);
        expect(shadowChanged).toHaveBeenCalledTimes(1);
    });

    test('ignores registration events from non-root targets', () => {
        const target = new TestElement();
        const changed = jest.fn();
        target.addEventListener('__nyx__adoptedStyleSheetsChange', changed);
        injectProxy(false, false, true);
        class RegisterEvent extends Event {
            composedPath() {
                return [target] as unknown as EventTarget[];
            }
        }
        documentRoot.dispatchEvent(new RegisterEvent('__nyx__registerAdoptedRoot'));
        expect(changed).not.toHaveBeenCalled();
    });

    test('notifies each root adopting a shared stylesheet', () => {
        const {rule, sheet} = pageSheet();
        sheet.ownerNode = null;
        const shadow = new TestShadowRoot();
        const documentChanged = jest.fn();
        const shadowChanged = jest.fn();
        documentRoot.addEventListener('__nyx__adoptedStyleSheetChange', documentChanged);
        shadow.addEventListener('__nyx__adoptedStyleSheetChange', shadowChanged);
        injectProxy(false, false, true);
        documentRoot.adoptedStyleSheets = [sheet];
        shadow.adoptedStyleSheets = [sheet];
        documentChanged.mockClear();
        shadowChanged.mockClear();
        rule.style.color = 'red';
        expect(documentChanged).toHaveBeenCalledTimes(1);
        expect(shadowChanged).toHaveBeenCalledTimes(1);
        shadow.isConnected = false;
        rule.style.color = 'blue';
        expect(documentChanged).toHaveBeenCalledTimes(2);
        expect(shadowChanged).toHaveBeenCalledTimes(1);
    });

    test('keeps declaration support when grouping rules are unavailable', () => {
        Object.defineProperty(globalThis, 'CSSGroupingRule', {value: undefined, configurable: true, writable: true});
        expect(() => injectProxy(false, false, true)).not.toThrow();
        const {rule} = pageSheet();
        expect(rule.style).not.toBe(rule.declaration);
    });

    test('notifies on nested rule edits and restores grouping methods on cleanup', () => {
        const {sheet, owner} = pageSheet();
        const group = new TestGroup();
        group.parentStyleSheet = sheet;
        const changed = jest.fn();
        owner.addEventListener('__nyx__updateSheet', changed);
        const insert = TestGroup.prototype.insertRule;
        const remove = TestGroup.prototype.deleteRule;
        injectProxy(false, false, true);
        expect(group.insertRule('a {}', 2)).toBe(2);
        group.deleteRule(0);
        expect(group.rules).toEqual([]);
        expect(changed).toHaveBeenCalledTimes(2);
        group.parentStyleSheet = null;
        group.insertRule('a {}');
        group.deleteRule(0);
        expect(group.rules).toEqual([]);
        expect(changed).toHaveBeenCalledTimes(2);
        documentRoot.dispatchEvent(new CustomEvent('__nyx__cleanUp'));
        expect(TestGroup.prototype.insertRule).toBe(insert);
        expect(TestGroup.prototype.deleteRule).toBe(remove);
    });

    test('leaves declaration getters and ordinary native methods unchanged for Dynamic', () => {
        const {rule} = pageSheet();
        const getter = Object.getOwnPropertyDescriptor(TestRule.prototype, 'style')!.get;
        const method = TestDeclaration.prototype.getPropertyValue;
        const groupMethod = TestGroup.prototype.insertRule;
        injectProxy(false, false);
        expect(Object.getOwnPropertyDescriptor(TestRule.prototype, 'style')!.get).toBe(getter);
        expect(TestDeclaration.prototype.getPropertyValue).toBe(method);
        expect(TestGroup.prototype.insertRule).toBe(groupMethod);
        expect(rule.style).toBe(rule.declaration);
    });
});
