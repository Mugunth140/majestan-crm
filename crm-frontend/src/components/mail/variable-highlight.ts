import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function decorate(doc: PmNode, blockKeys: Set<string>, knownKeys: Set<string> | null) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(TOKEN)) {
      const key = match[1];
      const from = pos + (match.index ?? 0);
      const cls = knownKeys && !knownKeys.has(key) ? "email-var email-var-unknown" : blockKeys.has(key) ? "email-var email-var-block" : "email-var";
      decorations.push(Decoration.inline(from, from + match[0].length, { class: cls }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

export interface VariableKeys {
  blockKeys: string[];
  knownKeys: string[];
}

const VARIABLES_CHANGED = "variableHighlight:changed";

/** Updates the known fields and recolours the chips. */
export function setVariableKeys(editor: Editor, keys: VariableKeys) {
  const storage = (editor.storage as unknown as Record<string, { keys: VariableKeys } | undefined>).variableHighlight;
  if (!storage || editor.isDestroyed) return;
  storage.keys = keys;
  editor.view.dispatch(editor.state.tr.setMeta(VARIABLES_CHANGED, true));
}

/**
 * Shows {{variables}} as chips (blocks as full-width placeholders; unknown names in red).
 * Display only. The list lives in the extension's storage (`setVariableKeys`), so it
 * can arrive after the editor exists.
 */
export const VariableHighlight = Extension.create<object, { keys: VariableKeys }>({
  name: "variableHighlight",
  addStorage: () => ({ keys: { blockKeys: [], knownKeys: [] } }),
  addProseMirrorPlugins() {
    const storage = this.storage;
    const run = (doc: PmNode) => {
      const { blockKeys, knownKeys } = storage.keys;
      // Before the list has loaded, don't flag every field as unknown.
      return decorate(doc, new Set(blockKeys), knownKeys.length ? new Set(knownKeys) : null);
    };
    return [
      new Plugin({
        key: new PluginKey("variableHighlight"),
        state: {
          init: (_config, state) => run(state.doc),
          apply: (tr, old) => (tr.docChanged || tr.getMeta(VARIABLES_CHANGED) ? run(tr.doc) : old),
        },
        props: { decorations(state) { return this.getState(state); } },
      }),
    ];
  },
});
