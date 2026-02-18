"use client";

import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { EmblaOptionsType } from "embla-carousel";
import Autoplay from "embla-carousel-autoplay";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

type CarouselProps = {
  slides: React.ReactNode[];
  options?: EmblaOptionsType;
  className?: string;
  maxRotateX?: number;
  maxRotateY?: number;
  maxScale?: number;
  tweenFactorBase?: number;
  autoplay?: boolean;
  autoplayDelay?: number;
  showIndicators?: boolean;
  showArrows?: boolean;
};

const numberWithinRange = (number: number, min: number, max: number): number =>
  Math.min(Math.max(number, min), max);

export function Carousel3D({
  slides,
  options,
  className,
  maxRotateX = 45,
  maxRotateY = 15,
  maxScale = 0.9,
  tweenFactorBase = 0.7,
  autoplay = true,
  autoplayDelay = 5000,
  showIndicators = true,
  showArrows = true,
}: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    options,
    autoplay
      ? [Autoplay({ delay: autoplayDelay, stopOnInteraction: true })]
      : [],
  );
  const [tweenValues, setTweenValues] = useState<number[]>([]);
  const [prevBtnDisabled, setPrevBtnDisabled] = useState(true);
  const [nextBtnDisabled, setNextBtnDisabled] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const onScroll = useCallback(() => {
    if (!emblaApi) return;

    const scrollProgress = emblaApi.scrollProgress();
    const slidesInView = emblaApi.slidesInView();

    const styles = slidesInView.map((index) => {
      const slideProgress = emblaApi.scrollSnapList()[index] - scrollProgress;
      const tweenFactor = tweenFactorBase * emblaApi.scrollSnapList().length;
      return numberWithinRange(
        1 - Math.abs(slideProgress * tweenFactor),
        maxScale,
        1,
      );
    });
    setTweenValues(styles);
  }, [emblaApi, maxScale, tweenFactorBase]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setPrevBtnDisabled(!emblaApi.canScrollPrev());
    setNextBtnDisabled(!emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    onScroll();
    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());

    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", onScroll);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("reInit", onScroll);

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("scroll", onScroll);
    };
  }, [emblaApi, onScroll, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  return (
    <div className={cn("relative", className)}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {slides.map((slide, index) => {
            const tweenValue = tweenValues[index] ?? maxScale;
            const rotateY = (1 - tweenValue) * maxRotateY;
            const rotateX = (1 - tweenValue) * maxRotateX;
            const scale = tweenValue;

            return (
              <motion.div
                key={index}
                className="min-w-0 flex-[0_0_100%] pl-4"
                style={{
                  transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
                }}
                transition={{ duration: 0.3 }}
              >
                {slide}
              </motion.div>
            );
          })}
        </div>
      </div>

      {showArrows && (
        <>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute left-5 top-1/2 z-20 h-12 w-12 -translate-y-1/2 rounded-full bg-white/90 text-black transition-all hover:bg-white disabled:opacity-50",
              prevBtnDisabled && "cursor-not-allowed",
            )}
            onClick={scrollPrev}
            disabled={prevBtnDisabled}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "absolute right-5 top-1/2 z-20 h-12 w-12 -translate-y-1/2 rounded-full bg-white/90 text-black transition-all hover:bg-white disabled:opacity-50",
              nextBtnDisabled && "cursor-not-allowed",
            )}
            onClick={scrollNext}
            disabled={nextBtnDisabled}
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </>
      )}

      {showIndicators && scrollSnaps.length > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              className={cn(
                "h-2 w-2 rounded-full transition-all",
                index === selectedIndex
                  ? "w-8 bg-[var(--ui-foreground)]"
                  : "bg-[var(--ui-muted)] hover:bg-[var(--ui-foreground)]",
              )}
              onClick={() => scrollTo(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
