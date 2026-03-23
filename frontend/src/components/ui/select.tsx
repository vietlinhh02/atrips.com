"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, CaretDown } from "@phosphor-icons/react/dist/ssr";
import * as React from "react";
import { forwardRef } from "react";
import { cn } from "@/src/lib/utils";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between gap-2 rounded-[10px] border border-[var(--neutral-30)] bg-[var(--neutral-10)] px-3 py-2.5 text-sm text-[var(--neutral-100)] placeholder:text-[var(--neutral-60)] focus-visible:border-[var(--neutral-30)] focus-visible:outline-none",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <CaretDown size={16} className="text-[var(--neutral-60)]" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-[10px] border border-[var(--neutral-30)] bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)]",
        // Added w-full to match trigger width when needed, or use specific width in implementation
        // position === "popper" && "w-[var(--radix-select-trigger-width)]", 
        // Radix Select provides --radix-select-trigger-width custom property
        position === "popper" && "data-[side=bottom]:translate-y-1 w-[var(--radix-select-trigger-width)]",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-[8px] py-2 pl-8 pr-3 text-sm text-[var(--neutral-100)] outline-none focus:bg-[var(--neutral-10)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check size={14} className="text-[var(--primary-main)]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectItem };
