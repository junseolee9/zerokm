import type { Member, EntryMap } from '@/lib/types'

interface Props {
  year: number
  month: number
  selectedDate: string
  entries: EntryMap
  members: Member[]
  onDateSelect: (date: string) => void
}

function getMonthDays(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDay + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function CalendarGrid({ year, month, selectedDate, entries, members, onDateSelect }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const weeks = getMonthDays(year, month)

  return (
    <div className="cal-tbl-w">
      <table className="cal-tbl">
        <thead>
          <tr>
            <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th>
            <th className="sat">Sat</th><th className="sun">Sun</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => {
                if (day === null) return <td key={di} className="c-empty" />
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayMap  = entries[dateStr]

                const present = members.map(m => {
                  const e = dayMap?.[m.id]
                  return { member: m, has: Boolean(e?.text) || Boolean(e?.photo_path), photo: e?.photo_url ?? null }
                })
                const anyone   = present.some(p => p.has)
                const everyone = present.every(p => p.has)

                let cls = 'c-day'
                if (di === 5) cls += ' sat'
                if (di === 6) cls += ' sun'
                if (dateStr === selectedDate) cls += ' sel'
                if (dateStr === today && dateStr !== selectedDate) cls += ' tod'

                return (
                  <td key={di}>
                    <button className={cls} onClick={() => onDateSelect(dateStr)} type="button">
                      <span className="c-n">{day}</span>
                      {anyone && (
                        <span className="c-em">
                          {present.map((p, i) => p.has && (
                            <span key={p.member.id}>
                              {i > 0 && everyone && <span>❤️</span>}
                              <span className="c-em-person" style={{ '--pc': p.member.color } as React.CSSProperties}>
                                {p.member.emoji}
                                {p.photo && (
                                  <span className={`c-em-preview c-em-preview-slot${p.member.slot}`}>
                                    <img src={p.photo} alt={p.member.display_name} />
                                  </span>
                                )}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
