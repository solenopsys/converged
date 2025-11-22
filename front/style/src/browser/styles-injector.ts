export function injectStyle(text) {
    if (typeof document !== 'undefined') {
      const styleTag = document.getElementById('bun_lightningcss')

      if (styleTag) {
        const node = document.createTextNode(text)
        styleTag.appendChild(node)
        return
      }

      var style = document.createElement('style')
      style.id = 'bun_lightningcss'
      var node = document.createTextNode(text)
      style.appendChild(node)
      document.head.appendChild(style)
    }
  }