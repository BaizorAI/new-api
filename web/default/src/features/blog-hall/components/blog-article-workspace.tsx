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
import { useParams } from '@tanstack/react-router'
import { useState } from 'react'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

import { BlogArticleContent } from './blog-article-content'
import { BlogArticleListPanel } from './blog-article-list-panel'
import { BlogWorkspaceChatPanel } from './blog-workspace-chat-panel'
import { BlogWorkspaceProvider } from './blog-workspace-provider'
import { BlogWorkspaceToolbar } from './blog-workspace-toolbar'

export function BlogArticleWorkspace() {
  const { articleId } = useParams({
    from: '/_authenticated/blog-hall/$articleId/',
  })
  const id = Number(articleId)
  const [showArticleList, setShowArticleList] = useState(false)

  return (
    <BlogWorkspaceProvider articleId={id}>
      <div className='flex h-full flex-col overflow-hidden'>
        <BlogWorkspaceToolbar
          showArticleList={showArticleList}
          onToggleArticleList={() => setShowArticleList((prev) => !prev)}
        />

        <div className='flex min-h-0 flex-1'>
          <aside
            className={`border-border flex flex-col border-r bg-muted/20 transition-all duration-200 ${
              showArticleList ? 'w-64' : 'w-0'
            }`}
          >
            {showArticleList && (
              <div className='flex h-full flex-col overflow-hidden'>
                <BlogArticleListPanel />
              </div>
            )}
          </aside>

          <ResizablePanelGroup orientation='horizontal' className='min-h-0 flex-1'>
            <ResizablePanel defaultSize={55} minSize={30} className='flex flex-col'>
              <BlogArticleContent />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={45} minSize={25} className='flex flex-col'>
              <BlogWorkspaceChatPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </BlogWorkspaceProvider>
  )
}
