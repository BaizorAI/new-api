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
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import { type BlogArticle, type BlogHallDialogType } from '../types'

type BlogHallContextType = {
  open: BlogHallDialogType | null
  setOpen: (str: BlogHallDialogType | null) => void
  currentRow: BlogArticle | null
  setCurrentRow: React.Dispatch<React.SetStateAction<BlogArticle | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const BlogHallContext = React.createContext<BlogHallContextType | null>(null)

export function BlogHallProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useDialogState<BlogHallDialogType>(null)
  const [currentRow, setCurrentRow] = useState<BlogArticle | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <BlogHallContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </BlogHallContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useBlogHall = () => {
  const ctx = React.useContext(BlogHallContext)
  if (!ctx) {
    throw new Error('useBlogHall has to be used within <BlogHallProvider>')
  }
  return ctx
}
