import { Group, Rect, Text, Image as KonvaImage, Line } from 'react-konva';
import useImage from 'use-image';

export const CanvasBackground = ({ type, width, height, bgColor = "#ffffff" }: { type: string, width: number, height: number, bgColor?: string }) => {
  if (type === 'line') {
    const lines = [];
    for (let i = 0; i < height; i += 28) {
      lines.push(<Line key={i} points={[0, i, width, i]} stroke="#cccccc" strokeWidth={1} opacity={0.5} />);
    }
    return (
      <Group name="background-rect">
        <Rect width={width} height={height} fill={bgColor} name="background-rect" />
        {lines}
      </Group>
    );
  }

  if (type === 'dotted') {
    const dots = [];
    for (let y = 0; y < height; y += 15) {
      for (let x = 0; x < width; x += 15) {
        dots.push(<Rect key={`${x}-${y}`} x={x} y={y} width={2} height={2} fill="#000000" opacity={0.1} cornerRadius={1} />);
      }
    }
    return (
      <Group name="background-rect">
        <Rect width={width} height={height} fill={bgColor} name="background-rect" />
        {dots}
      </Group>
    );
  }
  
  return <Rect width={width} height={height} fill={bgColor} name="background-rect" />;
};

export const Polaroid = ({ url, name, x, y, rotation, scale, fallbackUrl }: { url: string, name: string, x: number, y: number, rotation: number, scale: number, fallbackUrl?: string }) => {
  const imageUrl = url || fallbackUrl || '';
  const isDataUrl = imageUrl.startsWith('data:') || imageUrl.startsWith('/');
  const [img] = useImage(imageUrl, isDataUrl ? undefined : 'anonymous');
  
  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale}>
      <Rect
        x={0} y={0}
        width={144} height={176}
        fill="white"
        shadowColor="black"
        shadowBlur={10}
        shadowOpacity={0.15}
        shadowOffsetX={0}
        shadowOffsetY={5}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <Rect x={8} y={8} width={128} height={128} fill="#e4e4e7" />
      {img && (
        <KonvaImage
          image={img}
          x={8} y={8} width={128} height={128}
          crop={
            // Crop to center
            {
              x: img.width > img.height ? (img.width - img.height) / 2 : 0,
              y: img.height > img.width ? (img.height - img.width) / 2 : 0,
              width: Math.min(img.width, img.height),
              height: Math.min(img.width, img.height)
            }
          }
        />
      )}
      <Text
        x={0} y={150} width={144}
        text={name}
        fontSize={10}
        fontFamily="sans-serif"
        fontStyle="bold"
        align="center"
        fill="black"
      />
    </Group>
  );
};
