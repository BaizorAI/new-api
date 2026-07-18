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
import { useEffect } from 'react'

interface PageMetaOptions {
  title?: string
  description?: string
  image?: string
  type?: string
}

function setMetaTag(propertyOrName: string, content: string | undefined, attr = 'name') {
  if (!content) return
  let element = document.querySelector(`meta[${attr}="${propertyOrName}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, propertyOrName)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

function removeMetaTag(propertyOrName: string, attr = 'name') {
  const element = document.querySelector(`meta[${attr}="${propertyOrName}"]`)
  if (element) {
    element.remove()
  }
}

export function usePageMeta({ title, description, image, type = 'website' }: PageMetaOptions) {
  useEffect(() => {
    const previousTitle = document.title
    if (title) {
      document.title = title
    }

    if (description) {
      setMetaTag('description', description)
      setMetaTag('og:description', description, 'property')
    }
    if (title) {
      setMetaTag('og:title', title, 'property')
    }
    if (image) {
      setMetaTag('og:image', image, 'property')
    }
    setMetaTag('og:type', type, 'property')
    setMetaTag('twitter:card', 'summary_large_image')

    return () => {
      document.title = previousTitle
      removeMetaTag('description')
      removeMetaTag('og:description', 'property')
      removeMetaTag('og:title', 'property')
      removeMetaTag('og:image', 'property')
      removeMetaTag('og:type', 'property')
      removeMetaTag('twitter:card')
    }
  }, [title, description, image, type])
}
