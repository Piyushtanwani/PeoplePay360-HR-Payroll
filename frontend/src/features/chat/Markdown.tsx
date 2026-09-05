import * as React from 'react'

/**
 * Small markdown renderer for assistant replies.
 * Builds React elements rather than HTML, so model output can never inject markup.
 * Supports headings, bold, italic, inline code, fenced code, lists, blockquotes and links.
 */

type Inline = string | React.ReactElement

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^\s)]+\))/g

function renderInline(text: string, keyPrefix: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  let match: RegExpExecArray | null
  const re = new RegExp(INLINE)
  let i = 0

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index))
    const token = match[0]
    const key = `${keyPrefix}-i${i++}`

    if (token.startsWith('**') || token.startsWith('__')) {
      out.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      out.push(
        <code key={key} className="rounded bg-surface2 px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const split = token.indexOf('](')
      const label = token.slice(1, split)
      const href = token.slice(split + 2, -1)
      out.push(
        <a key={key} href={href} target="_blank" rel="noreferrer noopener" className="text-accent underline underline-offset-2">
          {label}
        </a>,
      )
    } else {
      out.push(<em key={key} className="italic">{token.slice(1, -1)}</em>)
    }
    last = match.index + token.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function CodeBlock({ code, lang }: { code: string; lang: string | null }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    void navigator.clipboard?.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  return (
    <div className="group/code relative my-3 overflow-hidden rounded-card border border-separator bg-surface2/60">
      <div className="flex items-center justify-between border-b border-separator px-3 py-1.5">
        <span className="font-mono text-xs2 text-label2">{lang || 'code'}</span>
        <button onClick={copy} className="text-xs2 text-label2 transition-colors hover:text-label">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2.5"><code className="font-mono text-sm2 leading-relaxed">{code}</code></pre>
    </div>
  )
}

export function Markdown({ text }: { text: string }) {
  const blocks = React.useMemo(() => {
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    const nodes: React.ReactElement[] = []
    let para: string[] = []
    let list: { ordered: boolean; items: string[] } | null = null
    let k = 0

    const flushPara = () => {
      if (!para.length) return
      const body = para.join(' ')
      nodes.push(<p key={`p${k++}`} className="my-2 first:mt-0 last:mb-0">{renderInline(body, `p${k}`)}</p>)
      para = []
    }
    const flushList = () => {
      if (!list) return
      const Tag = list.ordered ? 'ol' : 'ul'
      const cls = list.ordered ? 'my-2 list-decimal space-y-1 pl-5' : 'my-2 list-disc space-y-1 pl-5'
      nodes.push(
        React.createElement(
          Tag,
          { key: `l${k++}`, className: cls },
          list.items.map((item, idx) => <li key={idx}>{renderInline(item, `l${k}-${idx}`)}</li>),
        ),
      )
      list = null
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      const fence = line.match(/^```(\w+)?\s*$/)
      if (fence) {
        flushPara(); flushList()
        const lang = fence[1] ?? null
        const buf: string[] = []
        i++
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
        nodes.push(<CodeBlock key={`c${k++}`} code={buf.join('\n')} lang={lang} />)
        continue
      }

      if (!line.trim()) { flushPara(); flushList(); continue }

      const heading = line.match(/^(#{1,4})\s+(.*)$/)
      if (heading) {
        flushPara(); flushList()
        const level = heading[1].length
        const size = level <= 2 ? 'text-[1.05em]' : 'text-body'
        nodes.push(
          <p key={`h${k++}`} className={`mb-1 mt-3 font-semibold first:mt-0 ${size}`}>
            {renderInline(heading[2], `h${k}`)}
          </p>,
        )
        continue
      }

      const quote = line.match(/^>\s?(.*)$/)
      if (quote) {
        flushPara(); flushList()
        nodes.push(
          <blockquote key={`q${k++}`} className="my-2 border-l-2 border-separator pl-3 text-label2">
            {renderInline(quote[1], `q${k}`)}
          </blockquote>,
        )
        continue
      }

      const bullet = line.match(/^\s*[-*+]\s+(.*)$/)
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
      if (bullet || numbered) {
        flushPara()
        const ordered = Boolean(numbered)
        const content = (bullet ? bullet[1] : numbered![1])
        if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
        list.items.push(content)
        continue
      }

      if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
        flushPara(); flushList()
        nodes.push(<hr key={`r${k++}`} className="my-3 border-separator" />)
        continue
      }

      flushList()
      para.push(line.trim())
    }
    flushPara(); flushList()
    return nodes
  }, [text])

  return <div className="text-body leading-[1.65]">{blocks}</div>
}
