export type TabType = 'agent_prompt' | 'master_synthesis' | 'prompts_library' | 'openapi_hub' | 'api_key'

export type PromptPersonaKey =
  | 'base'
  | 'cover_letter'
  | 'master_synthesis'
  | 'professional'
  | 'architect'
  | 'historian'
  | 'didactic'
  | 'alien'

export interface PersonaDefinition {
  title: string
  icon: string
  badge: string
  desc: string
  content: string
}

export interface AgentHubModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated?: (newKey: string | null) => void
  initialTab?: TabType
}
