/**
 * Component: FieldAutoComplete
 *
 * Autocomplete binding input. Searches the active FlatRegistry by label
 * or path key to dynamically resolve structure indices.
 */

import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Pressable, ScrollView } from 'react-native';
import type { FlatRegistry, FlatSkeletonEntry } from '@sekundo/core';

interface FieldAutoCompleteProps {
  flatRegistry: FlatRegistry;
  onSelect: (entry: FlatSkeletonEntry) => void;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export function FieldAutoComplete({
  flatRegistry,
  onSelect,
  value,
  onChangeText,
  placeholder,
}: FieldAutoCompleteProps) {
  const [suggestions, setSuggestions] = useState<FlatSkeletonEntry[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }

    const query = value.toLowerCase();
    const filtered = flatRegistry.filter(
      (entry) =>
        entry.label.toLowerCase().includes(query) ||
        entry.key.toLowerCase().includes(query)
    );
    setSuggestions(filtered);
  }, [value, flatRegistry]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => {
          // Delay closing so press triggers first
          setTimeout(() => setShowDropdown(false), 200);
        }}
        placeholder={placeholder}
        placeholderTextColor="#4F5E74"
      />
      
      {showDropdown && suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
            {suggestions.map((entry) => (
              <Pressable
                key={entry.key}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                onPress={() => {
                  onSelect(entry);
                  setShowDropdown(false);
                }}
              >
                <View>
                  <Text style={styles.itemLabel}>{entry.label}</Text>
                  <Text style={styles.itemKey}>
                    {entry.key} • {entry.type.toUpperCase()}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 100,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 14,
  },
  dropdown: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    maxHeight: 180,
    backgroundColor: '#1E232F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 999,
  },
  scroll: {
    flex: 1,
  },
  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  itemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  itemLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  itemKey: {
    color: '#8A94A6',
    fontSize: 10,
    marginTop: 2,
    fontFamily: 'monospace',
  },
});
