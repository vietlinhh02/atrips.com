import React from "react";
import Image from "next/image";
import { CalendarBlank, CurrencyCircleDollar } from "@phosphor-icons/react";
import { Button } from "@/src/components/ui/button";

interface DestinationCardProps {
  image?: string;
  title?: string;
  description?: string;
  priceRange?: string;
  dateRange?: string;
  onAction?: () => void;
}

export default function DestinationCard({
  image = "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=2073&auto=format&fit=crop", // Paris placeholder
  title = "Paris - France",
  description = "Perfect for a romantic long weekend gateaway in Paris France.",
  priceRange = "$1,000 - $1,500",
  dateRange = "Mar - Jun",
  onAction,
}: DestinationCardProps) {
  return (
    <div className="flex flex-col items-start w-full max-w-[270px] h-[302px] rounded-[10px] overflow-hidden bg-white dark:bg-[var(--neutral-20)]">
      {/* Image Section */}
      <div className="w-full h-[160px] relative border border-[var(--neutral-30,#ededed)] border-b-0 rounded-t-[10px] overflow-hidden">
        <Image
          alt={title}
          src={image}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Content Section */}
      <div className="w-full px-[12px] py-[8px] border border-[var(--neutral-30,#ededed)] rounded-b-[10px] bg-white dark:bg-[var(--neutral-20)] flex flex-col gap-[16px]">
        <div className="flex flex-col gap-[12px] w-full">
          {/* Text Content */}
          <div className="flex flex-col gap-[4px] w-full text-[var(--neutral-70,#606060)]">
            <h3 className="text-[18px] font-medium leading-[1.2] font-sans text-[var(--neutral-100)]">
              {title}
            </h3>
            <p className="text-[12px] leading-[1.5] font-normal line-clamp-2">
              {description}
            </p>
          </div>

          {/* Details (Price & Date) */}
          <div className="flex flex-row items-center gap-[8px] w-full text-[12px] text-[var(--neutral-70,#606060)]">
            {/* Price */}
            <div className="flex items-center gap-1">
              <CurrencyCircleDollar className="w-4 h-4 text-[var(--neutral-70,#606060)]" />
              <span className="leading-[1.5]">{priceRange}</span>
            </div>

            {/* Divider */}
            <div className="w-px h-3 bg-[var(--neutral-30,#ededed)] mx-1" />

            {/* Date */}
            <div className="flex items-center gap-1">
              <CalendarBlank className="w-4 h-4 text-[var(--neutral-70,#606060)]" />
              <span className="leading-[1.5]">{dateRange}</span>
            </div>
          </div>
        </div>

        {/* Button CTA */}
        <Button
          className="w-full bg-[var(--primary-main,#073E71)] hover:bg-[var(--primary-hover,#001A32)] text-white font-medium text-[12px] h-auto py-[8px] rounded-[10px] shadow-[6px_6px_32px_0px_rgba(0,0,0,0.06)]"
          onClick={onAction}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}
