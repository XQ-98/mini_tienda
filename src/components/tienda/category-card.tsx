import Image from "next/image";
import Link from "next/link";

interface Props {
  category: { name: string; slug: string; imageUrl: string | null; productCount: number };
}

export function CategoryCard({ category }: Props) {
  return (
    <Link
      href={`/categoria/${category.slug}`}
      className="group relative block overflow-hidden rounded-xl bg-muted"
    >
      <div className="relative aspect-square">
        {category.imageUrl && (
          <Image
            src={category.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="font-heading text-base leading-tight font-semibold sm:text-lg">{category.name}</p>
        <p className="text-xs text-white/80">
          {category.productCount} {category.productCount === 1 ? "producto" : "productos"}
        </p>
      </div>
    </Link>
  );
}
