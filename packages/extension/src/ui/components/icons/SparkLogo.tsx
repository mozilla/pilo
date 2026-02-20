interface SparkLogoProps {
  className?: string;
}

export function SparkLogo({ className }: SparkLogoProps) {
  return (
    <svg
      viewBox="0 0 18.21 10.35"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Spark logo"
      role="img"
    >
      <path d="M6.33114 0H8.7334V1.0879C8.7334 2.9791 7.2836 4.5296 5.43471 4.6908H3.28396C3.08387 4.2426 2.99125 3.7818 2.99125 3.33355C2.99125 1.57613 4.40793 0 6.33114 0Z" />
      <path d="M18.2104 4.6908H12.7392C10.8903 4.5296 9.4405 2.9791 9.4405 1.0879V0H16.1214L18.2104 4.6908Z" />
      <path d="M8.7334 9.2738V10.3521H2.08905L0 5.6595H5.21169C7.16463 5.7087 8.7334 7.3083 8.7334 9.2738Z" />
      <path d="M15.2181 7.0168C15.2181 8.7742 13.8014 10.3521 11.8782 10.3521H9.4405V9.2738C9.4405 7.3083 11.0081 5.7087 12.9622 5.6595H14.9254C15.1255 6.1077 15.2181 6.5685 15.2181 7.0168Z" />
    </svg>
  );
}
