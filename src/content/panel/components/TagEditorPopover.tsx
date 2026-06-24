import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { setNodeMetadata } from '@shared/metadata-storage';
import { usePanelStore } from '../store/panel-store';
import { NODE_STEP, ROW_V_GAP, nodeCenterY } from './constants';

interface TagEditorPopoverProps {
  nodeIndex:   number;
  nodeId:      string;
  sessionId:   string;
  currentTags: string[];
}

export function TagEditorPopover({
  nodeIndex,
  nodeId,
  sessionId,
  currentTags,
}: TagEditorPopoverProps) {
  const patchNodeMetadata = usePanelStore((s) => s.patchNodeMetadata);
  const setTagEditNodeId  = usePanelStore((s) => s.setTagEditNodeId);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setTagEditNodeId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setTagEditNodeId]);

  const addTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().toLowerCase();
      if (!tag || currentTags.includes(tag)) return;
      const next = [...currentTags, tag];
      patchNodeMetadata(nodeId, { tags: next });
      setNodeMetadata(sessionId, nodeId, { tags: next });
      setInputValue('');
    },
    [nodeId, sessionId, currentTags, patchNodeMetadata],
  );

  const removeTag = useCallback(
    (tag: string) => {
      const next = currentTags.filter((t) => t !== tag);
      patchNodeMetadata(nodeId, { tags: next });
      setNodeMetadata(sessionId, nodeId, { tags: next });
    },
    [nodeId, sessionId, currentTags, patchNodeMetadata],
  );

  const handleInputKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Prevent keystrokes from reaching Claude.ai's global listeners.
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === 'Backspace' && inputValue === '' && currentTags.length > 0) {
        removeTag(currentTags[currentTags.length - 1]);
      }
    },
    [inputValue, currentTags, addTag, removeTag],
  );

  const rowH  = NODE_STEP - ROW_V_GAP;
  const cy    = nodeCenterY(nodeIndex);
  const topPx = 6 + cy - rowH / 2;

  return (
    <div
      role="dialog"
      aria-label="태그 편집"
      className="nav-tag-popover"
      style={{ top: topPx }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="nav-tag-popover-header">
        <span className="nav-tag-popover-title">태그 편집</span>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => setTagEditNodeId(null)}
          className="nav-tag-popover-close"
        >
          <X size={12} />
        </button>
      </div>

      {currentTags.length > 0 && (
        <div className="nav-tag-chip-list">
          {currentTags.map((tag) => (
            <span key={tag} className="nav-tag-chip">
              {tag}
              <button
                type="button"
                aria-label={`태그 제거: ${tag}`}
                onClick={() => removeTag(tag)}
                className="nav-tag-chip-remove"
              >
                <X size={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        placeholder="태그 입력 후 Enter"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleInputKeyDown}
        className="nav-tag-input"
        maxLength={32}
      />
    </div>
  );
}
