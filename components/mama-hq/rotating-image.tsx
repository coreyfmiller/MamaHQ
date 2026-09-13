'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const images = [
  {
    src: '/images/hero-white-family.png',
    alt: 'A white mother and father holding their newborn baby together in morning light',
  },
  {
    src: '/images/hero-black-mother.png',
    alt: 'A Black mother holding her newborn baby close to her cheek in morning light',
  },
  {
    src: '/images/hero-latina-mother.png',
    alt: 'A Latina mother smiling down at her newborn baby in soft window light',
  },
  {
    src: '/images/hero-asian-family.png',
    alt: 'An East Asian mother and father cradling their newborn together on a bed',
  },
  {
    src: '/images/hero-southasian-family.png',
    alt: 'A South Asian mother and toddler gently touching their newborn baby',
  },
  {
    src: '/images/hero-mother-baby.png',
    alt: 'A mother holding her newborn baby near a window in soft morning light',
  },
]

export function RotatingImage() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length)
    }, 3500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[2.75rem] border border-border/60 shadow-[0_40px_80px_-30px_rgba(80,55,40,0.55)]">
      {images.map((img, i) => (
        <Image
          key={img.src}
          src={img.src || '/placeholder.svg'}
          alt={img.alt}
          fill
          priority={i === 0}
          sizes="(max-width: 1024px) 100vw, 40vw"
          className={`object-cover transition-opacity duration-1000 ease-in-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
        {images.map((img, i) => (
          <span
            key={img.src}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === index ? 'w-5 bg-card' : 'w-1.5 bg-card/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
