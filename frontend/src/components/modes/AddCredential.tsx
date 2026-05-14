import { useState, useEffect, useCallback } from 'react'
import { Globe, User, Key } from 'lucide-react'
import { api } from '../../api/client'
import { fetchFavicon } from '../../utils/favicon'
import PaletteInput from '../PaletteInput'
import { type PaletteMode, type CredentialPreview } from '../../api/types'

interface AddCredentialProps {
  editEntry: CredentialPreview | null
  prefillTitle: string
  generatedPassword: string
  onModeChange: (mode: PaletteMode) => void
  onCredentialsChanged: () => void
}

function AddCredential({ editEntry, prefillTitle, generatedPassword, onModeChange, onCredentialsChanged }: AddCredentialProps) {
  const isEditing = editEntry !== null
  const [formData, setFormData] = useState({
    title: prefillTitle || '',
    username: '',
    password: '',
    url: ''
  })
  const [error, setError] = useState('')
  const [loadedEdit, setLoadedEdit] = useState(false)

  useEffect(() => {
    if (isEditing && editEntry && !loadedEdit) {
      loadFullEntry()
    }
  }, [isEditing, editEntry, loadedEdit])

  useEffect(() => {
    if (generatedPassword) {
      setFormData((prev) => ({ ...prev, password: generatedPassword }))
    }
  }, [generatedPassword])

  const loadFullEntry = async () => {
    try {
      const fullEntry = await api.getFullEntry(editEntry!.id)
      setFormData({
        title: fullEntry.title,
        username: fullEntry.username,
        password: fullEntry.password,
        url: fullEntry.url || ''
      })
      setLoadedEdit(true)
    } catch (error) {
      console.error('Failed to load entry for editing:', error)
    }
  }

  const handleSave = useCallback(async () => {
    setError('')

    if (!formData.title || !formData.username || !formData.password) {
      setError('Title, username, and password are required')
      return
    }

    try {
      let iconUrl: string | undefined
      const url = formData.url.trim() || undefined

      if (url) {
        try {
          const favicon = await fetchFavicon(url)
          if (favicon) {
            iconUrl = favicon
          }
        } catch (favError) {
          console.error('Error fetching favicon:', favError)
        }
      }

      if (isEditing && editEntry) {
        await api.updateEntry({
          id: editEntry.id,
          title: formData.title,
          username: formData.username,
          password: formData.password,
          url,
          iconUrl,
        })
      } else {
        await api.addEntry({
          title: formData.title,
          username: formData.username,
          password: formData.password,
          url,
          iconUrl,
        })
      }

      setFormData({ title: '', username: '', password: '', url: '' })
      onCredentialsChanged()
      onModeChange('search')
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'adding'} entry:`, err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [formData, editEntry, isEditing, onModeChange, onCredentialsChanged])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setFormData({ title: '', username: '', password: '', url: '' })
        setLoadedEdit(false)
        onModeChange('search')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleSave, onModeChange])

  return (
    <>
      <PaletteInput
        value={formData.title}
        onChange={(val) => setFormData({ ...formData, title: val })}
        placeholder={isEditing ? 'Edit website title...' : 'Website title...'}
        icon={Globe}
        autoFocus={true}
      />
      <PaletteInput
        value={formData.username}
        onChange={(val) => setFormData({ ...formData, username: val })}
        placeholder={isEditing ? 'Edit username or email...' : 'Username or email...'}
        icon={User}
      />
      <PaletteInput
        value={formData.password}
        onChange={(val) => setFormData({ ...formData, password: val })}
        placeholder={isEditing ? 'Edit password...' : 'Password...'}
        type="password"
        icon={Key}
      />
      <PaletteInput
        value={formData.url}
        onChange={(val) => setFormData({ ...formData, url: val })}
        placeholder={isEditing ? 'Edit website URL...' : 'Website URL (optional)...'}
        icon={Globe}
      />
      {error && <div className="palette-error">{error}</div>}
      <div className="palette-footer">
        <span className="palette-footer-hint">
          <kbd>Enter</kbd> {isEditing ? 'Update' : 'Save'} <kbd>Esc</kbd> Cancel
        </span>
      </div>
    </>
  )
}

export default AddCredential
