import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useRef } from "react";

interface CodeEditorPanelProps {
  label: string;
  language: string;
  value: string;
  onChange: (value: string) => void;
}

const languageMap: Record<string, string> = {
  cpp: "cpp",
  "c++": "cpp",
  python: "python",
  java: "java",
  javascript: "javascript",
};

export default function CodeEditorPanel({ label, language, value, onChange }: CodeEditorPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount = (ed: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = ed;

    // Override copy with Clipboard API
    ed.addAction({
      id: "custom-copy",
      label: "Copy",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC],
      run: (editor) => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (selection && model) {
          const text = model.getValueInRange(selection);
          if (text) {
            navigator.clipboard.writeText(text).catch(() => {});
          }
        }
      },
    });

    // Override paste with Clipboard API
    ed.addAction({
      id: "custom-paste",
      label: "Paste",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV],
      run: async (editor) => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            const selection = editor.getSelection();
            if (selection) {
              editor.executeEdits("paste", [
                { range: selection, text, forceMoveMarkers: true },
              ]);
            }
          }
        } catch {
          // Clipboard API not available, try fallback
          console.warn("Clipboard read not available");
        }
      },
    });

    // Override cut with Clipboard API
    ed.addAction({
      id: "custom-cut",
      label: "Cut",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX],
      run: async (editor) => {
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (selection && model) {
          const text = model.getValueInRange(selection);
          if (text) {
            await navigator.clipboard.writeText(text).catch(() => {});
            editor.executeEdits("cut", [
              { range: selection, text: "", forceMoveMarkers: true },
            ]);
          } else {
            // Cut entire line when nothing selected (default Monaco behavior)
            const line = selection.startLineNumber;
            const lineContent = model.getLineContent(line);
            await navigator.clipboard.writeText(lineContent + "\n").catch(() => {});
            const range = {
              startLineNumber: line,
              startColumn: 1,
              endLineNumber: line + 1,
              endColumn: 1,
            };
            editor.executeEdits("cut", [
              { range, text: "", forceMoveMarkers: true },
            ]);
          }
        }
      },
    });

    // Select All
    ed.addAction({
      id: "custom-select-all",
      label: "Select All",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA],
      run: (editor) => {
        const model = editor.getModel();
        if (model) {
          editor.setSelection(model.getFullModelRange());
        }
      },
    });

    // Focus highlight
    ed.onDidFocusEditorText(() => {
      ed.updateOptions({ renderLineHighlight: "all" });
    });
    ed.onDidBlurEditorText(() => {
      ed.updateOptions({ renderLineHighlight: "none" });
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border bg-secondary/30 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={languageMap[language] || "cpp"}
          value={value}
          onChange={(val) => onChange(val || "")}
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            wordWrap: "on",
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            cursorStyle: "line",
            cursorWidth: 2,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
            renderLineHighlight: "all",
            renderLineHighlightOnlyWhenFocus: true,
            multiCursorModifier: "ctrlCmd",
            occurrencesHighlight: "singleFile",
            selectionHighlight: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
              useShadows: false,
            },
            overviewRulerBorder: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            autoIndent: "advanced",
            formatOnPaste: false,
            formatOnType: false,
            suggest: { showWords: true, showSnippets: true, preview: true, shareSuggestSelections: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            acceptSuggestionOnCommitCharacter: true,
            suggestOnTriggerCharacters: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: "mouseover",
            matchBrackets: "always",
            mouseWheelZoom: true,
            dragAndDrop: true,
            copyWithSyntaxHighlighting: false,
            glyphMargin: false,
            lineDecorationsWidth: 8,
            lineNumbersMinChars: 3,
            links: true,
            contextmenu: true,
            columnSelection: false,
            find: {
              addExtraSpaceOnTop: false,
              autoFindInSelection: "multiline",
              seedSearchStringFromSelection: "selection",
            },
          }}
        />
      </div>
    </div>
  );
}
