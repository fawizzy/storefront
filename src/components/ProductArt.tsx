const PATTERNS = ["adire", "adire-alt", "adire-stripe"];

/** Product image, or an adire-pattern tile with the product name when no image is set. */
export function ProductArt({
  id,
  name,
  imageUrl,
  className = "",
}: {
  id: number;
  name: string;
  imageUrl: string | null;
  className?: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary merchant-supplied URLs
    return <img src={imageUrl} alt={name} className={`object-cover ${className}`} />;
  }
  return (
    <div
      role="img"
      aria-label={name}
      className={`${PATTERNS[id % PATTERNS.length]} flex items-end p-4 ${className}`}
    >
      <span className="rounded bg-indigo px-2 py-1 font-display text-lg leading-tight text-white">
        {name}
      </span>
    </div>
  );
}
