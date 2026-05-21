import { UI } from "../lib/uiAssets";

type Props = {
  className?: string;
  /** Header bar — shorter logo */
  variant?: "header" | "hero";
};

export function BrandMark({ className = "", variant = "hero" }: Props) {
  const h = variant === "header" ? "h-9 sm:h-10" : "h-14 sm:h-16";
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={UI.logo}
        alt="MushkilPay"
        className={`${h} w-auto max-w-[200px] sm:max-w-[240px] object-contain object-left`}
        draggable={false}
      />
    </div>
  );
}
