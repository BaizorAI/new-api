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
import { Outlet } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

import { BlogArticleListPanel } from './blog-article-list-panel'

export function BlogHallLayout() {
  return (
    <Main className='p-0'>
      <ResizablePanelGroup orientation='horizontal'>
        <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
          <BlogArticleListPanel />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={75}>
          <Outlet />
        </ResizablePanel>
      </ResizablePanelGroup>
    </Main>
  )
}
