import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import {
  getPrimaryBoard,
  getDoDoneColumns,
  listTodos,
  insertTodo,
  updateTodoText,
  moveTodoToColumn,
  updateTodoPosition,
  Todo,
} from '../services/database';
import { computeNewPosition } from '../utils/position';
import ReorderList from '../components/ReorderList';

export default function BoardScreen() {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [doColumnId, setDoColumnId] = useState<string | null>(null);
  const [doneColumnId, setDoneColumnId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<'do' | 'done'>('do');
  const [doTodos, setDoTodos] = useState<Todo[]>([]);
  const [doneTodos, setDoneTodos] = useState<Todo[]>([]);
  const [quickAddText, setQuickAddText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load board and columns on mount
  const loadBoard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const board = await getPrimaryBoard();
      setBoardId(board.id);

      const { doId, doneId } = await getDoDoneColumns(board.id);
      setDoColumnId(doId);
      setDoneColumnId(doneId);

      // Load initial todos
      await loadTodos(board.id, doId, doneId);
    } catch (err: any) {
      setError(err.message || 'Failed to load board');
      Alert.alert('Error', err.message || 'Failed to load board');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load todos for both columns
  const loadTodos = useCallback(
    async (bid: string, doId: string, doneId: string) => {
      try {
        const [doList, doneList] = await Promise.all([
          listTodos(bid, doId),
          listTodos(bid, doneId),
        ]);
        setDoTodos(doList);
        setDoneTodos(doneList);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load todos');
      }
    },
    []
  );


  // Load on mount
  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Refresh when board/columns are loaded
  useEffect(() => {
    if (boardId && doColumnId && doneColumnId) {
      loadTodos(boardId, doColumnId, doneColumnId);
    }
  }, [boardId, doColumnId, doneColumnId, loadTodos]);

  // Quick add todo
  const handleQuickAdd = useCallback(async () => {
    if (!quickAddText.trim() || !boardId) return;

    const columnId = selectedSegment === 'do' ? doColumnId : doneColumnId;
    if (!columnId) return;

    const currentTodos =
      selectedSegment === 'do' ? doTodos : doneTodos;

    // Compute position for top insertion
    const newPosition = computeNewPosition(0, currentTodos);

    try {
      const newTodo = await insertTodo(
        boardId,
        columnId,
        quickAddText.trim(),
        newPosition
      );

      // Update local state
      if (selectedSegment === 'do') {
        setDoTodos([newTodo, ...doTodos]);
      } else {
        setDoneTodos([newTodo, ...doneTodos]);
      }

      setQuickAddText('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add todo');
    }
  }, [
    quickAddText,
    boardId,
    selectedSegment,
    doColumnId,
    doneColumnId,
    doTodos,
    doneTodos,
  ]);

  // Toggle todo between columns
  const handleToggle = useCallback(
    async (todo: Todo) => {
      if (!boardId || !doColumnId || !doneColumnId) return;

      const targetColumnId =
        todo.column_id === doColumnId ? doneColumnId : doColumnId;
      const targetTodos =
        todo.column_id === doColumnId ? doneTodos : doTodos;

      // Compute position for top of target column
      const newPosition = computeNewPosition(0, targetTodos);

      try {
        await moveTodoToColumn(todo.id, targetColumnId, newPosition);

        // Update local state
        if (todo.column_id === doColumnId) {
          setDoTodos(doTodos.filter((t) => t.id !== todo.id));
          setDoneTodos([{ ...todo, column_id: targetColumnId, position: newPosition }, ...doneTodos]);
        } else {
          setDoneTodos(doneTodos.filter((t) => t.id !== todo.id));
          setDoTodos([{ ...todo, column_id: targetColumnId, position: newPosition }, ...doTodos]);
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to toggle todo');
      }
    },
    [boardId, doColumnId, doneColumnId, doTodos, doneTodos]
  );

  // Update todo text
  const handleUpdateText = useCallback(
    async (todo: Todo, text: string) => {
      try {
        await updateTodoText(todo.id, text);

        // Update local state
        if (todo.column_id === doColumnId) {
          setDoTodos(
            doTodos.map((t) => (t.id === todo.id ? { ...t, text } : t))
          );
        } else {
          setDoneTodos(
            doneTodos.map((t) => (t.id === todo.id ? { ...t, text } : t))
          );
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to update todo');
      }
    },
    [doColumnId, doTodos, doneTodos]
  );

  // Reorder todos within column
  const handleReorder = useCallback(
    async (reorderedTodos: Todo[]) => {
      if (!boardId) return;

      const columnId = selectedSegment === 'do' ? doColumnId : doneColumnId;
      if (!columnId) return;

      // Update local state immediately
      if (selectedSegment === 'do') {
        setDoTodos(reorderedTodos);
      } else {
        setDoneTodos(reorderedTodos);
      }

      // Find the moved item (compare with previous order)
      const previousTodos =
        selectedSegment === 'do' ? doTodos : doneTodos;
      const movedTodo = reorderedTodos.find(
        (t, idx) => previousTodos[idx]?.id !== t.id
      );

      if (movedTodo) {
        // Compute new position for the moved item
        const newIndex = reorderedTodos.findIndex((t) => t.id === movedTodo.id);
        const newPosition = computeNewPosition(newIndex, reorderedTodos);

        try {
          await updateTodoPosition(movedTodo.id, newPosition);
        } catch (err: any) {
          // Revert on error
          if (selectedSegment === 'do') {
            setDoTodos(previousTodos);
          } else {
            setDoneTodos(previousTodos);
          }
          Alert.alert('Error', err.message || 'Failed to reorder todo');
        }
      }
    },
    [boardId, selectedSegment, doColumnId, doneColumnId, doTodos, doneTodos]
  );


  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading board...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadBoard}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentTodos = selectedSegment === 'do' ? doTodos : doneTodos;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Segmented Control */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segment,
              selectedSegment === 'do' && styles.segmentActive,
            ]}
            onPress={() => setSelectedSegment('do')}
          >
            <Text
              style={[
                styles.segmentText,
                selectedSegment === 'do' && styles.segmentTextActive,
              ]}
            >
              Do
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segment,
              selectedSegment === 'done' && styles.segmentActive,
            ]}
            onPress={() => setSelectedSegment('done')}
          >
            <Text
              style={[
                styles.segmentText,
                selectedSegment === 'done' && styles.segmentTextActive,
              ]}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Add */}
        <View style={styles.quickAddContainer}>
          <TextInput
            style={styles.quickAddInput}
            placeholder={`Add to ${selectedSegment === 'do' ? 'Do' : 'Done'}...`}
            value={quickAddText}
            onChangeText={setQuickAddText}
            onSubmitEditing={handleQuickAdd}
            returnKeyType="done"
          />
          {quickAddText.trim() && (
            <TouchableOpacity
              style={styles.quickAddButton}
              onPress={handleQuickAdd}
            >
              <Text style={styles.quickAddButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Todo List */}
        {currentTodos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No items in {selectedSegment === 'do' ? 'Do' : 'Done'}
            </Text>
          </View>
        ) : (
          <ReorderList
            todos={currentTodos}
            onToggle={handleToggle}
            onUpdateText={handleUpdateText}
            onReorder={handleReorder}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 8,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#007AFF',
  },
  segmentText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  quickAddContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickAddInput: {
    flex: 1,
    fontSize: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginRight: 8,
  },
  quickAddButton: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  quickAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
