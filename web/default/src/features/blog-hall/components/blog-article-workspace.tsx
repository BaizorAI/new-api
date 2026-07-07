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

import { BlogArticleContent } from './blog-article-content'
import { BlogWorkspaceChatBar } from './blog-workspace-chat-bar'
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

        {/* Scrollable article content */}
        <div className='flex-1 overflow-y-auto'>
          <BlogArticleContent />
        </div>

        {/* Chat section at bottom */}
        <BlogWorkspaceChatBar />
      </div>
    </BlogWorkspaceProvider>
  )
}
