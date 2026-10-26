// Laboratoire · DOM simulé minimal pour les essais (aucun navigateur). Toute écriture de innerHTML / outerHTML / insertAdjacentHTML lève une erreur
// et est comptée : un essai qui voit `compteurHTML.n > 0` échoue. Copie de l'outil de labo/essais-composants.mjs, partagée par les essais du lot 4.
export const compteurHTML = { n: 0 };
class Noeud {
  constructor(type) { this.nodeType = type; this.childNodes = []; this.parentNode = null; }
  get textContent() { return this.nodeType === 3 ? this._t : this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { if (this.nodeType === 3) this._t = String(v); else { this.childNodes.forEach((c) => (c.parentNode = null)); this.childNodes = []; if (v !== "" && v != null) this.append(new Texte(String(v))); } }
  append(...k) { for (const c of k) { const n = typeof c === "string" ? new Texte(c) : c; if (n.parentNode) n.remove(); n.parentNode = this; this.childNodes.push(n); } }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; } }
}
export class Texte extends Noeud { constructor(t) { super(3); this._t = t; } }
export class Elem extends Noeud {
  constructor(tag, ns) { super(1); this.localName = tag; this.tagName = tag.toUpperCase(); this.namespaceURI = ns || "http://www.w3.org/1999/xhtml"; this._a = new Map(); this._ev = {}; this.value = ""; this.disabled = false; }
  setAttribute(k, v) { this._a.set(k, String(v)); if (k === "value") this.value = String(v); }
  getAttribute(k) { return this._a.has(k) ? this._a.get(k) : null; }
  hasAttribute(k) { return this._a.has(k); }
  removeAttribute(k) { this._a.delete(k); }
  get attributes() { return [...this._a].map(([name, value]) => ({ name, value })); }
  get className() { return this.getAttribute("class") || ""; } set className(v) { this.setAttribute("class", v); }
  get children() { return this.childNodes.filter((c) => c.nodeType === 1); }
  addEventListener(t, f) { (this._ev[t] ||= []).push(f); }
  dispatch(t, ev = {}) { const e = { type: t, isTrusted: false, preventDefault() {}, currentTarget: this, target: this, ...ev }; (this._ev[t] || []).forEach((f) => f(e)); return e; }
  click() { this.dispatch("click"); }
  closest() { return null; }
  get innerHTML() { return ""; } set innerHTML(v) { compteurHTML.n++; throw new Error("innerHTML interdit"); }
  set outerHTML(v) { compteurHTML.n++; throw new Error("outerHTML interdit"); }
  insertAdjacentHTML() { compteurHTML.n++; throw new Error("insertAdjacentHTML interdit"); }
  tous(pred, out = []) { for (const c of this.children) { if (pred(c)) out.push(c); c.tous(pred, out); } return out; }
  parTag(t) { return this.tous((e) => e.localName === t); }
  parClasse(k) { return this.tous((e) => (" " + e.className + " ").includes(" " + k + " ")); }
  un(t) { return this.parTag(t)[0]; }
  /** Simule le choix d'une valeur dans une liste déroulante puis l'événement « change ». */
  choisir(v) { this.value = String(v); this.dispatch("change"); }
}
export function installer() {
  globalThis.document = { createElement: (t) => new Elem(t), createElementNS: (ns, t) => new Elem(t, ns), createTextNode: (t) => new Texte(t), body: new Elem("body") };
  return globalThis.document;
}
