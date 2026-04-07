"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ThemeBlockType } from "./schema";
import type { BlockComponentProps } from "./types";

type BlockComponent = ComponentType<BlockComponentProps>;
type BlockRegistry = Partial<Record<ThemeBlockType, BlockComponent>>;

const defaultBlockRegistry: BlockRegistry = {
  text: dynamic<BlockComponentProps>(() => import("./blocks/TextBlock")),
  button: dynamic<BlockComponentProps>(() => import("./blocks/ButtonBlock")),
  image: dynamic<BlockComponentProps>(() => import("./blocks/ImageBlock")),
  icon: dynamic<BlockComponentProps>(() => import("./blocks/IconBlock")),
  video: dynamic<BlockComponentProps>(() => import("./blocks/VideoBlock")),
  audio: dynamic<BlockComponentProps>(() => import("./blocks/AudioBlock")),
};

const themeBlockOverrides: Record<string, BlockRegistry> = {
  default: {},
};

export function getBlockComponent(themeId: string | undefined, blockType: ThemeBlockType): BlockComponent | null {
  const themeRegistry = themeId ? themeBlockOverrides[themeId] : undefined;
  return themeRegistry?.[blockType] ?? defaultBlockRegistry[blockType] ?? null;
}