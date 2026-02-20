interface TabstackIconProps {
  className?: string;
}

export function TabstackIcon({ className }: TabstackIconProps) {
  return (
    <svg
      width="192"
      height="192"
      viewBox="0 0 192 192"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="26" y="69.2295" width="70.0195" height="27.2298" fill="currentColor" />
      <rect x="95.9805" y="96.4595" width="70.0195" height="27.2298" fill="currentColor" />
      <rect x="95.9805" y="42" width="70.0195" height="27.2298" fill="currentColor" />
      <rect x="26" y="123.689" width="70.0195" height="27.2298" fill="currentColor" />
    </svg>
  );
}
