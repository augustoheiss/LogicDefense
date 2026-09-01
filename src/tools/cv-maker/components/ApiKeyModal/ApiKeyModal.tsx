import React from 'react'
import { AgentHubModal } from '../Modals/AgentHubModal'

interface ApiKeyModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated: (newKey: string | null) => void
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onKeyUpdated }) => {
  return (
    <AgentHubModal
      isOpen={isOpen}
      onClose={onClose}
      onKeyUpdated={onKeyUpdated}
      initialTab="api_key"
    />
  )
}
