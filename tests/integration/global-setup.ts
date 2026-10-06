import type { TestProject } from 'vitest/node'
import { startStack, type Stack } from './stack'

let stack: Stack | undefined

declare module 'vitest' {
  export interface ProvidedContext {
    stackUrl: string
    stackToken: string
    stackUserId: string
    stackPgPort: number
  }
}

export default async function setup(project: TestProject) {
  stack = await startStack()
  const userId = await stack.createUser('integration@example.com')
  project.provide('stackUrl', stack.url)
  project.provide('stackToken', stack.mintJwt(userId))
  project.provide('stackUserId', userId)
  project.provide('stackPgPort', stack.pgPort)
  return async () => {
    await stack?.stop()
  }
}
