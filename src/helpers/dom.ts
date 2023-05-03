let currentDir: 'ltr' | 'rtl' | 'auto' = 'auto'

function hasDocument() {
  return typeof document !== 'undefined'
}

export function getDocumentDir() {
  if (!hasDocument()) {
    return currentDir
  }
  const direction =
    typeof document.dir !== 'undefined'
      ? document.dir
      : document.getElementsByTagName('html')[0].getAttribute('dir')
  return direction
}

export function setDocumentDir(dir: 'ltr' | 'rtl' | 'auto') {
  if (!hasDocument()) {
    currentDir = dir
    return
  }

  const html = document.getElementsByTagName('html')[0]
  html.setAttribute('dir', dir)
}
