export interface GuestData {
  fullName: string;
  nickname: string;
  className: string;
  schoolName: string;
  avatarUrl: string | null;
  longText?: string;
  longTextMeta?: {
    font: string;
    size: number;
    color: string;
    align: 'left' | 'center' | 'right';
  };
}

export type Tool = 'pen' | 'text' | 'select' | 'eraser' | 'eraser-object';
export type LayoutBackground = 'blank' | 'dotted' | 'line';

export interface TextNode {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
}

export interface LineNode {
  id: string;
  points: number[];
  color: string;
  thickness: number;
  isEraser?: boolean;
}

export interface ImageNode {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface GuestbookEntry extends GuestData {
  id: string;
  canvasImage: string;
  audioUrl?: string | null;
  lines: LineNode[];
  texts: TextNode[];
  images: ImageNode[];
  createdAt: any;
}
