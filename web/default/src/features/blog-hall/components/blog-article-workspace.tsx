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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

import { BlogArticleContent } from './blog-article-content'
import { BlogWorkspaceChatPanel } from './blog-workspace-chat-panel'
import { BlogWorkspaceProvider } from './blog-workspace-provider'
import { BlogWorkspaceToolbar } from './blog-workspace-toolbar'

export function BlogArticleWorkspace() {
  const { articleId } = useParams({
    from: '/_authenticated/blog-hall/$articleId/',
  })
  const id = Number(articleId)

  return (
    <BlogWorkspaceProvider articleId={id}>
      <div className='flex h-full flex-col overflow-hidden'>
        <BlogWorkspaceToolbar />

        {/* Two-column layout: article content (left) + AI chat (right) */}
        <ResizablePanelGroup orientation='horizontal' className='min-h-0 flex-1'>
          {/* Left panel: Article content with paragraph selection */}
          <ResizablePanel defaultSize={55} minSize={30} className='flex flex-col'>
            <BlogArticleContent />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: AI Chat */}
          <ResizablePanel defaultSize={45} minSize={25} className='flex flex-col'>
            <BlogWorkspaceChatPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </BlogWorkspaceProvider>
  )
}
