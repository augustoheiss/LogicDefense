import React from 'react'
import { AgentHubModal } from '../Modals/AgentHubModal'

interface OpenPromptsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const OpenPromptsModal: React.FC<OpenPromptsModalProps> = ({ isOpen, onClose }) => {
  return (
    <AgentHubModal
      isOpen={isOpen}
      onClose={onClose}
      initialTab="agent_prompt"
    />
  )
}
