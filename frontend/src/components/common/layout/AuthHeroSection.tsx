'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Slide {
  imageUrl: string;
  title: string;
  description: string;
}

interface AuthHeroSectionProps {
  slides: Slide[];
  autoPlayInterval?: number;
}

export default function AuthHeroSection({
  slides,
  autoPlayInterval = 5000,
}: AuthHeroSectionProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [slides.length, autoPlayInterval]);

  const currentSlide = slides[activeSlide] || slides[0];

  return (
    <div className="relative hidden h-full overflow-hidden rounded-l-[20px] lg:block lg:sticky lg:top-0 lg:h-screen">
      <div className="absolute inset-0 z-0">
        {slides.map((slide, index) => (
          <Image
            key={index}
            alt=""
            src={slide.imageUrl}
            fill
            className={`object-cover transition-opacity duration-1000 ${
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            }`}
            unoptimized
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#101010] z-10" />
      </div>

      <div className="absolute bottom-20 left-20 right-20 space-y-10 text-white z-20">
        <div className="space-y-3">
          <p className="text-[32px] font-medium leading-[1.2] text-white lg:text-[40px] transition-opacity duration-500">
            {currentSlide.title}
          </p>
          <p className="text-sm text-[var(--neutral-40)] transition-opacity duration-500">
            {currentSlide.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`size-2 rounded-full transition-all ${
                index === activeSlide ? 'bg-white w-8' : 'bg-[var(--neutral-70)]'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
