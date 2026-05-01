import { useState, useEffect, useCallback } from 'react'
import { usersService } from '../services/usersService'

const byFullName = (a, b) => a.fullName.localeCompare(b.fullName)

export function useUsers() {
  const [users,         setUsers]         = useState([])
  const [archivedUsers, setArchivedUsers] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [fetchError,    setFetchError]    = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [active, archived] = await Promise.all([
        usersService.list(),
        usersService.archived(),
      ])
      setUsers(active)
      setArchivedUsers(archived)
    } catch {
      setFetchError('Could not load users. The server may be starting up — please retry in a moment.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const createUser = async (payload) => {
    const created = await usersService.create(payload)
    setUsers(prev => [...prev, created].sort(byFullName))
    return created
  }

  const updateUser = async (id, body) => {
    const updated = await usersService.update(id, body)
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u).sort(byFullName))
    return updated
  }

  const applyUpdated = (updated) => {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u).sort(byFullName))
  }

  const removeUser = async (id) => {
    await usersService.remove(id)
    let archivedTarget = null
    setUsers(prev => {
      archivedTarget = prev.find(u => u.id === id) ?? null
      return prev.filter(u => u.id !== id)
    })
    if (archivedTarget) {
      setArchivedUsers(prev => [...prev, archivedTarget].sort(byFullName))
    }
    return archivedTarget
  }

  const applyDeleted = (id) => {
    let archivedTarget = null
    setUsers(prev => {
      archivedTarget = prev.find(u => u.id === id) ?? null
      return prev.filter(u => u.id !== id)
    })
    if (archivedTarget) {
      setArchivedUsers(prev => [...prev, archivedTarget].sort(byFullName))
    }
    return archivedTarget
  }

  const restoreUser = async (id) => {
    const restored = await usersService.restore(id)
    setArchivedUsers(prev => prev.filter(a => a.id !== id))
    setUsers(prev => [...prev, restored].sort(byFullName))
    return restored
  }

  const syncAd = () => usersService.syncAd()

  return {
    users,
    archivedUsers,
    loading,
    fetchError,
    fetchUsers,
    createUser,
    updateUser,
    applyUpdated,
    removeUser,
    applyDeleted,
    restoreUser,
    syncAd,
  }
}
