import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button - shadcn/ui (new-york) primitive adapted for Mystic Premium.
 * Primary variant uses gold gradient; secondary uses subtle glass surface.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-[#d4af37] to-[#b8941f] text-black font-semibold shadow-[0_0_20px_rgba(212,175,55,0.15)] hover:shadow-[0_0_28px_rgba(212,175,55,0.25)]",
        secondary:
          "bg-white/5 ring-1 ring-white/10 text-white hover:bg-white/10",
        ghost: "text-white hover:bg-white/5",
        outline:
          "ring-1 ring-white/15 text-white hover:ring-white/25 hover:bg-white/5",
        danger:
          "bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white font-semibold",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 px-4 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
