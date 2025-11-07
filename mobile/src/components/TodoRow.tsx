import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Todo } from '../services/database';

interface TodoRowProps {
  todo: Todo;
  onToggle: () => void;
  onUpdateText: (text: string) => void;
  drag?: () => void;
  isActive?: boolean;
}

export default function TodoRow({
  todo,
  onToggle,
  onUpdateText,
  drag,
  isActive,
}: TodoRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const translateX = useSharedValue(0);

  // Swipe right gesture to toggle
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow swiping right
      if (e.translationX > 0) {
        translateX.value = Math.min(e.translationX, 100);
      }
    })
    .onEnd((e) => {
      if (e.translationX > 50) {
        // Swipe threshold reached, trigger toggle
        runOnJS(onToggle)();
      }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleTextSubmit = () => {
    if (editText.trim() && editText !== todo.text) {
      onUpdateText(editText.trim());
    }
    setIsEditing(false);
  };

  const handleTextBlur = () => {
    handleTextSubmit();
  };

  const handlePress = () => {
    if (!isActive) {
      setIsEditing(true);
      setEditText(todo.text);
    }
  };

  const handleLongPress = () => {
    if (drag && !isEditing) {
      drag();
    }
  };

  if (isEditing) {
    return (
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          value={editText}
          onChangeText={setEditText}
          onSubmitEditing={handleTextSubmit}
          onBlur={handleTextBlur}
          autoFocus
          multiline
        />
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <TouchableOpacity
          style={styles.touchable}
          onPress={handlePress}
          onLongPress={handleLongPress}
          activeOpacity={0.7}
        >
          <Text style={styles.text}>{todo.text}</Text>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  touchable: {
    flex: 1,
  },
  text: {
    fontSize: 16,
    color: '#000',
  },
  input: {
    fontSize: 16,
    color: '#000',
    padding: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
