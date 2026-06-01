import logoAsset from "@/assets/ankor-logo.jpeg.asset.json";

type Props = {
  width?: number;
  height?: number;
  className?: string;
};

export const BrandLogo = ({ width = 96, height = 72, className = "" }: Props) => (
  <div className={`flex items-center justify-center ${className}`}>
    <img
      src={logoAsset.url}
      alt="Ankor Tech"
      width={width}
      height={height}
      className="rounded-xl object-contain shadow-soft-sm"
      style={{ width, height }}
    />
  </div>
);

export default BrandLogo;