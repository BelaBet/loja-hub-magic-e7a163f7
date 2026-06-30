import logoAsset from "@/assets/thai-logo.jpeg.asset.json";

type Props = {
  width?: number;
  height?: number;
  className?: string;
  imgClassName?: string;
};

export const BrandLogo = ({
  width = 96,
  height = 72,
  className = "",
  imgClassName = "",
}: Props) => (
  <div className={`flex items-center justify-center ${className}`}>
    <img
      src={logoAsset.url}
      alt="THAI"
      width={width}
      height={height}
      className={`rounded-xl object-contain shadow-soft-sm max-w-full h-auto ${imgClassName}`}
      style={{ width, height }}
    />
  </div>
);

export default BrandLogo;