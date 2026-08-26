export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088
  const toRad = (d: number) => (d * Math.PI) / 180
  const phi1 = toRad(lat1), phi2 = toRad(lat2)
  const dphi = toRad(lat2 - lat1)
  const dlam = toRad(lon2 - lon1)
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
