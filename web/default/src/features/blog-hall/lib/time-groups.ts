/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { BlogArticle } from '../types'

export interface TimeGroup {
  label: string
  labelKey: string
  articles: BlogArticle[]
}

function startOfDay(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function groupArticlesByTime(articles: BlogArticle[]): TimeGroup[] {
  const now = new Date()
  const todayStart = startOfDay(now)
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - (now.getDay() * 86_400_000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  const groups: Record<string, BlogArticle[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  }

  for (const article of articles) {
    const ts = article.updated_time * 1000
    if (ts >= todayStart) {
      groups.today.push(article)
    } else if (ts >= yesterdayStart) {
      groups.yesterday.push(article)
    } else if (ts >= weekStart) {
      groups.thisWeek.push(article)
    } else if (ts >= monthStart) {
      groups.thisMonth.push(article)
    } else {
      groups.older.push(article)
    }
  }

  const result: TimeGroup[] = []

  if (groups.today.length > 0) {
    result.push({ label: 'Today', labelKey: 'Today', articles: groups.today })
  }
  if (groups.yesterday.length > 0) {
    result.push({ label: 'Yesterday', labelKey: 'Yesterday', articles: groups.yesterday })
  }
  if (groups.thisWeek.length > 0) {
    result.push({ label: 'This Week', labelKey: 'This Week', articles: groups.thisWeek })
  }
  if (groups.thisMonth.length > 0) {
    result.push({ label: 'This Month', labelKey: 'This Month', articles: groups.thisMonth })
  }
  if (groups.older.length > 0) {
    result.push({ label: 'Older', labelKey: 'Older', articles: groups.older })
  }

  return result
}
