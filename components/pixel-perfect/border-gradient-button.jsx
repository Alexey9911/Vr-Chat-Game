import { Button } from "@/components/ui/button";

const BorderGradientButton = ({ className, children, ...props }) => {
  return (
    <Button
      className={`relative rounded-md animate-rainbow bg-[linear-gradient(45deg,var(--color-1),var(--color-5),var(--color-3),var(--color-4),var(--color-2))] bg-[length:200%] active:scale-[0.95] group ${className || ""}`}
      {...props}
    >
      <div
        className="z-0 absolute inset-[2px] bg-background/95 group-hover:bg-background/40  backdrop-blur-3xl rounded-[calc(0.375rem-2px)] transition-all saturate-200" />
      <span className="z-10 text-foreground pointer-events-none flex items-center gap-2">
        {children}
      </span>
    </Button>
  );
};

export { BorderGradientButton };
