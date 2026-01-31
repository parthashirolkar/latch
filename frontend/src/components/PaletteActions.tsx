import { LucideIcon } from 'lucide-react'
import { Key, User, ArrowLeft, LogOut, Edit } from 'lucide-react'

export interface Action {
  id: string
  title: string
  subtitle?: string
  icon: LucideIcon
  handler: () => void | Promise<void>
}

export function createEntryActions(
  entryId: string,
  entryTitle: string,
  onCopyPassword: (id: string) => Promise<void>,
  onCopyUsername: (id: string) => Promise<void>,
  onEdit: (id: string) => void | Promise<void>,
  onLock: () => void,
  onBack: () => void
): Action[] {
  return [
    {
      id: 'copy-password',
      title: 'Copy Password',
      subtitle: entryTitle,
      icon: Key,
      handler: () => onCopyPassword(entryId),
    },
    {
      id: 'copy-username',
      title: 'Copy Username',
      subtitle: entryTitle,
      icon: User,
      handler: () => onCopyUsername(entryId),
    },
    {
      id: 'edit',
      title: 'Edit Entry',
      subtitle: entryTitle,
      icon: Edit,
      handler: () => onEdit(entryId),
    },
    {
      id: 'back',
      title: 'Back to Search',
      icon: ArrowLeft,
      handler: onBack,
    },
    {
      id: 'lock',
      title: 'Lock Vault',
      icon: LogOut,
      handler: onLock,
    },
  ]
}
