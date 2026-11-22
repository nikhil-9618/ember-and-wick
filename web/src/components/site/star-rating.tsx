export function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5 text-clay" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden className={star <= rounded ? "opacity-100" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}
