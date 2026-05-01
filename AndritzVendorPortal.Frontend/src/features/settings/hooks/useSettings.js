import { useState } from 'react'
import { settingsService } from '../services/settingsService'

export function useSettings() {
  const [saving, setSaving] = useState(false)

  const updateProfile = async (payload) => {
    setSaving(true)
    try {
      return await settingsService.updateProfile(payload)
    } finally {
      setSaving(false)
    }
  }

  return { saving, updateProfile }
}
