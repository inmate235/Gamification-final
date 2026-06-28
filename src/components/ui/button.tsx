import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button - shadcn/ui (new-york) primitive adapted for the playful MurkyCorps theme.
 * Primary variant uses magenta with 3D press shadow; secondary uses light surface.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e6009e]/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[#e6009e] text-white font-semibold shadow-[0_6px_0_#b8007e] hover:bg-[#f30aac] active:translate-y-[3px] active:shadow-[0_3px_0_#b8007e]",
        secondary:
          "bg-[#f4f4f5] ring-1 ring-[#141414]/10 text-[#141414] hover:bg-[#e4e4e7]",
        ghost: "text-[#4b4b4b] hover:bg-[#141414]/5",
        outline:
          "ring-1 ring-[#141414]/15 text-[#141414] hover:ring-[#141414]/25 hover:bg-[#141414]/5",
        danger:
          "bg-[#ef4444] text-white font-semibold shadow-[0_6px_0_#dc2626] active:translate-y-[3px] active:shadow-[0_3px_0_#dc2626]",
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
