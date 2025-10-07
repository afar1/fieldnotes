import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Draggable } from 'react-beautiful-dnd';
import './App.css';

import StrictModeDroppable from './components/StrictModeDroppable';
import SelectableItem from './components/SelectableItem';
import ProTipTooltip from './components/ProTipTooltip';
import MigrationOverlay from './components/MigrationOverlay';
import useQuickAdd from './hooks/useQuickAdd';
import { useColumnToggles } from './hooks/useColumnToggles';
import { findNearestColumn, getPreviousColumnId, startEditItem } from './utils/columnUtils';
import { supabase } from './supabaseClient';
import { useAuth } from './auth/AuthContext';

// Plain-English helper: generate ids that work with Supabase UUID columns
const createClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Lightweight UUID fallback (not cryptographically strong, but unique enough for local usage)
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return template.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
};

// We keep a factory function so each call returns a fresh copy of empty columns
const createEmptyColumns = () => ({
  do: {
    id: 'do',
    name: 'DO',
    items: [],
  },
  done: {
    id: 'done',
    name: 'DONE',
    items: [],
  },
  ignore: {
    id: 'ignore',
    name: 'IGNORE',
    items: [],
  },
  others: {
    id: 'others',
    name: 'OTHERS',
    items: [],
  },
  ember: {
    id: 'ember',
    name: 'EMBER',
    items: [],
  }
});

// Column sequence for navigation
const COLUMN_SEQUENCE = ['do', 'ignore', 'others', 'ember'];

// Columns that persist to Supabase today (we skip ember for now)
const PERSISTED_COLUMNS = ['do', 'done', 'ignore', 'others'];

const LOCAL_STORAGE_KEY = 'my-todos';
const LOCAL_STORAGE_VERSION = '1.0';

const normalizeItems = (items = []) => {
  return items.map((item) => {
    const createdAt = item.createdAt || item.created_at || new Date().toISOString();
    const updatedAt = item.updatedAt || item.updated_at || item.completedAt || item.completed_at || createdAt;

    return {
      id: item.id || createClientId(),
      text: typeof item.text === 'string' ? item.text : '',
      createdAt,
      updatedAt,
      completedAt: item.completedAt || item.completed_at || null,
      metadata: item.metadata ?? null,
    };
  });
};

const loadLocalSnapshot = () => {
  const fallback = {
    columns: createEmptyColumns(),
    lastUpdated: null,
  };

  try {
    if (typeof localStorage === 'undefined') {
      return fallback;
    }

    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== LOCAL_STORAGE_VERSION || !parsed.columns) {
      return fallback;
    }

    const base = createEmptyColumns();

    Object.entries(base).forEach(([slug, column]) => {
      const savedColumn = parsed.columns[slug];
      if (savedColumn && Array.isArray(savedColumn.items)) {
        base[slug] = {
          ...column,
          name: savedColumn.name || column.name,
          items: normalizeItems(savedColumn.items),
        };
      }
    });

    return {
      columns: base,
      lastUpdated: parsed.lastUpdated || null,
    };
  } catch (error) {
    console.error('Error loading local snapshot:', error);
    return fallback;
  }
};

const saveLocalSnapshot = (columns, lastUpdated) => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const payload = {
      version: LOCAL_STORAGE_VERSION,
      lastUpdated,
      columns: PERSISTED_COLUMNS.reduce((acc, slug) => {
        const column = columns[slug] || { name: slug.toUpperCase(), items: [] };
        acc[slug] = {
          name: column.name,
          items: (column.items || []).map((item) => ({
            id: item.id,
            text: item.text,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt || item.createdAt,
            completedAt: item.completedAt || null,
            metadata: item.metadata ?? null,
          })),
        };
        return acc;
      }, {
        ember: {
          name: columns.ember?.name || 'EMBER',
          items: (columns.ember?.items || []).map((item) => ({
            id: item.id || createClientId(),
            text: item.text || '',
            nextContact: item.nextContact || null,
            originalDays: item.originalDays || null,
          })),
        }
      }),
    };

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Error saving local snapshot:', error);
  }
};

// Add Ember-specific utilities
const DEFAULT_RECONNECT_DAYS = 30; // Default time until next reconnection

const calculateDaysFromNow = (date) => {
  const now = new Date();
  const targetDate = new Date(date);
  const diffTime = targetDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const calculateOpacity = (daysFromNow) => {
  // Scale opacity from 1.0 (today) to 0.2 (furthest date)
  return Math.max(0.2, Math.min(1.0, 1 - (daysFromNow / (DEFAULT_RECONNECT_DAYS * 2))));
};

// Add this function before the App component
const startEmberEdit = (id, setEditingId) => {
  setEditingId(id);
};

function BoardApp() {
  const { user } = useAuth();
  const activeUserId = user?.id ?? null;
  const [isMigrating, setIsMigrating] = useState(false);

  const localSnapshotRef = useRef(null);
  if (localSnapshotRef.current === null) {
    localSnapshotRef.current = loadLocalSnapshot();
  }

  // Supabase-related state
  const [boardId, setBoardId] = useState(null);
  const [columnMeta, setColumnMeta] = useState({}); // slug -> { id, name }
  const userIdRef = useRef(null);

  // Offline + sync state
  const [columns, setColumns] = useState(() => localSnapshotRef.current.columns);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragEnd, setDragEnd] = useState({ x: 0, y: 0 });
  const [columnSearch, setColumnSearch] = useState({
    do: '',
    done: '',
    ignore: '',
    others: '',
    ember: ''  // Add ember search state
  });
  const [history, setHistory] = useState(() => [JSON.stringify(localSnapshotRef.current.columns)]);
  const isUndoingRef = useRef(false);
  const dragStartPos = useRef(null);
  const columnsRef = useRef(localSnapshotRef.current.columns);
  const lastUpdatedRef = useRef(localSnapshotRef.current.lastUpdated || null);
  const remoteLastSeenRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState(localSnapshotRef.current.lastUpdated || null);
  const [, setIsSyncing] = useState(false);
  const [, setSyncError] = useState(null);
  const isHydratingRef = useRef(true);
  const isApplyingRemoteRef = useRef(false);
  const pendingSyncRef = useRef(null);
  const syncTimerRef = useRef(null);
  const channelRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    userIdRef.current = activeUserId;
  }, [activeUserId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    lastUpdatedRef.current = lastUpdated;
  }, [lastUpdated]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const releaseRemoteApply = () => {
    const release = () => {
      isApplyingRemoteRef.current = false;
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(release);
    } else {
      setTimeout(release, 0);
    }
  };

  const applyRemoteSnapshot = useCallback((nextColumns, remoteUpdatedAt) => {
    isApplyingRemoteRef.current = true;
    columnsRef.current = nextColumns;
    setColumns(nextColumns);
    setHistory([JSON.stringify(nextColumns)]);

    if (remoteUpdatedAt) {
      setLastUpdated(remoteUpdatedAt);
      lastUpdatedRef.current = remoteUpdatedAt;
    }

    const effectiveTimestamp = remoteUpdatedAt || lastUpdatedRef.current || new Date().toISOString();
    saveLocalSnapshot(nextColumns, effectiveTimestamp);
    remoteLastSeenRef.current = effectiveTimestamp;
    releaseRemoteApply();
  }, []);

  const syncToSupabase = useCallback(async (snapshot) => {
    const userId = userIdRef.current;
    if (!boardId || !userId) return;

    const syncTimestamp = snapshot.lastUpdated || new Date().toISOString();

    try {
      setSyncError(null);
      setIsSyncing(true);

      const rows = [];

      PERSISTED_COLUMNS.forEach((slug) => {
        const meta = columnMeta[slug];
        if (!meta) return;

        const columnItems = snapshot.columns[slug]?.items || [];
        columnItems.forEach((item, index) => {
          rows.push({
            id: item.id,
            board_id: boardId,
            column_id: meta.id,
            text: item.text ?? '',
            position: index + 1,
            created_at: item.createdAt || syncTimestamp,
            updated_at: syncTimestamp,
            completed_at: item.completedAt || null,
            metadata: item.metadata ?? null,
            owner_id: userId,
          });
        });
      });

      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .eq('board_id', boardId)
        .eq('owner_id', userId);

      if (deleteError) throw deleteError;

      if (rows.length > 0) {
        const { error: insertError } = await supabase.from('todos').insert(rows);
        if (insertError) throw insertError;
      }

      const { error: boardError } = await supabase
        .from('boards')
        .update({ updated_at: syncTimestamp })
        .eq('id', boardId)
        .eq('owner_id', userId);

      if (boardError) throw boardError;

      remoteLastSeenRef.current = syncTimestamp;
    } catch (error) {
      console.error('Error syncing todos to Supabase:', error);
      setSyncError(error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  }, [boardId, columnMeta]);

  const scheduleRemoteSync = useCallback((snapshot, delay = 400) => {
    if (!snapshot) return;

    const syncTimestamp = snapshot.lastUpdated || new Date().toISOString();
    const normalizedSnapshot = {
      columns: snapshot.columns,
      lastUpdated: syncTimestamp,
    };

    pendingSyncRef.current = normalizedSnapshot;

    const hasMeta = Object.keys(columnMeta).length > 0;
    const userId = userIdRef.current;
    const canSyncNow = Boolean(boardId) && hasMeta && Boolean(userId);

    if (!canSyncNow) {
      return;
    }

    if (syncTimerRef.current) {
      return;
    }

    syncTimerRef.current = setTimeout(async () => {
      syncTimerRef.current = null;

      const payload = pendingSyncRef.current;
      pendingSyncRef.current = null;

      if (!payload) {
        return;
      }

      try {
        await syncToSupabase(payload);
      } catch (error) {
        pendingSyncRef.current = payload;
        scheduleRemoteSync(payload, 3000);
      }
    }, delay);
  }, [boardId, columnMeta, syncToSupabase]);

  useEffect(() => {
    if (isHydratingRef.current) {
      isHydratingRef.current = false;
      return;
    }

    if (isApplyingRemoteRef.current) {
      return;
    }

    const timestamp = new Date().toISOString();
    const snapshot = { columns, lastUpdated: timestamp };

    saveLocalSnapshot(columns, timestamp);
    setLastUpdated(timestamp);
    lastUpdatedRef.current = timestamp;

    scheduleRemoteSync(snapshot);
  }, [columns, scheduleRemoteSync]);

  useEffect(() => {
    if (!boardId) return;
    if (Object.keys(columnMeta).length === 0) return;
    if (!pendingSyncRef.current) return;
    if (syncTimerRef.current) return;

    scheduleRemoteSync(pendingSyncRef.current, 0);
  }, [boardId, columnMeta, scheduleRemoteSync]);
  
  const [hasMoved, setHasMoved] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState(null);
  const [tipActionHandler, setTipActionHandler] = useState(null);
  const [clipboard, setClipboard] = useState([]);
  const [isCut, setIsCut] = useState(false);
  const [isRbdDragging, setIsRbdDragging] = useState(false);
  const [keyboardFocusedColumn, setKeyboardFocusedColumn] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [doneBlinking, setDoneBlinking] = useState(false);
  const [showIgnore, setShowIgnore] = useState(false);
  const [ignoreBlinking, setIgnoreBlinking] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState(null);
  const [quickAddColumn, setQuickAddColumn] = useState(null);

  // Add new state for Ember
  const [emberHighlightedIndex, setEmberHighlightedIndex] = useState(-1);

  // Add new state for Ember editing
  const [emberEditingId, setEmberEditingId] = useState(null);
  const emberEditInputRef = useRef(null);

  // Add state for days editing
  const [emberDaysEditingId, setEmberDaysEditingId] = useState(null);
  const emberDaysInputRef = useRef(null);

  const loadBoard = useCallback(async () => {
    const userId = activeUserId || userIdRef.current;
    if (!userId) {
      console.warn('Supabase session unavailable; skipping remote load.');
      return;
    }

    try {
      let boardRecord = null;
      let createdBoard = false;

      const { data: boardRows, error: boardError } = await supabase
        .from('boards')
        .select('id, name, updated_at')
        .eq('owner_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (boardError) throw boardError;

      if (boardRows && boardRows.length > 0) {
        boardRecord = boardRows[0];
      } else {
        const { data: newBoard, error: newBoardError } = await supabase
          .from('boards')
          .insert({ name: 'Personal Board', owner_id: userId })
          .select('id, name, updated_at')
          .single();

        if (newBoardError) throw newBoardError;
        boardRecord = newBoard;
        createdBoard = true;
      }

      if (!boardRecord) {
        return;
      }

      if (!isMountedRef.current) return;
      setBoardId(boardRecord.id);

      let columnRows = [];

      if (createdBoard) {
        const defaultColumns = [
          { slug: 'do', name: 'DO' },
          { slug: 'done', name: 'DONE' },
          { slug: 'ignore', name: 'IGNORE' },
          { slug: 'others', name: 'OTHERS' },
        ].map((col, index) => ({
          board_id: boardRecord.id,
          slug: col.slug,
          name: col.name,
          sort_order: index + 1,
          owner_id: userId,
        }));

        const { data: insertedColumns, error: insertColumnsError } = await supabase
          .from('board_columns')
          .insert(defaultColumns)
          .select('id, slug, name, sort_order');

        if (insertColumnsError) throw insertColumnsError;
        columnRows = insertedColumns || [];
      } else {
        const { data: existingColumns, error: columnError } = await supabase
          .from('board_columns')
          .select('id, slug, name, sort_order')
          .eq('board_id', boardRecord.id)
          .eq('owner_id', userId)
          .order('sort_order', { ascending: true });

        if (columnError) throw columnError;
        columnRows = existingColumns || [];
      }

      if (!isMountedRef.current) return;

      const baseColumns = createEmptyColumns();
      const meta = {};
      const columnIdToSlug = {};

      columnRows.forEach((column) => {
        if (!baseColumns[column.slug]) return;
        baseColumns[column.slug] = {
          ...baseColumns[column.slug],
          name: column.name || baseColumns[column.slug].name,
          items: [],
        };
        meta[column.slug] = {
          id: column.id,
          name: column.name || baseColumns[column.slug].name,
        };
        columnIdToSlug[column.id] = column.slug;
      });

      setColumnMeta(meta);

      const { data: todoRows, error: todoError } = await supabase
        .from('todos')
        .select('id, column_id, text, position, created_at, updated_at, completed_at, metadata')
        .eq('board_id', boardRecord.id)
        .eq('owner_id', userId)
        .order('position', { ascending: true });

      if (todoError) throw todoError;
      if (!isMountedRef.current) return;

      let remoteLatest = boardRecord.updated_at || null;

      (todoRows || []).forEach((todo) => {
        const slug = columnIdToSlug[todo.column_id];
        if (!slug || !baseColumns[slug]) return;

        const createdAt = todo.created_at || new Date().toISOString();
        const updatedAt = todo.updated_at || createdAt;
        const completedAt = todo.completed_at || null;
        const candidate = completedAt || updatedAt || createdAt;

        baseColumns[slug] = {
          ...baseColumns[slug],
          items: [
            ...baseColumns[slug].items,
            {
              id: todo.id,
              text: todo.text || '',
              createdAt,
              updatedAt,
              completedAt,
              metadata: todo.metadata ?? null,
            }
          ],
        };

        if (candidate) {
          const candidateTime = Date.parse(candidate);
          const currentTime = remoteLatest ? Date.parse(remoteLatest) : 0;
          if (candidateTime > currentTime) {
            remoteLatest = new Date(candidate).toISOString();
          }
        }
      });

      remoteLastSeenRef.current = remoteLatest;

      const localTime = lastUpdatedRef.current ? Date.parse(lastUpdatedRef.current) : 0;
      const remoteTime = remoteLatest ? Date.parse(remoteLatest) : 0;

      if (remoteTime > localTime) {
        applyRemoteSnapshot(baseColumns, remoteLatest);
      } else if (localTime > remoteTime && lastUpdatedRef.current) {
        scheduleRemoteSync({ columns: columnsRef.current, lastUpdated: lastUpdatedRef.current }, 0);
      } else if (!lastUpdatedRef.current && remoteLatest) {
        setLastUpdated(remoteLatest);
        lastUpdatedRef.current = remoteLatest;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error loading data from Supabase:', error);
      }
    }
  }, [activeUserId, applyRemoteSnapshot, scheduleRemoteSync]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!boardId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`todos-board-${boardId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'todos',
        filter: `board_id=eq.${boardId}`,
      }, (payload) => {
        const remoteTimestamp = payload.new?.updated_at || payload.new?.created_at;
        const remoteTime = remoteTimestamp ? Date.parse(remoteTimestamp) : 0;
        const localTime = lastUpdatedRef.current ? Date.parse(lastUpdatedRef.current) : 0;

        if (remoteTime && remoteTime <= localTime) {
          return;
        }

        loadBoard();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [boardId, loadBoard]);

  // Initialize column toggles
  const { toggleDoDone, toggleOthersIgnore, handleMigrationComplete } = useColumnToggles(
    setShowDone,
    setShowIgnore,
    setIsMigrating
  );

  // Notify tip system of completed actions
  const notifyTipAction = useCallback((action) => {
    if (tipActionHandler) {
      tipActionHandler(action);
    }
  }, [tipActionHandler]);

  // Handle column search
  const handleColumnSearch = useCallback((columnId, searchText) => {
    setColumnSearch(prev => ({
      ...prev,
      [columnId]: searchText
    }));
  }, []);

  // Wrap sanitizeItemText in useCallback
  const sanitizeItemText = useCallback((text) => {
    if (typeof text !== 'string') return '';
    return text.trim().slice(0, 1000); // Limit length to 1000 chars
  }, []);

  // Wrap filterItems in useCallback
  const filterItems = useCallback((items, columnId) => {
    const searchText = columnSearch[columnId];
    if (!searchText) return items;

    return items.filter(item => 
      item.text.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [columnSearch]);

  // Handle Ember edit mode
  const handleEmberEditComplete = useCallback((itemId, newText) => {
    // Remove items that are empty or just whitespace
    if (!newText || !newText.trim()) {
      setColumns(prev => {
        const updated = { ...prev };
        const emberColumn = { ...updated.ember };
        emberColumn.items = emberColumn.items.filter(i => i.id !== itemId);
        updated.ember = emberColumn;
        return updated;
      });
    } else {
      setColumns(prev => {
        const updated = { ...prev };
        const emberColumn = { ...updated.ember };
        emberColumn.items = emberColumn.items.map(item => 
          item.id === itemId ? { ...item, text: newText } : item
        );
        updated.ember = emberColumn;
        return updated;
      });
    }
    setEmberEditingId(null);
  }, []);

  // Handle Ember reset with original days
  const handleEmberReset = useCallback((itemId) => {
    setColumns(prev => {
      const updated = { ...prev };
      const emberColumn = { ...updated.ember };
      emberColumn.items = emberColumn.items.map(item => 
        item.id === itemId ? 
          { 
            ...item, 
            nextContact: new Date(Date.now() + (item.originalDays || DEFAULT_RECONNECT_DAYS) * 24 * 60 * 60 * 1000).toISOString() 
          } : 
          item
      );
      updated.ember = emberColumn;
      return updated;
    });
  }, []);

  // Handle days editing with original days storage
  const handleEmberDaysEditComplete = useCallback((itemId, days) => {
    setColumns(prev => {
      const updated = { ...prev };
      const emberColumn = { ...updated.ember };
      emberColumn.items = emberColumn.items.map(item => 
        item.id === itemId ? 
          { 
            ...item, 
            nextContact: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
            originalDays: days
          } : 
          item
      );
      updated.ember = emberColumn;
      return updated;
    });
    setEmberDaysEditingId(null);
  }, []);

  // Add new Ember contact with original days
  const handleAddEmberContact = useCallback(() => {
    const newItemId = createClientId();
    setColumns(prev => {
      const updated = { ...prev };
      const emberColumn = { ...updated.ember };
      const newItem = {
        id: newItemId,
        text: '',
        nextContact: new Date(Date.now() + DEFAULT_RECONNECT_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        originalDays: DEFAULT_RECONNECT_DAYS
      };
      emberColumn.items = [newItem, ...emberColumn.items];  // Add to the beginning
      updated.ember = emberColumn;
      return updated;
    });
    // Set editing state and focus input immediately
    setEmberEditingId(newItemId);
    // Use a small timeout to ensure the input is rendered
    setTimeout(() => {
      if (emberEditInputRef.current) {
        emberEditInputRef.current.focus();
      }
    }, 0);
  }, []);

  // Add cleanup effect for Ember state
  useEffect(() => {
    return () => {
      setEmberHighlightedIndex(-1);
      setEmberEditingId(null);
      setEmberDaysEditingId(null);
    };
  }, []);

  // Handle Ember keyboard navigation
  useEffect(() => {
    const handleEmberKeyboard = (e) => {
      try {
        // Prevent handling if we're in an input field (except for Escape)
        if (e.target.tagName === 'INPUT' && e.key !== 'Escape') return;
        if (e.target.tagName === 'TEXTAREA') return;

        // Only handle keyboard events if we have a highlighted item or are in edit mode
        if (emberHighlightedIndex === -1 && !emberEditingId) return;
        
        // If in edit mode, handle Escape and Enter
        if (emberEditingId) {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // Always remove empty items when escaping
            setColumns(prev => {
              try {
                const item = prev.ember.items.find(i => i.id === emberEditingId);
                if (item && (!item.text || !item.text.trim())) {
                  const updated = { ...prev };
                  const emberColumn = { ...updated.ember };
                  emberColumn.items = emberColumn.items.filter(i => i.id !== emberEditingId);
                  updated.ember = emberColumn;
                  return updated;
                }
                return prev;
              } catch (error) {
                console.error('Error handling Escape in edit mode:', error);
                return prev;
              }
            });
            setEmberEditingId(null);
            setEmberHighlightedIndex(-1); // Clear highlight when escaping edit mode
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            const input = emberEditInputRef.current;
            if (input) {
              if (!input.value.trim()) {
                // Remove empty items
                setColumns(prev => {
                  try {
                    const updated = { ...prev };
                    const emberColumn = { ...updated.ember };
                    emberColumn.items = emberColumn.items.filter(i => i.id !== emberEditingId);
                    updated.ember = emberColumn;
                    return updated;
                  } catch (error) {
                    console.error('Error handling Enter with empty input:', error);
                    return prev;
                  }
                });
              } else {
                handleEmberEditComplete(emberEditingId, input.value);
              }
            }
            setEmberEditingId(null);
            return;
          }
          return;
        }

        const emberItems = columns.ember.items;
        if (!emberItems?.length) return;

        switch (e.key.toLowerCase()) {
          case 'e':
            e.preventDefault();
            e.stopPropagation();
            if (emberHighlightedIndex >= 0 && emberHighlightedIndex < emberItems.length) {
              const item = emberItems[emberHighlightedIndex];
              handleEmberReset(item.id);
            }
            break;
          case 'enter':
            e.preventDefault();
            e.stopPropagation();
            if (emberHighlightedIndex >= 0 && emberHighlightedIndex < emberItems.length) {
              const item = emberItems[emberHighlightedIndex];
              startEmberEdit(item.id, setEmberEditingId);
            }
            break;
          case 'delete':        // Forward delete on Mac
          case 'del':          // Delete on some keyboards
          case 'backspace':    // Backspace
            if (emberHighlightedIndex >= 0 && emberHighlightedIndex < emberItems.length) {
              e.preventDefault();
              e.stopPropagation();
              const itemId = emberItems[emberHighlightedIndex].id;
              setColumns(prev => {
                try {
                  const updated = { ...prev };
                  const emberColumn = { ...updated.ember };
                  emberColumn.items = emberColumn.items.filter(i => i.id !== itemId);
                  updated.ember = emberColumn;
                  return updated;
                } catch (error) {
                  console.error('Error handling delete:', error);
                  return prev;
                }
              });
              // Adjust highlighted index if needed
              if (emberHighlightedIndex >= emberItems.length - 1) {
                setEmberHighlightedIndex(prev => Math.max(0, prev - 1));
              }
            }
            break;
          case 'escape':
            e.preventDefault();
            e.stopPropagation();
            // Clear highlight state when Escape is pressed
            setEmberHighlightedIndex(-1);
            break;
          case 'j':
            e.preventDefault();
            e.stopPropagation();
            setEmberHighlightedIndex(prev => 
              prev < emberItems.length - 1 ? prev + 1 : prev);
            break;
          case 'k':
            e.preventDefault();
            e.stopPropagation();
            setEmberHighlightedIndex(prev => 
              prev > 0 ? prev - 1 : prev);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error('Error in Ember keyboard handler:', error);
        // Reset state on error
        setEmberHighlightedIndex(-1);
        setEmberEditingId(null);
      }
    };

    // Use capture phase to ensure our handler runs first
    window.addEventListener('keydown', handleEmberKeyboard, true);
    return () => window.removeEventListener('keydown', handleEmberKeyboard, true);
  }, [
    columns,
    emberEditingId,
    emberHighlightedIndex,
    handleEmberEditComplete,
    handleEmberReset,
    setEmberEditingId,
    setEmberHighlightedIndex
  ]);

  // Update history when columns change
  useEffect(() => {
    if (isUndoingRef.current) return;

    const serialized = JSON.stringify(columns);
    setHistory(prev => {
      if (prev[prev.length - 1] === serialized) {
        return prev;
      }
      return [...prev, serialized];
    });
  }, [columns]);

  // Handle undo
  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length < 2) return prev; // Need at least 2 items to undo (current + previous)
      
      const newHistory = prev.slice(0, -1);
      isUndoingRef.current = true;
      
      // Restore the previous state
      const previousState = JSON.parse(newHistory[newHistory.length - 1]);
      setColumns(previousState);
      
      // Reset the undo flag after a short delay
      setTimeout(() => {
        isUndoingRef.current = false;
      }, 0);
      
      return newHistory;
    });
  }, [setColumns]);

  // Add keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  // Handle item selection
  const toggleSelection = (itemId, e) => {
    if (e.shiftKey) {
      setSelectedIds(prev => {
        if (prev.includes(itemId)) {
          return prev.filter(id => id !== itemId);
        } else {
          return [...prev, itemId];
        }
      });
    } else {
      // If not holding shift, either add to selection or make it the only selection
      setSelectedIds(prev => {
        if (prev.includes(itemId)) {
          return prev.length === 1 ? [] : [itemId];
        } else {
          return [itemId];
        }
      });
    }
  };

  // Update hover handling to clear keyboard focus only when mouse moves
  const handleColumnHover = useCallback((columnId) => {
    // Only prevent hover updates during drag operations
    if (isDragging) return;
    
    // Only clear keyboard focus if the mouse actually moved
    if (columnId !== hoveredColumn) {
      setKeyboardFocusedColumn(null);
    }
    setHoveredColumn(columnId);
  }, [isDragging, hoveredColumn]);

  // Get effective column (keyboard focus takes precedence over hover)
  const getEffectiveColumn = useCallback(() => {
    return keyboardFocusedColumn || hoveredColumn;
  }, [keyboardFocusedColumn, hoveredColumn]);

  // Handle mouse movement to clear keyboard focus and handle drag selection
  const handleMouseMove = useCallback((e) => {
    // Clear keyboard focus when mouse moves significantly
    if (keyboardFocusedColumn) {
      const movementThreshold = 5;
      if (Math.abs(e.movementX) > movementThreshold || Math.abs(e.movementY) > movementThreshold) {
        setKeyboardFocusedColumn(null);
      }
    }

    if (!isDragging || isRbdDragging) return;
    
    setDragEnd({ x: e.clientX, y: e.clientY });
    
    // Calculate selection box coordinates
    const box = {
      left: Math.min(dragStart.x, e.clientX),
      right: Math.max(dragStart.x, e.clientX),
      top: Math.min(dragStart.y, e.clientY),
      bottom: Math.max(dragStart.y, e.clientY)
    };

    // Only update selection if we've moved enough to consider it a drag
    const hasDraggedEnough = Math.abs(dragStart.x - e.clientX) > 5 || Math.abs(dragStart.y - e.clientY) > 5;
    
    if (hasDraggedEnough) {
      // Get all todo items that are currently visible
      const items = Array.from(document.querySelectorAll('.todo-item:not([style*="display: none"]'));
      
      // Determine which items intersect with the selection box
      const intersectingIds = items
        .filter(item => {
          const rect = item.getBoundingClientRect();
          return !(rect.right < box.left || 
                  rect.left > box.right || 
                  rect.bottom < box.top || 
                  rect.top > box.bottom);
        })
        .map(item => item.getAttribute('data-id'))
        .filter(Boolean);

      // Update selection based on shift key
      setSelectedIds(prev => {
        const baseSelection = e.shiftKey ? prev : [];
        return Array.from(new Set([...baseSelection, ...intersectingIds]));
      });
      
      if (!hasMoved) {
        setHasMoved(true);
      }
    }
  }, [isDragging, isRbdDragging, dragStart, hasMoved, keyboardFocusedColumn, setKeyboardFocusedColumn, setDragEnd, setSelectedIds, setHasMoved]);

  // Handle drag select start
  const handleMouseDown = (e) => {
    // Only handle left clicks on the container and not on interactive elements
    if (e.button !== 0 || 
        !e.target.closest('.app-container') || 
        isRbdDragging ||
        e.target.closest('input, textarea, [role="button"]')) return;
    
    // Clear selection if not holding shift
    if (!e.shiftKey) {
      setSelectedIds([]);
    }
    
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragEnd({ x: e.clientX, y: e.clientY });
  };

  // Handle drag select end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Clean up drag state on unmount
  useEffect(() => {
    return () => {
      setIsDragging(false);
      setHasMoved(false);
    };
  }, []);

  // Handle keyboard navigation and shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      try {
        // Don't handle if we're in an input field
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const currentColumn = getEffectiveColumn();
        if (!currentColumn) return;

        // Get visible items in current column
        const currentItems = filterItems(columns[currentColumn].items, currentColumn);
        if (!currentItems?.length) return;

        const currentIndex = focusedItemId 
          ? currentItems.findIndex(item => item.id === focusedItemId)
          : -1;

        switch (e.key.toLowerCase()) {
          case 'j':
          case 'arrowdown': {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = currentIndex;
            if (currentIndex < currentItems.length - 1) {
              newIndex = currentIndex + 1;
            } else if (currentIndex === -1) {
              newIndex = 0;
            }
            if (newIndex !== currentIndex) {
              setFocusedItemId(currentItems[newIndex].id);
              // If in Ember column, also update highlight
              if (currentColumn === 'ember') {
                setEmberHighlightedIndex(newIndex);
              }
            }
            break;
          }
          case 'k':
          case 'arrowup': {
            e.preventDefault();
            e.stopPropagation();
            let newIndex = currentIndex;
            if (currentIndex > 0) {
              newIndex = currentIndex - 1;
            } else if (currentIndex === -1) {
              newIndex = currentItems.length - 1;
            }
            if (newIndex !== currentIndex) {
              setFocusedItemId(currentItems[newIndex].id);
              // If in Ember column, also update highlight
              if (currentColumn === 'ember') {
                setEmberHighlightedIndex(newIndex);
              }
            }
            break;
          }
          case 'd':
          case 'delete':
          case 'backspace': {
            // Only handle if we have a focused item or selected items
            if (!focusedItemId && selectedIds.length === 0) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            try {
              setColumns(prev => {
                const updated = { ...prev };
                const col = { ...updated[currentColumn] };
                
                // Determine which items to delete
                const itemsToDelete = selectedIds.length > 0 
                  ? selectedIds 
                  : [focusedItemId];
                
                // Find the index of the first item to be deleted
                const firstDeleteIndex = currentItems.findIndex(
                  item => itemsToDelete.includes(item.id)
                );
                
                // Remove the items
                col.items = col.items.filter(
                  item => !itemsToDelete.includes(item.id)
                );
                updated[currentColumn] = col;

                // Update focus to next available item
                const remainingItems = filterItems(col.items, currentColumn);
                if (remainingItems.length > 0) {
                  const nextIndex = Math.min(firstDeleteIndex, remainingItems.length - 1);
                  const nextItem = remainingItems[nextIndex];
                  
                  // Schedule focus update after state change
                  setTimeout(() => {
                    setFocusedItemId(nextItem.id);
                    if (currentColumn === 'ember') {
                      setEmberHighlightedIndex(nextIndex);
                    }
                  }, 0);
                } else {
                  // No items left, clear focus
                  setTimeout(() => {
                    setFocusedItemId(null);
                    if (currentColumn === 'ember') {
                      setEmberHighlightedIndex(-1);
                    }
                  }, 0);
                }

                return updated;
              });

              // Clear selection after delete
              setSelectedIds([]);
              
            } catch (error) {
              console.error('Error during delete operation:', error);
              // Provide user feedback
              // You might want to add a toast notification system here
            }
            break;
          }
          case 'escape': {
            e.preventDefault();
            e.stopPropagation();
            setFocusedItemId(null);
            setSelectedIds([]);
            if (currentColumn === 'ember') {
              setEmberHighlightedIndex(-1);
            }
            break;
          }
          default: {
            // Handle any other keys if needed
            break;
          }
        }
      } catch (error) {
        console.error('Error in keyboard handler:', error);
        // Reset state on error
        setFocusedItemId(null);
        setEmberHighlightedIndex(-1);
        setSelectedIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [
    columns,
    focusedItemId,
    selectedIds,
    getEffectiveColumn,
    filterItems,
    setFocusedItemId,
    setEmberHighlightedIndex,
    setSelectedIds,
    setColumns
  ]);

  // Add keyboard event listener for delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if we're in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Don't handle delete if we have a highlighted Ember item
      if (emberHighlightedIndex >= 0) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        // Delete all selected items
        setColumns(prev => {
          const updated = { ...prev };
          // Remove selected items from all columns
          Object.keys(updated).forEach((colId) => {
            const col = { ...updated[colId] };
            col.items = col.items.filter(item => !selectedIds.includes(item.id));
            updated[colId] = col;
          });
          return updated;
        });
        // Clear selection after delete
        setSelectedIds([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, emberHighlightedIndex, setColumns, setSelectedIds]);

  // Add keyboard event listeners for cut/copy/paste and tab navigation
  useEffect(() => {
    let isMounted = true;

    const handleKeyDown = (e) => {
      try {
        // Ignore if in input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          
          const currentColumn = getEffectiveColumn() || COLUMN_SEQUENCE[0];
          if (!COLUMN_SEQUENCE.includes(currentColumn)) {
            console.error('Invalid column:', currentColumn);
            return;
          }

          const currentIndex = COLUMN_SEQUENCE.indexOf(currentColumn);
          
          // Calculate next column index based on shift key
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + COLUMN_SEQUENCE.length) % COLUMN_SEQUENCE.length
            : (currentIndex + 1) % COLUMN_SEQUENCE.length;
          
          const nextColumn = COLUMN_SEQUENCE[nextIndex];
          if (isMounted) {
            setKeyboardFocusedColumn(nextColumn);
          }
          
          // If moving to Ember column, add new contact
          if (nextColumn === 'ember') {
            handleAddEmberContact();
          }
          
          // Scroll the column into view if needed
          try {
            const columnElement = document.getElementById(`column-${nextColumn}`);
            if (columnElement) {
              columnElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          } catch (scrollError) {
            console.error('Error scrolling to column:', scrollError);
          }
        }
      } catch (error) {
        console.error('Error in keyboard handler:', error);
        // Reset state on error
        if (isMounted) {
          setKeyboardFocusedColumn(null);
        }
      }
    };

    const handleGlobalKeyPress = (e) => {
      try {
        // Ignore if in input field or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Handle Command+A (or Ctrl+A) for selecting all items in hovered column
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && getEffectiveColumn()) {
          e.preventDefault();
          e.stopPropagation();
          
          const column = getEffectiveColumn();
          if (!column) return;

          const columnItems = columns[column]?.items;
          if (!columnItems?.length) return;

          const itemIds = columnItems.map(item => item.id);
          if (isMounted) {
            setSelectedIds(itemIds);
            notifyTipAction('select-all');
          }
          return;
        }
        
        // Only trigger for printable characters and ignore modifier keys
        if (getEffectiveColumn() && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          
          if (isMounted) {
            setQuickAddColumn(getEffectiveColumn());
          }
          
          // Small delay to ensure input is focused
          setTimeout(() => {
            if (!isMounted) return;
            try {
              const input = document.querySelector('.quick-add-input');
              if (input) {
                input.value = e.key;
                input.focus();
              }
            } catch (focusError) {
              console.error('Error focusing quick add input:', focusError);
            }
          }, 0);
        }
      } catch (error) {
        console.error('Error in global key press handler:', error);
        // Reset state on error
        if (isMounted) {
          setQuickAddColumn(null);
          setSelectedIds([]);
        }
      }
    };

    window.addEventListener('keypress', handleGlobalKeyPress, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      isMounted = false;
      window.removeEventListener('keypress', handleGlobalKeyPress, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [
    getEffectiveColumn,
    columns,
    notifyTipAction,
    setSelectedIds,
    setQuickAddColumn,
    setKeyboardFocusedColumn,
    handleAddEmberContact
  ]);

  // Handle copy operation
  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    const itemsToCopy = [];
    Object.values(columns).forEach(column => {
      column.items.forEach(item => {
        if (selectedIds.includes(item.id)) {
          itemsToCopy.push({ ...item, originalId: item.id, id: createClientId() });
        }
      });
    });
    
    setClipboard(itemsToCopy);
    setIsCut(false);
    notifyTipAction('copy');
  }, [selectedIds, columns, notifyTipAction]);

  // Handle cut operation
  const handleCut = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    handleCopy();
    setIsCut(true);
    
    // Remove cut items
    setColumns(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach((colId) => {
        updated[colId] = {
          ...updated[colId],
          items: updated[colId].items.filter(item => !selectedIds.includes(item.id))
        };
      });
      
      setSelectedIds([]);
      notifyTipAction('cut');
      return updated;
    });
  }, [selectedIds, handleCopy, notifyTipAction]);

  // Handle paste operation
  const handleClipboardPaste = useCallback(() => {
    const targetColumn = getEffectiveColumn();
    if (clipboard.length === 0 || !targetColumn) return;
    
    setColumns(prev => {
      const updated = { ...prev };
      const targetColumnData = updated[targetColumn];
      
      // Create new items with fresh IDs
      const now = new Date().toISOString();
      const newItems = clipboard.map(item => {
        const createdAt = item.createdAt || now;
        const completedAt = targetColumn === 'done' ? now : null;

        return {
          ...item,
          id: createClientId(),
          createdAt,
          updatedAt: now,
          completedAt,
        };
      });
      
      updated[targetColumn] = {
        ...targetColumnData,
        items: targetColumn === 'done' ? 
          [...newItems, ...targetColumnData.items] :
          [...targetColumnData.items, ...newItems]
      };
      
      return updated;
    });
    
    // Clear clipboard if this was a cut operation
    if (isCut) {
      setClipboard([]);
      setIsCut(false);
    }
    
    notifyTipAction('paste');
  }, [clipboard, getEffectiveColumn, isCut, notifyTipAction]);

  // Add keyboard event listeners for cut/copy/paste
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if we're in an input field or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'x':
            e.preventDefault();
            handleCut();
            break;
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'v':
            e.preventDefault();
            handleClipboardPaste();
            break;
          default:
            break;
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCut, handleCopy, handleClipboardPaste]);

  // Update renderEmberItem to include days editing
  const renderEmberItem = (item, index) => {
    const daysFromNow = calculateDaysFromNow(item.nextContact);
    const opacity = calculateOpacity(daysFromNow);
    const isEditing = emberEditingId === item.id;
    const isDaysEditing = emberDaysEditingId === item.id;
    
    return (
      <div
        key={item.id}
        className={`ember-item ${index === emberHighlightedIndex ? 'highlighted' : ''} ${isEditing ? 'editing' : ''}`}
        style={{ 
          opacity,
          backgroundColor: index === emberHighlightedIndex ? '#2a2a2a' : 'transparent'
        }}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey) {
            handleEmberReset(item.id);
          } else if (!item.text) {
            // Start editing if item is unnamed
            startEmberEdit(item.id, setEmberEditingId);
          }
        }}
      >
        {isEditing ? (
          <input
            ref={emberEditInputRef}
            defaultValue={item.text}
            onBlur={(e) => handleEmberEditComplete(item.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                handleEmberEditComplete(item.id, e.target.value);
                setEmberDaysEditingId(item.id);
                setTimeout(() => {
                  if (emberDaysInputRef.current) {
                    emberDaysInputRef.current.focus();
                    emberDaysInputRef.current.select();
                  }
                }, 0);
              } else if (e.key === 'Escape') {
                setEmberEditingId(null);
              }
            }}
          />
        ) : (
          <>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                startEmberEdit(item.id, setEmberEditingId);
              }}
              style={{
                cursor: 'text',
                color: item.text ? 'inherit' : '#666'
              }}
            >
              {item.text || '<unnamed>'}
            </span>
            {isDaysEditing ? (
              <input
                ref={emberDaysInputRef}
                className="ember-days-edit"
                defaultValue={daysFromNow}
                onBlur={(e) => {
                  const days = parseInt(e.target.value, 10);
                  if (!isNaN(days) && days > 0) {
                    handleEmberDaysEditComplete(item.id, days);
                  } else {
                    setEmberDaysEditingId(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    const days = parseInt(e.target.value, 10);
                    if (!isNaN(days) && days > 0) {
                      handleEmberDaysEditComplete(item.id, days);
                    } else {
                      setEmberDaysEditingId(null);
                    }
                  } else if (e.key === 'Escape') {
                    setEmberDaysEditingId(null);
                  }
                }}
              />
            ) : (
              <span 
                style={{ color: '#666' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setEmberDaysEditingId(item.id);
                  setTimeout(() => {
                    if (emberDaysInputRef.current) {
                      emberDaysInputRef.current.focus();
                      emberDaysInputRef.current.select();
                    }
                  }, 0);
                }}
              >
                {daysFromNow}d
              </span>
            )}
          </>
        )}
      </div>
    );
  };

  // Add todo handler
  const addTodo = useCallback((text, columnId) => {
    setColumns(prev => {
      const updated = { ...prev };
      const now = new Date().toISOString();
      const newItem = {
        id: createClientId(),
        text,
        createdAt: now,
        updatedAt: now,
        completedAt: columnId === 'done' ? now : null,
      };
      
      updated[columnId] = {
        ...updated[columnId],
        items: columnId === 'done' 
          ? [newItem, ...updated[columnId].items]
          : [...updated[columnId].items, newItem]
      };
      
      return updated;
    });
  }, []);

  // Initialize quick add functionality
  const {
    quickAddInputRef,
    handleQuickAddKeyDown,
    handleQuickAddBlur,
    renderQuickAddInput,
    startEditItem,
    getPreviousColumnId
  } = useQuickAdd({
    addTodo,
    columns,
    quickAddColumn,
    setQuickAddColumn
  });

  // Update renderDraggableItem to show focus state
  const renderDraggableItem = useCallback((provided, snapshot, item, columnId) => (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      className={`todo-item-wrapper ${selectedIds.includes(item.id) ? 'selected' : ''} ${focusedItemId === item.id ? 'keyboard-focused' : ''}`}
      data-id={item.id}
    >
      <SelectableItem
        item={item}
        isSelected={selectedIds.includes(item.id)}
        isFocused={focusedItemId === item.id}
        onClick={(e) => {
          if (e.shiftKey) {
            toggleSelection(item.id, e);
          } else if (e.metaKey || e.ctrlKey) {
            // Command/Ctrl+click to move to DONE from any column
            if (columnId !== 'done') {
              setDoneBlinking(true);
              setTimeout(() => setDoneBlinking(false), 500);
              
              setColumns(prev => {
                const updated = { ...prev };
                const now = new Date().toISOString();
                
                // Remove item from current column
                const sourceColumn = { ...updated[columnId] };
                const movedItem = sourceColumn.items.find(i => i.id === item.id);
                sourceColumn.items = sourceColumn.items.filter(i => i.id !== item.id);
                updated[columnId] = sourceColumn;

                if (!movedItem) {
                  return prev;
                }

                // Add to DONE column with timestamp
                const doneColumn = { ...updated.done };
                doneColumn.items = [
                  { ...movedItem, completedAt: now, updatedAt: now },
                  ...doneColumn.items
                ];
                updated.done = doneColumn;
                
                return updated;
              });
              setSelectedIds([]);
              notifyTipAction('cmd-click-move');
            }
          } else {
            // Regular click just focuses the item
            setFocusedItemId(item.id);
          }
        }}
        onUpdate={(newText) => {
          setColumns(prev => {
            const updated = { ...prev };
            const column = { ...updated[columnId] };
            column.items = column.items.map(i => 
              i.id === item.id ? { ...i, text: newText } : i
            );
            updated[columnId] = column;
            return updated;
          });
        }}
        columnId={columnId}
      />
    </div>
  ), [selectedIds, focusedItemId, setColumns, setSelectedIds, setFocusedItemId, setDoneBlinking, notifyTipAction]);

  return (
    <>
      {isMigrating && <MigrationOverlay onComplete={handleMigrationComplete} />}
      <DragDropContext 
        onDragStart={(start) => {
          setIsRbdDragging(true);
          if (start.client) {
            dragStartPos.current = start.client;
          }
        }}
        onDragEnd={(result) => {
          setIsRbdDragging(false);
          if (!result) return;

          const { source } = result;
          let finalDestination = result.destination;

          // If no destination, try to find nearest column
          if (!finalDestination && result.client) {
            const predictedColumn = findNearestColumn(source.droppableId, result.client);
            if (predictedColumn) {
              finalDestination = {
                droppableId: predictedColumn,
                index: 0  // Add to top of predicted column
              };
            }
          }

          // Reset drag tracking
          dragStartPos.current = null;

          // Validate source and destination
          if (!source || !COLUMN_SEQUENCE.includes(source.droppableId)) {
            throw new Error('Invalid source');
          }

          // If no destination or same location, no action needed
          if (!finalDestination || 
              (finalDestination.droppableId === source.droppableId && 
               finalDestination.index === source.index)) {
            return;
          }

          // Validate destination
          if (!COLUMN_SEQUENCE.includes(finalDestination.droppableId)) {
            throw new Error('Invalid destination');
          }

          setColumns(prev => {
            if (!prev || !prev[source.droppableId] || !prev[finalDestination.droppableId]) {
              return prev;
            }

            const updated = { ...prev };
            const sourceColumn = { ...updated[source.droppableId] };
            const destColumn = { ...updated[finalDestination.droppableId] };

            // Find the item being moved
            const [movedItem] = sourceColumn.items.splice(source.index, 1);
            if (!movedItem) return prev;

            // Update timestamp if moving to DONE column
            const now = new Date().toISOString();
            const movingToDone = finalDestination.droppableId === 'done';
            const updatedItem = {
              ...movedItem,
              completedAt: movingToDone ? now : null,
              updatedAt: now,
            };

            // Insert at new position
            destColumn.items.splice(finalDestination.index, 0, updatedItem);

            updated[source.droppableId] = sourceColumn;
            updated[finalDestination.droppableId] = destColumn;

            return updated;
          });

          if (finalDestination && finalDestination.droppableId !== source.droppableId) {
            notifyTipAction('drag-move');
          }
        }}
      >
        <div 
          className={`app-container ${isRbdDragging ? 'dragging-in-progress' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
        >
          <ProTipTooltip onAction={setTipActionHandler} />
          
          {/* Show selection box while dragging but not during item drag */}
          {isDragging && !isRbdDragging && (
            <div
              className="selection-box"
              style={{
                position: 'fixed',
                left: Math.min(dragStart.x, dragEnd.x),
                top: Math.min(dragStart.y, dragEnd.y),
                width: Math.abs(dragEnd.x - dragStart.x),
                height: Math.abs(dragEnd.y - dragStart.y),
              }}
            />
          )}
          
          <div className="columns">
            {/* DO/DONE Column */}
            <div 
              className={`column ${keyboardFocusedColumn === (showDone ? 'done' : 'do') ? 'keyboard-focused' : ''}`}
            >
              <h2 
                onClick={toggleDoDone}
                className={getEffectiveColumn() === (showDone ? 'done' : 'do') ? 'hovered' : ''}
              >
                {showDone ? (
                  <>
                    <span className="done-text">DO</span> / <span className={doneBlinking ? 'blink-done' : ''}>DONE</span>
                  </>
                ) : (
                  <>
                    DO / <span className={`done-text ${doneBlinking ? 'blink-done' : ''}`}>DONE</span>
                  </>
                )}
              </h2>
              <input
                className="column-search"
                placeholder="🔍"
                value={columnSearch[showDone ? 'done' : 'do']}
                onChange={(e) => handleColumnSearch(showDone ? 'done' : 'do', e.target.value)}
              />
              <StrictModeDroppable droppableId={showDone ? 'done' : 'do'}>
                {(provided, snapshot) => (
                  <div
                    id={`column-${showDone ? 'done' : 'do'}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    onMouseEnter={() => handleColumnHover(showDone ? 'done' : 'do')}
                    onMouseLeave={() => handleColumnHover(null)}
                  >
                    {filterItems(columns[showDone ? 'done' : 'do'].items, showDone ? 'done' : 'do').map((item, index) => (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={index}
                      >
                        {(provided, snapshot) => renderDraggableItem(provided, snapshot, item, showDone ? 'done' : 'do')}
                      </Draggable>
                    ))}
                    {getEffectiveColumn() === (showDone ? 'done' : 'do') && !quickAddColumn && (
                      <div 
                        className="cursor-line"
                        onClick={() => setQuickAddColumn(showDone ? 'done' : 'do')}
                      />
                    )}
                    {renderQuickAddInput(showDone ? 'done' : 'do')}
                    {provided.placeholder}
                  </div>
                )}
              </StrictModeDroppable>
            </div>

            {/* OTHERS/IGNORE Column */}
            <div 
              className={`column ${keyboardFocusedColumn === (showIgnore ? 'ignore' : 'others') ? 'keyboard-focused' : ''}`}
            >
              <h2 
                onClick={toggleOthersIgnore}
                className={getEffectiveColumn() === (showIgnore ? 'ignore' : 'others') ? 'hovered' : ''}
              >
                {showIgnore ? (
                  <>
                    <span className="ignore-text">OTHERS</span> / <span className={ignoreBlinking ? 'blink-ignore' : ''}>IGNORE</span>
                  </>
                ) : (
                  <>
                    OTHERS / <span className={`ignore-text ${ignoreBlinking ? 'blink-ignore' : ''}`}>IGNORE</span>
                  </>
                )}
              </h2>
              <input
                className="column-search"
                placeholder="🔍"
                value={columnSearch[showIgnore ? 'ignore' : 'others']}
                onChange={(e) => handleColumnSearch(showIgnore ? 'ignore' : 'others', e.target.value)}
              />
              <StrictModeDroppable droppableId={showIgnore ? 'ignore' : 'others'}>
                {(provided, snapshot) => (
                  <div
                    id={`column-${showIgnore ? 'ignore' : 'others'}`}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`droppable-area ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                    onMouseEnter={() => handleColumnHover(showIgnore ? 'ignore' : 'others')}
                    onMouseLeave={() => handleColumnHover(null)}
                  >
                    {filterItems(columns[showIgnore ? 'ignore' : 'others'].items, showIgnore ? 'ignore' : 'others').map((item, index) => (
                      <Draggable 
                        key={item.id} 
                        draggableId={item.id} 
                        index={index}
                      >
                        {(provided, snapshot) => renderDraggableItem(provided, snapshot, item, showIgnore ? 'ignore' : 'others')}
                      </Draggable>
                    ))}
                    {getEffectiveColumn() === (showIgnore ? 'ignore' : 'others') && !quickAddColumn && (
                      <div 
                        className="cursor-line"
                        onClick={() => setQuickAddColumn(showIgnore ? 'ignore' : 'others')}
                      />
                    )}
                    {renderQuickAddInput(showIgnore ? 'ignore' : 'others')}
                    {provided.placeholder}
                  </div>
                )}
              </StrictModeDroppable>
            </div>

            {/**
             * Ember column temporarily disabled
             */}
            {false && (
              <div 
                className={`column ${keyboardFocusedColumn === 'ember' ? 'keyboard-focused' : ''}`}
                style={{ minWidth: '250px' }}
              >
                <h2 className={getEffectiveColumn() === 'ember' ? 'hovered' : ''}>
                  EMBER
                </h2>
                <input
                  className="column-search"
                  placeholder="🔍"
                  value={columnSearch.ember}
                  onChange={(e) => handleColumnSearch('ember', e.target.value)}
                />
                <div
                  id="column-ember"
                  className="droppable-area"
                  onMouseEnter={() => handleColumnHover('ember')}
                  onMouseLeave={() => handleColumnHover(null)}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      handleAddEmberContact();
                    }
                  }}
                >
                  {filterItems([...columns.ember.items]
                    .sort((a, b) => new Date(a.nextContact) - new Date(b.nextContact)), 'ember')
                    .map((item, index) => renderEmberItem(item, index))}
                </div>
              </div>
            )}
          </div>
        </div>
        </DragDropContext>
    </>
  );
}

export default BoardApp;