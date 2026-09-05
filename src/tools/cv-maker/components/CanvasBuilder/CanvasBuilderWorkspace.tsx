import React, { useState, useEffect } from 'react'
import type { CanvasBlockConfig, CanvasColSpan, CVData, CVDesignConfig } from '../../types/cv'
import {
  CANVAS_PRESETS,
  loadSavedCanvasBlocks,
  saveCanvasBlocks
} from '../../services/canvasBuilderService'
import { CanvasBlockPalette } from './CanvasBlockPalette'
import { CanvasA4Sheet } from './CanvasA4Sheet'
import { CanvasBlockInspector } from './CanvasBlockInspector'
import '../../styles/cv-canvas-builder.css'

interface CanvasBuilderWorkspaceProps {
  data: CVData | null
  designConfig: CVDesignConfig
  onRequestGenerateCoverLetter?: () => void
}

export const CanvasBuilderWorkspace: React.FC<CanvasBuilderWorkspaceProps> = ({
  data,
  designConfig,
  onRequestGenerateCoverLetter
}) => {
  const [blocks, setBlocks] = useState<CanvasBlockConfig[]>(() => loadSavedCanvasBlocks())
  const [selectedBlock, setSelectedBlock] = useState<CanvasBlockConfig | null>(null)
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false)

  // Persist blocks on changes
  useEffect(() => {
    saveCanvasBlocks(blocks)
  }, [blocks])

  const handleAddBlock = (newBlock: CanvasBlockConfig) => {
    setBlocks(prev => [...prev, newBlock])
  }

  const handleApplyPreset = (presetId: string) => {
    const preset = CANVAS_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    const newBlocks = preset.blocks.map(b => ({
      ...b,
      id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    }))
    setBlocks(newBlocks)
    setSelectedBlock(null)
  }

  const handleClearCanvas = () => {
    if (blocks.length > 0 && !window.confirm('Deseja realmente limpar todos os blocos da folha A4?')) {
      return
    }
    setBlocks([])
    setSelectedBlock(null)
  }

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    setBlocks(prev => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    if (index >= blocks.length - 1) return
    setBlocks(prev => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleChangeColSpan = (id: string, colSpan: CanvasColSpan) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id ? { ...b, colSpan } : b))
    )
    if (selectedBlock?.id === id) {
      setSelectedBlock(prev => prev ? { ...prev, colSpan } : null)
    }
  }

  const handleOpenInspector = (block: CanvasBlockConfig) => {
    setSelectedBlock(block)
    setIsInspectorOpen(true)
  }

  const handleUpdateBlock = (updated: CanvasBlockConfig) => {
    setBlocks(prev =>
      prev.map(b => (b.id === updated.id ? updated : b))
    )
    setSelectedBlock(updated)
  }

  const handleDeleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
    if (selectedBlock?.id === id) {
      setSelectedBlock(null)
      setIsInspectorOpen(false)
    }
  }

  return (
    <div className="cv-canvas-workspace">
      {/* Left Menu / YAML Palette */}
      <CanvasBlockPalette
        data={data}
        onAddBlock={handleAddBlock}
        onApplyPreset={handleApplyPreset}
        onClearCanvas={handleClearCanvas}
        activeBlockCount={blocks.length}
      />

      {/* Center Blank A4 Sheet & Live Content */}
      <CanvasA4Sheet
        blocks={blocks}
        data={data}
        designConfig={designConfig}
        selectedBlockId={selectedBlock?.id || null}
        onSelectBlock={b => setSelectedBlock(b)}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onChangeColSpan={handleChangeColSpan}
        onOpenInspector={handleOpenInspector}
        onDeleteBlock={handleDeleteBlock}
        onRequestGenerateCoverLetter={onRequestGenerateCoverLetter}
        onLoadPreset={handleApplyPreset}
        onUpdateBlock={handleUpdateBlock}
      />

      {/* Property Inspector Drawer */}
      {isInspectorOpen && (
        <CanvasBlockInspector
          block={selectedBlock}
          onClose={() => setIsInspectorOpen(false)}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
        />
      )}
    </div>
  )
}
