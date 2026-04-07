#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

function printUsage() {
  console.log(`Usage:
  node sdk/js/theme-cli.mjs validate <zipPath> <apiBaseUrl> <token>
  node sdk/js/theme-cli.mjs import <zipPath> <apiBaseUrl> <token>
  node sdk/js/theme-cli.mjs export <themeSlug> <outputZipPath> <apiBaseUrl>`)
}

async function uploadPackage(command, zipPath, apiBaseUrl, token) {
  const buffer = await readFile(zipPath)
  const form = new FormData()
  form.append('file', new Blob([buffer], { type: 'application/zip' }), path.basename(zipPath))

  const response = await fetch(`${apiBaseUrl}/api/v1/themes/${command === 'validate' ? 'validate-package' : 'import-package'}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`)
  }

  console.log(JSON.stringify(payload, null, 2))
}

async function exportPackage(slug, outputZipPath, apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/api/v1/themes/${slug}/export-package`)
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload.error || `Request failed with status ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  await writeFile(outputZipPath, buffer)
  console.log(`Theme package exported to ${outputZipPath}`)
}

async function main() {
  const [command, arg1, arg2, arg3] = process.argv.slice(2)

  if (!command) {
    printUsage()
    process.exitCode = 1
    return
  }

  if (command === 'validate' || command === 'import') {
    if (!arg1 || !arg2 || !arg3) {
      printUsage()
      process.exitCode = 1
      return
    }

    await uploadPackage(command, arg1, arg2.replace(/\/$/, ''), arg3)
    return
  }

  if (command === 'export') {
    if (!arg1 || !arg2 || !arg3) {
      printUsage()
      process.exitCode = 1
      return
    }

    await exportPackage(arg1, arg2, arg3.replace(/\/$/, ''))
    return
  }

  printUsage()
  process.exitCode = 1
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})