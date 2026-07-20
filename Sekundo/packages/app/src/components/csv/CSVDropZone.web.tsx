/**
 * Component: CSVDropZone.web
 *
 * Web-specific CSV file uploader supporting drag-and-drop overlays
 * and manual file selection. Reads files client-side and triggers parser.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { parseCSV } from '@sekundo/core';

interface CSVDropZoneProps {
  onParsed: (rows: any[]) => void;
  onError: (error: string) => void;
}

export default function CSVDropZone({ onParsed, onError }: CSVDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Invalid file type. Please upload a .csv file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const parsed = parseCSV(text);
        onParsed(parsed);
      } catch (err: any) {
        onError(err.message || 'Failed to parse CSV file.');
      }
    };
    reader.onerror = () => {
      onError('FileReader encountered an error reading the file.');
    };
    reader.readAsText(file);
  };

  if (Platform.OS !== 'web') {
    // Return standard picker placeholder for native views (to be mapped via picker)
    return (
      <View style={styles.mobileContainer}>
        <Text style={styles.subText}>CSV file selection is web-optimized.</Text>
      </View>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: '100%',
        backgroundColor: isDragOver ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.01)',
        borderRadius: '12px',
        border: isDragOver ? '2px dashed #3B82F6' : '1px dashed rgba(255, 255, 255, 0.12)',
        padding: '32px 16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Text style={styles.icon}>📥</Text>
      <Text style={styles.title}>Drag & Drop CSV template here</Text>
      <Text style={styles.subText}>or click to select file from device</Text>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
    </div>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    padding: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subText: {
    color: '#6F7E94',
    fontSize: 12,
    marginTop: 4,
  },
});
