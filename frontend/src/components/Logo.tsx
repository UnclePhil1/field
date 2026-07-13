export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={['inline-block object-contain', className].join(' ')}
      style={{ height: size, width: size }}
    />
  );
}
