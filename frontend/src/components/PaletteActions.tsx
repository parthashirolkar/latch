export interface Action {
  id: string
  title: string
  subtitle?: string
  icon: string
  handler: () => void | Promise<void>
}

export function createEntryActions(
  entryId: string,
  entryTitle: string,
  onCopyPassword: (id: string) => Promise<void>,
  onCopyUsername: (id: string) => Promise<void>,
  onLock: () => void,
  onBack: () => void
): Action[] {
  return [
    {
      id: 'copy-password',
      title: 'Copy Password',
      subtitle: entryTitle,
      icon: '🔑',
      handler: () => onCopyPassword(entryId),
    },
    {
      id: 'copy-username',
      title: 'Copy Username',
      subtitle: entryTitle,
      icon: '👤',
      handler: () => onCopyUsername(entryId),
    },
    {
      id: 'back',
      title: 'Back to Search',
      icon: '←',
      handler: onBack,
    },
    {
      id: 'lock',
      title: 'Lock Vault',
      icon: '🔒',
      handler: onLock,
    },
  ]
}
