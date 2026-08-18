import type { VercelRequest, VercelResponse } from '@vercel/node'
import { promises as dns } from 'node:dns'
import { isIP } from 'node:net'
import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'

const MIN_ARTICLE_LENGTH = 100
const FETCH_TIMEOUT_MS = 10_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url : null
  if (!rawUrl) {
    res.status(400).json({ error: 'Missing url query parameter' })
    return
  }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    res.status(400).json({ error: 'Invalid URL' })
    return
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http/https URLs are supported' })
    return
  }

  const blockedReason = await getBlockedReason(target.hostname)
  if (blockedReason) {
    res.status(400).json({ error: `URL not allowed: ${blockedReason}` })
    return
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(target.toString(), {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TextSummarizerBot/1.0)' },
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      res.status(502).json({ error: `Failed to fetch the page (status ${response.status})` })
      return
    }

    const html = await response.text()
    const { document } = parseHTML(html)
    const reader = new Readability(document as unknown as Document)
    const article = reader.parse()

    if (!article?.textContent || article.textContent.trim().length < MIN_ARTICLE_LENGTH) {
      res.status(422).json({ error: 'Could not extract readable article content from this page' })
      return
    }

    res.status(200).json({ title: article.title ?? '', text: article.textContent.trim() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error fetching article'
    res.status(500).json({ error: message })
  }
}

// Basic SSRF guard: reject IP-literal hosts and hostnames that resolve to
// private/loopback/link-local addresses (e.g. localhost, 169.254.169.254
// cloud metadata endpoints, internal 10.x/172.16.x/192.168.x ranges).
async function getBlockedReason(hostname: string): Promise<string | null> {
  if (isIP(hostname)) {
    return isPrivateOrReservedIp(hostname) ? 'points to a private/reserved IP' : null
  }

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return 'points to localhost'
  }

  try {
    const records = await dns.lookup(hostname, { all: true })
    for (const record of records) {
      if (isPrivateOrReservedIp(record.address)) {
        return `resolves to a private/reserved IP (${record.address})`
      }
    }
  } catch {
    return 'could not be resolved'
  }

  return null
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts
    if (a === 127) return true // loopback
    if (a === 10) return true // private
    if (a === 169 && b === 254) return true // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
    if (a === 0) return true // "this network"
    return false
  }
  if (isIP(ip) === 6) {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true // loopback
    if (normalized.startsWith('fe80:') || normalized.startsWith('fe80::')) return true // link-local
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // unique local
    return false
  }
  return false
}
