import { Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { ImageNode } from '../types';

export default function URLImage({
  imageInfo,
  isSelected,
  onSelect,
  onChange,
}: {
  imageInfo: ImageNode;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newProps: ImageNode) => void;
}) {
  const isDataUrl = imageInfo.url.startsWith('data:') || imageInfo.url.startsWith('/');
  const [img] = useImage(imageInfo.url, isDataUrl ? undefined : 'anonymous');
  return (
    <KonvaImage
      image={img}
      x={imageInfo.x}
      y={imageInfo.y}
      width={imageInfo.width}
      height={imageInfo.height}
      rotation={imageInfo.rotation}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => {
        onChange({
          ...imageInfo,
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      stroke={isSelected ? '#8ace00' : undefined}
      strokeWidth={isSelected ? 4 : 0}
    />
  );
}
