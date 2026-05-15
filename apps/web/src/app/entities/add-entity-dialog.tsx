'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'

export function AddEntityDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cik, setCik] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'PERSON' | 'COMPANY'>('PERSON')
  const [description, setDescription] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cik, name, type, description: description || undefined }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create entity')
        return
      }

      setOpen(false)
      setCik('')
      setName('')
      setType('PERSON')
      setDescription('')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Entity
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700 text-gray-100">
        <DialogHeader>
          <DialogTitle>Add Entity</DialogTitle>
          <DialogDescription className="text-gray-400">
            Add a new person or company to track SEC filings for.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cik">CIK</Label>
            <Input
              id="cik"
              value={cik}
              onChange={(e) => setCik(e.target.value)}
              placeholder="e.g. 0001234567"
              required
              className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elon Musk"
              required
              className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'PERSON' | 'COMPANY')}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                <SelectItem value="PERSON" className="text-gray-100">Person</SelectItem>
                <SelectItem value="COMPANY" className="text-gray-100">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={3}
              className="flex w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Entity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
