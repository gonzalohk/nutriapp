import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// Every user-facing string must come from the translation dictionaries (constitution Principle I).
const ROOT = join(import.meta.dirname, '..', '..', 'src')
const TEXT_ATTRIBUTES = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label'])
const HAS_LETTERS = /\p{L}/u

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === 'i18n' ? [] : files(path)
    return path.endsWith('.tsx') ? [path] : []
  })
}

function offenders(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const report = (node: ts.Node, text: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart())
    found.push(`${path.replace(ROOT, 'src')}:${line + 1}  "${text.trim()}"`)
  }
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && HAS_LETTERS.test(node.text)) report(node, node.text)
    if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.has(node.name.getText()) && node.initializer && ts.isStringLiteral(node.initializer)) {
      if (HAS_LETTERS.test(node.initializer.text)) report(node, node.initializer.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('no hard-coded user-facing text', () => {
  it('finds none in the screens and components (all text goes through t())', () => {
    expect(files(ROOT).flatMap(offenders)).toEqual([])
  })

  it('the detector itself catches a violation', () => {
    const sample = ts.createSourceFile('x.tsx', '<button aria-label="Cerrar">Hola</button>', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    let hits = 0
    const visit = (n: ts.Node) => {
      if (ts.isJsxText(n) && HAS_LETTERS.test(n.text)) hits++
      if (ts.isJsxAttribute(n) && ts.isStringLiteral(n.initializer!) && HAS_LETTERS.test(n.initializer.text)) hits++
      ts.forEachChild(n, visit)
    }
    visit(sample)
    expect(hits).toBe(2)
  })
})
