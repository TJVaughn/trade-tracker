import axios from 'axios'

export interface NtfyOptions {
  title: string
  message: string
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent'
  tags?: string[]
  topic: string
}

export async function sendNtfy(opts: NtfyOptions): Promise<void> {
  const baseUrl = process.env.NTFY_BASE_URL || 'https://ntfy.sh'
  await axios.post(`${baseUrl}/${opts.topic}`, opts.message, {
    headers: {
      Title: opts.title,
      Priority: opts.priority || 'default',
      Tags: opts.tags?.join(',') || '',
      'Content-Type': 'text/plain',
    },
  })
}
