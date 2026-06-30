import logoAsset from "@/assets/thai-logo.jpeg.asset.json";

type Props = {
  width?: number;
  height?: number;
  className?: string;
  containerClassName?: string;
};

export const BrandLogo = ({
  width = 96,
  height = 72,
  className = "",
  containerClassName = "",
}: Props) => (
  <div className={`flex items-center justify-center ${containerClassName}`}>
    <img
      src={logoAsset.url}
      alt="THAI"
      width={width}
      height={height}
      className={`rounded-xl object-contain shadow-soft-sm max-w-full h-auto ${className}`}
      style={{ width, height }}
    />
  </div>
);

export default BrandLogo;