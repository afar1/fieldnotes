import { supabase } from './supabase';
import Constants from 'expo-constants';
import { computeNewPosition } from '../utils/position';

// Types matching Supabase schema
export interface Todo {
  id: string;
  board_id: string;
  column_id: string;
  text: string;
  position: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Column {
  id: string;
  board_id: string;
  slug: string;
  name: string;
  created_at: string;
}

export interface Board {
  id: string;
  slug: string;
  name: string;
  owner_id: string;
  created_at: string;
}

/**
 * Get the primary board for the current user.
 * First tries BOARD_SLUG from config, then falls back to first user-owned board.
 */
export async function getPrimaryBoard(): Promise<Board> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const boardSlug = Constants.expoConfig?.extra?.BOARD_SLUG;
  
  if (boardSlug) {
    // Try to find board by slug first
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('slug', boardSlug)
      .eq('owner_id', user.id)
      .single();
    
    if (!error && data) {
      return data;
    }
  }

  // Fall back to first user-owned board
  const { data, error } = await supabase
    .from('boards')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('No board found. Please create a board first.');
  }

  return data;
}

/**
 * Get the Do and Done column IDs for a board.
 * Caches the result in memory for the session.
 */
let columnCache: { boardId: string; doId: string; doneId: string } | null = null;

export async function getDoDoneColumns(boardId: string): Promise<{
  doId: string;
  doneId: string;
}> {
  // Return cached result if available
  if (columnCache && columnCache.boardId === boardId) {
    return { doId: columnCache.doId, doneId: columnCache.doneId };
  }

  const { data, error } = await supabase
    .from('columns')
    .select('id, slug')
    .eq('board_id', boardId)
    .in('slug', ['do', 'done']);

  if (error) throw error;
  if (!data || data.length !== 2) {
    throw new Error('Do/Done columns not found. Please ensure your board has these columns.');
  }

  const doColumn = data.find((c) => c.slug === 'do');
  const doneColumn = data.find((c) => c.slug === 'done');

  if (!doColumn || !doneColumn) {
    throw new Error('Do/Done columns not found.');
  }

  // Cache the result
  columnCache = {
    boardId,
    doId: doColumn.id,
    doneId: doneColumn.id,
  };

  return { doId: doColumn.id, doneId: doneColumn.id };
}

/**
 * List todos for a column, ordered by position descending, then created_at descending.
 */
export async function listTodos(
  boardId: string,
  columnId: string
): Promise<Todo[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('board_id', boardId)
    .eq('column_id', columnId)
    .eq('owner_id', user.id)
    .order('position', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Insert a new todo at the specified position.
 */
export async function insertTodo(
  boardId: string,
  columnId: string,
  text: string,
  position: number
): Promise<Todo> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('todos')
    .insert({
      board_id: boardId,
      column_id: columnId,
      text,
      position,
      owner_id: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update the text of a todo.
 */
export async function updateTodoText(id: string, text: string): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .update({ text })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Move a todo to a different column and position.
 */
export async function moveTodoToColumn(
  id: string,
  targetColumnId: string,
  position: number
): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .update({
      column_id: targetColumnId,
      position,
    })
    .eq('id', id);

  if (error) throw error;
}

/**
 * Update the position of a todo within its column.
 */
export async function updateTodoPosition(
  id: string,
  position: number
): Promise<void> {
  const { error } = await supabase
    .from('todos')
    .update({ position })
    .eq('id', id);

  if (error) throw error;
}
