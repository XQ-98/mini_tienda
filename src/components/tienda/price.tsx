import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/domain/money";

interface Props {
  price: number;
  compareAtPrice?: number | null;
  className?: string;
}

export function Price({ price, compareAtPrice, className }: Props) {
  const onSale = compareAtPrice != null && compareAtPrice > price;
  return (
    <p className={cn("flex items-baseline gap-2", className)}>
      <span className={cn("font-semibold tabular-nums", onSale && "text-primary")}>{formatUSD(price)}</span>
      {onSale && (
        <s className="text-sm text-muted-foreground tabular-nums">
          <span className="sr-only">Antes </span>
          {formatUSD(compareAtPrice)}
        </s>
      )}
    </p>
  );
}
