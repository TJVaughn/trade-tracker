import axios from 'axios'

export interface NtfyOptions {
  title: string
  message: string
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent'
  tags?: string[]
  topic: string
}

function normalizeTopic(topic: string): string {
  const trimmed = topic.trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(trimmed)) {
    throw new Error(
      'ntfy topic must be 1-64 characters using only letters, numbers, underscores, or hyphens',
    )
  }
  return trimmed
}

export async function sendNtfy(opts: NtfyOptions): Promise<void> {
  const baseUrl = (process.env.NTFY_BASE_URL || 'https://ntfy.sh').replace(/\/+$/, '')
  const topic = encodeURIComponent(normalizeTopic(opts.topic))
  await axios.post(`${baseUrl}/${topic}`, opts.message, {
    headers: {
      Title: opts.title,
      Priority: opts.priority || 'default',
      Tags: opts.tags?.join(',') || '',
      'Content-Type': 'text/plain',
    },
  })
}
