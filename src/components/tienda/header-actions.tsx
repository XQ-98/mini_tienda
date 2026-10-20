import Link from "next/link";
import { ShoppingBagIcon, UserIcon } from "lucide-react";

import { getSessionUser } from "@/server/auth/guards";
import { getCurrentCartCount } from "@/server/queries/cart";

const iconLink =
  "relative flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted";

/** Íconos de cuenta y carrito. Leen la sesión y la cookie: van dentro de <Suspense>. */
export async function HeaderActions() {
  const [user, count] = await Promise.all([getSessionUser(), getCurrentCartCount()]);
  return <HeaderActionsView signedIn={!!user} count={count} />;
}

export function HeaderActionsView({ signedIn, count }: { signedIn: boolean; count: number }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={signedIn ? "/cuenta" : "/ingresar"} className={iconLink} aria-label={signedIn ? "Mi cuenta" : "Ingresar"}>
        <UserIcon className="size-5" />
      </Link>
      <Link href="/carrito" className={iconLink} aria-label={`Carrito, ${count} ${count === 1 ? "producto" : "productos"}`}>
        <ShoppingBagIcon className="size-5" />
        {count > 0 && (
          <span
            data-testid="cart-count"
            className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground tabular-nums"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </div>
  );
}
