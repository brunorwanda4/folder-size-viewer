import * as React from "react"
import { DayPicker } from "react-day-picker"
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("p-2 relative select-none", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-3",
        month_caption: "flex justify-center pt-0 relative items-center h-8",
        caption_label: "text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 hover:bg-muted border border-border/40 text-foreground cursor-pointer transition-colors",
        dropdowns: "flex justify-center items-center gap-2",
        dropdown_root: "relative inline-flex items-center",
        dropdown: "absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20",
        nav: "flex items-center justify-between absolute inset-x-0 top-0 h-8 pointer-events-none z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-background/90 hover:bg-accent p-0 opacity-80 hover:opacity-100 pointer-events-auto shadow-xs border text-foreground"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-background/90 hover:bg-accent p-0 opacity-80 hover:opacity-100 pointer-events-auto shadow-xs border text-foreground"
        ),
        month_grid: "w-full border-collapse space-y-1 mt-2",
        weekdays: "flex justify-between",
        weekday:
          "text-muted-foreground rounded-md w-8 font-normal text-[0.75rem] text-center",
        week: "flex w-full mt-1 justify-between",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal aria-selected:opacity-100 text-xs"
        ),
        range_start: "day-range-start rounded-l-md bg-primary text-primary-foreground",
        range_end: "day-range-end rounded-r-md bg-primary text-primary-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md font-medium",
        today: "border border-primary/50 text-foreground font-bold",
        outside:
          "day-outside text-muted-foreground/40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-25 pointer-events-none cursor-not-allowed select-none",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground rounded-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className, ...chevronProps }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...chevronProps} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("h-4 w-4", className)} {...chevronProps} />;
          }
          if (orientation === "up") {
            return <ChevronUp className={cn("h-3.5 w-3.5", className)} {...chevronProps} />;
          }
          return <ChevronDown className={cn("h-3.5 w-3.5 ml-0.5 opacity-70", className)} {...chevronProps} />;
        },
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
