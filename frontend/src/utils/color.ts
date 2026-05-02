/** Convert a hex color (#rrggbb or #rgb) to the "H S% L%" string that
 *  shadcn/ui CSS variables expect (e.g. "220 70% 50%"). */
export function hexToHsl(hex: string): string {
  const clean = hex.replace('#', '')
  const full  = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean

  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l   = (max + min) / 2
  const d   = max - min

  let h = 0
  let s = 0

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6;               break
      case b: h = ((r - g) / d + 4) / 6;               break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
