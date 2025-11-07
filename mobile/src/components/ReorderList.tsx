import React from 'react';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { Todo } from '../services/database';
import TodoRow from './TodoRow';

interface ReorderListProps {
  todos: Todo[];
  onToggle: (todo: Todo) => void;
  onUpdateText: (todo: Todo, text: string) => void;
  onReorder: (todos: Todo[]) => void;
}

export default function ReorderList({
  todos,
  onToggle,
  onUpdateText,
  onReorder,
}: ReorderListProps) {
  const renderItem = ({ item, drag, isActive }: RenderItemParams<Todo>) => {
    return (
      <ScaleDecorator>
        <TodoRow
          todo={item}
          onToggle={() => onToggle(item)}
          onUpdateText={(text) => onUpdateText(item, text)}
          drag={drag}
          isActive={isActive}
        />
      </ScaleDecorator>
    );
  };

  return (
    <DraggableFlatList
      data={todos}
      onDragEnd={({ data }) => onReorder(data)}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      activationDistance={10}
    />
  );
}
