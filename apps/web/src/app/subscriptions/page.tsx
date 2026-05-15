'use client'
import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { FormTypeBadge } from '@/components/form-type-badge'
import { Trash2, Plus, Bell, Mail } from 'lucide-react'

interface Entity {
  id: string
  name: string
}

interface Subscription {
  id: string
  type: 'NTFY' | 'EMAIL'
  endpoint: string
  entityId: string | null
  entity: Entity | null
  formTypes: string[]
  active: boolean
  createdAt: string
}

const ALL_FORM_TYPES = ['FORM_4', 'FORM_13F', 'SCHEDULE_13DG']

const formTypeLabels: Record<string, string> = {
  FORM_4: 'Form 4',
  FORM_13F: 'Form 13F',
  SCHEDULE_13DG: '13D/G',
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [subType, setSubType] = useState<'NTFY' | 'EMAIL'>('NTFY')
  const [endpoint, setEndpoint] = useState('')
  const [entityId, setEntityId] = useState('')
  const [formTypes, setFormTypes] = useState<string[]>([...ALL_FORM_TYPES])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [subsRes, entitiesRes] = await Promise.all([
        fetch('/api/subscriptions'),
        fetch('/api/entities?limit=200'),
      ])
      const subsData = await subsRes.json()
      const entitiesData = await entitiesRes.json()
      setSubscriptions(subsData)
      setEntities(entitiesData.entities ?? [])
    } catch {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleToggleActive(sub: Subscription) {
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !sub.active }),
      })
      if (res.ok) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, active: !s.active } : s))
        )
      }
    } catch {
      // silently fail
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this subscription?')) return
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSubscriptions((prev) => prev.filter((s) => s.id !== id))
      }
    } catch {
      // silently fail
    }
  }

  function toggleFormType(ft: string) {
    setFormTypes((prev) =>
      prev.includes(ft) ? prev.filter((f) => f !== ft) : [...prev, ft]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!endpoint.trim()) {
      setFormError('Endpoint is required')
      return
    }
    if (formTypes.length === 0) {
      setFormError('Select at least one form type')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: subType,
          endpoint: endpoint.trim(),
          entityId: entityId || undefined,
          formTypes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error ?? 'Failed to create subscription')
        return
      }

      const newSub = await res.json()
      setSubscriptions((prev) => [newSub, ...prev])
      setEndpoint('')
      setEntityId('')
      setFormTypes([...ALL_FORM_TYPES])
      setSubType('NTFY')
    } catch {
      setFormError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Subscriptions</h1>
        <p className="text-gray-400 text-sm mt-1">Manage notifications for new SEC filings</p>
      </div>

      {/* Add Subscription Form */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type Radio */}
            <div className="space-y-2">
              <Label className="text-gray-300">Notification Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="NTFY"
                    checked={subType === 'NTFY'}
                    onChange={() => setSubType('NTFY')}
                    className="accent-blue-500"
                  />
                  <span className="text-gray-300 text-sm flex items-center gap-1">
                    <Bell className="h-4 w-4" /> ntfy.sh
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="EMAIL"
                    checked={subType === 'EMAIL'}
                    onChange={() => setSubType('EMAIL')}
                    className="accent-blue-500"
                  />
                  <span className="text-gray-300 text-sm flex items-center gap-1">
                    <Mail className="h-4 w-4" /> Email
                  </span>
                </label>
              </div>
            </div>

            {/* Endpoint */}
            <div className="space-y-1.5">
              <Label htmlFor="endpoint" className="text-gray-300">
                {subType === 'NTFY' ? 'ntfy.sh Topic URL' : 'Email Address'}
              </Label>
              <Input
                id="endpoint"
                type={subType === 'EMAIL' ? 'email' : 'text'}
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={
                  subType === 'NTFY'
                    ? 'https://ntfy.sh/your-topic'
                    : 'you@example.com'
                }
                required
                className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
              />
            </div>

            {/* Entity Select */}
            <div className="space-y-1.5">
              <Label htmlFor="entity" className="text-gray-300">
                Entity (leave blank for all entities)
              </Label>
              <select
                id="entity"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-1 text-sm text-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Entities</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Form Types */}
            <div className="space-y-2">
              <Label className="text-gray-300">Form Types</Label>
              <div className="flex gap-4">
                {ALL_FORM_TYPES.map((ft) => (
                  <label key={ft} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formTypes.includes(ft)}
                      onChange={() => toggleFormType(ft)}
                      className="accent-blue-500"
                    />
                    <span className="text-gray-300 text-sm">{formTypeLabels[ft]}</span>
                  </label>
                ))}
              </div>
            </div>

            {formError && <p className="text-red-400 text-sm">{formError}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Subscription'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Subscriptions List */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-100 text-lg">
            Active Subscriptions ({subscriptions.filter((s) => s.active).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading && (
            <p className="text-gray-400 text-sm p-6">Loading subscriptions...</p>
          )}
          {error && (
            <p className="text-red-400 text-sm p-6">{error}</p>
          )}
          {!loading && subscriptions.length === 0 && (
            <p className="text-gray-400 text-sm p-6">
              No subscriptions yet. Create one above to start receiving notifications.
            </p>
          )}
          <div className="divide-y divide-gray-700">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="px-6 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                        sub.type === 'NTFY'
                          ? 'bg-blue-900 text-blue-300 border-blue-700'
                          : 'bg-teal-900 text-teal-300 border-teal-700'
                      }`}
                    >
                      {sub.type === 'NTFY' ? (
                        <><Bell className="h-3 w-3" /> ntfy</>
                      ) : (
                        <><Mail className="h-3 w-3" /> email</>
                      )}
                    </span>
                    <span className="text-gray-100 text-sm font-mono truncate max-w-xs">
                      {sub.endpoint}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-400 text-xs">
                      {sub.entity ? sub.entity.name : 'All Entities'}
                    </span>
                    <Separator orientation="vertical" className="h-3 bg-gray-600" />
                    <div className="flex gap-1 flex-wrap">
                      {sub.formTypes.map((ft) => (
                        <FormTypeBadge key={ft} formType={ft} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(sub)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      sub.active ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                    title={sub.active ? 'Deactivate' : 'Activate'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                        sub.active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-gray-400 w-16">
                    {sub.active ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(sub.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
