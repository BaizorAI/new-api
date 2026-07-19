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
import { useBlogWorkspace } from './blog-workspace-provider'
import { BlogArticleEditor } from './blog-article-editor'

export function BlogArticleContent() {
  const {
    article,
    content,
    setContent,
    title,
    setTitle,
    summary,
    setSummary,
    coverImage,
    selectedParagraphIndex,
    selectParagraph,
    generatingField,
    requestGenTitle,
    requestGenSummary,
  } = useBlogWorkspace()

  return (
    <BlogArticleEditor
      content={content}
      setContent={setContent}
      title={title}
      setTitle={setTitle}
      summary={summary}
      setSummary={setSummary}
      coverImage={coverImage}
      articleId={article?.id}
      selectedParagraphIndex={selectedParagraphIndex}
      onSelectParagraph={selectParagraph}
      generatingField={generatingField}
      onGenerateTitle={requestGenTitle}
      onGenerateSummary={requestGenSummary}
    />
  )
}
