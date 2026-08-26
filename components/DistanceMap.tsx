'use client'

import dynamic from 'next/dynamic'
import type { PlotParams } from 'react-plotly.js'
import tzCoords from '@/lib/tz-coords.json'

const Plot = dynamic<PlotParams>(
  () => import('react-plotly.js'),
  { ssr: false, loading: () => <div className="map-loading" /> }
)

function makeArc(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  n = 120
): { lats: number[]; lons: number[] } {
  const midLat  = (lat1 + lat2) / 2
  const midLon  = (lon1 + lon2) / 2
  const dist    = Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2)
  const ctrlLat = midLat + dist * 0.25
  const lats: number[] = []
  const lons: number[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    lats.push((1 - t) ** 2 * lat1 + 2 * (1 - t) * t * ctrlLat + t ** 2 * lat2)
    lons.push((1 - t) ** 2 * lon1 + 2 * (1 - t) * t * midLon  + t ** 2 * lon2)
  }
  return { lats, lons }
}

interface Props {
  aTz: string
  aColor: string
  aEmoji: string
  bTz: string
  bColor: string
  bEmoji: string
}

export function DistanceMap({ aTz, aColor, aEmoji, bTz, bColor, bEmoji }: Props) {
  const coords = tzCoords as unknown as Record<string, [number, number]>
  const a = coords[aTz]
  const b = coords[bTz]

  if (!a || !b) return null

  const { lats, lons } = makeArc(a[0], a[1], b[0], b[1])
  const mid = Math.floor(lats.length / 2)

  const data: PlotParams['data'] = [
    // outer glow
    {
      type: 'scattergeo' as const,
      lat: lats, lon: lons, mode: 'lines',
      line: { width: 8, color: 'rgba(18,18,18,0.08)' },
      showlegend: false,
    },
    // first member's half
    {
      type: 'scattergeo' as const,
      lat: lats.slice(0, mid + 1), lon: lons.slice(0, mid + 1), mode: 'lines',
      line: { width: 3, color: aColor },
      showlegend: false,
    },
    // second member's half
    {
      type: 'scattergeo' as const,
      lat: lats.slice(mid), lon: lons.slice(mid), mode: 'lines',
      line: { width: 3, color: bColor },
      showlegend: false,
    },
    // City markers
    {
      type: 'scattergeo' as const,
      lat: [a[0], b[0]], lon: [a[1], b[1]], mode: 'markers',
      marker: {
        size: [14, 14],
        color: [aColor, bColor],
        symbol: ['square', 'square'] as unknown as string,
        line: { width: 2, color: '#121212' },
      },
      showlegend: false,
    },
    // Emoji labels
    {
      type: 'scattergeo' as const,
      lat: [a[0], b[0]], lon: [a[1], b[1]], mode: 'text',
      text: [aEmoji, bEmoji],
      textfont: { size: 22 },
      showlegend: false,
    },
  ]

  const layout: PlotParams['layout'] = {
    geo: {
      showland: true,      landcolor: 'rgb(224,224,224)',
      showocean: true,     oceancolor: 'rgb(200,216,232)',
      showcoastlines: true, coastlinecolor: 'rgb(18,18,18)', coastlinewidth: 1,
      showlakes: true,     lakecolor: 'rgb(200,216,232)',
      showcountries: true, countrycolor: 'rgb(160,160,160)', countrywidth: 0.5,
      showframe: true,     framecolor: '#121212', framewidth: 2,
      bgcolor: 'rgb(240,240,240)',
      projection: { type: 'natural earth' },
    },
    paper_bgcolor: 'rgb(240,240,240)',
    margin: { l: 0, r: 0, t: 0, b: 0 },
    height: 360,
  }

  return (
    <Plot
      data={data}
      layout={layout}
      style={{ width: '100%' }}
      config={{ displayModeBar: false, responsive: true }}
    />
  )
}
