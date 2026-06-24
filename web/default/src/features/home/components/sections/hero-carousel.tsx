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
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'

import { Hero } from './hero'
import { HermesAgent } from './hermes-agent'

interface HeroCarouselProps {
  isAuthenticated?: boolean
}

export function HeroCarousel(props: HeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const firstScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!api) return

    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap())
    }

    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api])

  useLayoutEffect(() => {
    if (!api) return

    const INTERVAL = 2000
    const MIN_FIRST_DELAY = 300

    const startAutoplay = () => {
      if (autoplayRef.current || firstScrollTimeoutRef.current) return

      const elapsed = Date.now() - resumeTimeRef.current
      const remaining = Math.max(MIN_FIRST_DELAY, INTERVAL - elapsed)

      firstScrollTimeoutRef.current = setTimeout(() => {
        api.scrollNext()
        firstScrollTimeoutRef.current = null
        autoplayRef.current = setInterval(() => {
          api.scrollNext()
        }, INTERVAL)
      }, remaining)
    }

    const stopAutoplay = () => {
      if (firstScrollTimeoutRef.current) {
        clearTimeout(firstScrollTimeoutRef.current)
        firstScrollTimeoutRef.current = null
      }
      if (autoplayRef.current) {
        clearInterval(autoplayRef.current)
        autoplayRef.current = null
      }
    }

    // The first scroll should feel like it happens ~INTERVAL after the page
    // becomes visible, not after Embla finishes initialising. Compensate for the
    // time already spent rendering and initialising the carousel so the first
    // auto-switch is not perceived as delayed.
    resumeTimeRef.current = Date.now()
    startAutoplay()

    const container = api.rootNode()
    const handleMouseEnter = () => stopAutoplay()
    const handleMouseLeave = () => {
      resumeTimeRef.current = Date.now()
      startAutoplay()
    }
    container?.addEventListener('mouseenter', handleMouseEnter)
    container?.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      stopAutoplay()
      container?.removeEventListener('mouseenter', handleMouseEnter)
      container?.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [api])

  return (
    <section className='relative z-10 overflow-hidden'>
      <Carousel
        opts={{
          align: 'start',
          loop: true,
        }}
        setApi={setApi}
      >
        <CarouselContent className='-ml-0'>
          <CarouselItem className='pl-0'>
            <Hero isAuthenticated={props.isAuthenticated} />
          </CarouselItem>
          <CarouselItem className='pl-0'>
            <HermesAgent />
          </CarouselItem>
        </CarouselContent>
      </Carousel>

      <div className='pointer-events-none absolute right-0 bottom-6 left-0 z-20 flex items-center justify-center gap-2'>
        {Array.from({ length: count }).map((_, index) => (
          <button
            key={index}
            type='button'
            onClick={() => api?.scrollTo(index)}
            className={`pointer-events-auto size-2 rounded-full transition-all duration-300 ${
              index === current
                ? 'bg-foreground w-6'
                : 'bg-foreground/30 hover:bg-foreground/50'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
