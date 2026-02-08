/**
 * Fix-on-save handler
 * Manages automatic ESLint fixing when files are saved
 */

// Constants for fix-on-save timing
const FIX_ON_SAVE_TIMEOUT_MS = 5000; // Failsafe: force cleanup after 5 seconds
// Note: These delays are necessary due to Nova's async editor behavior:
// - EDIT_SETTLE_DELAY_MS: Nova's editor.edit() may not commit changes immediately,
//   so we wait briefly before calling save() to ensure edits are applied
// - SAVE_COMPLETE_DELAY_MS: Nova's onDidSave event fires during save operation,
//   not after completion. We wait to prevent the fix cycle from re-triggering
//   before the save event fully settles
const EDIT_SETTLE_DELAY_MS = 10; // Wait for edit to commit before saving
const SAVE_COMPLETE_DELAY_MS = 100; // Wait for save event to settle

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'jsx', 'tsx'];
const CONFIG_KEY_FIX_ON_SAVE = 'eslint.fixOnSave';

class FixOnSaveHandler {
  constructor(provider) {
    this.provider = provider;
    this.fixingEditors = new WeakMap(); // Track which editors are currently being fixed (with timeout IDs)
  }

  /**
   * Add a pending timeout to track for cleanup
   */
  addPendingTimeout(editor, timeoutId) {
    const state = this.fixingEditors.get(editor);
    if (state) {
      state.pending.push(timeoutId);
    }
  }

  /**
   * Check if editor is currently being fixed
   */
  isFixing(editor) {
    return this.fixingEditors.has(editor);
  }

  /**
   * Set up fix-on-save functionality for all editors
   * @param {Array} disposables - Array to track workspace-level disposables
   * @param {WeakMap} editorDisposables - WeakMap to track per-editor disposables
   */
  setupFixOnSave(disposables, editorDisposables) {
    disposables.push(
      nova.workspace.onDidAddTextEditor(editor => {
        // Use WeakMap to store editor-specific disposable
        // This prevents memory leak as WeakMap entries are GC'd when editor is destroyed
        const saveDisposable = editor.onDidSave(async editor => {
          if (!nova.config.get(CONFIG_KEY_FIX_ON_SAVE, 'boolean')) return;
          if (!editor.document.path) return;
          if (!SUPPORTED_LANGUAGES.includes(editor.document.syntax)) return;
          if (!this.provider || !this.provider.runner) {
            console.error('Provider not initialized');
            return;
          }

          // Check if this editor is already being fixed
          if (this.isFixing(editor)) {
            return;
          }

          const filePath = editor.document.path;

          try {
            this.startFixing(editor);

            const fixedContent = await this.provider.runner.fix(filePath);
            if (!fixedContent) {
              this.stopFixing(editor);
              return;
            }

            const currentContent = editor.document.getTextInRange(
              new Range(0, editor.document.length),
            );

            if (currentContent === fixedContent) {
              this.stopFixing(editor);
              return;
            }

            await editor.edit(edit => {
              edit.replace(new Range(0, editor.document.length), fixedContent);
            });

            // Wait for edit to commit before saving
            const editSettleTimeout = setTimeout(() => {
              // Validate editor is still valid before saving
              if (!editor.document) {
                this.stopFixing(editor);
                return;
              }

              // Check if content changed during EDIT_SETTLE_DELAY
              const contentAfterSettle = editor.document.getTextInRange(
                new Range(0, editor.document.length),
              );

              if (contentAfterSettle !== fixedContent) {
                // User modified content during settle delay - don't save
                console.log(
                  'Content changed during edit settle - skipping save',
                );
                this.stopFixing(editor);
                return;
              }

              editor
                .save()
                .then(() => {
                  // Wait for save event to settle before cleaning up
                  const saveCompleteTimeout = setTimeout(() => {
                    this.stopFixing(editor);
                  }, SAVE_COMPLETE_DELAY_MS);

                  this.addPendingTimeout(editor, saveCompleteTimeout);
                })
                .catch(saveError => {
                  console.error('Failed to save after fix:', saveError);
                  this.stopFixing(editor);
                });
            }, EDIT_SETTLE_DELAY_MS);

            this.addPendingTimeout(editor, editSettleTimeout);
          } catch (error) {
            console.error('Fix on save error:', error);
            this.stopFixing(editor);
          }
        });

        // Listen for editor destruction to clean up disposables
        const destroyDisposable = editor.onDidDestroy(() => {
          // Clean up fix-on-save state
          this.stopFixing(editor);

          // Clean up disposables
          const disposable = editorDisposables.get(editor);
          if (disposable) {
            disposable.dispose();
            editorDisposables.delete(editor);
          }
          if (destroyDisposable) {
            destroyDisposable.dispose();
          }
        });

        editorDisposables.set(editor, saveDisposable);
      }),
    );
  }

  /**
   * Mark editor as fixing and set failsafe timeout
   */
  startFixing(editor) {
    const timeoutId = setTimeout(() => {
      console.warn(
        'Fix-on-save timeout reached for',
        editor.document?.path || 'unknown file',
      );
      this.stopFixing(editor);
    }, FIX_ON_SAVE_TIMEOUT_MS);

    // Store all timeout IDs for this editor
    this.fixingEditors.set(editor, {
      failsafe: timeoutId,
      pending: [], // Will hold edit settle and save complete timeouts
    });
  }

  /**
   * Stop fixing and clear all timeouts
   */
  stopFixing(editor) {
    const state = this.fixingEditors.get(editor);
    if (state) {
      // Clear failsafe timeout
      clearTimeout(state.failsafe);

      // Clear all pending timeouts
      state.pending.forEach(timeoutId => clearTimeout(timeoutId));
    }
    this.fixingEditors.delete(editor);
  }
}

module.exports = { FixOnSaveHandler };
