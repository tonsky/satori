import gradient from 'gradient-parser'

interface Background {
  attachment: string
  color?: string
  clip: string
  image: string
  origin: string
  position: string
  size: string
  repeat: string
}

function resolveColorFromStop(stop) {
  if (stop.type === 'literal') return stop.value
  if (stop.type === 'hex') return `#${stop.value}`
  if (stop.type === 'rgb') return `rgb(${stop.value.join(',')})`
  if (stop.type === 'rgba') return `rgba(${stop.value.join(',')})`
  return 'transparent'
}

export default function backgroundImage(
  { id, width }: { id: string; width: number; height: number },
  { image }: Background
) {
  if (image.startsWith('linear-gradient(')) {
    const parsed = gradient.parse(image)[0]

    // Calculate the direction.
    let x1, y1, x2, y2
    if (parsed.orientation.type === 'directional') {
      ;[x1, y1, x2, y2] = {
        top: [0, 1, 0, 0],
        bottom: [0, 0, 0, 1],
        left: [1, 0, 0, 0],
        right: [0, 0, 1, 0],
      }[parsed.orientation.value]
    } else if (parsed.orientation.type === 'angular') {
      const angle = (+parsed.orientation.value / 180) * Math.PI - Math.PI / 2
      const c = Math.cos(angle)
      const s = Math.sin(angle)

      x1 = 0
      y1 = 0
      x2 = c
      y2 = s
      if (x2 < 0) {
        x1 -= x2
        x2 = 0
      }
      if (y2 < 0) {
        y1 -= y2
        y2 = 0
      }
    }

    // @TODO
    const totalLength = width

    // Resolve the color stops based on the spec:
    // https://drafts.csswg.org/css-images/#color-stop-syntax
    const stops = []
    for (const stop of parsed.colorStops) {
      const color = resolveColorFromStop(stop)
      if (!stops.length) {
        // First stop, ensure it's at the start.
        stops.push({
          offset: 0,
          color,
        })

        if (typeof stop.length === 'undefined') continue
        if (stop.length.value === '0') continue
      }

      // All offsets are relative values (0-1) in SVG.
      const offset =
        typeof stop.length === 'undefined'
          ? undefined
          : stop.length.type === '%'
          ? stop.length.value / 100
          : stop.length.value / totalLength

      stops.push({
        offset,
        color,
      })
    }
    if (!stops.length) {
      stops.push({
        offset: 0,
        color: 'transparent',
      })
    }
    // Last stop, ensure it's at the end.
    const lastStop = stops[stops.length - 1]
    if (lastStop.offset !== 1) {
      if (typeof lastStop.offset === 'undefined') {
        lastStop.offset = 1
      } else {
        stops.push({
          offset: 1,
          color: lastStop.color,
        })
      }
    }

    let previousStop = 0
    let nextStop = 1
    // Evenly distribute the missing stop offsets.
    for (let i = 0; i < stops.length; i++) {
      if (typeof stops[i].offset === 'undefined') {
        // Find the next stop that has an offset.
        if (nextStop < i) nextStop = i
        while (typeof stops[nextStop].offset === 'undefined') nextStop++

        stops[i].offset =
          ((stops[nextStop].offset - stops[previousStop].offset) /
            (nextStop - previousStop)) *
            (i - previousStop) +
          stops[previousStop].offset
      } else {
        previousStop = i
      }
    }

    return [
      `satori_lg${id}`,
      `<linearGradient id="satori_lg${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops
        .map(
          (stop) =>
            `<stop offset="${stop.offset * 100}%" stop-color="${stop.color}"/>`
        )
        .join('')}</linearGradient>`,
    ]
  }
}